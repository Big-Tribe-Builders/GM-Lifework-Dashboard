import { unstable_cache } from 'next/cache';
import { mightyReady, readConversations, readEvents, LOOK_BACK_DAYS, MAX_THREADS, MIGHTY_ENV, QUINB_CACHE, EVENTS_AHEAD_DAYS, type Note } from '@/lib/mighty';
import { Conversations, type NoteView, type ThreadView } from '@/components/QuinbInbox';

/**
 * The tabs that read the QuinB network itself: Conversations and Events.
 * Server components: the key never reaches the browser. What was read is
 * kept a few minutes (QUINB_CACHE), so reloading does not run into Mighty's
 * per-minute limit; a failed read is never kept. Without the key they say
 * exactly what is missing.
 */

/** A failed read throws, so it is not kept; the tab catches it and shows why. */
const kept = <T,>(read: () => Promise<T | { error: string }>, name: keyof typeof QUINB_CACHE) => unstable_cache(async () => {
  const r = await read();
  if (r && typeof r === 'object' && 'error' in r) throw new Error((r as { error: string }).error);
  return { ...(r as T), readAt: new Date().toISOString() };
}, [QUINB_CACHE[name].tag, 'v1'], { revalidate: QUINB_CACHE[name].seconds, tags: [QUINB_CACHE[name].tag] });
const keptConversations = kept(readConversations, 'conversations');
const keptEvents = kept(readEvents, 'events');
const failure = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong while reading QuinB.');
const clock = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { timeZone: 'Europe/Brussels', hour: '2-digit', minute: '2-digit' });

const when = (iso: string) => new Date(iso).toLocaleString('en-GB', {
  timeZone: 'Europe/Brussels', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
});
const whenWithYear = (iso: string) => new Date(iso).toLocaleString('en-GB', {
  timeZone: 'Europe/Brussels', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
});
/** The list's dates: the day, and the year only when it is another one. */
const dayMonth = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { timeZone: 'Europe/Brussels', day: 'numeric', month: 'short' });
const dayMonthYear = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { timeZone: 'Europe/Brussels', day: 'numeric', month: 'short', year: 'numeric' });
const yearOf = (iso: string) => new Date(iso).toLocaleString('en-GB', { timeZone: 'Europe/Brussels', year: 'numeric' });

function Missing({ missing, wrong, what }: { missing: string[]; wrong: string[]; what: string }) {
  return (
    <div className="notice">
      <span className="icon-chip icon-chip--sm accent-orange">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="8.5" /><path d="M12 8v5M12 16h.01" /></svg>
      </span>
      <div>
        <p className="row__title" style={{ fontSize: 14 }}>{what} come straight from the QuinB network. This is built; it waits for {missing.length + wrong.length === 1 ? 'one setting' : 'two settings'} in Vercel.</p>
        <ul className="muted notice__list">
          {missing.includes(MIGHTY_ENV.key) ? (
            <li><code>{MIGHTY_ENV.key}</code>: in Mighty Networks, Admin › Integrations › API › create a key. The Admin API comes with the Scale, Growth and Mighty Pro plans; if there is no API page, the QuinB plan does not include it.</li>
          ) : null}
          {wrong.includes(MIGHTY_ENV.network) ? (
            <li><code>{MIGHTY_ENV.network}</code> is set, but to neither the network&apos;s number nor its subdomain (small letters, digits and hyphens). Correct it, or delete it: without it the QuinB network is read.</li>
          ) : null}
          <li>Then redeploy. Until then nothing is called and nothing is stored.</li>
        </ul>
      </div>
    </div>
  );
}

function Failed({ error }: { error: string }) {
  return (
    <div className="notice">
      <span className="icon-chip icon-chip--sm accent-orange">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="8.5" /><path d="M12 8v5M12 16h.01" /></svg>
      </span>
      <div>
        <p className="row__title" style={{ fontSize: 14 }}>The QuinB network could not be read</p>
        <p className="muted" style={{ marginTop: 2 }}>{error}</p>
      </div>
    </div>
  );
}

/** QuinB Community › Conversations. */
export async function ConversationsTab() {
  const ready = mightyReady();
  if (!ready.ok) return <Missing missing={ready.missing} wrong={ready.wrong} what="Conversations" />;
  let r: Awaited<ReturnType<typeof keptConversations>>;
  try { r = await keptConversations(); } catch (e) { return <Failed error={failure(e)} />; }
  // Dates are written here, once, so the browser draws exactly what the server did.
  // An older one carries its year, or "Sat 20 Sept" from last year reads as last month.
  const thisYear = yearOf(new Date().toISOString());
  const view = (n: Note): NoteView => ({ ...n, when: yearOf(n.at) === thisYear ? when(n.at) : whenWithYear(n.at) });
  const short = (iso: string) => (yearOf(iso) === thisYear ? dayMonth(iso) : dayMonthYear(iso));
  const threads: ThreadView[] = r.threads.map((t) => ({ ...t, post: view(t.post), comments: t.comments.map(view), lastWhen: short(t.lastAt) }));
  return <Conversations threads={threads} more={r.more} days={LOOK_BACK_DAYS} max={MAX_THREADS} readAt={clock(r.readAt)} />;
}

const evDay = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { timeZone: 'Europe/Brussels', weekday: 'short', day: 'numeric', month: 'short' });
const evMonth = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { timeZone: 'Europe/Brussels', month: 'long', year: 'numeric' });

/** QuinB Community › Events: every planned date, soonest first, by month. */
export async function EventsTab() {
  const ready = mightyReady();
  if (!ready.ok) return <Missing missing={ready.missing} wrong={ready.wrong} what="Events" />;
  let r: Awaited<ReturnType<typeof keptEvents>>;
  try { r = await keptEvents(); } catch (e) { return <Failed error={failure(e)} />; }
  const months = new Map<string, typeof r.events>();
  for (const e of r.events) { const k = evMonth(e.start); months.set(k, [...(months.get(k) ?? []), e]); }
  return (
    <div className="events">
      <p className="tabnote">The next {Math.round(EVENTS_AHEAD_DAYS / 30.4)} months, until {evDay(r.until)}; times in Brussels. Read from QuinB at {clock(r.readAt)}.</p>
      {r.events.length === 0 ? <p className="events__empty">No events planned in QuinB for the next {Math.round(EVENTS_AHEAD_DAYS / 30.4)} months.</p> : null}
      {[...months].map(([month, list]) => (
        <section key={month} className="events__month" aria-label={month}>
          <h2 className="events__monthname">{month} <span className="muted">· {list.length} {list.length === 1 ? 'event' : 'events'}</span></h2>
          <ul className="events__list">
            {list.map((e) => (
              <li key={`${e.id}-${e.start}`} className="events__row">
                <time className="events__when" dateTime={e.start}><strong>{evDay(e.start)}</strong> <span className="muted">{clock(e.start)}–{clock(e.end)}</span></time>
                <span className="events__main">
                  <span className="events__title">{e.title}</span>
                  <span className="events__meta muted">{[e.space, e.repeats].filter(Boolean).join(' · ')}</span>
                </span>
                {e.link ? <a className="btn btn--ghost btn--tiny events__open" href={e.link} target="_blank" rel="noreferrer">Open in QuinB</a> : null}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
