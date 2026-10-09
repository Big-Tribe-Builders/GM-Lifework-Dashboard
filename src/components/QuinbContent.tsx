'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ColumnSetting } from '@/lib/grid';
import { POST_STATUS, POST_TONE, BANNER_BUCKET, type PostStatus, type QuinbPost, type QuinbStrategy } from '@/lib/quinb';
import { saveStrategy, addPost, updatePost, removePost } from '@/app/d/quinb/actions';
import { saveGridColumn } from '@/app/d/actions';
import { getSupabase } from '@/lib/supabase';
import { Grid, type Column } from '@/components/Grid';
import { EditableCell } from '@/components/EditableCell';
import { AddRow, Remove, Sel, DateCell, OpenArrow } from '@/components/rowkit';
import { shortDate } from '@/lib/upwork';

/**
 * QuinB Community › Content strategy and Posts.
 *
 * The strategy is one page. A post is planned here (title, Space, date,
 * banner, text) and pasted into Mighty Networks by hand: the app has no
 * connection to the QuinB network to post with.
 */

// --------------------------------------------------------------- strategy

export function Strategy({ strategy }: { strategy: QuinbStrategy | null }) {
  const value = strategy?.body ?? '';
  const [draft, setDraft] = useState(value);
  const [state, setState] = useState<'idle' | 'dirty' | 'saving' | 'saved' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();
  useEffect(() => { if (state === 'idle' || state === 'saved') setDraft(value); }, [value]); // eslint-disable-line react-hooks/exhaustive-deps
  function commit() {
    if (draft === value) { setState((s) => (s === 'dirty' ? 'idle' : s)); return; }
    setState('saving'); setError(null);
    start(async () => {
      const r = await saveStrategy(draft);
      if (r.error) { setState('error'); setError(r.error); } else setState((s) => (s === 'dirty' ? s : 'saved'));
    });
  }
  return (
    <div className="about">
      <div className="field about__field">
        <label htmlFor="quinb-strategy">Content strategy
          <span className="about__state">{state === 'saving' ? 'Saving…' : state === 'saved' ? 'Saved' : state === 'dirty' ? 'Unsaved — click away to save' : ''}</span></label>
        <textarea id="quinb-strategy" rows={22} value={draft} placeholder="What we post in the community, why, for whom, and in what rhythm."
          onChange={(e) => { setDraft(e.target.value); setState('dirty'); }} onBlur={commit} />
        {error ? <p className="field__error" role="alert">{error}</p> : null}
      </div>
      {strategy?.updatedAt ? <p className="muted about__note">Last saved {shortDate(strategy.updatedAt)}.</p> : null}
    </div>
  );
}

// ------------------------------------------------------------------ posts

const statusOpts = (Object.keys(POST_STATUS) as PostStatus[]).map((k) => ({ value: k, label: POST_STATUS[k] }));

export function Posts({ rows, settings, accent, store, peek, base }: {
  rows: QuinbPost[]; settings?: Record<string, ColumnSetting>; accent?: string; store: string; peek?: string; base: string;
}) {
  // Planned date first, undated ones last, then by title.
  const sorted = [...rows].sort((a, b) =>
    (a.plannedFor ?? '9999').localeCompare(b.plannedFor ?? '9999') || a.title.localeCompare(b.title) || a.id.localeCompare(b.id));
  const text = (field: 'title' | 'space', label: string) => (r: QuinbPost) => (
    <EditableCell kind="text" value={r[field]} label={`${label} of ${r.title}`} onSave={(v) => updatePost(r.id, field, v)} />
  );
  const columns: Column<QuinbPost>[] = [
    { key: 'open', label: 'Open', type: 'text', width: 44, bare: true, render: (r) => <OpenArrow href={`${base}?peek=${r.id}`} what={r.title} /> },
    { key: 'banner', label: 'Banner', type: 'text', width: 96, render: (r) => (
      <span className="cell">{r.bannerUrl ? <img className="banner__thumb" src={r.bannerUrl} alt="" /> : <span className="muted">—</span>}</span>
    ) },
    { key: 'title', label: 'Post', type: 'text', width: 320, render: text('title', 'Title') },
    { key: 'space', label: 'Space', type: 'text', width: 180, render: text('space', 'Space') },
    { key: 'planned', label: 'Planned for', type: 'date', width: 150, render: (r) => <DateCell value={r.plannedFor} label={`Planned for, ${r.title}`} onSave={(v) => updatePost(r.id, 'plannedFor', v)} /> },
    { key: 'status', label: 'Status', type: 'select', width: 120, render: (r) => (
      <Sel value={r.status} options={statusOpts} className={`status status--${POST_TONE[r.status]} status--select`} label="Status" onChange={(v) => updatePost(r.id, 'status', v)} />
    ) },
    { key: 'posted', label: 'Live link', type: 'link', width: 200, render: (r) => (
      <EditableCell kind="link" value={r.postedUrl} label={`Live link of ${r.title}`} onSave={(v) => updatePost(r.id, 'postedUrl', v)} />
    ) },
    { key: 'del', label: 'Delete', type: 'text', width: 60, bare: true, render: (r) => <Remove what={r.title} onRemove={() => removePost(r.id)} /> },
  ];
  const open = peek ? rows.find((r) => r.id === peek) ?? null : null;
  return (
    <div className="mailstack">
      <AddRow label="+ Add post" onAdd={(f) => addPost(f)} fields={[
        { key: 'title', placeholder: 'Post title', wide: true }, { key: 'space', placeholder: 'Space' }, { key: 'plannedFor', placeholder: 'Planned for', type: 'date' },
      ]} />
      <Grid rows={sorted} columns={columns} rowKey={(r) => r.id} store={store} settings={settings} accent={accent}
        onColumnSettings={(k, i) => saveGridColumn(store, k, i)} empty="No posts yet. Add the first one above, then open it to write and add the banner." />
      {open ? <PostPanel key={open.id} post={open} closeHref={base} /> : null}
    </div>
  );
}

