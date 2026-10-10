'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { moveDomain, moveDomainToCollection, moveCollection } from '@/app/d/actions';

/**
 * The three dots on a collection or a space in the rail.
 *
 * Shown on hover, and kept in the tree rather than conjured on hover so it
 * stays reachable from the keyboard. Every item here moves something; there
 * is nothing in the menu that only looks like it does.
 */
export function NavMenu({ kind, name, groups, canUp, canDown }: {
  kind: 'collection' | 'space';
  /** The collection's name, or the space's slug. */
  name: string;
  /** Collections a space can be moved into. Empty for a collection's own menu. */
  groups?: { label: string; current: boolean }[];
  canUp: boolean;
  canDown: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const wrap = useRef<HTMLSpanElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('mousedown', away);
      document.removeEventListener('keydown', key);
    };
  }, [open]);

  function run(fn: () => Promise<{ error: string | null }>) {
    setError(null);
    start(async () => {
      const r = await fn();
      if (r.error) { setError(r.error); return; }
      setOpen(false);
      router.refresh();
    });
  }

  const move = (dir: 'up' | 'down') =>
    kind === 'collection'
      ? run(() => moveCollection(name, dir, { visibleOnly: true }))
      : run(() => moveDomain(name, dir, { visibleOnly: true }));

  return (
    <span className="navmenu" ref={wrap}>
      <button
        type="button"
        className="navmenu__dots"
        aria-label={`Move ${kind}`}
        aria-expanded={open}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen((o) => !o); }}
      >
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <circle cx="3" cy="8" r="1.4" /><circle cx="8" cy="8" r="1.4" /><circle cx="13" cy="8" r="1.4" />
        </svg>
      </button>

      {open ? (
        <div className="navmenu__pop" role="menu">
          <button
            type="button" role="menuitem" className="navmenu__item"
            disabled={!canUp || pending}
            onClick={(e) => { e.preventDefault(); move('up'); }}
          >
            Move up
          </button>
          <button
            type="button" role="menuitem" className="navmenu__item"
            disabled={!canDown || pending}
            onClick={(e) => { e.preventDefault(); move('down'); }}
          >
            Move down
          </button>

          {groups && groups.length > 0 ? (
            <>
              <p className="navmenu__label">Move to collection</p>
              {groups.map((g) => (
                <button
                  key={g.label}
                  type="button" role="menuitem" className="navmenu__item"
                  disabled={g.current || pending}
                  onClick={(e) => { e.preventDefault(); run(() => moveDomainToCollection(name, g.label)); }}
                >
                  {g.label}{g.current ? ' — here now' : ''}
                </button>
              ))}
            </>
          ) : null}

          {error ? <p className="navmenu__error" role="alert">{error}</p> : null}
        </div>
      ) : null}
    </span>
  );
}
