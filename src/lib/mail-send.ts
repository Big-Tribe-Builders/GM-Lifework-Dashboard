import { getSupabase } from '@/lib/supabase';
import { sendEmail, cancelEmail, resendReady, SCHEDULE_WINDOW_DAYS } from '@/lib/resend';
import { render, laterStatus, type MailCampaign, type MailTemplate, type MailSender, type MailStep, type MailSend, type SendStatus, type Recipient } from '@/lib/mail';
import type { CrmEmail } from '@/lib/crm';

/**
 * Handing emails to Resend.
 *
 * Shared by the server actions (buttons in the Campaigns tab) and the daily
 * tick (/api/mail/tick). Everything here reads the tables directly, not the
 * views, because it writes back.
 *
 * The rules that keep us out of spam folders live here as code:
 *   - nobody on the suppression list is ever written to;
 *   - every email carries List-Unsubscribe + one-click POST headers and a
 *     footer with the sender's postal address and an unsubscribe link;
 *   - a plain-text part always goes with the HTML;
 *   - one Idempotency-Key per send row, so a retry never doubles an email.
 */

type Db = NonNullable<ReturnType<typeof getSupabase>>;

const day = 86_400_000;

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-|-$/g, '');

type Loaded = { error: string } | { campaign: MailCampaign; sender: MailSender | null; template: MailTemplate | null; steps: MailStep[] };

async function loadCampaign(db: Db, id: string): Promise<Loaded> {
  const { data: c, error } = await db.from('mail_campaigns').select('*').eq('id', id).maybeSingle();
  if (error) return { error: error.message };
  if (!c) return { error: 'Campaign not found.' };
  const campaign: MailCampaign = {
    id: c.id, name: c.name, venture: c.venture, kind: c.kind, listId: c.list_id, templateId: c.template_id, senderId: c.sender_id,
    status: c.status, sendAt: c.send_at, quote: c.quote, notes: c.notes, createdAt: c.created_at, updatedAt: c.updated_at,
  };
  const [{ data: s }, { data: t }, { data: steps }] = await Promise.all([
    campaign.senderId ? db.from('mail_senders').select('*').eq('id', campaign.senderId).maybeSingle() : Promise.resolve({ data: null }),
    campaign.templateId ? db.from('mail_templates').select('*').eq('id', campaign.templateId).maybeSingle() : Promise.resolve({ data: null }),
    db.from('mail_sequence_steps').select('*').eq('campaign_id', id).order('step'),
  ]);
  const sender: MailSender | null = s ? { id: s.id, venture: s.venture, fromName: s.from_name, fromEmail: s.from_email, replyTo: s.reply_to, address: s.address } : null;
  const template = t ? toTemplate(t) : null;
  const stepRows: MailStep[] = (steps ?? []).map((x) => ({ id: x.id, campaignId: x.campaign_id, step: x.step, dayOffset: x.day_offset, templateId: x.template_id }));
  return { campaign, sender, template, steps: stepRows };
}

const toTemplate = (t: Record<string, unknown>): MailTemplate => ({
  id: String(t.id), name: String(t.name), venture: String(t.venture), subject: String(t.subject ?? ''), preheader: (t.preheader as string | null) ?? null,
  body: String(t.body ?? ''), style: (t.style as MailTemplate['style']) ?? 'plain', updatedAt: String(t.updated_at ?? ''),
});

async function members(db: Db, listId: string | null): Promise<CrmEmail[]> {
  if (!listId) return [];
  const { data: m } = await db.from('mail_list_members').select('email').eq('list_id', listId);
  const emails = (m ?? []).map((x) => x.email as string);
  if (!emails.length) return [];
  const { data: rows } = await db.from('crm_emails').select('*').in('email', emails);
  return (rows ?? []).map((r) => ({
    email: r.email, firstName: r.first_name, lastName: r.last_name, city: r.city, state: r.state, source: r.source,
    isClient: r.is_client, inCommunity: r.in_community, notes: r.notes, createdAt: r.created_at, updatedAt: r.updated_at,
  }));
}

async function suppressed(db: Db): Promise<Set<string>> {
  const { data } = await db.from('mail_suppressions').select('email');
  return new Set((data ?? []).map((x) => (x.email as string).toLowerCase()));
}

const token = () => crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');

/**
 * Creates the send rows: one per person on the list (× one per step for a
 * sequence). Rows that exist are kept, so this can run again after people
 * were added to the list. Suppressed addresses are never created.
 */
