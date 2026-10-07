import { NextResponse, type NextRequest } from 'next/server';
import { verifyWebhook } from '@/lib/resend';
import { applyEvent } from '@/lib/mail-send';

/**
 * Resend's webhook. Set its URL in Resend (Webhooks → Add) to
 * https://<app>/api/mail/webhook and put the signing secret it shows in
 * RESEND_WEBHOOK_SECRET. Without the secret every call is refused.
 */
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (!(await verifyWebhook(req.headers, raw))) return new NextResponse('bad signature', { status: 401 });
  let event: { type?: string; data?: { email_id?: string; to?: string[] | string } };
  try { event = JSON.parse(raw); } catch { return new NextResponse('bad json', { status: 400 }); }
  const type = event.type ?? '';
  const id = event.data?.email_id ?? null;
  const to = Array.isArray(event.data?.to) ? event.data?.to[0] : event.data?.to;
  await applyEvent(type, id, to ?? null, event);
  return NextResponse.json({ ok: true });
}
