import { NextResponse, type NextRequest } from 'next/server';
import { FOLLOWUPS_PATH, OAUTH_COOKIE, SAID_COOKIE } from '@/lib/mighty-oauth';

/**
 * Back to Follow-ups, with one line for the top of the tab (a cookie, kept a
 * minute). The address is relative, so it stays on the host she came from.
 */
export function backToFollowups(req: NextRequest, said: string): NextResponse {
  const res = new NextResponse(null, { status: 307, headers: { Location: FOLLOWUPS_PATH } });
  const secure = req.nextUrl.protocol === 'https:';
  res.cookies.set(SAID_COOKIE, said.slice(0, 600), { httpOnly: true, secure, sameSite: 'lax', path: FOLLOWUPS_PATH, maxAge: 60 });
  res.cookies.set(OAUTH_COOKIE, '', { httpOnly: true, secure, sameSite: 'lax', path: '/api/mighty', maxAge: 0 });
  return res;
}
