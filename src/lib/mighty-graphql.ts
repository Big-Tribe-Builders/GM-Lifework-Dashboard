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
 */
import { RETRY_WAITS, retryAfter, sleep, mightyNetwork } from '@/lib/mighty';

export const GRAPHQL_ENV = 'MIGHTY_GRAPHQL_KEY';
export const ADMIN_KEY_ENV = 'MIGHTY_API_KEY';

/** A browser's User-Agent: api.mn.co's firewall rejects unusual ones. */
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

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
