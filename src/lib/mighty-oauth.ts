import { createHash, randomBytes } from 'node:crypto';
import { adminClient, authEnabled, currentUser, ADMIN_ENV } from '@/lib/auth';
import { USER_AGENT } from '@/lib/mighty-graphql';
import { sleep } from '@/lib/mighty';
import { DB_STEP } from '@/lib/followups';

/**
 * The connection for private messages in QuinB (Follow-ups): Giulia signs in
 * to QuinB once, with OAuth (Authorization Code with PKCE), and the app sends
 * and reads her private messages as her. An API key cannot hold the chat
 * scopes, so this is the only way.
 *
 * The tokens are secrets. They live in mighty_connection (row level security
 * on, no policy for anyone but the service role), are read and written here on
 * the server with adminClient(), and never reach the browser: what leaves
 * this file is the status (connected as whom, what is missing).
 *
 * Server-only.
 */

export const OAUTH_ID_ENV = 'MIGHTY_OAUTH_CLIENT_ID';
export const OAUTH_SECRET_ENV = 'MIGHTY_OAUTH_CLIENT_SECRET';
/** Where QuinB sends her back after she approves; the same in the OAuth application in Mighty. */
export const REDIRECT_URI = 'https://gm-lifework-dashboard.vercel.app/api/mighty/callback';
/** Send and read private messages. */
export const SCOPES = 'read:chats write:chats';
/** QuinB's own authorization server: its community address first, then the custom domain. */
const ISSUERS = ['https://quinb.mn.co', 'https://www.quinb.academy'];
/** The one connection: Giulia's. */
const CONNECTION = 'quinb';
/** The state and PKCE verifier between Connect and the callback, httpOnly, for ten minutes. */
export const OAUTH_COOKIE = 'lifework_mighty_oauth';
/** What the callback has to say, shown once at the top of Follow-ups. */
export const SAID_COOKIE = 'lifework_mighty_said';
export const FOLLOWUPS_PATH = '/d/quinb-community/followups';

/** What Giulia sets up, word for word as the tab shows it while it is missing. */
export const OAUTH_SETUP = `In Mighty: Network Admin › Integrations › OAuth Applications › new application "Lifework", confidential client, redirect URI ${REDIRECT_URI}, scopes read:chats and write:chats. "Skip consent screen" is not allowed with chat scopes, so you approve once. Then in Vercel › Settings › Environment Variables add ${OAUTH_ID_ENV} and ${OAUTH_SECRET_ENV} from that application, and redeploy.`;

const creds = () => ({ id: (process.env[OAUTH_ID_ENV] ?? '').trim(), secret: (process.env[OAUTH_SECRET_ENV] ?? '').trim() });

// ------------------------------------------------------------------ status

export type ChatStatus = {
  /** Signed in, set up and connected: Send and reading private messages work. */
  ready: boolean;
  /** The QuinB account messages go out as. */
  connectedAs: string | null;
  /** The Connect button works (signed in and set up). */
  canConnect: boolean;
  /** A connection that stopped working: "Connect again". */
  reconnect: boolean;
  /** What stands in the way, in plain words, in order. */
  blockers: string[];
  /** The last thing that went wrong with the connection. */
  lastError: string | null;
};

type ConnRow = {
  id: string; access_token: string | null; refresh_token: string | null; expires_at: string | null; scope: string | null;
  member_gid: string | null; member_name: string | null; refreshing_until: string | null; last_error: string | null; chats_read_at: string | null;
};

const missingStep = (msg: string) => /does not exist|could not find|schema cache/i.test(msg);

async function readRow(): Promise<{ row: ConnRow | null } | { error: string }> {
  const admin = adminClient();
  if (!admin) return { error: `${ADMIN_ENV} is not set in Vercel.` };
  const { data, error } = await admin.from('mighty_connection').select('*').eq('id', CONNECTION).maybeSingle();
  if (error) return { error: missingStep(error.message) ? DB_STEP : error.message };
  return { row: (data as ConnRow | null) ?? null };
}

/** Sign-in: on, with someone signed in. Sending, reading chats, connecting and drafting refuse without it. */
export async function signedIn(): Promise<{ ok: true } | { ok: false; why: string }> {
  if (!authEnabled) {
    return { ok: false, why: 'Sign-in is off (LIFEWORK_AUTH is not "on" in Vercel), so the app is open to anyone with the link and private messages stay locked. To turn it on: make your login under Settings in this app, then in Vercel › Settings › Environment Variables set LIFEWORK_AUTH to on and redeploy.' };
  }
  return (await currentUser()) ? { ok: true } : { ok: false, why: 'Sign in to send and read private messages.' };
}

