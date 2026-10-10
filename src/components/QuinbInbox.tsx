'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { answerInQuinb } from '@/app/d/quinb/actions';
import { Grid, type Column } from '@/components/Grid';

/** One thing to react to, ready to draw: the server has already formatted the date. */
export type InboxItem = {
  key: string;
  kind: 'post' | 'comment';
  id: number;
  postId: number;
  postTitle: string;
  authorName: string;
  text: string;
  when: string;
  link: string | null;
  inReplyTo: string | null;
};

/** QuinB Community › Comments: what members wrote that has no answer from you yet. */
export function Inbox({ items }: { items: InboxItem[] }) {
  if (!items.length) return <p className="inbox__empty">Nothing waiting. Every member comment and post of the last 30 days has an answer from you.</p>;
  return (
    <ul className="inbox">
      {items.map((w) => (
        <li key={w.key} className="inbox__item">
          <div className="inbox__head">
            <strong>{w.authorName}</strong>
            <span className="muted">{w.kind === 'post' ? 'posted' : w.inReplyTo ? 'replied on' : 'commented on'}</span>
            <span className="inbox__post">{w.postTitle}</span>
            <span className="muted inbox__when">{w.when}</span>
          </div>
          {w.inReplyTo ? <blockquote className="inbox__quote">{w.inReplyTo}</blockquote> : null}
          <p className="inbox__text">{w.text || <span className="muted">(no text: a picture or a file)</span>}</p>
          <Answer item={w} />
        </li>
      ))}
    </ul>
  );
}

function Answer({ item }: { item: InboxItem }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();
  const send = () => {
    setError(null);
    start(async () => {
      const r = await answerInQuinb(item.postId, item.kind === 'comment' ? item.id : null, text);
      if (r.error) { setError(r.error); return; }
      setDone(true); setOpen(false); setText('');
      router.refresh();
    });
  };
  return (
    <div className="inbox__actions">
      {open ? (
        <div className="inbox__answer">
          <textarea rows={3} value={text} autoFocus disabled={pending} aria-label={`Your answer to ${item.authorName}`}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && text.trim()) send(); }} />
          <div className="inbox__row">
            <button type="button" className="btn btn--primary" disabled={pending || !text.trim()} onClick={send}>{pending ? 'Posting…' : 'Post answer in QuinB'}</button>
            <button type="button" className="btn btn--ghost" disabled={pending} onClick={() => { setOpen(false); setError(null); }}>Cancel</button>
            <span className="muted">Ctrl+Enter posts it.</span>
          </div>
        </div>
      ) : (
        <div className="inbox__row">
          {done ? <span className="note--ok inbox__done">Answered.</span> : <button type="button" className="btn btn--ghost" onClick={() => setOpen(true)}>Answer</button>}
          {item.link ? <a className="btn btn--ghost" href={item.link} target="_blank" rel="noreferrer">Open in QuinB ↗</a> : null}
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
