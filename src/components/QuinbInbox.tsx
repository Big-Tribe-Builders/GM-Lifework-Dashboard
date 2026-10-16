'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState, useTransition, type ReactNode } from 'react';
import { answerInQuinb } from '@/app/d/quinb/actions';
import { Grid, type Column } from '@/components/Grid';
import { matches, searchWords, useSearch, useSearchable } from '@/lib/search';
import type { Note, NoteStatus, Thread } from '@/lib/mighty';

/** A post or comment ready to draw: the server has already written the date. */
export type NoteView = Note & { when: string };
export type ThreadView = Omit<Thread, 'post' | 'comments'> & { post: NoteView; comments: NoteView[] };

type Show = 'waiting' | 'answered' | 'all';

/** What the search reads in a note: the words people wrote and who wrote them, not the addresses. */
const searchable = (ns: NoteView[]) => ns.map((n) => ({ author: n.author, name: n.authorName, text: n.text }));

/**
 * QuinB Community › Conversations (Giulia, 16 Oct 2026): every post with its
 * comments under it, the way the community shows them, and a filter on
 * whether she has answered. The toolbar search looks through names, titles
 * and texts.
 */
export function Conversations({ threads, more, days, max }: { threads: ThreadView[]; more: number; days: number; max: number }) {
  useSearchable();
  const { q } = useSearch();
  const words = useMemo(() => searchWords(q), [q]);
  const hay = useMemo(() => new Map(threads.map((t) => [t.postId, { title: t.title, space: t.space, notes: searchable([t.post, ...t.comments]) }])), [threads]);

  const waiting = threads.filter((t) => t.waiting > 0);
  const answered = threads.filter((t) => t.waiting === 0 && t.answered > 0);
  const [show, setShow] = useState<Show>(waiting.length ? 'waiting' : 'all');
  // Answered just now: stays in view until another filter is picked, so it does not vanish while she reads it.
  const [kept, setKept] = useState<ReadonlySet<number>>(new Set());
  const pick = (s: Show) => { setShow(s); setKept(new Set()); };

  const base = show === 'waiting' ? threads.filter((t) => t.waiting > 0 || kept.has(t.postId)) : show === 'answered' ? answered : threads;
  const shown = words.length ? base.filter((t) => matches(hay.get(t.postId), words)) : base;
  const chips: [Show, string, number][] = [['waiting', 'Waiting for you', waiting.length], ['answered', 'Answered', answered.length], ['all', 'All', threads.length]];
  // When not every active post was read, say only what was looked at.
  const scope = more ? `the ${max} posts read here` : `the last ${days} days`;
  const empty = words.length ? `Nothing here matches “${q.trim()}”.`
    : show === 'waiting' ? (more ? `Nothing waiting for you in ${scope}.` : `Nothing waiting for you. Every member post and comment of the last ${days} days has your answer.`)
    : show === 'answered' ? `Nothing answered in ${scope} yet.`
    : `No posts or comments in the last ${days} days.`;

  return (
    <div className="convo">
      <div className="convo__bar">
        <div className="convo__filter" role="group" aria-label="Show">
          {chips.map(([k, label, n]) => (
            <button key={k} type="button" className={`chip${show === k ? ' chip--active' : ''}`} aria-pressed={show === k} onClick={() => pick(k)}>
              {label}<span className="convo__count">{n}</span>
            </button>
          ))}
        </div>
        <span className="convo__hint">Posts and comments of the last {days} days, newest first.</span>
      </div>
      {more > 0 ? <p className="tabnote">The {max} posts with the latest activity are shown; {more} more had activity in these {days} days. Open QuinB for those.</p> : null}
      {shown.length ? (
        <ol className="convo__list">
          {shown.map((t) => <ThreadCard key={t.postId} t={t} words={words} onAnswered={() => setKept((k) => new Set(k).add(t.postId))} />)}
        </ol>
      ) : <p className="convo__empty">{empty}</p>}
    </div>
  );
}

