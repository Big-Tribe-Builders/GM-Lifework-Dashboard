'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { SearchIcon } from '@/components/Icon';
import { search, useSearch } from '@/lib/search';

/**
 * The search, the way Notion has it (Giulia, 13 Oct 2026): a magnifier on the
 * right of the toolbar; a click opens the field, and every table and board on
 * the page filters as she types. Escape empties it, and closes it when empty.
 *
 * Shown only where there is a list to search. Clients and Upwork search on
 * the server (they look in more than the rows show), so for those the query
 * also goes into the address (?q=), a little after she stops typing.
 */
export function ToolbarSearch({ server, label }: { server: boolean; label: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { q, lists } = useSearch();
  const [open, setOpen] = useState(false);
  const field = useRef<HTMLInputElement>(null);

  // Every page starts from its own address: the search it was opened with, or none.
  useEffect(() => {
    const fromUrl = server ? params.get('q') ?? '' : '';
    search.set({ q: fromUrl, server });
    setOpen(!!fromUrl);
    // Only a new page resets it; the address changing under a search does not.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, server]);

  // Clients and Upwork: the query into the address, so the server filters.
  useEffect(() => {
    if (!server) return;
    const current = params.get('q') ?? '';
    if (q === current) return;
    const t = setTimeout(() => {
      // Keep the rest of the address (the view: table or Kanban); only an
      // open panel closes, as the list under it changes.
      const next = new URLSearchParams(params.toString());
      if (q) next.set('q', q); else next.delete('q');
      next.delete('peek');
      const s = next.toString();
      router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false });
    }, 180);
    return () => clearTimeout(t);
  }, [q, server, params, router, pathname]);

  useEffect(() => { if (open) field.current?.focus(); }, [open]);

  if (!server && lists === 0 && !q) return null;

  if (!open) {
    return (
      <button type="button" className="tsearch__btn" aria-label={`Search ${label}`} title="Search" onClick={() => setOpen(true)}>
        <SearchIcon />
      </button>
    );
  }
  return (
    <span className="tsearch" role="search">
      <SearchIcon />
      <input ref={field} className="tsearch__input" type="text" value={q} placeholder="Type to search…"
        aria-label={`Search ${label}`}
        onChange={(e) => search.set({ q: e.target.value })}
        onKeyDown={(e) => {
          if (e.key !== 'Escape') return;
          e.preventDefault();
          if (q) search.set({ q: '' }); else setOpen(false);
        }}
        onBlur={() => { if (!q) setOpen(false); }} />
      {q ? (
        <button type="button" className="tsearch__clear" aria-label="Clear the search" title="Clear"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => { search.set({ q: '' }); field.current?.focus(); }}>
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true"><path d="m4.5 4.5 7 7M11.5 4.5l-7 7" /></svg>
        </button>
      ) : null}
    </span>
  );
}
