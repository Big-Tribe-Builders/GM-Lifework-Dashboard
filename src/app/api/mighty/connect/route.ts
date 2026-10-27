import { NextResponse, type NextRequest } from 'next/server';
import { authorizeUrl, chatStatus, endpoints, startFlow, OAUTH_COOKIE } from '@/lib/mighty-oauth';
import { backToFollowups } from '../said';

/**
 * Connect: off to QuinB's authorization server, where Giulia approves once.
 * Only for a signed-in user, with the OAuth application set up. The state
 * and the PKCE verifier wait in an httpOnly cookie for the callback.
 */
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const status = await chatStatus();
  if (!status.canConnect) return backToFollowups(req, `Not connected: ${status.blockers[0] ?? 'Connect is not available.'}`);
  const ep = await endpoints();
  if ('error' in ep) return backToFollowups(req, `Not connected: ${ep.error}`);
  const flow = startFlow();
  const res = NextResponse.redirect(authorizeUrl(ep.authorize, flow.state, flow.challenge));
  res.cookies.set(OAUTH_COOKIE, `${flow.state}.${flow.verifier}`, {
    httpOnly: true, secure: req.nextUrl.protocol === 'https:', sameSite: 'lax', path: '/api/mighty', maxAge: 600,
  });
  return res;
}
