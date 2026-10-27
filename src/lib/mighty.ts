/**
 * The QuinB network on Mighty Networks, by plain HTTP: the Admin API.
 *
 * Server-only settings in Vercel:
 *   MIGHTY_API_KEY     Mighty Networks › Admin › Integrations › API (the plan must include the Admin API)
 *   MIGHTY_NETWORK_ID  optional: the network's number or subdomain. Without it, QuinB's own
 *                      subdomain is used; the spec takes either in the address.
 * Without the key `mightyReady()` names what is missing and nothing is called.
 *
 * Spec: https://api.mn.co/admin/v1/spec.json — base https://api.mn.co,
 * Bearer token. Lists come back in pages of at most 100. The page wrapper is
 * not described in the spec, so `itemsOf` accepts the shapes such APIs use,
 * and says so when a page comes in a shape it does not know.
 */

import { occurrences, type MnEvent, type Occurrence } from '@/lib/events';

export const MIGHTY_ENV = { key: 'MIGHTY_API_KEY', network: 'MIGHTY_NETWORK_ID' } as const;

/**
 * What was read from QuinB is kept a while (QuinbLive.tsx), so a reload does
 * not ask Mighty again: Conversations 5 minutes, Events 15. Her own answer
 * clears the Conversations copy at once.
 */
export const QUINB_CACHE = { conversations: { tag: 'quinb-conversations', seconds: 300 }, events: { tag: 'quinb-events', seconds: 900 } } as const;

/** How far back the Conversations tab looks. */
export const LOOK_BACK_DAYS = 30;

const BASE = 'https://api.mn.co/admin/v1';
const PER_PAGE = 100;
const day = 86_400_000;

/** QuinB's subdomain on Mighty Networks (its network slug), read when MIGHTY_NETWORK_ID is not set. */
const QUINB_NETWORK = 'quinb';
/** The spec's two forms of network_id: the number, or the subdomain. */
const NETWORK_ID = /^(\d+|[a-z][a-z0-9-]+)$/;

// Trimmed: a value pasted into Vercel can carry a space or a line break.
const apiKey = () => (process.env.MIGHTY_API_KEY ?? '').trim();
const networkId = () => (process.env.MIGHTY_NETWORK_ID ?? '').trim() || QUINB_NETWORK;

