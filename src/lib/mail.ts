/**
 * Mailing: lists over the CRM emails, templates, senders, campaigns.
 *
 * Her words: lists you label, templates and styles, one sender system for
 * QuinB Academy and Big Tribe Builders, sequences and pre-planned
 * broadcasts, sent through Resend, with a personal line per person.
 *
 * Rendering lives here too (no React): a template body is plain text with a
 * little markdown and placeholders; it becomes an HTML email and a text
 * version, each with the footer deliverability needs (postal address and a
 * working unsubscribe link).
 */
import { VENTURES } from '@/lib/goals';

export { VENTURES };

export type MailStyle = 'plain' | 'quinb' | 'btb';
export const MAIL_STYLES: Record<MailStyle, string> = { plain: 'Plain', quinb: 'QuinB Academy', btb: 'Big Tribe Builders' };

export type CampaignKind = 'broadcast' | 'sequence';
export type CampaignStatus = 'draft' | 'scheduled' | 'sending' | 'sent' | 'paused';
export const CAMPAIGN_STATUS: Record<CampaignStatus, string> = {
  draft: 'Draft', scheduled: 'Scheduled', sending: 'Sending', sent: 'Sent', paused: 'Paused',
};
export const CAMPAIGN_TONE: Record<CampaignStatus, string> = {
  draft: 'sleeping', scheduled: 'contact', sending: 'active', sent: 'done', paused: 'archived',
};

export type SendStatus =
  | 'planned' | 'queued' | 'sent' | 'delivered' | 'opened' | 'clicked'
  | 'bounced' | 'complained' | 'failed' | 'skipped';
export const SEND_STATUS: Record<SendStatus, string> = {
  planned: 'Planned', queued: 'Handed to Resend', sent: 'Sent', delivered: 'Delivered', opened: 'Opened',
  clicked: 'Clicked', bounced: 'Bounced', complained: 'Marked spam', failed: 'Failed', skipped: 'Skipped',
};
/** Progress order, so a late "delivered" never overwrites an "opened". */
const SEND_RANK: Record<SendStatus, number> = {
  planned: 0, queued: 1, sent: 2, delivered: 3, opened: 4, clicked: 5, bounced: 9, complained: 9, failed: 9, skipped: 9,
};
export const laterStatus = (a: SendStatus, b: SendStatus): SendStatus => (SEND_RANK[b] >= SEND_RANK[a] ? b : a);

export type MailList = { id: string; name: string; venture: string; description: string | null; memberCount: number; createdAt: string };
export type MailListMember = { listId: string; email: string; addedAt: string };
export type MailTemplate = { id: string; name: string; venture: string; subject: string; preheader: string | null; body: string; style: MailStyle; updatedAt: string };
export type MailSender = { id: string; venture: string; fromName: string; fromEmail: string; replyTo: string | null; address: string | null };
export type MailCampaign = {
  id: string; name: string; venture: string; kind: CampaignKind;
  listId: string | null; templateId: string | null; senderId: string | null;
  status: CampaignStatus; sendAt: string | null; quote: string | null; notes: string | null;
  createdAt: string; updatedAt: string;
};
export type MailStep = { id: string; campaignId: string; step: number; dayOffset: number; templateId: string | null };
export type MailSend = {
  id: string; campaignId: string; stepId: string | null; email: string; personalLine: string | null;
  status: SendStatus; resendId: string | null; scheduledFor: string | null; sentAt: string | null; error: string | null;
};
export type MailSuppression = { email: string; reason: 'unsubscribed' | 'bounced' | 'complained' | 'manual'; note: string | null; createdAt: string };

/** The placeholders a template may use. Shown next to the editor. */
export const PLACEHOLDERS: { key: string; what: string }[] = [
  { key: '{{first_name}}', what: 'First name, or "there" when we have none' },
  { key: '{{last_name}}', what: 'Last name' },
  { key: '{{city}}', what: 'City' },
  { key: '{{personal}}', what: 'The line written for this person (Campaign › recipients)' },
  { key: '{{quote}}', what: 'The quote or thought from you set on the campaign' },
];

// ----------------------------------------------------------------- render

export type Recipient = { email: string; firstName?: string | null; lastName?: string | null; city?: string | null; personal?: string | null };

export type Rendered = { subject: string; html: string; text: string };

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function fill(source: string, r: Recipient, quote: string | null | undefined): string {
  return source
    .replace(/\{\{\s*first_name\s*\}\}/gi, r.firstName?.trim() || 'there')
    .replace(/\{\{\s*last_name\s*\}\}/gi, r.lastName?.trim() || '')
    .replace(/\{\{\s*city\s*\}\}/gi, r.city?.trim() || '')
    .replace(/\{\{\s*personal\s*\}\}/gi, r.personal?.trim() || '')
    .replace(/\{\{\s*quote\s*\}\}/gi, quote?.trim() || '')
    // A placeholder that filled to nothing should not leave a blank line.
    .replace(/\n{3,}/g, '\n\n');
}

