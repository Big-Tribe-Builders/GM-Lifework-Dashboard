import { mightyReady, readConversations, LOOK_BACK_DAYS, MAX_THREADS, MIGHTY_ENV, type Note } from '@/lib/mighty';
import { Conversations, type NoteView, type ThreadView } from '@/components/QuinbInbox';

/**
 * The tab that reads the QuinB network itself: Conversations.
 * Server components: the key never reaches the browser, and every visit
 * reads fresh. Without the key they say exactly what is missing.
 */

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
  const r = await readConversations();
  if ('error' in r) return <Failed error={r.error} />;
  // Dates are written here, once, so the browser draws exactly what the server did.
  // An older one carries its year, or "Sat 20 Sept" from last year reads as last month.
  const thisYear = yearOf(new Date().toISOString());
  const view = (n: Note): NoteView => ({ ...n, when: yearOf(n.at) === thisYear ? when(n.at) : whenWithYear(n.at) });
  const short = (iso: string) => (yearOf(iso) === thisYear ? dayMonth(iso) : dayMonthYear(iso));
  const threads: ThreadView[] = r.threads.map((t) => ({ ...t, post: view(t.post), comments: t.comments.map(view), lastWhen: short(t.lastAt) }));
  return <Conversations threads={threads} more={r.more} days={LOOK_BACK_DAYS} max={MAX_THREADS} />;
}