/** missing: not set at all. wrong: set, but to something the API cannot take. */
export function mightyReady(): { ok: true } | { ok: false; missing: string[]; wrong: string[] } {
  const missing = apiKey() ? [] : [MIGHTY_ENV.key];
  const wrong = NETWORK_ID.test(networkId()) ? [] : [MIGHTY_ENV.network];
  return missing.length || wrong.length ? { ok: false, missing, wrong } : { ok: true };
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
type MnSpace = { id: number; name: string };

/** Whether a member's post or comment of the last LOOK_BACK_DAYS days has an answer from her. */
export type NoteStatus = 'waiting' | 'answered';

/** One post or comment in a conversation. */
export type Note = {
  kind: 'post' | 'comment';
  id: number;
  /** "You" for her own. */
  author: string;
  /** The real name, for the initials when there is no picture. */
  authorName: string;
  avatar: string | null;
  mine: boolean;
  text: string;
  at: string;
  /** A reply to a comment, drawn indented under the comment it belongs to. */
  reply: boolean;
  /** Written in the last LOOK_BACK_DAYS days. */
  recent: boolean;
  /** Only for someone else's post or comment of the last LOOK_BACK_DAYS days. */
  status: NoteStatus | null;
  link: string | null;
};

/** A post and everything said under it, the way the community shows it. */
export type Thread = {
  postId: number;
  title: string | null;
  space: string | null;
  post: Note;
  /** Oldest first; each reply right after the comment it belongs to. */
  comments: Note[];
  /** The last thing written in it. */
  lastAt: string;
  waiting: number;
  answered: number;
  /** Its comments could not be read (or only part of them): then nothing in it gets a status. */
  unread: string | null;
};

// ------------------------------------------------------------------- calls

type Got<T> = { data: T } | { error: string };

/**
 * Mighty limits how many calls a key may make in a short time and answers 429
 * past it (docs.mightynetworks.com › Admin API › rate limiting: back off and
 * try again). A 429 is waited out: Retry-After when Mighty sends it, else 2
 * and then 5 seconds, twice at most, so a page never hangs for long.
 */
const RETRY_WAITS = [2_000, 5_000];
const MAX_WAIT = 8_000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
function retryAfter(res: Response, fallback: number): number {
  const h = res.headers.get('retry-after');
  if (!h) return fallback;
  const secs = Number(h);
  const ms = Number.isFinite(secs) ? secs * 1000 : Date.parse(h) - Date.now();
  return Number.isFinite(ms) && ms > 0 ? Math.min(ms, MAX_WAIT) : fallback;
}

async function call<T>(path: string, init?: { method?: string; body?: unknown }, attempt = 0): Promise<Got<T>> {
  const ready = mightyReady();
  if (!ready.ok) {
    return { error: [
      ready.missing.length ? `${ready.missing.join(' and ')} not set in Vercel.` : '',
      ready.wrong.length ? `${ready.wrong.join(' and ')} in Vercel is neither a network number nor a subdomain.` : '',
    ].filter(Boolean).join(' ') };
  }
  try {
    const res = await fetch(`${BASE}/networks/${networkId()}${path}`, {
      method: init?.method ?? 'GET',
      headers: { Authorization: `Bearer ${apiKey()}`, Accept: 'application/json', ...(init?.body ? { 'Content-Type': 'application/json' } : {}) },
      body: init?.body ? JSON.stringify(init.body) : undefined,
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    });
    // Only reads are tried again: a post that reached Mighty must not be written twice.
    if (res.status === 429 && (init?.method ?? 'GET') === 'GET' && attempt < RETRY_WAITS.length) {
      await sleep(retryAfter(res, RETRY_WAITS[attempt]));
      return call<T>(path, init, attempt + 1);
    }
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      const why = (json && typeof json === 'object' && 'error' in json) ? String((json as { error: unknown }).error) : res.statusText;
      // The spec's 401 also covers a key that belongs to another network than the one asked for.
      if (res.status === 401 || res.status === 403) return { error: `Mighty Networks refused the key for network ${networkId()} (${res.status}): ${why}. Check ${MIGHTY_ENV.key}, that it was made in that network, and that the plan includes the Admin API.` };
      if (res.status === 404 && path === '/me') return { error: `Mighty Networks does not know network ${networkId()}. Check ${MIGHTY_ENV.network}.` };
      if (res.status === 429) return { error: `Mighty Networks says too many requests were made in a short time (429), and it still did after waiting. This page asks again in a few minutes by itself; reload then. (${why})` };
      return { error: `Mighty Networks answered ${res.status}: ${why}` };
    }
    return { data: json as T };
  } catch (err) {
    return { error: err instanceof Error ? `Could not reach Mighty Networks: ${err.message}` : 'Could not reach Mighty Networks.' };
  }
}

/**
 * The list inside a page, whatever the wrapper is called; null when it is in
 * none of them, so an unknown shape is not mistaken for an empty list (that
 * would read as "All answered").
 */
export function itemsOf<T>(page: unknown): T[] | null {
  if (Array.isArray(page)) return page as T[];
  if (page && typeof page === 'object') {
    for (const k of ['items', 'data', 'results', 'records']) {
      const v = (page as Record<string, unknown>)[k];
      if (Array.isArray(v)) return v as T[];
    }
  }
  return null;
}

/** A whole list; `cut` when it stopped at `maxPages` while Mighty may have had more. */
type List<T> = { data: T[]; cut: boolean } | { error: string };

