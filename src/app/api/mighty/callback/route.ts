import type { NextRequest } from 'next/server';
import { exchangeCode, saveConnection, signedIn, OAUTH_COOKIE } from '@/lib/mighty-oauth';
import { whoAmI } from '@/lib/mighty-graphql';
import { backToFollowups } from '../said';

/**
 * Where QuinB sends Giulia back after she approved: the state is checked
 * against the cookie Connect left, the code is exchanged here on the server,
 * `me` says who is connected, and the tokens are kept (mighty-oauth.ts).
 */
export const dynamic = 'force-dynamic';

const clip = (s: string) => s.replace(/\s+/g, ' ').trim().slice(0, 200);

export async function GET(req: NextRequest) {
  const gate = await signedIn();
  if (!gate.ok) return backToFollowups(req, `Not connected: ${gate.why}`);
  const p = req.nextUrl.searchParams;
  if (p.get('error')) return backToFollowups(req, `QuinB did not connect: ${clip(p.get('error_description') ?? p.get('error') ?? '')}.`);

  const [state, verifier] = (req.cookies.get(OAUTH_COOKIE)?.value ?? '').split('.');
  const code = p.get('code');
  if (!code || !state || !verifier || p.get('state') !== state) {
    return backToFollowups(req, 'Not connected: the answer from QuinB did not belong to this Connect (it may be more than ten minutes old). Click Connect again.');
  }
  const tokens = await exchangeCode(code, verifier);
  if ('error' in tokens) return backToFollowups(req, `Not connected: ${tokens.error}`);
  const who = await whoAmI(tokens.data.access_token);
  if ('error' in who) return backToFollowups(req, `Not connected: QuinB did not say who you are, so nothing was kept. ${who.error}`);
  if (!who.data.me) return backToFollowups(req, 'Not connected: QuinB did not say who you are, so nothing was kept.');
  const saved = await saveConnection(tokens.data, who.data.me);
  if (saved.error) return backToFollowups(req, `Not connected: ${saved.error}`);
  return backToFollowups(req, `Connected: private messages go out as ${who.data.me.name ?? 'your QuinB account'}.`);
}
