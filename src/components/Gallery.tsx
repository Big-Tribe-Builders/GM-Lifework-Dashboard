'use client';

import { useEffect, useRef, useState, useTransition, type ReactNode } from 'react';
import Link from 'next/link';
import { saveGroupColor } from '@/app/d/actions';
import { ColorPicker } from '@/components/ColorPicker';
import { tintClass, paletteFor, type PaletteKey } from '@/lib/palette';

/**
 * The gallery, after Trello (Giulia, 10 Oct 2026): one list per group, side
 * by side, cards stacked in each. The standard for every space that offers
 * a gallery next to its table.
 *
 *   .gallery         the row of lists; scrolls sideways when they do not fit
 *   .glist           one list: a group (a year, a quarter). Grey, or the
 *                    palette colour she gave it with the dot in its header
 *   .gcard           one card. Labels on top (.gcard__labels), the title
 *                    (.gcard__title), then the footer (.gcard__foot): small
 *                    counts and dates (.gcard__badge) and who works on it
 *                    (.avatar). A card opens the panel on the right.
 *   .glist__add      "+ Add …" at the bottom of a list
 *
 * The colour of a group is shared with the table's fold for the same group.
 */

export type GalleryList<T> = {
  /** The group: '2026', '2026-Q4'. Also the key its colour is saved under. */
  key: string;
  title: string;
  /** Under or after the title: 'Oct – Dec'. */
  sub?: string;
  /** A small mark after the title, for the group we are in now. */
  now?: boolean;
  items: T[];
  /** The "+ Add" at the bottom of the list. */
  add?: ReactNode;
};

type Result = { error: string | null };

export function Gallery<T>({ grid, lists, colors, itemKey, href, card, label }: {
  /** The collection the colours are saved under: 'goal-navigator/years'. */
  grid: string;
  lists: GalleryList<T>[];
  colors: Record<string, PaletteKey>;
  itemKey: (item: T) => string;
  /** Where a card goes: the panel for that item. */
  href: (item: T) => string;
  card: (item: T) => ReactNode;
  /** What the lists hold, for screen readers: 'Yearly goals'. */
  label: string;
}) {
  return (
    <div className="gallery" role="region" aria-label={label}>
      {lists.map((l) => {
        const color = colors[l.key] ?? null;
        return (
          <section key={l.key} className={`glist${color ? ` tinted ${tintClass(color)}` : ''}`} aria-label={l.title}>
            <div className="glist__head">
              <h2 className="glist__title">{l.title}</h2>
              <span className="glist__count">{l.items.length}</span>
              {l.sub ? <span className="glist__sub">{l.sub}</span> : null}
              {l.now ? <span className="glist__now">Now</span> : null}
              <span className="glist__spacer" />
              <ColorPicker value={color} label={`Colour of ${l.title}`} onPick={(c) => saveGroupColor(grid, l.key, c)} />
            </div>
            {l.items.length ? (
              <ol className="glist__cards">
                {l.items.map((it) => (
                  <li key={itemKey(it)}>
                    {/* No aria-label: the card's own words (title, labels, counts) are its name. */}
                    <Link href={href(it)} scroll={false} className="gcard">{card(it)}</Link>
                  </li>
                ))}
              </ol>
            ) : null}
            {l.add}
          </section>
        );
      })}
    </div>
  );
}

/**
 * "+ Add …" at the bottom of a list: a title and, where needed, a choice
 * (the venture). Opens in place, the way Trello adds a card.
 */
export function AddCard({ label, placeholder, choice, onAdd }: {
  label: string;
  placeholder: string;
  choice?: { label: string; options: { value: string; label: string }[] };
  onAdd: (title: string, choice: string) => Promise<Result>;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [pick, setPick] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  // Closing puts the focus back on "+ Add", not on the page.
  const addButton = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);
  useEffect(() => {
    if (wasOpen.current && !open) addButton.current?.focus();
    wasOpen.current = open;
  }, [open]);
  if (!open) {
    return <button type="button" ref={addButton} className="glist__add" onClick={() => setOpen(true)}>{label}</button>;
  }
  const close = () => { setOpen(false); setTitle(''); setPick(''); setError(null); };
  return (
    <form className="glist__form"
      onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); } }}
      onSubmit={(e) => {
        e.preventDefault(); setError(null);
        start(async () => { const r = await onAdd(title, pick); if (r.error) setError(r.error); else close(); });
      }}>
      <textarea rows={2} value={title} autoFocus placeholder={placeholder} aria-label={placeholder} disabled={pending}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (title.trim() && !pending) e.currentTarget.form?.requestSubmit(); } }} />
      {choice ? (
        <select value={pick} aria-label={choice.label} disabled={pending} onChange={(e) => setPick(e.target.value)}>
          <option value="">{choice.label}</option>
          {choice.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ) : null}
      <div className="glist__formrow">
        <button type="submit" className="btn btn--primary" disabled={pending || !title.trim()}>{pending ? 'Adding…' : 'Add'}</button>
        <button type="button" className="btn btn--ghost" disabled={pending} onClick={close}>Cancel</button>
      </div>
      {error ? <span className="cell__error" role="alert">{error}</span> : null}
    </form>
  );
}

/** Who works on something, as initials in a palette colour; the names on hover. */
export function Avatars({ names, max = 3 }: { names: string[]; max?: number }) {
  if (!names.length) return null;
  const shown = names.slice(0, max);
  return (
    <span className="avatars" title={names.join(', ')} aria-label={`Who: ${names.join(', ')}`} role="img">
      {shown.map((n) => <span key={n} className={`avatar tint-tag ${tintClass(paletteFor(n))}`} aria-hidden="true">{initial(n)}</span>)}
      {names.length > max ? <span className="avatar avatar--more" aria-hidden="true">+{names.length - max}</span> : null}
    </span>
  );
}

const initial = (n: string) => (n.trim()[0] ?? '?').toUpperCase();
