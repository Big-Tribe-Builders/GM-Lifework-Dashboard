'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { getSupabase } from '@/lib/supabase';
import { VENTURES, EMAIL_RE, brusselsToIso } from '@/lib/mail';
import { prepare, handOver, sendTest as sendTestMail, cancelScheduled as cancelScheduledMail } from '@/lib/mail-send';

/** Writes for Mailing. One allowlist per table, like the Goal Navigator. */
type Result = { error: string | null };
const touched = () => revalidatePath('/d/mailing', 'layout');

const TABLES = {
  mail_lists: {
    text: { name: 'name', venture: 'venture', description: 'description' },
    number: {}, ref: {}, enum: {}, datetime: {},
  },
  mail_templates: {
    text: { name: 'name', venture: 'venture', subject: 'subject', preheader: 'preheader', body: 'body' },
    number: {}, ref: {}, enum: { style: ['plain', 'quinb', 'btb'] }, datetime: {},
  },
  mail_senders: {
    text: { venture: 'venture', fromName: 'from_name', fromEmail: 'from_email', replyTo: 'reply_to', address: 'address' },
    number: {}, ref: {}, enum: {}, datetime: {},
  },
  mail_campaigns: {
    text: { name: 'name', venture: 'venture', quote: 'quote', notes: 'notes', kind: 'kind' },
    number: {},
    ref: { listId: 'list_id', templateId: 'template_id', senderId: 'sender_id' },
    // Only the two states she sets by hand; the rest follow from sending.
    enum: { status: ['draft', 'paused'] },
    datetime: { sendAt: 'send_at' },
  },
  mail_sequence_steps: {
    text: {}, number: { step: 'step', dayOffset: 'day_offset' }, ref: { templateId: 'template_id', campaignId: 'campaign_id' }, enum: {}, datetime: {},
  },
} as const;
export type MailTable = keyof typeof TABLES;

type Spec = {
  text: Record<string, string>; number: Record<string, string>; ref: Record<string, string>;
  enum: Record<string, readonly string[]>; datetime: Record<string, string>;
};

function check(table: MailTable, field: string, v: string): string | null {
  if (field === 'name' && !v) return 'A name is needed.';
  if (field === 'venture' && !(VENTURES as readonly string[]).includes(v)) return 'Pick one of the ventures.';
  if ((field === 'fromEmail' || field === 'replyTo') && v && !EMAIL_RE.test(v)) return 'That is not an email address.';
  if (field === 'fromEmail' && !v) return 'A from address is needed.';
  if (field === 'fromName' && !v) return 'A from name is needed.';
  if (table === 'mail_campaigns' && field === 'kind' && !['broadcast', 'sequence'].includes(v)) return 'Broadcast or sequence.';
  return null;
}

export async function updateMail(table: MailTable, id: string, field: string, value: string): Promise<Result> {
  const spec = TABLES[table] as unknown as Spec;
  if (!spec) return { error: `Unknown table: ${table}` };
  const db = getSupabase();
  if (!db) return { error: 'Supabase is not configured.' };
  const v = value.trim();
  let patch: Record<string, unknown> | null = null;
  if (field in spec.text) {
    const bad = check(table, field, v);
    if (bad) return { error: bad };
    patch = { [spec.text[field]]: v || null };
    if (field === 'subject' || field === 'body') patch = { [spec.text[field]]: v };
  } else if (field in spec.number) {
    const n = Number(v);
    if (!v || !Number.isFinite(n)) return { error: 'A number, please.' };
    patch = { [spec.number[field]]: Math.round(n) };
  } else if (field in spec.ref) {
    patch = { [spec.ref[field]]: v || null };
  } else if (field in spec.enum) {
    if (!spec.enum[field].includes(v)) return { error: `Not a valid ${field}.` };
    patch = { [field]: v };
  } else if (field in spec.datetime) {
    if (v) {
      const iso = brusselsToIso(v);
      if (!iso) return { error: 'Date and time are written 2026-10-09T18:00.' };
      patch = { [spec.datetime[field]]: iso };
    } else {
      patch = { [spec.datetime[field]]: null };
    }
  }
  if (!patch) return { error: `Unknown field: ${field}` };
  const withStamp = table === 'mail_sequence_steps' ? patch : { ...patch, updated_at: new Date().toISOString() };
  const { error } = await db.from(table).update(withStamp).eq('id', id);
  if (error) return { error: error.message };
  touched();
  return { error: null };
}

