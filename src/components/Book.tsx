'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Book, Chapter, ChapterStatus } from '@/lib/book';
import { CHAPTER_STATUS, CHAPTER_TONE, wordCount } from '@/lib/book';
import type { ColumnSetting } from '@/lib/grid';
import { saveBook, addChapter, updateChapter, removeChapter, type AboutField } from '@/app/d/book/actions';
import { saveGridColumn } from '@/app/d/actions';
import { Grid, type Column } from '@/components/Grid';
import { EditableCell } from '@/components/EditableCell';
import { AddRow, Remove, Sel, OpenArrow } from '@/components/rowkit';
import { shortDate } from '@/lib/upwork';

/**
 * The book.
 *
 *   About     title, what the book is, the style we write in — saves on blur
 *   Chapters  one line per chapter; the arrow opens the chapter to write
 */

// ------------------------------------------------------------------ about

function AboutField({ field, label, hint, value, rows }: { field: AboutField; label: string; hint?: string; value: string; rows?: number }) {
  const [draft, setDraft] = useState(value);
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();
  useEffect(() => { setDraft(value); }, [value]);
  function commit() {
    if (draft.trim() === value.trim()) return;
    setState('saving'); setError(null);
    start(async () => {
      const r = await saveBook(field, draft);
      if (r.error) { setState('error'); setError(r.error); } else setState('saved');
    });
  }
  const id = `about-${field}`;
  return (
    <div className="field about__field">
      <label htmlFor={id}>{label}{hint ? <span className="muted"> {hint}</span> : null}
        <span className="about__state">{state === 'saving' ? 'Saving…' : state === 'saved' ? 'Saved' : ''}</span></label>
      {rows ? (
        <textarea id={id} rows={rows} value={draft} onChange={(e) => { setDraft(e.target.value); setState('idle'); }} onBlur={commit} />
      ) : (
        <input id={id} value={draft} onChange={(e) => { setDraft(e.target.value); setState('idle'); }} onBlur={commit} />
      )}
      {error ? <p className="field__error" role="alert">{error}</p> : null}
    </div>
  );
}

export function About({ book }: { book: Book | null }) {
  return (
    <div className="about">
      <AboutField field="title" label="Title" value={book?.title ?? ''} />
      <AboutField field="description" label="What the book is" hint="(the general description: what it is about, for whom, what it promises)" value={book?.description ?? ''} rows={10} />
      <AboutField field="style" label="The style we write in" hint="(voice, tone, what to avoid — every chapter is written from this)" value={book?.style ?? ''} rows={8} />
      <p className="muted about__note">Changes save when you click away from a field.{book?.updatedAt ? ` Last saved ${shortDate(book.updatedAt)}.` : ''}</p>
    </div>
  );
}

// --------------------------------------------------------------- chapters

const statusOpts = (Object.keys(CHAPTER_STATUS) as ChapterStatus[]).map((k) => ({ value: k, label: CHAPTER_STATUS[k] }));

