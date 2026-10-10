import type { QuinbMember } from '@/lib/book';
import { mightyReady, readWaiting, readNewcomers, LOOK_BACK_DAYS, MIGHTY_ENV } from '@/lib/mighty';
import { Inbox, Newcomers, type InboxItem, type NewcomerRow } from '@/components/QuinbInbox';

/**
 * The two tabs that read the QuinB network itself: Comments and New members.
 * Server components: the key never reaches the browser, and every visit
 * reads fresh. Without the key they say exactly what is missing.
 */

const when = (iso: string) => new Date(iso).toLocaleString('en-GB', {
  timeZone: 'Europe/Brussels', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
});
const dayOf = (iso: string) => new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso).toLocaleDateString('en-GB', {
  timeZone: 'Europe/Brussels', day: 'numeric', month: 'short', year: 'numeric',
});

function Missing({ missing, what }: { missing: string[]; what: string }) {
  return (
    <div className="notice">
      <span className="icon-chip icon-chip--sm accent-orange">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="8.5" /><path d="M12 8v5M12 16h.01" /></svg>
      </span>
      <div>
        <p className="row__title" style={{ fontSize: 14 }}>{what} come straight from the QuinB network. This is built; it waits for {missing.length === 1 ? 'one setting' : 'two settings'} in Vercel.</p>
        <ul className="muted notice__list">
          {missing.includes(MIGHTY_ENV.key) ? (
            <li><code>{MIGHTY_ENV.key}</code>: in Mighty Networks, Settings › API Keys › create a key. The Admin API comes with the Scale, Growth and Mighty Pro plans; if there is no API Keys page, the QuinB plan does not include it.</li>
          ) : null}
          {missing.includes(MIGHTY_ENV.network) ? (
            <li><code>{MIGHTY_ENV.network}</code>: the number of the QuinB network, shown on that same page.</li>
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

/** QuinB Community › Comments. */
export async function CommentsTab() {
  const ready = mightyReady();
  if (!ready.ok) return <Missing missing={ready.missing} what="Member comments" />;
  const r = await readWaiting();
  if ('error' in r) return <Failed error={r.error} />;
  const items: InboxItem[] = r.items.map((w) => ({
    key: `${w.kind}-${w.id}`, kind: w.kind, id: w.id, postId: w.postId, postTitle: w.postTitle, authorName: w.authorName,
    text: w.text, when: when(w.at), link: w.link, inReplyTo: w.inReplyTo,
  }));
  return (
    <div className="mailstack">
      <p className="tabnote">{items.length ? `${items.length} waiting for you` : 'All answered'} · member posts and comments of the last {LOOK_BACK_DAYS} days with no answer from you, newest first.</p>
      <Inbox items={items} />
    </div>
  );
}

/** QuinB Community › New members. Live from the network; from the Members tab until the key is there. */
export async function NewMembersTab({ members, store, accent }: { members: QuinbMember[]; store: string; accent?: string }) {
  const ready = mightyReady();
  if (!ready.ok) {
    const since = new Date(Date.now() - LOOK_BACK_DAYS * 86_400_000).toISOString().slice(0, 10);
    const rows: NewcomerRow[] = members
      .filter((m) => m.memberSince && m.memberSince >= since)
      .sort((a, b) => (b.memberSince ?? '').localeCompare(a.memberSince ?? ''))
      .map((m) => ({ key: m.id, name: m.name, email: m.email, joined: dayOf(m.memberSince!), location: null, bio: m.notes, link: null }));
    return (
      <div className="mailstack">
        <Missing missing={ready.missing} what="New members" />
        <p className="tabnote">Until then: members from the Members tab whose “member since” falls in the last {LOOK_BACK_DAYS} days.</p>
        <Newcomers rows={rows} store={store} accent={accent} />
      </div>
    );
  }
  const r = await readNewcomers();
  if ('error' in r) return <Failed error={r.error} />;
  const rows: NewcomerRow[] = r.items.map((m) => ({
    key: String(m.id), name: m.name, email: m.email, joined: dayOf(m.joined), location: m.location, bio: m.bio, link: m.link,
  }));
  return (
    <div className="mailstack">
      <p className="tabnote">{rows.length} joined in the last {LOOK_BACK_DAYS} days, newest first. Open a profile to welcome them in QuinB.</p>
      <Newcomers rows={rows} store={store} accent={accent} />
    </div>
  );
}