export async function addMail(table: MailTable, input: Record<string, string>): Promise<Result> {
  const spec = TABLES[table] as unknown as Spec;
  if (!spec) return { error: `Unknown table: ${table}` };
  const db = getSupabase();
  if (!db) return { error: 'Supabase is not configured.' };
  const row: Record<string, unknown> = {};
  for (const [k, col] of Object.entries(spec.text)) {
    const v = input[k]?.trim() ?? '';
    const bad = check(table, k, v);
    if (bad && (v || ['name', 'venture', 'fromEmail', 'fromName'].includes(k))) return { error: bad };
    if (v) row[col] = v;
  }
  for (const [k, col] of Object.entries(spec.number)) if (input[k]?.trim()) row[col] = Math.round(Number(input[k]));
  for (const [k, col] of Object.entries(spec.ref)) if (input[k]?.trim()) row[col] = input[k].trim();
  for (const [k] of Object.entries(spec.enum)) if (input[k]?.trim()) row[k] = input[k].trim();
  for (const [k, col] of Object.entries(spec.datetime)) if (input[k]?.trim()) {
    const iso = brusselsToIso(input[k]);
    if (!iso) return { error: 'Date and time are written 2026-10-09T18:00.' };
    row[col] = iso;
  }
  if (table !== 'mail_sequence_steps' && !row.venture) return { error: 'Pick one of the ventures.' };
  if (table === 'mail_sequence_steps' && !row.campaign_id) return { error: 'No campaign.' };
  const { error } = await db.from(table).insert(row);
  if (error) return { error: error.message };
  touched();
  return { error: null };
}

export async function removeMail(table: MailTable, id: string): Promise<Result> {
  if (!TABLES[table]) return { error: `Unknown table: ${table}` };
  const db = getSupabase();
  if (!db) return { error: 'Supabase is not configured.' };
  const { error } = await db.from(table).delete().eq('id', id);
  if (error) return { error: error.message };
  touched();
  return { error: null };
}

/** Puts an address on a list, or takes it off. */
export async function setListMember(listId: string, email: string, on: boolean): Promise<Result> {
  const db = getSupabase();
  if (!db) return { error: 'Supabase is not configured.' };
  const { error } = on
    ? await db.from('mail_list_members').upsert({ list_id: listId, email }, { onConflict: 'list_id,email' })
    : await db.from('mail_list_members').delete().eq('list_id', listId).eq('email', email);
  if (error) return { error: error.message };
  touched();
  return { error: null };
}

/** Everyone matching a filter onto a list in one go. */
export async function addManyToList(listId: string, emails: string[]): Promise<Result> {
  const db = getSupabase();
  if (!db) return { error: 'Supabase is not configured.' };
  const rows = [...new Set(emails)].map((email) => ({ list_id: listId, email }));
  if (!rows.length) return { error: null };
  const { error } = await db.from('mail_list_members').upsert(rows, { onConflict: 'list_id,email' });
  if (error) return { error: error.message };
  touched();
  return { error: null };
}

/** The sentence written for one person. */
export async function setPersonalLine(sendId: string, text: string): Promise<Result> {
  const db = getSupabase();
  if (!db) return { error: 'Supabase is not configured.' };
  const { error } = await db.from('mail_sends').update({ personal_line: text.trim() || null, updated_at: new Date().toISOString() }).eq('id', sendId);
  if (error) return { error: error.message };
  touched();
  return { error: null };
}

export async function suppress(email: string, note: string): Promise<Result> {
  const db = getSupabase();
  if (!db) return { error: 'Supabase is not configured.' };
  const e = email.trim().toLowerCase();
  if (!EMAIL_RE.test(e)) return { error: 'That is not an email address.' };
  const { error } = await db.from('mail_suppressions').upsert({ email: e, reason: 'manual', note: note.trim() || null }, { onConflict: 'email' });
  if (error) return { error: error.message };
  touched();
  return { error: null };
}

export async function unsuppress(email: string): Promise<Result> {
  const db = getSupabase();
  if (!db) return { error: 'Supabase is not configured.' };
  const { error } = await db.from('mail_suppressions').delete().eq('email', email.toLowerCase());
  if (error) return { error: error.message };
  touched();
  return { error: null };
}

async function origin(): Promise<string> {
  const h = await headers();
  const o = h.get('origin');
  if (o) return o;
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}

export async function prepareCampaign(campaignId: string) {
  const r = await prepare(campaignId);
  touched();
  return r;
}

/** One batch. The panel calls this again while `remaining` is above zero. */
export async function sendBatch(campaignId: string, limit = 20) {
  const r = await handOver(campaignId, await origin(), limit);
  touched();
  return r;
}

export async function sendTest(campaignId: string, to: string, stepId?: string | null): Promise<Result> {
  const e = to.trim();
  if (!EMAIL_RE.test(e)) return { error: 'That is not an email address.' };
  return sendTestMail(campaignId, e, await origin(), stepId);
}

export async function cancelScheduled(campaignId: string) {
  const r = await cancelScheduledMail(campaignId);
  touched();
  return r;
}
