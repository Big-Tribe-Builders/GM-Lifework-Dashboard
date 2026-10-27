/**
 * The QuinB network on Mighty Networks through its GraphQL API (the Mighty
 * API): https://api.mn.co/networks/{network}/graphql, Bearer token.
 *
 * GraphQL answers HTTP 200 with an `errors` list for most failures: that is a
 * failure here, and its messages are shown word for word. api.mn.co's
 * firewall turns away requests without a usual User-Agent, so one is sent.
 * Reads are waited out on 429 with the same backoff as the Admin API
 * (mighty.ts); a mutation is never sent twice.
 *
 * Server-only. Keys, for the roster ("Refresh from QuinB"):
 *   MIGHTY_API_KEY      tried first (it is in Vercel already, for the Admin API)
 *   MIGHTY_GRAPHQL_KEY  read when Mighty refuses the first for GraphQL: a Mighty
 *                       API key with the host scope host:read:network_members
 * Private messages use Giulia's own token from the OAuth connection
 * (mighty-oauth.ts): an API key cannot hold the chat scopes.
 */
import { RETRY_WAITS, retryAfter, sleep, mightyNetwork } from '@/lib/mighty';

export const GRAPHQL_ENV = 'MIGHTY_GRAPHQL_KEY';
export const ADMIN_KEY_ENV = 'MIGHTY_API_KEY';

/** A browser's User-Agent: api.mn.co's firewall rejects unusual ones. */
export const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

export const graphqlUrl = () => `https://api.mn.co/networks/${mightyNetwork()}/graphql`;

/** `refused`: Mighty turned the token away (wrong kind of key, missing scope, expired). */
export type Gql<T> = { data: T } | { error: string; refused: boolean };

type GqlError = { message?: string; extensions?: { code?: string } };

const REFUSED = /unauthori[sz]ed|unauthenticated|forbidden|not authori[sz]ed|authentication|access denied|invalid (api )?(key|token)|scope|permission/i;

export async function gql<T>(token: string, query: string, variables: Record<string, unknown> = {}, opts: { mutation?: boolean } = {}, attempt = 0): Promise<Gql<T>> {
  let res: Response;
  try {
    res = await fetch(graphqlUrl(), {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json', 'User-Agent': USER_AGENT },
      body: JSON.stringify({ query, variables }),
      cache: 'no-store',
      signal: AbortSignal.timeout(20_000),
    });
  } catch (err) {
    return { error: err instanceof Error ? `Could not reach Mighty Networks: ${err.message}` : 'Could not reach Mighty Networks.', refused: false };
  }
  if (res.status === 429 && !opts.mutation && attempt < RETRY_WAITS.length) {
    await sleep(retryAfter(res, RETRY_WAITS[attempt]));
    return gql<T>(token, query, variables, opts, attempt + 1);
  }
  const text = await res.text();
  let json: { data?: T; errors?: GqlError[]; error?: string } | null = null;
  try { json = JSON.parse(text); } catch { /* not JSON: shown as it came */ }
  const errors = json?.errors ?? [];
  if (!res.ok || errors.length || !json?.data) {
    const words = errors.length ? errors.map((e) => e.message ?? JSON.stringify(e)).join(' · ')
      : json?.error ?? (text.trim().slice(0, 300) || res.statusText);
    const refused = res.status === 401 || res.status === 403 || errors.some((e) => /UNAUTHENTICATED|FORBIDDEN|UNAUTHORIZED/i.test(e.extensions?.code ?? '') || REFUSED.test(e.message ?? ''));
    return { error: `Mighty Networks (GraphQL, ${res.status}): ${words}`, refused };
  }
  return { data: json.data };
}

// ----------------------------------------------------------------- roster

/** One member as the roster query returns them. */
export type GqlMember = {
  id: string; resourceId: string | number; name: string | null; firstName: string | null; lastName: string | null;
  email: string | null; shortBio: string | null; avatarUrl: string | null;
  networkRole: string | null; memberType: string | null; joinedAt: string | null; lastActiveAt: string | null;
  membership: { status: string | null; accessPathPlans: { nodes: { name: string | null }[] | null } | null } | null;
};
type MemberPage = { network: { members: { totalCount: number; pageInfo: { hasNextPage: boolean; endCursor: string | null }; edges: { node: GqlMember }[] } | null } | null };

const MEMBER_FIELDS = `id resourceId name firstName lastName email shortBio avatarUrl networkRole memberType joinedAt lastActiveAt
        membership { status accessPathPlans { nodes { name } } }`;

/**
 * Ordered by resourceId: the only order under which paging returns every
 * member exactly once. The ordering argument is written two ways; the second
 * is tried only when Mighty says the first does not exist.
 */
const ORDERINGS = ['orderBy: [{ resourceId: ASC }]', 'sort: RESOURCE_ID, sortOrder: ASC'];
const rosterQuery = (order: string) => `query Roster($after: String) {
  network {
    members(first: 50, after: $after, ${order}) {
      totalCount
      pageInfo { hasNextPage endCursor }
      edges { node { ${MEMBER_FIELDS} } }
    }
  }
}`;

