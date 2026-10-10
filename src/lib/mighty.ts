/**
 * The QuinB network on Mighty Networks, by plain HTTP: the Admin API.
 *
 * Needs two server-only settings in Vercel:
 *   MIGHTY_API_KEY     Mighty Networks › Settings › API Keys (the plan must include the Admin API)
 *   MIGHTY_NETWORK_ID  the number of the QuinB network, shown on the same page
 * Without them `mightyReady()` names what is missing and nothing is called.
 *
 * Spec: https://docs.mightynetworks.com/admin-api — base https://api.mn.co,
 * Bearer token. Lists come back in pages of at most 100. The page wrapper is
 * not described in the spec, so `itemsOf` accepts the shapes such APIs use.
 */

export const MIGHTY_ENV = { key: 'MIGHTY_API_KEY', network: 'MIGHTY_NETWORK_ID' } as const;

/** How far back the Comments and New members tabs look. */
export const LOOK_BACK_DAYS = 30;

const BASE = 'https://api.mn.co/admin/v1';
const PER_PAGE = 100;
const day = 86_400_000;

export function mightyReady(): { ok: true } | { ok: false; missing: string[] } {
  const missing = [
    !process.env.MIGHTY_API_KEY && MIGHTY_ENV.key,
    !/^\d+$/.test(process.env.MIGHTY_NETWORK_ID ?? '') && MIGHTY_ENV.network,
  ].filter(Boolean) as string[];
  return missing.length ? { ok: false, missing } : { ok: true };
}

// ------------------------------------------------------------------ shapes

export type MnPost = {
  id: number; created_at: string; creator_id: number; space_id: number | null; title: string | null;
  summary: string | null; description: string | null; published_at: string | null; last_activity_at: string | null; permalink: string | null;
};
export type MnComment = {
  id: number; created_at: string; targetable_id: number; text: string; depth: number | null;
  reply_to_id: number | null; author_id: number; space_id: number | null; permalink: string | null;
};
export type MnMember = {
  id: number; created_at: string; email: string | null; first_name: string | null; last_name: string | null;
  location: string | null; bio: string | null; avatar: string | null; permalink: string | null; member_type: string | null;
};
type MnMe = { user: { id: number; name: string | null; email: string | null }; network: { id: number; subdomain: string | null; title: string | null } };

/** One thing in the community that waits for her: a member's post or comment she has not answered. */
export type Waiting = {
  kind: 'post' | 'comment';
  id: number;
  postId: number;
  postTitle: string;
  authorId: number;
  authorName: string;
  text: string;
  at: string;
  link: string | null;
  /** For a comment that answers someone else: what it answers. */
  inReplyTo: string | null;
};

export type Newcomer = { id: number; name: string; email: string | null; joined: string; location: string | null; bio: string | null; link: string | null };

// ------------------------------------------------------------------- calls

type Got<T> = { data: T } | { error: string };

