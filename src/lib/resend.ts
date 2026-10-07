/**
 * Resend, by plain HTTP. No SDK: four calls, one host.
 *
 * Needs RESEND_API_KEY (server-only). Without it `resendReady()` says so and
 * nothing is sent. The sending domain is verified in the Resend dashboard,
 * not here.
 */

export const RESEND_ENV = 'RESEND_API_KEY';
export const RESEND_WEBHOOK_ENV = 'RESEND_WEBHOOK_SECRET';

/** Resend accepts scheduled_at up to 30 days ahead. */
export const SCHEDULE_WINDOW_DAYS = 30;

export function resendReady(): { ok: true } | { ok: false; missing: string } {
  return process.env.RESEND_API_KEY ? { ok: true } : { ok: false, missing: RESEND_ENV };
}

export type OutgoingEmail = {
  from: string;            // "Name <address>"
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string | null;
  headers?: Record<string, string>;
  tags?: { name: string; value: string }[];
  /** ISO instant. Omit to send now. */
  scheduledAt?: string | null;
  /** Same key twice → Resend returns the first result instead of sending again. */
  idempotencyKey: string;
};

export type SendResult = { id: string } | { error: string };

export async function sendEmail(e: OutgoingEmail): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { error: `${RESEND_ENV} is not set.` };
  const body: Record<string, unknown> = {
    from: e.from, to: [e.to], subject: e.subject, html: e.html, text: e.text,
  };
  if (e.replyTo) body.reply_to = e.replyTo;
  if (e.headers) body.headers = e.headers;
  if (e.tags?.length) body.tags = e.tags;
  if (e.scheduledAt) body.scheduled_at = e.scheduledAt;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'Idempotency-Key': e.idempotencyKey.slice(0, 256) },
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => ({}))) as { id?: string; message?: string; name?: string };
    if (!res.ok) return { error: json.message ? `${json.name ?? res.status}: ${json.message}` : `Resend answered ${res.status}` };
    if (!json.id) return { error: 'Resend answered without an id.' };
    return { id: json.id };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Could not reach Resend.' };
  }
}

/** Cancels a scheduled email. Resend only allows this before it goes. */
export async function cancelEmail(id: string): Promise<{ error: string | null }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { error: `${RESEND_ENV} is not set.` };
  const res = await fetch(`https://api.resend.com/emails/${id}/cancel`, { method: 'POST', headers: { Authorization: `Bearer ${key}` } });
  if (!res.ok) {
    const json = (await res.json().catch(() => ({}))) as { message?: string };
    return { error: json.message ?? `Resend answered ${res.status}` };
  }
  return { error: null };
}

/**
 * Verifies a webhook the way Svix signs them: HMAC-SHA256 over
 * "<id>.<timestamp>.<body>" with the secret after "whsec_", base64.
 * Returns false when the secret is missing, so an unconfigured endpoint
 * accepts nothing.
 */
export async function verifyWebhook(headers: Headers, rawBody: string): Promise<boolean> {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  const id = headers.get('svix-id');
  const ts = headers.get('svix-timestamp');
  const sig = headers.get('svix-signature');
  if (!secret || !id || !ts || !sig) return false;
  // Five minutes of clock drift, like Svix's own libraries.
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false;
  const raw = Uint8Array.from(atob(secret.replace(/^whsec_/, '')), (c) => c.charCodeAt(0));
  const k = await crypto.subtle.importKey('raw', raw, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(`${id}.${ts}.${rawBody}`));
  const expected = btoa(String.fromCharCode(...new Uint8Array(mac)));
  return sig.split(' ').some((part) => {
    const [v, s] = part.split(',');
    return v === 'v1' && s === expected;
  });
}