/** The whole roster with one token, one page at a time. */
async function rosterWith(token: string): Promise<{ members: GqlMember[]; total: number } | { error: string; refused: boolean }> {
  let lastError: { error: string; refused: boolean } | null = null;
  for (const order of ORDERINGS) {
    const out: GqlMember[] = [];
    let after: string | null = null;
    let total = 0;
    let failed: { error: string; refused: boolean } | null = null;
    for (let page = 0; page < 200; page++) {
      const r: Gql<MemberPage> = await gql<MemberPage>(token, rosterQuery(order), { after });
      if ('error' in r) { failed = r; break; }
      const conn: NonNullable<MemberPage['network']>['members'] = r.data.network?.members ?? null;
      if (!conn) { failed = { error: 'Mighty Networks (GraphQL) sent no member list: network.members came back empty.', refused: false }; break; }
      total = conn.totalCount;
      out.push(...conn.edges.map((e) => e.node));
      if (!conn.pageInfo.hasNextPage || !conn.pageInfo.endCursor) return { members: out, total };
      after = conn.pageInfo.endCursor;
    }
    if (!failed) return { error: 'Mighty Networks (GraphQL) kept sending more pages; the read stopped after 200.', refused: false };
    // Only an ordering Mighty does not know is worth the second way of writing it.
    if (!/orderBy|sortOrder|sort|RESOURCE_ID|resourceId|argument/i.test(failed.error) || failed.refused || out.length) return failed;
    lastError = lastError ? { error: `${lastError.error} — then: ${failed.error}`, refused: false } : failed;
  }
  return lastError!;
}

/** What the tab says when no key can read the roster. */
export const ROSTER_KEY_HELP = `In Mighty: Network Admin › Integrations › Mighty API › New API Key, with the host scope host:read:network_members (these keys only take host: scopes, act as the host who made them and do not expire). Then in Vercel › Settings › Environment Variables add it as ${GRAPHQL_ENV} and redeploy.`;

/**
 * The roster, with MIGHTY_API_KEY first and MIGHTY_GRAPHQL_KEY when Mighty
 * refuses the first for GraphQL (or it is not set).
 */
export async function readRoster(): Promise<{ members: GqlMember[]; total: number; key: string } | { error: string; needsKey: boolean }> {
  const admin = (process.env[ADMIN_KEY_ENV] ?? '').trim();
  const own = (process.env[GRAPHQL_ENV] ?? '').trim();
  let refusedWhy: string | null = null;
  if (admin) {
    const r = await rosterWith(admin);
    if (!('error' in r)) return { ...r, key: ADMIN_KEY_ENV };
    if (!r.refused) return { error: r.error, needsKey: false };
    refusedWhy = r.error;
  }
  if (own) {
    const r = await rosterWith(own);
    if (!('error' in r)) return { ...r, key: GRAPHQL_ENV };
    return { error: r.refused ? `${r.error} ${ROSTER_KEY_HELP}` : r.error, needsKey: r.refused };
  }
  const why = refusedWhy ? `Mighty does not take ${ADMIN_KEY_ENV} for reading members: ${refusedWhy}.` : `Neither ${ADMIN_KEY_ENV} nor ${GRAPHQL_ENV} is set in Vercel.`;
  return { error: `${why} ${ROSTER_KEY_HELP}`, needsKey: true };
}

// ------------------------------------------------------- private messages
//
// The shapes as Mighty's schema had them on 28 Sep 2026 (read from the live
// schema by a published integration that sends and reads host DMs; Mighty's
// own docs could not be reached from where this was built). A field Mighty
// renamed comes back as a GraphQL error, shown word for word.

export type Me = { id: string; resourceId: string | number; name: string | null };

/** Who the token belongs to: the account private messages are sent as. */
export async function whoAmI(token: string): Promise<Gql<{ me: Me | null }>> {
  return gql<{ me: Me | null }>(token, 'query Me { me { id resourceId name } }');
}

/** Why Mighty did not send: its outcome codes, in plain words. */
const SKIPPED: Record<string, string> = {
  SKIPPED_CONVERSATION_UNAVAILABLE: 'the conversation or the member is no longer available in QuinB',
  SKIPPED_NETWORK_CHAT_DISABLED: 'private chat is turned off for the whole of QuinB',
  SKIPPED_RECIPIENT_CHAT_DISABLED: 'this member has turned private chat off',
  SKIPPED_RECIPIENT_LIMITED_MEMBER: 'this member is a limited member and cannot get private messages',
  SKIPPED_SELF_MESSAGE: 'this is the connected account itself',
  SKIPPED_SENDER_CHAT_DISABLED: 'private chat is turned off for the connected account',
  SKIPPED_SENDER_NOT_HOST: 'the connected account is not a host of QuinB',
};

/** Her text as Mighty's own web client sends it: a blank line starts a paragraph, a line break stays one. */
export function chatHtml(text: string): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  return text.replace(/\r\n?/g, '\n').trim().split(/\n{2,}/).map((p) => `<p dir="auto">${esc(p).replace(/\n/g, '<br>')}</p>`).join('');
}