/** Where private messages stand, for the tab. Never carries a token. */
export async function chatStatus(): Promise<ChatStatus> {
  const blockers: string[] = [];
  const gate = await signedIn();
  if (!gate.ok) blockers.push(gate.why);
  const { id, secret } = creds();
  const missing = [!id ? OAUTH_ID_ENV : null, !secret ? OAUTH_SECRET_ENV : null].filter(Boolean);
  if (missing.length) blockers.push(`${missing.join(' and ')} ${missing.length === 1 ? 'is' : 'are'} not set. ${OAUTH_SETUP}`);
  const read = await readRow();
  if ('error' in read) blockers.push(read.error);
  const row = 'row' in read ? read.row : null;
  const connected = !!row?.refresh_token || !!row?.access_token;
  const reconnect = !connected && !!row?.last_error;
  if (!connected && !('error' in read)) blockers.push(reconnect ? `The connection to QuinB stopped working: ${row!.last_error} Connect again.` : 'QuinB is not connected yet: click Connect and approve in QuinB.');
  const canConnect = gate.ok && !missing.length && !('error' in read);
  return {
    ready: canConnect && connected,
    connectedAs: connected ? row?.member_name ?? 'your QuinB account' : null,
    canConnect, reconnect, blockers, lastError: row?.last_error ?? null,
  };
}

// --------------------------------------------------------------- the flow

type Endpoints = { authorize: string; token: string };
let endpointsFound: Endpoints | null = null;

/** The authorization and token endpoints, as QuinB's authorization server publishes them. */
export async function endpoints(): Promise<Endpoints | { error: string }> {
  if (endpointsFound) return endpointsFound;
  const tried: string[] = [];
  for (const base of ISSUERS) {
    const at = `${base}/.well-known/oauth-authorization-server`;
    try {
      const res = await fetch(at, { headers: { Accept: 'application/json', 'User-Agent': USER_AGENT }, cache: 'no-store', signal: AbortSignal.timeout(10_000) });
      const j = res.ok ? await res.json().catch(() => null) as { authorization_endpoint?: string; token_endpoint?: string } | null : null;
      if (j?.authorization_endpoint && j.token_endpoint) {
        endpointsFound = { authorize: j.authorization_endpoint, token: j.token_endpoint };
        return endpointsFound;
      }
      tried.push(`${at} (${res.ok ? 'no endpoints in it' : res.status})`);
    } catch (err) {
      tried.push(`${at} (${err instanceof Error ? err.message : 'no answer'})`);
    }
  }
  return { error: `QuinB's sign-in server could not be found: ${tried.join('; ')}.` };
}

const b64url = (b: Buffer) => b.toString('base64url');

/** A fresh state and PKCE pair for one Connect. */
export function startFlow(): { state: string; verifier: string; challenge: string } {
  const verifier = b64url(randomBytes(32));
  return { state: b64url(randomBytes(16)), verifier, challenge: b64url(createHash('sha256').update(verifier).digest()) };
}

export function authorizeUrl(authorize: string, state: string, challenge: string): string {
  const u = new URL(authorize);
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('client_id', creds().id);
  u.searchParams.set('redirect_uri', REDIRECT_URI);
  u.searchParams.set('scope', SCOPES);
  u.searchParams.set('state', state);
  u.searchParams.set('code_challenge', challenge);
  u.searchParams.set('code_challenge_method', 'S256');
  return u.toString();
}

type TokenSet = { access_token: string; refresh_token?: string; expires_in?: number; scope?: string };
type TokenResult = { data: TokenSet } | { error: string; status: number; code: string | null };

/**
 * A POST to the token endpoint, with the client id and secret in the body;
 * when Mighty answers 401, once more with HTTP Basic (Mighty has refused
 * either way for some applications).
 */