async function call<T>(path: string, init?: { method?: string; body?: unknown }): Promise<Got<T>> {
  const ready = mightyReady();
  if (!ready.ok) return { error: `${ready.missing.join(' and ')} not set in Vercel.` };
  try {
    const res = await fetch(`${BASE}/networks/${process.env.MIGHTY_NETWORK_ID}${path}`, {
      method: init?.method ?? 'GET',
      headers: { Authorization: `Bearer ${process.env.MIGHTY_API_KEY}`, Accept: 'application/json', ...(init?.body ? { 'Content-Type': 'application/json' } : {}) },
      body: init?.body ? JSON.stringify(init.body) : undefined,
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      const why = (json && typeof json === 'object' && 'error' in json) ? String((json as { error: unknown }).error) : res.statusText;
      if (res.status === 401 || res.status === 403) return { error: `Mighty Networks refused the key (${res.status}): ${why}. Check ${MIGHTY_ENV.key} and that the plan includes the Admin API.` };
      if (res.status === 404 && path === '/me') return { error: `Mighty Networks does not know network ${process.env.MIGHTY_NETWORK_ID}. Check ${MIGHTY_ENV.network}.` };
      return { error: `Mighty Networks answered ${res.status}: ${why}` };
    }
    return { data: json as T };
  } catch (err) {
    return { error: err instanceof Error ? `Could not reach Mighty Networks: ${err.message}` : 'Could not reach Mighty Networks.' };
  }
}

/** The list inside a page, whatever the wrapper is called. */
export function itemsOf<T>(page: unknown): T[] {
  if (Array.isArray(page)) return page as T[];
  if (page && typeof page === 'object') {
    for (const k of ['items', 'data', 'results', 'records']) {
      const v = (page as Record<string, unknown>)[k];
      if (Array.isArray(v)) return v as T[];
    }
  }
  return [];
}

/** Every page of a list, up to `maxPages`. Stops at the first short page. */
async function all<T>(path: string, maxPages: number): Promise<Got<T[]>> {
  const out: T[] = [];
  const sep = path.includes('?') ? '&' : '?';
  for (let page = 1; page <= maxPages; page++) {
    const r = await call<unknown>(`${path}${sep}page=${page}&per_page=${PER_PAGE}`);
    if ('error' in r) return page === 1 ? r : { data: out };
    const items = itemsOf<T>(r.data);
    out.push(...items);
    if (items.length < PER_PAGE) break;
  }
  return { data: out };
}

/** Runs `fn` over `xs`, a few at a time, so a long list does not open fifty connections at once. */
async function pool<X, Y>(xs: X[], size: number, fn: (x: X) => Promise<Y>): Promise<Y[]> {
  const out: Y[] = new Array(xs.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(size, xs.length) }, async () => {
    while (next < xs.length) { const i = next++; out[i] = await fn(xs[i]); }
  }));
  return out;
}

// ------------------------------------------------------------------ pure parts

/** Comment and post bodies come as HTML. This keeps the words and the line breaks, nothing else. */
export function plainText(html: string | null | undefined): string {
  return (html ?? '')
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/\s*(p|div|li|h\d)\s*>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, '&')
    .replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** A permalink may be a full address or a path inside the network. */