/** Every page of a list, up to `maxPages`. Stops at the first short page. */
async function all<T>(path: string, maxPages: number): Promise<List<T>> {
  const out: T[] = [];
  const sep = path.includes('?') ? '&' : '?';
  for (let page = 1; page <= maxPages; page++) {
    const r = await call<unknown>(`${path}${sep}page=${page}&per_page=${PER_PAGE}`);
    if ('error' in r) return page === 1 ? r : { data: out, cut: true };
    const items = itemsOf<T>(r.data);
    if (!items) {
      const d = r.data;
      const shape = d && typeof d === 'object' ? `with ${Object.keys(d).join(', ') || 'nothing'} in it` : d === null ? 'empty' : `as ${typeof d}`;
      return { error: `Mighty Networks sent the list ${path} in a shape this page does not read (${shape}).` };
    }
    out.push(...items);
    if (items.length < PER_PAGE) return { data: out, cut: false };
  }
  return { data: out, cut: true };
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
    // <br dir="auto"> as well as <br> and <br/>: Mighty writes the first.
    .replace(/<\s*br\b[^>]*>/gi, '\n')
    .replace(/<\/\s*(p|div|li|h\d|blockquote)\s*>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, '&')
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

/** Milliseconds of an instant; the API writes offsets as +00:00 or Z, so strings are not compared. */
const ms = (s: string | null | undefined) => { const t = s ? Date.parse(s) : NaN; return Number.isNaN(t) ? 0 : t; };

/**
 * The conversations of the last stretch: every post written since `since`,
 * or with a comment written since then, with all its comments. Newest
 * activity first.
 *
 * Answered (Giulia, 16 Oct 2026: "filter with answered and unanswered"):
 *   - someone else's post: once she has commented on it;
 *   - someone else's comment: once she has written in its branch after it
 *     (a reply to it, or a later reply under the same comment). Mighty may
 *     point a reply at the comment above it or at the first one, so the
 *     branch is what counts, not the exact comment replied to.
 * Only what was written since `since` gets a status; older is context.
 * A post whose comments could not be read whole (`unread`: why) is still
 * shown, without statuses: from part of a conversation no answer can be
 * judged.
 */
export function threadsOf(
  me: number, myName: string, posts: MnPost[], comments: Map<number, MnComment[]>,
  people: Map<number, MnMember>, spaces: Map<number, string>, since: number, subdomain: string | null,
  unread: Map<number, string> = new Map(),
): Thread[] {
  const nameOf = (id: number) => (id === me ? myName : nameOfMember(people.get(id), id));
  const out: Thread[] = [];
  for (const p of posts) {
    const cs = [...(comments.get(p.id) ?? [])].sort((a, b) => ms(a.created_at) - ms(b.created_at));
    const postAt = p.published_at ?? p.created_at;
    const why = unread.get(p.id) ?? null;
    if (!why && ms(postAt) < since && !cs.some((c) => ms(c.created_at) >= since)) continue;

    const byId = new Map(cs.map((c) => [c.id, c]));
    // The top-level comment a reply hangs under, however deep it is.
    const rootOf = (c: MnComment) => {
      let x = c;
      for (let n = 0; x.reply_to_id != null && byId.has(x.reply_to_id) && n < 50; n++) x = byId.get(x.reply_to_id)!;
      return x.id;
    };
    const roots = new Map(cs.map((c) => [c.id, rootOf(c)]));
    const mineIn = (root: number, after: number) => cs.some((m) => m.author_id === me && roots.get(m.id) === root && ms(m.created_at) > after);

    const note = (kind: Note['kind'], id: number, authorId: number, html: string | null | undefined, at: string, permalink: string | null, reply: boolean, answered: () => boolean): Note => {
      const mine = authorId === me;
      const recent = ms(at) >= since;
      return {
        kind, id, author: mine ? 'You' : nameOf(authorId), authorName: nameOf(authorId), avatar: people.get(authorId)?.avatar || null, mine,
        text: plainText(html), at, reply, recent, status: mine || !recent || why ? null : answered() ? 'answered' : 'waiting', link: linkOf(permalink, subdomain),
      };
    };

    const post = note('post', p.id, p.creator_id, p.description || p.summary, postAt, p.permalink, false, () => cs.some((c) => c.author_id === me));
    // Each top-level comment, then the replies under it.
    const ordered = cs.filter((c) => roots.get(c.id) === c.id).flatMap((top) => [top, ...cs.filter((c) => c.id !== top.id && roots.get(c.id) === top.id)]);
    const notes = ordered.map((c) => note('comment', c.id, c.author_id, c.text, c.created_at, c.permalink, c.id !== roots.get(c.id), () => mineIn(roots.get(c.id)!, ms(c.created_at))));
    const items = [post, ...notes];
    out.push({
      postId: p.id,
      title: p.title?.trim() || null,
      space: p.space_id != null ? spaces.get(p.space_id) ?? null : null,
      post,
      comments: notes,
      lastAt: items.reduce((a, n) => (ms(n.at) > ms(a) ? n.at : a), postAt),
      waiting: items.filter((n) => n.status === 'waiting').length,
      answered: items.filter((n) => n.status === 'answered').length,
      unread: why,
    });
  }
  return out.sort((a, b) => ms(b.lastAt) - ms(a.lastAt));
}

// ----------------------------------------------------------------- reading

const sinceMs = (days: number) => Date.now() - days * day;

/** The most posts read with their comments on one visit: one call to Mighty each. */
export const MAX_THREADS = 60;

/** QuinB Community › Conversations: the posts and comments of the last LOOK_BACK_DAYS days. */
export async function readConversations(): Promise<{ threads: Thread[]; more: number } | { error: string }> {
  const me = await call<MnMe>('/me');
  if ('error' in me) return me;
  const myId = me.data.user?.id;
  if (myId == null) return { error: 'Mighty Networks did not say who the key belongs to.' };
  const sub = me.data.network?.subdomain ?? null;
  const since = sinceMs(LOOK_BACK_DAYS);

  // The API does not say in which order posts come, so read far enough back to be sure.
  // Names, pictures and spaces come with whole lists: three calls instead of one per person.
  const [posts, members, spaces] = await Promise.all([
    all<MnPost>('/posts', 20), all<MnMember>('/members', 50), all<MnSpace>('/spaces', 10),
  ]);
  if ('error' in posts) return posts;
  const active = posts.data
    .filter((p) => ms(p.last_activity_at ?? p.published_at ?? p.created_at) >= since)
    .sort((a, b) => ms(b.last_activity_at ?? b.created_at) - ms(a.last_activity_at ?? a.created_at));
  const live = active.slice(0, MAX_THREADS);

  // 2,000 comments a post; a post with more says so rather than being judged on part of it.
  // Three at a time: Mighty counts calls per minute.
  const lists = await pool(live, 3, (p) => all<MnComment>(`/posts/${p.id}/comments`, 20));
  // One post that cannot be read does not take the others with it; only when none can is it the tab's error.
  const firstError = lists.find((x): x is { error: string } => 'error' in x);
  if (firstError && lists.every((x) => 'error' in x)) return firstError;
  const comments = new Map<number, MnComment[]>();
  const unread = new Map<number, string>();
  live.forEach((p, i) => {
    const l = lists[i];
    if ('error' in l) unread.set(p.id, `Its comments could not be read: ${l.error}`);
    else {
      comments.set(p.id, l.data);
      if (l.cut) unread.set(p.id, `Only part of its comments could be read here (${l.data.length}).`);
    }
  });

  // Without the member or space list the conversations still show, with "Member 123" and no space.
  const people = new Map('data' in members ? members.data.map((m) => [m.id, m]) : []);
  const spaceNames = new Map('data' in spaces ? spaces.data.map((s) => [s.id, s.name]) : []);
  const myName = me.data.user?.name?.trim() || nameOfMember(people.get(myId), myId);

  return { threads: threadsOf(myId, myName, live, comments, people, spaceNames, since, sub, unread), more: active.length - live.length };
}

/** How far ahead the Events tab looks. */
export const EVENTS_AHEAD_DAYS = 183;

/** QuinB Community › Events: every date of every event from now to EVENTS_AHEAD_DAYS ahead, soonest first. */
export async function readEvents(): Promise<{ events: (Occurrence & { space: string | null; link: string | null })[]; until: string } | { error: string }> {
  const [events, spaces] = await Promise.all([all<MnEvent>('/events', 20), all<MnSpace>('/spaces', 10)]);
  if ('error' in events) return events;
  // A list in a shape not read here says so, rather than showing "no events".
  if (events.data.length && !events.data.some((e) => e && typeof e === 'object' && 'starts_at' in e)) {
    return { error: `Mighty Networks sent the events without a start date this page knows (it sent ${Object.keys(events.data[0] ?? {}).join(', ') || 'nothing'}).` };
  }
  const now = Date.now();
  const until = now + EVENTS_AHEAD_DAYS * day;
  const names = new Map('data' in spaces ? spaces.data.map((s) => [s.id, s.name]) : []);
  // The network's subdomain, for links that come as a path.
  const sub = /^\d+$/.test(networkId()) ? null : networkId();
  const seen = new Set<string>();
  const out = events.data.flatMap((e) => occurrences(e, now, until)).filter((o) => {
    // The list may hold a repeating event once per date already: one row per date.
    const k = `${o.title}|${o.start}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  }).map((o) => ({ ...o, space: o.spaceId != null ? names.get(o.spaceId) ?? null : null, link: linkOf(o.permalink, sub) }));
  out.sort((a, b) => ms(a.start) - ms(b.start));
  return { events: out, until: new Date(until).toISOString() };
}

// ----------------------------------------------------------------- writing

/** Her answer, as a comment on the post; with `replyToId` it answers that comment. */
export async function answer(postId: number, text: string, replyToId?: number | null): Promise<{ error: string | null }> {
  const body: Record<string, unknown> = { text };
  if (replyToId != null) body.reply_to_id = replyToId;
  const r = await call<unknown>(`/posts/${postId}/comments`, { method: 'POST', body });
  return { error: 'error' in r ? r.error : null };
}