export async function prepare(campaignId: string): Promise<{ error: string | null; created: number; skipped: number }> {
  const db = getSupabase();
  if (!db) return { error: 'Supabase is not configured.', created: 0, skipped: 0 };
  const loaded = await loadCampaign(db, campaignId);
  if ('error' in loaded) return { error: loaded.error, created: 0, skipped: 0 };
  const { campaign, steps } = loaded;
  if (!campaign.listId) return { error: 'Pick a list first.', created: 0, skipped: 0 };
  if (campaign.kind === 'sequence' && !steps.length) return { error: 'Add at least one step first.', created: 0, skipped: 0 };

  const [people, stop, { data: existing }] = await Promise.all([
    members(db, campaign.listId), suppressed(db),
    db.from('mail_sends').select('email, step_id').eq('campaign_id', campaignId),
  ]);
  const have = new Set((existing ?? []).map((x) => `${x.step_id ?? ''}|${(x.email as string).toLowerCase()}`));
  const start = campaign.sendAt ? new Date(campaign.sendAt).getTime() : Date.now();
  const slots: { stepId: string | null; at: string | null }[] = campaign.kind === 'sequence'
    ? steps.map((s) => ({ stepId: s.id, at: new Date(start + s.dayOffset * day).toISOString() }))
    : [{ stepId: null, at: campaign.sendAt }];

  const rows: Record<string, unknown>[] = [];
  let skipped = 0;
  for (const p of people) {
    if (stop.has(p.email.toLowerCase())) { skipped++; continue; }
    for (const slot of slots) {
      if (have.has(`${slot.stepId ?? ''}|${p.email.toLowerCase()}`)) continue;
      rows.push({ campaign_id: campaignId, step_id: slot.stepId, email: p.email, scheduled_for: slot.at, unsubscribe_token: token() });
    }
  }
  if (rows.length) {
    const { error } = await db.from('mail_sends').insert(rows);
    if (error) return { error: error.message, created: 0, skipped };
  }
  return { error: null, created: rows.length, skipped };
}

function recipientOf(p: CrmEmail | undefined, send: MailSend): Recipient {
  return { email: send.email, firstName: p?.firstName, lastName: p?.lastName, city: p?.city, personal: send.personalLine };
}

