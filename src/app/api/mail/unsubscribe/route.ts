import { NextResponse, type NextRequest } from 'next/server';
import { unsubscribeByToken } from '@/lib/mail-send';

/**
 * Unsubscribe.
 *
 * GET shows a one-button page (the link in the footer). POST is the one-click
 * unsubscribe Gmail and Yahoo send from their own button (RFC 8058): no page,
 * just a 200. Both end on the suppression list. The token is per email sent,
 * so the link in a forwarded email still unsubscribes the right person.
 */
export const dynamic = 'force-dynamic';

function page(title: string, body: string) {
  return new NextResponse(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${title}</title>
<style>body{margin:0;font:16px/1.6 -apple-system,"Segoe UI",Helvetica,Arial,sans-serif;color:#111827;background:#f6f6f7}main{max-width:480px;margin:10vh auto;background:#fff;padding:32px;border-radius:10px}h1{font-size:20px;margin:0 0 12px}button{font:inherit;padding:10px 18px;border-radius:8px;border:1px solid #111827;background:#111827;color:#fff;cursor:pointer}p{margin:0 0 16px}</style>
</head><body><main><h1>${title}</h1>${body}</main></body></html>`, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

export async function GET(req: NextRequest) {
  const t = req.nextUrl.searchParams.get('t');
  if (!t || t === 'test') return page('Unsubscribe', '<p>This link came from a test email. Nothing to do.</p>');
  return page('Unsubscribe', `<p>Click once and we will not write to you again.</p><form method="post"><input type="hidden" name="t" value="${t.replace(/[^a-f0-9]/g, '')}"><button type="submit">Unsubscribe</button></form>`);
}

export async function POST(req: NextRequest) {
  let t = req.nextUrl.searchParams.get('t');
  if (!t) {
    const form = await req.formData().catch(() => null);
    t = (form?.get('t') as string | null) ?? null;
  }
  if (!t || t === 'test') return page('Unsubscribe', '<p>Nothing to do.</p>');
  const { email } = await unsubscribeByToken(t.replace(/[^a-f0-9]/g, ''));
  // Mail clients call this without a person watching; a plain 200 is the contract.
  if (req.headers.get('content-type')?.includes('application/x-www-form-urlencoded') && !req.headers.get('sec-fetch-user')) {
    return new NextResponse('ok', { status: 200 });
  }
  return page(email ? 'You are unsubscribed' : 'Unsubscribe', email
    ? `<p>${email} will not get any more emails from us.</p>`
    : '<p>This link is not valid any more. Reply to the email and we take you off by hand.</p>');
}