function PostPanel({ post, closeHref }: { post: QuinbPost; closeHref: string }) {
  const router = useRouter();
  const [body, setBody] = useState(post.body);
  const [state, setState] = useState<'idle' | 'dirty' | 'saving' | 'saved' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [, start] = useTransition();

  function save() {
    if (body === post.body) { setState((s) => (s === 'dirty' ? 'idle' : s)); return; }
    setState('saving'); setError(null);
    start(async () => {
      const r = await updatePost(post.id, 'body', body);
      if (r.error) { setState('error'); setError(r.error); } else setState((s) => (s === 'dirty' ? s : 'saved'));
    });
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') { e.preventDefault(); save(); return; }
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      const t = e.target as Element | null;
      if (t?.closest('input, textarea, select, dialog') || document.querySelector('dialog[open]')) return;
      router.push(closeHref, { scroll: false });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  async function copy() {
    try { await navigator.clipboard.writeText(`${post.title}\n\n${body}`); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    catch { setError('The browser did not allow copying. Select the text and copy it by hand.'); }
  }

  return (
    <aside className="peek peek--wide chapter" role="dialog" aria-label={post.title}>
      <div className="peek__bar">
        <Link href={closeHref} scroll={false} className="peek__btn" aria-label="Close" title="Close (Esc)">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true"><path d="m4 4 8 8M12 4l-8 8" /></svg>
        </Link>
        <span className="peek__title">{post.title}</span>
        <span className="chapter__meta muted">{state === 'saving' ? 'Saving…' : state === 'saved' ? 'Saved' : state === 'dirty' ? 'Unsaved — click away or Ctrl+S' : state === 'error' ? 'Not saved' : ''}</span>
        <button type="button" className="btn btn--ghost btn--tiny" onClick={copy}>{copied ? 'Copied' : 'Copy text'}</button>
        <Sel value={post.status} options={statusOpts} className={`status status--${POST_TONE[post.status]} status--select`} label="Status" onChange={(v) => updatePost(post.id, 'status', v)} />
      </div>
      <div className="peek__body chapter__body">
        <Banner post={post} />
        <dl className="facts">
          <dt>Space</dt><dd>{post.space ?? <span className="muted">not set</span>}</dd>
          <dt>Planned for</dt><dd>{post.plannedFor ? shortDate(post.plannedFor) : <span className="muted">not set</span>}</dd>
          <dt>Live link</dt><dd>{post.postedUrl ? <a href={post.postedUrl} target="_blank" rel="noreferrer">{post.postedUrl}</a> : <span className="muted">not posted yet</span>}</dd>
        </dl>
        <textarea className="chapter__text post__text" placeholder="The text of the post. A blank line makes a paragraph." aria-label="Post text"
          value={body} onChange={(e) => { setBody(e.target.value); setState('dirty'); }} onBlur={save} />
        {error ? <p className="field__error" role="alert">{error}</p> : null}
      </div>
    </aside>
  );
}

const MAX_BYTES = 5 * 1024 * 1024;

function Banner({ post }: { post: QuinbPost }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setError(null);
    if (!file.type.startsWith('image/')) { setError('Pick an image: PNG, JPG, WebP or GIF.'); return; }
    if (file.size > MAX_BYTES) { setError('The image is larger than 5 MB.'); return; }
    const db = getSupabase();
    if (!db) { setError('Supabase is not configured.'); return; }
    setBusy(true);
    const ext = (file.name.split('.').pop() ?? 'png').toLowerCase().replace(/[^a-z0-9]/g, '') || 'png';
    const path = `posts/${post.id}-${Date.now()}.${ext}`;
    const { error: upErr } = await db.storage.from(BANNER_BUCKET).upload(path, file, { contentType: file.type, upsert: false });
    if (upErr) { setBusy(false); setError(upErr.message); return; }
    const { data } = db.storage.from(BANNER_BUCKET).getPublicUrl(path);
    const r = await updatePost(post.id, 'bannerUrl', data.publicUrl);
    setBusy(false);
    if (r.error) setError(r.error);
  }

  return (
    <div className="banner">
      {post.bannerUrl ? <img className="banner__img" src={post.bannerUrl} alt={`Banner for ${post.title}`} /> : <div className="banner__empty">No banner yet</div>}
      <div className="banner__actions">
        <input ref={input} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden
          onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void upload(f); }} />
        <button type="button" className="btn btn--ghost btn--tiny" disabled={busy} onClick={() => input.current?.click()}>
          {busy ? 'Uploading…' : post.bannerUrl ? 'Replace banner' : 'Upload banner'}
        </button>
        {post.bannerUrl ? (
          <>
            <a className="btn btn--ghost btn--tiny" href={post.bannerUrl} download target="_blank" rel="noreferrer">Open full size</a>
            <button type="button" className="btn btn--ghost btn--tiny" disabled={busy} onClick={async () => { const r = await updatePost(post.id, 'bannerUrl', ''); if (r.error) setError(r.error); }}>Remove</button>
          </>
        ) : null}
        {error ? <span className="cell__error">{error}</span> : null}
      </div>
    </div>
  );
}