function headersFor(url: string, sender: MailSender) {
  return {
    'List-Unsubscribe': `<${url}>, <mailto:${sender.replyTo ?? sender.fromEmail}?subject=unsubscribe>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  };
}

/**
 * Hands up to `limit` planned emails to Resend. Only those due within the
 * window Resend accepts (now + 30 days) go; the rest wait for the next call
 * or the daily tick. Returns how many went and how many still wait.
 */
export async function handOver(campaignId: string, origin: string, limit = 20): Promise<{ error: string | null; handed: number; remaining: number; failed: number }> {
  const none = { handed: 0, remaining: 0, failed: 0 };
  const ready = resendReady();
  if (!ready.ok) return { error: `Nothing sent: ${ready.missing} is not set in Vercel.`, ...none };
  const db = getSupabase();
  if (!db) return { error: 'Supabase is not configured.', ...none };
  const loaded = await loadCampaign(db, campaignId);
  if ('error' in loaded) return { error: loaded.error, ...none };
  const { campaign, sender, template, steps } = loaded;
  if (!sender) return { error: 'Pick a sender first.', ...none };
  if (campaign.kind === 'broadcast' && !template) return { error: 'Pick a template first.', ...none };
  if (campaign.status === 'paused') return { error: 'The campaign is paused.', ...none };

  const templates = new Map<string, MailTemplate>();
  if (template) templates.set(template.id, template);
  const stepTemplateIds = steps.map((s) => s.templateId).filter((x): x is string => !!x && !templates.has(x));
  if (stepTemplateIds.length) {
    const { data } = await db.from('mail_templates').select('*').in('id', stepTemplateIds);
    for (const t of data ?? []) templates.set(t.id, toTemplate(t));
  }
  const stepById = new Map(steps.map((s) => [s.id, s]));

  const horizon = new Date(Date.now() + SCHEDULE_WINDOW_DAYS * day).toISOString();
  const [{ data: due, error: qErr }, { count: remainingAll }, people, stop] = await Promise.all([
    db.from('mail_sends').select('*').eq('campaign_id', campaignId).eq('status', 'planned')
      .or(`scheduled_for.is.null,scheduled_for.lte.${horizon}`).order('scheduled_for', { ascending: true, nullsFirst: true }).limit(limit),
    db.from('mail_sends').select('*', { count: 'exact', head: true }).eq('campaign_id', campaignId).eq('status', 'planned'),
    members(db, campaign.listId), suppressed(db),
  ]);
  if (qErr) return { error: qErr.message, ...none };
  const person = new Map(people.map((p) => [p.email.toLowerCase(), p]));

  let handed = 0; let failed = 0;
  for (const row of due ?? []) {
    const send: MailSend = {
      id: row.id, campaignId: row.campaign_id, stepId: row.step_id, email: row.email, personalLine: row.personal_line, status: row.status,
      resendId: row.resend_id, scheduledFor: row.scheduled_for, sentAt: row.sent_at, error: row.error,
    };
    if (stop.has(send.email.toLowerCase())) {
      await db.from('mail_sends').update({ status: 'skipped', error: 'On the suppression list', updated_at: new Date().toISOString() }).eq('id', send.id);
      continue;
    }
    const t = send.stepId ? templates.get(stepById.get(send.stepId)?.templateId ?? '') : template;
    if (!t) {
      await db.from('mail_sends').update({ status: 'failed', error: 'Step has no template', updated_at: new Date().toISOString() }).eq('id', send.id);
      failed++; continue;
    }
    const url = `${origin}/api/mail/unsubscribe?t=${row.unsubscribe_token}`;
    const r = render({
      subject: t.subject, preheader: t.preheader, body: t.body, style: t.style,
      recipient: recipientOf(person.get(send.email.toLowerCase()), send), quote: campaign.quote,
      sender: { fromName: sender.fromName, address: sender.address }, unsubscribeUrl: url,
    });
    const future = send.scheduledFor && new Date(send.scheduledFor).getTime() > Date.now() + 60_000;
    const out = await sendEmail({
      from: `${sender.fromName} <${sender.fromEmail}>`, to: send.email, subject: r.subject, html: r.html, text: r.text,
      replyTo: sender.replyTo, headers: headersFor(url, sender),
      tags: [{ name: 'campaign', value: slug(campaign.id) }, { name: 'venture', value: slug(campaign.venture) }],
      scheduledAt: future ? send.scheduledFor : null, idempotencyKey: `send-${send.id}`,
    });
    if ('error' in out) {
      failed++;
      await db.from('mail_sends').update({ status: 'failed', error: out.error, updated_at: new Date().toISOString() }).eq('id', send.id);
      // A rejected key or a dead API: stop the run, the error says why.
      if (/not set|401|403|validation/i.test(out.error)) {
        return { error: out.error, handed, remaining: (remainingAll ?? 0) - handed - failed, failed };
      }
      continue;
    }
    handed++;
    await db.from('mail_sends').update({
      status: 'queued', resend_id: out.id, error: null, sent_at: future ? null : new Date().toISOString(), updated_at: new Date().toISOString(),
    }).eq('id', send.id);
  }

  const remaining = Math.max(0, (remainingAll ?? 0) - handed - failed);
  const { count: pendingLater } = await db.from('mail_sends').select('*', { count: 'exact', head: true })
    .eq('campaign_id', campaignId).in('status', ['planned', 'queued']).gt('scheduled_for', new Date().toISOString());
  const status = remaining > 0 ? 'sending' : (pendingLater ?? 0) > 0 ? 'scheduled' : 'sent';
  await db.from('mail_campaigns').update({ status, updated_at: new Date().toISOString() }).eq('id', campaignId);
  return { error: null, handed, remaining, failed };
}

/** One email, to one address, now — to see it in a real inbox. Not recorded as a send. */
export async function sendTest(campaignId: string, to: string, origin: string, stepId?: string | null): Promise<{ error: string | null }> {
  const ready = resendReady();
  if (!ready.ok) return { error: `Nothing sent: ${ready.missing} is not set in Vercel.` };
  const db = getSupabase();
  if (!db) return { error: 'Supabase is not configured.' };
  const loaded = await loadCampaign(db, campaignId);
  if ('error' in loaded) return { error: loaded.error };
  const { campaign, sender, steps } = loaded;
  let { template } = loaded;
  if (!sender) return { error: 'Pick a sender first.' };
  if (stepId) {
    const s = steps.find((x) => x.id === stepId);
    if (s?.templateId) {
      const { data } = await db.from('mail_templates').select('*').eq('id', s.templateId).maybeSingle();
      template = data ? toTemplate(data) : null;
    }
  }
  if (!template) return { error: 'Pick a template first.' };
  const { data: me } = await db.from('crm_emails').select('*').eq('email', to).maybeSingle();
  const url = `${origin}/api/mail/unsubscribe?t=test`;
  const r = render({
    subject: template.subject, preheader: template.preheader, body: template.body, style: template.style,
    recipient: { email: to, firstName: me?.first_name ?? 'Giulia', lastName: me?.last_name, city: me?.city, personal: '(the personal line for this person goes here)' },
    quote: campaign.quote, sender: { fromName: sender.fromName, address: sender.address }, unsubscribeUrl: url,
  });
  const out = await sendEmail({
    from: `${sender.fromName} <${sender.fromEmail}>`, to, subject: `[Test] ${r.subject}`, html: r.html, text: r.text,
    replyTo: sender.replyTo, headers: headersFor(url, sender), tags: [{ name: 'campaign', value: 'test' }],
    idempotencyKey: `test-${campaignId}-${Date.now()}`,
  });
  return { error: 'error' in out ? out.error : null };
}

/** Takes back everything handed to Resend that has not gone yet. */
export async function cancelScheduled(campaignId: string): Promise<{ error: string | null; cancelled: number }> {
  const db = getSupabase();
  if (!db) return { error: 'Supabase is not configured.', cancelled: 0 };
  const { data } = await db.from('mail_sends').select('id, resend_id').eq('campaign_id', campaignId).eq('status', 'queued')
    .gt('scheduled_for', new Date().toISOString());
  let cancelled = 0;
  for (const s of data ?? []) {
    if (!s.resend_id) continue;
    const r = await cancelEmail(s.resend_id);
    if (r.error) continue;
    cancelled++;
    await db.from('mail_sends').update({ status: 'planned', resend_id: null, sent_at: null, updated_at: new Date().toISOString() }).eq('id', s.id);
  }
  await db.from('mail_campaigns').update({ status: 'paused', updated_at: new Date().toISOString() }).eq('id', campaignId);
  return { error: null, cancelled };
}

/** The daily tick: every live campaign gets its due emails handed over. */
export async function tickAll(origin: string): Promise<{ campaigns: number; handed: number; errors: string[] }> {
  const db = getSupabase();
  if (!db) return { campaigns: 0, handed: 0, errors: ['Supabase is not configured.'] };
  const { data } = await db.from('mail_campaigns').select('id').in('status', ['scheduled', 'sending']);
  let handed = 0; const errors: string[] = [];
  for (const c of data ?? []) {
    const r = await handOver(c.id, origin, 100);
    handed += r.handed;
    if (r.error) errors.push(`${c.id}: ${r.error}`);
  }
  return { campaigns: (data ?? []).length, handed, errors };
}

/** A webhook event moves one send forward and, for bounces and complaints, suppresses the address. */
export async function applyEvent(type: string, resendId: string | null, email: string | null, payload: unknown): Promise<void> {
  const db = getSupabase();
  if (!db) return;
  await db.from('mail_events').insert({ resend_id: resendId, type, email, payload });
  const map: Record<string, SendStatus> = {
    'email.sent': 'sent', 'email.delivered': 'delivered', 'email.opened': 'opened', 'email.clicked': 'clicked',
    'email.bounced': 'bounced', 'email.complained': 'complained', 'email.failed': 'failed',
  };
  const next = map[type];
  if (!next || !resendId) return;
  const { data: send } = await db.from('mail_sends').select('id, status, email').eq('resend_id', resendId).maybeSingle();
  if (send) {
    const status = laterStatus(send.status as SendStatus, next);
    const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
    if (next === 'sent') patch.sent_at = new Date().toISOString();
    await db.from('mail_sends').update(patch).eq('id', send.id);
  }
  const addr = (send?.email ?? email)?.toLowerCase();
  if (addr && (next === 'bounced' || next === 'complained')) {
    await db.from('mail_suppressions').upsert({ email: addr, reason: next, note: `Resend ${type}` }, { onConflict: 'email' });
    await db.from('mail_sends').update({ status: 'skipped', error: `Address ${next}`, updated_at: new Date().toISOString() }).eq('email', addr).eq('status', 'planned');
  }
}

/** Unsubscribe by token: suppress the address and skip everything still planned for it. */
export async function unsubscribeByToken(t: string): Promise<{ email: string | null }> {
  const db = getSupabase();
  if (!db) return { email: null };
  const { data: send } = await db.from('mail_sends').select('email').eq('unsubscribe_token', t).maybeSingle();
  if (!send) return { email: null };
  const email = (send.email as string).toLowerCase();
  await db.from('mail_suppressions').upsert({ email, reason: 'unsubscribed', note: 'Clicked unsubscribe' }, { onConflict: 'email' });
  await db.from('mail_sends').update({ status: 'skipped', error: 'Unsubscribed', updated_at: new Date().toISOString() }).eq('email', email).eq('status', 'planned');
  const { data: queued } = await db.from('mail_sends').select('id, resend_id').eq('email', email).eq('status', 'queued').gt('scheduled_for', new Date().toISOString());
  for (const q of queued ?? []) {
    if (q.resend_id) await cancelEmail(q.resend_id);
    await db.from('mail_sends').update({ status: 'skipped', resend_id: null, error: 'Unsubscribed', updated_at: new Date().toISOString() }).eq('id', q.id);
  }
  return { email };
}