/** A post and the comments under it. */
function ThreadCard({ t, words, onAnswered }: { t: ThreadView; words: string[]; onAnswered: () => void }) {
  const [early, setEarly] = useState(false);
  // Comments come as branches: a comment and the replies under it. A branch
  // with nothing from the last days is folded away, but never split.
  const branches = useMemo(() => {
    const out: NoteView[][] = [];
    for (const n of t.comments) { if (!n.reply || !out.length) out.push([n]); else out[out.length - 1].push(n); }
    return out.map((b) => ({ notes: b, recent: b.some((n) => n.recent) }));
  }, [t.comments]);
  // While she searches, a folded branch that holds the words opens, so what matched is in view.
  const hits = useMemo(() => (words.length
    ? new Set(branches.filter((b) => !b.recent && matches({ notes: searchable(b.notes) }, words)).map((b) => b.notes[0].id))
    : null), [branches, words]);
  const visible = (b: (typeof branches)[number]) => b.recent || early || !!hits?.has(b.notes[0].id);
  const folded = branches.filter((b) => !visible(b)).reduce((s, b) => s + b.notes.length, 0);
  const anyFolded = branches.some((b) => !b.recent);
  const label = t.title ? `${t.post.author}: ${t.title}` : `${t.post.author}, ${t.post.when}`;

  return (
    <li className={`convo__thread${t.waiting ? ' convo__thread--waiting' : ''}`}>
      <article aria-label={label}>
        <div className="convo__post">
          <header className="convo__head">
            <Avatar n={t.post} />
            <div className="convo__who">
              <strong>{t.post.author}</strong>
              {t.space ? <span className="convo__where">in {t.space}</span> : null}
              <time className="convo__when" dateTime={t.post.at}>{t.post.when}</time>
            </div>
            <Status s={t.post.status} />
          </header>
          {t.title ? <h3 className="convo__title">{t.title}</h3> : null}
          {/* A post that is all title (a question) has no body to show. */}
          {t.post.text || !t.title ? <Body text={t.post.text} lines={t.post.recent ? 8 : 3} /> : null}
          {t.unread ? <p className="convo__unread" role="note">{t.unread.replace(/\.?$/, '.')} Open it in QuinB to see them all; nothing in it is marked as waiting or answered.</p> : null}
          <Reply postId={t.postId} to={t.post} verb={t.post.mine ? 'Comment' : 'Answer'} onAnswered={onAnswered}
            extra={t.comments.length ? <span className="convo__n">{t.comments.length === 1 ? '1 comment' : `${t.comments.length} comments`}</span> : null} />
        </div>
        {t.comments.length ? (
          <div className="convo__comments">
            {anyFolded && (folded || early) ? (
              <button type="button" className="convo__more convo__early" aria-expanded={early} onClick={() => setEarly(!early)}>
                {early ? 'Hide the earlier comments' : folded === 1 ? 'Show 1 earlier comment' : `Show ${folded} earlier comments`}
              </button>
            ) : null}
            {branches.filter(visible).flatMap((b) => b.notes).map((n) => (
              <Bubble key={n.id} n={n} postId={t.postId} onAnswered={onAnswered} />
            ))}
          </div>
        ) : null}
      </article>
    </li>
  );
}

/** One comment, as a speech bubble; a reply sits indented under the comment it belongs to. */
function Bubble({ n, postId, onAnswered }: { n: NoteView; postId: number; onAnswered: () => void }) {
  return (
    <div className={`convo__note${n.reply ? ' convo__note--reply' : ''}${n.mine ? ' convo__note--mine' : ''}${n.recent ? '' : ' convo__note--old'}`}>
      <Avatar n={n} small />
      <div className="convo__bubble">
        <div className="convo__meta">
          <strong>{n.author}</strong>
          <time className="convo__when" dateTime={n.at}>{n.when}</time>
          <Status s={n.status} />
        </div>
        <Body text={n.text} lines={8} />
        {n.mine
          ? (n.link ? <div className="convo__actions convo__row"><a className="link" href={n.link} target="_blank" rel="noreferrer">Open in QuinB ↗</a></div> : null)
          : <Reply postId={postId} to={n} verb="Reply" onAnswered={onAnswered} />}
      </div>
    </div>
  );
}

function Status({ s }: { s: NoteStatus | null }) {
  if (s === 'waiting') return <span className="convo__status convo__status--waiting">Waiting for you</span>;
  if (s === 'answered') return <span className="convo__status convo__status--answered">✓ Answered</span>;
  return null;
}

const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => (Array.from(w)[0] ?? '').toUpperCase()).join('') || '?';

/** Their picture from QuinB, or their initials when there is none (or it does not load). */
function Avatar({ n, small }: { n: NoteView; small?: boolean }) {
  const [broken, setBroken] = useState(false);
  const img = useRef<HTMLImageElement>(null);
  // A picture that failed before the page came alive never reports it to onError; look once it has.
  useEffect(() => {
    const el = img.current;
    if (el && el.complete && el.naturalWidth === 0) setBroken(true);
  }, [n.avatar]);
  const cls = `convo__avatar${small ? ' convo__avatar--sm' : ''}`;
  if (n.avatar && !broken) {
    // eslint-disable-next-line @next/next/no-img-element -- an outside picture, drawn as it is
    return <img ref={img} className={cls} src={n.avatar} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)} />;
  }
  return <span className={`${cls} convo__avatar--initials`} aria-hidden="true">{initials(n.authorName)}</span>;
}