export function linkOf(permalink: string | null | undefined, subdomain: string | null | undefined): string | null {
  if (!permalink) return null;
  if (/^https?:\/\//.test(permalink)) return permalink;
  if (!subdomain) return null;
  return `https://${subdomain}.mn.co${permalink.startsWith('/') ? '' : '/'}${permalink}`;
}

export const nameOfMember = (m: Pick<MnMember, 'first_name' | 'last_name' | 'email'> | undefined, id: number) =>
  [m?.first_name, m?.last_name].filter(Boolean).join(' ') || m?.email || `Member ${id}`;

/**
 * What waits for her, from posts and their comments:
 *   - a comment by someone else that she has not answered (no comment of hers replies to it);
 *   - a post by someone else with no comment of hers on it at all.
 * Only what was written since `since`. Newest first.
 */
/** Milliseconds of an instant; the API writes offsets as +00:00 or Z, so strings are not compared. */
const ms = (s: string | null | undefined) => { const t = s ? Date.parse(s) : NaN; return Number.isNaN(t) ? 0 : t; };

export type RawWaiting = Omit<Waiting, 'authorName' | 'link'> & { permalink: string | null };

export function waitingFor(me: number, posts: MnPost[], comments: Map<number, MnComment[]>, since: number): RawWaiting[] {
  const out: RawWaiting[] = [];
  for (const p of posts) {
    const cs = comments.get(p.id) ?? [];
    const byId = new Map(cs.map((c) => [c.id, c]));
    const answered = new Set(cs.filter((c) => c.author_id === me && c.reply_to_id != null).map((c) => c.reply_to_id as number));
    const postTitle = p.title?.trim() || plainText(p.summary ?? p.description).slice(0, 80) || `Post ${p.id}`;
    const postAt = p.published_at ?? p.created_at;
    if (p.creator_id !== me && ms(postAt) >= since && !cs.some((c) => c.author_id === me)) {
      out.push({ kind: 'post', id: p.id, postId: p.id, postTitle, authorId: p.creator_id, text: plainText(p.description ?? p.summary), at: postAt, inReplyTo: null, permalink: p.permalink });
    }
    for (const c of cs) {
      if (c.author_id === me || ms(c.created_at) < since || answered.has(c.id)) continue;
      const parent = c.reply_to_id != null ? byId.get(c.reply_to_id) : undefined;
      out.push({
        kind: 'comment', id: c.id, postId: p.id, postTitle, authorId: c.author_id, text: plainText(c.text), at: c.created_at,
        inReplyTo: parent ? plainText(parent.text).slice(0, 140) : null, permalink: c.permalink,
      });
    }
  }
  return out.sort((a, b) => ms(b.at) - ms(a.at));
}

// ----------------------------------------------------------------- reading

const sinceMs = (days: number) => Date.now() - days * day;

/** Comments and posts by members, last LOOK_BACK_DAYS days, that she has not answered. */
export async function readWaiting(): Promise<{ items: Waiting[] } | { error: string }> {
  const me = await call<MnMe>('/me');
  if ('error' in me) return me;
  const myId = me.data.user?.id;
  if (myId == null) return { error: 'Mighty Networks did not say who the key belongs to.' };
  const sub = me.data.network?.subdomain ?? null;
  const since = sinceMs(LOOK_BACK_DAYS);

  // The API does not say in which order posts come, so read far enough back to be sure.
  const posts = await all<MnPost>('/posts', 20);
  if ('error' in posts) return posts;
  const live = posts.data
    .filter((p) => ms(p.last_activity_at ?? p.published_at ?? p.created_at) >= since)
    .sort((a, b) => ms(b.last_activity_at ?? b.created_at) - ms(a.last_activity_at ?? a.created_at))
    .slice(0, 60);

  const lists = await pool(live, 6, (p) => all<MnComment>(`/posts/${p.id}/comments`, 3));
  const failed = lists.find((x): x is { error: string } => 'error' in x);
  if (failed) return failed;
  const comments = new Map(live.map((p, i) => [p.id, (lists[i] as { data: MnComment[] }).data]));

  const raw = waitingFor(myId, live, comments, since);
  const authors = [...new Set(raw.map((w) => w.authorId))].slice(0, 80);
  const found = await pool(authors, 6, (id) => call<MnMember>(`/members/${id}/`));
  const people = new Map(authors.map((id, i) => [id, 'data' in found[i] ? (found[i] as { data: MnMember }).data : undefined]));

  return {
    items: raw.map(({ permalink, ...w }) => ({ ...w, authorName: nameOfMember(people.get(w.authorId), w.authorId), link: linkOf(permalink, sub) })),
  };
}

/** Members who joined in the last LOOK_BACK_DAYS days, newest first. */
export async function readNewcomers(): Promise<{ items: Newcomer[] } | { error: string }> {
  const me = await call<MnMe>('/me');
  if ('error' in me) return me;
  const sub = me.data.network?.subdomain ?? null;
  const members = await all<MnMember>('/members', 50);
  if ('error' in members) return members;
  const since = sinceMs(LOOK_BACK_DAYS);
  return {
    items: members.data
      .filter((m) => ms(m.created_at) >= since && m.id !== me.data.user?.id)
      .sort((a, b) => ms(b.created_at) - ms(a.created_at))
      .map((m) => ({ id: m.id, name: nameOfMember(m, m.id), email: m.email, joined: m.created_at, location: m.location, bio: m.bio, link: linkOf(m.permalink, sub) })),
  };
}

// ----------------------------------------------------------------- writing

/** Her answer, as a comment on the post; with `replyToId` it answers that comment. */
export async function answer(postId: number, text: string, replyToId?: number | null): Promise<{ error: string | null }> {
  const body: Record<string, unknown> = { text };
  if (replyToId != null) body.reply_to_id = replyToId;
  const r = await call<unknown>(`/posts/${postId}/comments`, { method: 'POST', body });
  return { error: 'error' in r ? r.error : null };
}