export function Chapters({ rows, settings, accent, store, peek, base }: {
  rows: Chapter[]; settings?: Record<string, ColumnSetting>; accent?: string; store: string; peek?: string; base: string;
}) {
  const sorted = [...rows].sort((a, b) => a.number - b.number || a.title.localeCompare(b.title));
  const text = (field: string, label: string) => (r: Chapter) => (
    <EditableCell kind="text" value={(r as unknown as Record<string, string | null>)[field] ?? null} label={label} onSave={(v) => updateChapter(r.id, field, v)} />
  );
  const columns: Column<Chapter>[] = [
    { key: 'open', label: 'Open', type: 'text', width: 44, bare: true, render: (r) => <OpenArrow href={`${base}?peek=${r.id}`} what={r.title} /> },
    { key: 'number', label: 'No.', type: 'number', width: 70, numeric: true, render: (r) => <EditableCell kind="text" value={String(r.number)} label="Chapter number" onSave={(v) => updateChapter(r.id, 'number', v)} /> },
    { key: 'title', label: 'Chapter', type: 'text', width: 320, render: text('title', 'Title') },
    { key: 'summary', label: 'Summary', type: 'text', width: 420, render: text('summary', 'Summary') },
    { key: 'status', label: 'Status', type: 'select', width: 120, render: (r) => (
      <Sel value={r.status} options={statusOpts} className={`status status--${CHAPTER_TONE[r.status]} status--select`} label="Status" onChange={(v) => updateChapter(r.id, 'status', v)} />
    ) },
    { key: 'words', label: 'Words', type: 'number', width: 90, numeric: true, render: (r) => <span className="cell muted">{wordCount(r.body).toLocaleString('en-GB')}</span> },
    { key: 'updated', label: 'Changed', type: 'date', width: 110, render: (r) => <span className="cell muted">{shortDate(r.updatedAt)}</span> },
    { key: 'del', label: 'Delete', type: 'text', width: 60, bare: true, render: (r) => <Remove what={r.title} body="The chapter and its text go. It cannot be undone." onRemove={() => removeChapter(r.id)} /> },
  ];
  const open = peek ? rows.find((r) => r.id === peek) ?? null : null;
  const next = String((sorted.at(-1)?.number ?? 0) + 1);
  return (
    <div className="mailstack">
      <AddRow label="+ Add chapter" defaults={{ number: next }} onAdd={(f) => addChapter({ number: f.number ?? '', title: f.title ?? '' })}
        fields={[{ key: 'number', placeholder: 'No.', type: 'number' }, { key: 'title', placeholder: 'Chapter title', wide: true }]} />
      <Grid rows={sorted} columns={columns} rowKey={(r) => r.id} store={store} settings={settings} accent={accent}
        onColumnSettings={(k, i) => saveGridColumn(store, k, i)} empty="No chapters yet. Add the first one above." />
      {open ? <ChapterPanel chapter={open} closeHref={base} /> : null}
    </div>
  );
}

function ChapterPanel({ chapter, closeHref }: { chapter: Chapter; closeHref: string }) {
  const router = useRouter();
  const [body, setBody] = useState(chapter.body);
  const [summary, setSummary] = useState(chapter.summary ?? '');
  const [state, setState] = useState<'idle' | 'dirty' | 'saving' | 'saved' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();
  const area = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { setBody(chapter.body); setSummary(chapter.summary ?? ''); setState('idle'); }, [chapter.id, chapter.body, chapter.summary]);

  function save() {
    if (body === chapter.body && summary === (chapter.summary ?? '')) { setState('idle'); return; }
    setState('saving'); setError(null);
    start(async () => {
      const r1 = body === chapter.body ? { error: null } : await updateChapter(chapter.id, 'body', body);
      const r2 = summary === (chapter.summary ?? '') ? { error: null } : await updateChapter(chapter.id, 'summary', summary);
      const err = r1.error ?? r2.error;
      if (err) { setState('error'); setError(err); } else setState('saved');
    });
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') { e.preventDefault(); area.current?.blur(); save(); return; }
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      const t = e.target as Element | null;
      if (t?.closest('input, textarea, select, dialog') || document.querySelector('dialog[open]')) return;
      router.push(closeHref, { scroll: false });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <aside className="peek peek--wide chapter" role="dialog" aria-label={chapter.title}>
      <div className="peek__bar">
        <Link href={closeHref} scroll={false} className="peek__btn" aria-label="Close" title="Close (Esc)">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true"><path d="m4 4 8 8M12 4l-8 8" /></svg>
        </Link>
        <span className="peek__title">{chapter.number}. {chapter.title}</span>
        <span className="chapter__meta muted">{wordCount(body).toLocaleString('en-GB')} words · {state === 'saving' ? 'Saving…' : state === 'saved' ? 'Saved' : state === 'dirty' ? 'Unsaved — click away or Ctrl+S' : state === 'error' ? 'Not saved' : ''}</span>
        <Sel value={chapter.status} options={statusOpts} className={`status status--${CHAPTER_TONE[chapter.status]} status--select`} label="Status" onChange={(v) => updateChapter(chapter.id, 'status', v)} />
      </div>
      <div className="peek__body chapter__body">
        <input className="chapter__summary" placeholder="One line: what this chapter does for the reader" aria-label="Summary"
          value={summary} onChange={(e) => { setSummary(e.target.value); setState('dirty'); }} onBlur={save} />
        <textarea ref={area} className="chapter__text" placeholder="Write here. A blank line makes a paragraph." aria-label="Chapter text"
          value={body} onChange={(e) => { setBody(e.target.value); setState('dirty'); }} onBlur={save} />
        {error ? <p className="field__error" role="alert">{error}</p> : null}
      </div>
    </aside>
  );
}