/** The text with its own line breaks; one that runs longer than a few lines folds, with "Show more". */
function Body({ text, lines }: { text: string; lines: number }) {
  const [open, setOpen] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const p = useRef<HTMLParagraphElement>(null);
  // Measured, not guessed: the same text is two lines on a wide screen and six on a phone.
  useLayoutEffect(() => {
    const el = p.current;
    if (!el || open) return;
    const check = () => setOverflows(el.scrollHeight > el.clientHeight + 1);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [text, lines, open]);
  if (!text) return <p className="convo__text muted">(no text here; open it in QuinB to see it)</p>;
  return (
    <>
      <p ref={p} className={`convo__text${open ? '' : ' convo__text--clip'}`} style={open ? undefined : { WebkitLineClamp: lines }}>{text}</p>
      {overflows || open ? <button type="button" className="convo__more" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? 'Show less' : 'Show more'}</button> : null}
    </>
  );
}

/** Answer under a post, or reply to a comment, straight into QuinB. */
function Reply({ postId, to, verb, onAnswered, extra }: { postId: number; to: NoteView; verb: string; onAnswered: () => void; extra?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();
  // When the box closes (cancel, Escape, posted), the keyboard goes back to the button that opened it.
  const opener = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);
  useEffect(() => {
    if (wasOpen.current && !open) opener.current?.focus();
    wasOpen.current = open;
  }, [open]);
  const send = () => {
    setError(null);
    start(async () => {
      // The action refreshes the page itself (revalidatePath), so the new comment comes back with it.
      const r = await answerInQuinb(postId, to.kind === 'comment' ? to.id : null, text);
      if (r.error) { setError(r.error); return; }
      setDone(true); setOpen(false); setText('');
      onAnswered();
    });
  };
  const close = () => { if (!pending) { setOpen(false); setError(null); } };
  const whom = to.mine ? 'your post' : to.author;
  return (
    <div className="convo__actions">
      {open ? (
        <div className="convo__composer">
          <textarea rows={3} value={text} autoFocus disabled={pending} aria-label={`${verb} to ${whom}`} placeholder={`${verb} to ${whom}…`}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && text.trim()) send();
              if (e.key === 'Escape') close();
            }} />
          <div className="convo__row">
            <button type="button" className="btn btn--primary" disabled={pending || !text.trim()} onClick={send}>{pending ? 'Posting…' : 'Post in QuinB'}</button>
            <button type="button" className="btn btn--ghost" disabled={pending} onClick={close}>Cancel</button>
            <span className="muted">Ctrl+Enter posts it.</span>
          </div>
        </div>
      ) : (
        <div className="convo__row">
          <button ref={opener} type="button" className="btn btn--ghost btn--tiny" onClick={() => { setDone(false); setOpen(true); }}>{verb}</button>
          {done ? <span className="convo__status convo__status--answered" role="status">✓ Posted in QuinB</span> : null}
          {to.link ? <a className="link" href={to.link} target="_blank" rel="noreferrer">Open in QuinB ↗</a> : null}
          {extra}
        </div>
      )}
      {error ? <p className="field__error" role="alert">{error}</p> : null}
    </div>
  );
}

/** One newcomer, ready to draw. */
export type NewcomerRow = { key: string; name: string; email: string | null; joined: string; location: string | null; bio: string | null; link: string | null };

/** QuinB Community › New members: who joined lately, newest first, to welcome them. */
export function Newcomers({ rows, store, accent }: { rows: NewcomerRow[]; store: string; accent?: string }) {
  const columns: Column<NewcomerRow>[] = [
    { key: 'name', label: 'Name', type: 'text', width: 220, render: (r) => <span className="cell">{r.name}</span> },
    { key: 'joined', label: 'Joined', type: 'date', width: 150, render: (r) => <span className="cell">{r.joined}</span> },
    { key: 'location', label: 'Location', type: 'text', width: 180, render: (r) => <span className="cell">{r.location || <span className="muted">—</span>}</span> },
    { key: 'email', label: 'Email', type: 'text', width: 240, render: (r) => <span className="cell">{r.email || <span className="muted">—</span>}</span> },
    { key: 'bio', label: 'About them', type: 'text', width: 380, render: (r) => <span className="cell cell--clip" title={r.bio ?? ''}>{r.bio || <span className="muted">—</span>}</span> },
    { key: 'link', label: 'Profile', type: 'link', width: 140, render: (r) => (
      <span className="cell">{r.link ? <a className="link" href={r.link} target="_blank" rel="noreferrer">Open in QuinB ↗</a> : <span className="muted">—</span>}</span>
    ) },
  ];
  return <Grid rows={rows} columns={columns} rowKey={(r) => r.key} store={store} accent={accent} empty="Nobody new in the last 30 days." />;
}