/** Inline markdown: **bold**, *italic*, [text](url). Input is already escaped. */
function inline(s: string): string {
  return s
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" style="color:inherit">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>');
}

/** Paragraphs split on blank lines; single newlines become <br>. */
function bodyHtml(text: string): string {
  return text.trim().split(/\n\s*\n/).map((p) => {
    const t = p.trim();
    if (/^#\s+/.test(t)) return `<h2 style="margin:24px 0 8px;font-size:20px;line-height:1.3">${inline(esc(t.replace(/^#\s+/, '')))}</h2>`;
    if (t.split('\n').every((l) => /^[-*]\s+/.test(l))) {
      return `<ul style="margin:0 0 16px;padding-left:22px">${t.split('\n').map((l) => `<li style="margin:4px 0">${inline(esc(l.replace(/^[-*]\s+/, '')))}</li>`).join('')}</ul>`;
    }
    return `<p style="margin:0 0 16px">${inline(esc(t)).replace(/\n/g, '<br>')}</p>`;
  }).join('');
}

const LOOK: Record<MailStyle, { name: string; colour: string; font: string }> = {
  plain: { name: '', colour: '#111827', font: 'Georgia, "Times New Roman", serif' },
  quinb: { name: 'QuinB Academy', colour: '#e11d48', font: '-apple-system, "Segoe UI", Helvetica, Arial, sans-serif' },
  btb: { name: 'Big Tribe Builders', colour: '#6d28d9', font: '-apple-system, "Segoe UI", Helvetica, Arial, sans-serif' },
};

export function render(input: {
  subject: string; preheader?: string | null; body: string; style: MailStyle;
  recipient: Recipient; quote?: string | null;
  sender: { fromName: string; address?: string | null };
  unsubscribeUrl: string;
}): Rendered {
  const { recipient: r, quote } = input;
  const subject = fill(input.subject, r, quote).replace(/\s+/g, ' ').trim();
  const body = fill(input.body, r, quote);
  const look = LOOK[input.style] ?? LOOK.plain;
  const pre = input.preheader ? fill(input.preheader, r, quote) : '';
  const address = input.sender.address?.trim();

  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#f6f6f7">
${pre ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(pre)}</div>` : ''}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f6f7"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:8px">
${look.name ? `<tr><td style="padding:20px 32px 0;font:600 13px/1.2 ${look.font};letter-spacing:.08em;text-transform:uppercase;color:${look.colour}">${esc(look.name)}</td></tr>` : ''}
<tr><td style="padding:24px 32px 8px;font:16px/1.6 ${look.font};color:#111827">${bodyHtml(body)}</td></tr>
<tr><td style="padding:16px 32px 28px;font:12px/1.6 ${look.font};color:#6b7280;border-top:1px solid #eceef1">
${esc(input.sender.fromName)}${address ? ` · ${esc(address)}` : ''}<br>
You get this because we know each other through ${look.name ? esc(look.name) : esc(input.sender.fromName)}.
<a href="${esc(input.unsubscribeUrl)}" style="color:#6b7280">Unsubscribe</a> and we will not write again.
</td></tr>
</table></td></tr></table></body></html>`;

  const text = `${body.trim()}

--
${input.sender.fromName}${address ? ` · ${address}` : ''}
Unsubscribe: ${input.unsubscribeUrl}
`;
  return { subject, html, text };
}

/** `2026-10-09T18:00` typed as Brussels time → an ISO instant. */
export function brusselsToIso(local: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local.trim());
  if (!m) return null;
  const [, y, mo, d, h, mi] = m.map(Number);
  // Guess UTC, see what Brussels shows for it, correct by the difference.
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  const shown = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Brussels', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
    .formatToParts(new Date(guess)).reduce<Record<string, number>>((acc, p) => (p.type === 'literal' ? acc : { ...acc, [p.type]: Number(p.value) }), {});
  const shownUtc = Date.UTC(shown.year, shown.month - 1, shown.day, shown.hour, shown.minute);
  return new Date(guess - (shownUtc - guess)).toISOString();
}

/** An ISO instant → `2026-10-09T18:00` in Brussels, for a datetime-local input. */
export function isoToBrussels(iso: string | null): string {
  if (!iso) return '';
  const p = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Brussels', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
    .formatToParts(new Date(iso)).reduce<Record<string, string>>((acc, x) => (x.type === 'literal' ? acc : { ...acc, [x.type]: x.value }), {});
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