async function postToken(tokenUrl: string, fields: Record<string, string>): Promise<TokenResult> {
  const { id, secret } = creds();
  const send = (basic: boolean) => {
    const body = new URLSearchParams(fields);
    const headers: Record<string, string> = { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json', 'User-Agent': USER_AGENT };
    if (basic) headers.Authorization = `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`;
    else { body.set('client_id', id); body.set('client_secret', secret); }
    return fetch(tokenUrl, { method: 'POST', headers, body, cache: 'no-store', signal: AbortSignal.timeout(15_000) });
  };
  let res: Response;
  try {
    res = await send(false);
    if (res.status === 401) res = await send(true);
  } catch (err) {
    return { error: `QuinB's sign-in server did not answer: ${err instanceof Error ? err.message : 'no answer'}.`, status: 0, code: null };
  }
  const text = await res.text();
  let j: (Partial<TokenSet> & { error?: string; error_description?: string }) | null = null;
  try { j = JSON.parse(text); } catch { /* shown as it came */ }
  if (!res.ok || !j?.access_token) {
    return { error: `QuinB's sign-in server (${res.status}): ${j?.error_description ?? j?.error ?? (text.trim().slice(0, 300) || res.statusText)}`, status: res.status, code: j?.error ?? null };
  }
  return { data: j as TokenSet };
}

const expiry = (t: TokenSet) => new Date(Date.now() + (t.expires_in ?? 3600) * 1000).toISOString();

/** The callback's half: the code for tokens. */
export async function exchangeCode(code: string, verifier: string): Promise<TokenResult> {
  const ep = await endpoints();
  if ('error' in ep) return { error: ep.error, status: 0, code: null };
  return postToken(ep.token, { grant_type: 'authorization_code', code, redirect_uri: REDIRECT_URI, code_verifier: verifier });
}

/** Keep the tokens of a new connection, with who it is. */
export async function saveConnection(t: TokenSet, me: { id: string; name: string | null }): Promise<{ error: string | null }> {
  const admin = adminClient();
  if (!admin) return { error: `${ADMIN_ENV} is not set in Vercel.` };
  const now = new Date().toISOString();
  const { error } = await admin.from('mighty_connection').upsert({
    id: CONNECTION, access_token: t.access_token, refresh_token: t.refresh_token ?? null, expires_at: expiry(t), scope: t.scope ?? null,
    member_gid: me.id, member_name: me.name, connected_at: now, refreshed_at: now, refreshing_until: null, last_error: null, updated_at: now,
  }, { onConflict: 'id' });
  return { error: error ? (missingStep(error.message) ? DB_STEP : error.message) : null };
}

// ------------------------------------------------------------- the token

export type Token = { token: string; meGid: string | null; chatsReadAt: string | null };

/**
 * A token that works for at least another minute. Refresh tokens may rotate,
 * so one refresh runs at a time: the database guard (refreshing_until) is
 * taken by whoever updates the row first; the others wait for its new token.
 * A refresh QuinB refuses ends the connection: "Connect again".
 */
export async function chatToken(): Promise<Token | { error: string }> {
  const gate = await signedIn();
  if (!gate.ok) return { error: gate.why };
  const admin = adminClient();
  if (!admin) return { error: `${ADMIN_ENV} is not set in Vercel.` };
  for (let attempt = 0; attempt < 10; attempt++) {
    const read = await readRow();
    if ('error' in read) return read;
    const row = read.row;
    if (!row?.access_token && !row?.refresh_token) return { error: 'QuinB is not connected: click Connect at the top of Follow-ups.' };
    const ok = (r: ConnRow): Token => ({ token: r.access_token!, meGid: r.member_gid, chatsReadAt: r.chats_read_at });
    if (row.access_token && row.expires_at && Date.parse(row.expires_at) - Date.now() > 60_000) return ok(row);
    if (!row.refresh_token) return { error: 'The connection to QuinB has run out. Connect again at the top of Follow-ups.' };

    const now = new Date();
    const { data: got, error: guardErr } = await admin.from('mighty_connection')
      .update({ refreshing_until: new Date(now.getTime() + 30_000).toISOString() })
      .eq('id', CONNECTION).eq('refresh_token', row.refresh_token)
      .or(`refreshing_until.is.null,refreshing_until.lt."${now.toISOString()}"`)
      .select('id');
    if (guardErr) return { error: guardErr.message };
    if (!got?.length) { await sleep(1_000); continue; }

    const ep = await endpoints();
    const r: TokenResult = 'error' in ep ? { error: ep.error, status: 0, code: null }
      : await postToken(ep.token, { grant_type: 'refresh_token', refresh_token: row.refresh_token });
    const at = new Date().toISOString();
    if ('error' in r) {
      // Refused for good (the refresh token is spent or revoked): the connection ends.
      const ended = r.code === 'invalid_grant' || r.status === 400 || r.status === 401;
      await admin.from('mighty_connection').update({
        refreshing_until: null, last_error: r.error, updated_at: at,
        ...(ended ? { access_token: null, refresh_token: null, expires_at: null } : {}),
      }).eq('id', CONNECTION);
      return { error: ended ? `The connection to QuinB stopped working (${r.error}). Connect again at the top of Follow-ups.` : r.error };
    }
    const t = r.data;
    const saved = { access_token: t.access_token, refresh_token: t.refresh_token ?? row.refresh_token, expires_at: expiry(t) };
    await admin.from('mighty_connection').update({
      ...saved, scope: t.scope ?? row.scope, refreshed_at: at, refreshing_until: null, last_error: null, updated_at: at,
    }).eq('id', CONNECTION);
    return { token: t.access_token, meGid: row.member_gid, chatsReadAt: row.chats_read_at };
  }
  return { error: 'The connection to QuinB is being renewed elsewhere; try again in a minute.' };
}

/** What went wrong with a call made with the connection, kept for the tab. */
export async function noteChatError(error: string | null): Promise<void> {
  const admin = adminClient();
  if (!admin) return;
  await admin.from('mighty_connection').update({ last_error: error, updated_at: new Date().toISOString() }).eq('id', CONNECTION);
}

/** When her private messages were last read through to the end. */
export async function noteChatsRead(at: string): Promise<void> {
  const admin = adminClient();
  if (!admin) return;
  await admin.from('mighty_connection').update({ chats_read_at: at, updated_at: new Date().toISOString() }).eq('id', CONNECTION);
}
