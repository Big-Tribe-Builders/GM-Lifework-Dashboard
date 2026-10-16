'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { MEMBER_FILTERS, MEMBER_FILTER_PARAM, memberFilterOf, type MemberFilter } from '@/lib/members';

/**
 * QuinB Community › Members: the name in the toolbar is a dropdown, "All
 * members ⌄", that picks which members the list shows (Giulia, 16 Oct 2026).
 */
export function MemberFilterMenu() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const current = memberFilterOf(params.get(MEMBER_FILTER_PARAM));
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLSpanElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const items = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    if (!open) return;
    // The chosen one gets the keyboard, so Enter keeps it and the arrows move from there.
    items.current[MEMBER_FILTERS.findIndex((f) => f.key === current)]?.focus();
    const away = (e: MouseEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, [open, current]);

  const close = () => { setOpen(false); button.current?.focus(); };
  const pick = (k: MemberFilter) => {
    const next = new URLSearchParams(params.toString());
    if (k === 'all') next.delete(MEMBER_FILTER_PARAM); else next.set(MEMBER_FILTER_PARAM, k);
    const s = next.toString();
    router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false });
    close();
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const at = items.current.findIndex((el) => el === document.activeElement);
    const n = MEMBER_FILTERS.length;
    items.current[(at + (e.key === 'ArrowDown' ? 1 : n - 1)) % n]?.focus();
  };

  const label = MEMBER_FILTERS.find((f) => f.key === current)!.label;
  return (
    <span className="viewmenu" ref={wrap} onKeyDown={onKey}>
      <button ref={button} type="button" className="viewmenu__btn" aria-haspopup="menu" aria-expanded={open}
        aria-label={`Showing ${label.toLowerCase()}. Change`} onClick={() => setOpen((o) => !o)}>
        <span className="chrome__view">{label}</span>
        <svg className="caret" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m4.5 6.5 3.5 3.5 3.5-3.5" />
        </svg>
      </button>
      {open ? (
        <div className="navmenu__pop viewmenu__pop" role="menu" aria-label="Show">
          {MEMBER_FILTERS.map((f, i) => (
            <button key={f.key} ref={(el) => { items.current[i] = el; }} type="button" role="menuitemradio" aria-checked={f.key === current}
              className={`navmenu__item viewmenu__item${f.key === current ? ' viewmenu__item--on' : ''}`} onClick={() => pick(f.key)}>
              <span className="viewmenu__label">{f.label}</span>
              <span className="viewmenu__hint">{f.hint}</span>
            </button>
          ))}
        </div>
      ) : null}
    </span>
  );
}