type SendPayload = {
  createConversation: {
    outcome: string | null; errors: string[] | null;
    conversation: { id: string } | null; message: { id: string; createdAt: string } | null;
  } | null;
};
const SEND = `mutation Send($input: CreateConversationInput!) {
  createConversation(input: $input) { outcome errors conversation { id } message { id createdAt } }
}`;

/**
 * One private message to one member (their GlobalID). createConversation
 * starts the conversation, or posts in the one the two of them already have.
 * Mighty reports a send it skipped as an outcome; only SENT means it went out.
 */
export async function sendPrivate(token: string, memberGid: string, text: string):
  Promise<{ sent: { conversationId: string | null; at: string | null } } | { skipped: string } | { error: string; refused: boolean }> {
  const r = await gql<SendPayload>(token, SEND, {
    input: { recipientIds: [memberGid], text: chatHtml(text), preserveParagraphSpacing: true, reportSkipsAsOutcomes: true },
  }, { mutation: true });
  if ('error' in r) return r;
  const p = r.data.createConversation;
  if (!p) return { error: 'Mighty Networks (GraphQL): createConversation came back empty, so it is not known whether the message went out. Look in QuinB before sending again.', refused: false };
  if (p.errors?.length) return { error: `Mighty Networks (GraphQL): ${p.errors.join(' · ')}`, refused: false };
  const outcome = p.outcome ?? (p.message ? 'SENT' : null);
  if (outcome !== 'SENT') return { skipped: outcome ? SKIPPED[outcome] ?? `Mighty did not send it (${outcome})` : 'Mighty did not say whether it was sent' };
  return { sent: { conversationId: p.conversation?.id ?? null, at: p.message?.createdAt ?? null } };
}

/** One conversation in her list of private messages, newest first. */
export type InboxEntry = { id: string; lastChatAt: string | null; isGroup?: boolean | null; participants?: { id: string; resourceId: string | number; name: string | null }[] | null };
type InboxPage = { me: { directMessages: { pageInfo: { hasNextPage: boolean; endCursor: string | null }; nodes: InboxEntry[] } | null } | null };
const INBOX = `query Inbox($after: String) {
  me {
    directMessages(first: 25, after: $after) {
      pageInfo { hasNextPage endCursor }
      nodes { id lastChatAt ... on DirectMessage { isGroup participants { id resourceId name } } }
    }
  }
}`;

export async function inboxPage(token: string, after: string | null): Promise<{ nodes: InboxEntry[]; next: string | null } | { error: string; refused: boolean }> {
  const r = await gql<InboxPage>(token, INBOX, { after });
  if ('error' in r) return r;
  const c = r.data.me?.directMessages;
  if (!c) return { error: 'Mighty Networks (GraphQL) sent no list of private messages (me.directMessages came back empty).', refused: false };
  return { nodes: c.nodes ?? [], next: c.pageInfo.hasNextPage ? c.pageInfo.endCursor : null };
}

/** One message in a conversation. */
export type ChatMessage = { id: string; createdAt: string; actorType: string | null; textText: string | null; member: { id: string; resourceId: string | number } | null };

/**
 * The field of a conversation that holds its link in QuinB, when the schema
 * has one: asked once, by introspection. A link is only ever taken from
 * Mighty, never made up.
 */
let linkField: Promise<string | null> | null = null;
function conversationLinkField(token: string): Promise<string | null> {
  linkField ??= gql<{ __type: { fields: { name: string }[] | null } | null }>(token, 'query { __type(name: "DirectMessage") { fields { name } } }')
    .then((r) => {
      if ('error' in r) { linkField = null; return null; }
      const names = new Set((r.data.__type?.fields ?? []).map((f) => f.name));
      return ['permalink', 'url'].find((n) => names.has(n)) ?? null;
    });
  return linkField;
}

type ThreadPage = { node: { messages?: { nodes: ChatMessage[] } | null; [link: string]: unknown } | null };

/** The newest 25 messages of one conversation (newest first), and its link when Mighty gives one. */
export async function threadPage(token: string, conversationId: string): Promise<{ messages: ChatMessage[]; link: string | null } | { error: string; refused: boolean }> {
  const field = await conversationLinkField(token);
  const query = `query Thread($id: ID!) {
  node(id: $id) {
    ... on DirectMessage {
      ${field ?? ''}
      messages(first: 25) { nodes { id createdAt actorType textText member { id resourceId } } }
    }
  }
}`;
  const r = await gql<ThreadPage>(token, query, { id: conversationId });
  if ('error' in r) return r;
  const node = r.data.node;
  if (!node?.messages) return { error: `Mighty Networks (GraphQL): conversation ${conversationId} could not be read as a private conversation.`, refused: false };
  const raw = field ? node[field] : null;
  return { messages: node.messages.nodes ?? [], link: typeof raw === 'string' && /^https:\/\//.test(raw) ? raw : null };
}
