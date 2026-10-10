'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { SearchIcon } from '@/components/Icon';

/**
 * Search, in the toolbar row where Airtable puts it.
 *
 * The query is a URL parameter, so the filtering happens on the server, the
 * address is shareable, and the back button undoes a search. Debounced, so
 * typing does not navigate on every key.
 */
export function ZoneSearch({ placeholder }: { placeholder: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get('q') ?? '');

  useEffect(() => { setQ(params.get('q') ?? ''); }, [params]);

  useEffect(() => {
    const current = params.get('q') ?? '';
    if (q === current) return;
    const t = setTimeout(() => {
      // Keep the rest of the address (the view: table or gallery); only an
      // open panel closes, as the list under it changes.
      const next = new URLSearchParams(params.toString());
      if (q) next.set('q', q); else next.delete('q');
      next.delete('peek');
      const s = next.toString();
      router.replace(s ? `${pathname}?${s}` : pathname);
    }, 180);
    return () => clearTimeout(t);
  }, [q, params, router, pathname]);

  return (
    <label className="clientsearch">
      <SearchIcon />
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
      />
    </label>
  );
}
