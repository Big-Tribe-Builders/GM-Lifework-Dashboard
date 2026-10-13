'use client';

import { useEffect, useSyncExternalStore } from 'react';

/**
 * Search, on every table and board (Giulia, 13 Oct 2026: "on all tables you
 * would need a search"). One query per page, typed in the toolbar
 * (ToolbarSearch); every list on the page filters on it as she types.
 *
 *   q        what she typed
 *   server   the zone filters on the server instead (Clients, Upwork: they
 *            search more than the rows show), so the lists leave it alone
 *   lists    how many lists on the page take the search; none, no button
 */
type SearchState = { q: string; server: boolean; lists: number };
const NONE: SearchState = { q: '', server: false, lists: 0 };

let state: SearchState = NONE;
const listeners = new Set<() => void>();

export const search = {
  get: () => state,
  set(next: Partial<SearchState>) {
    state = { ...state, ...next };
    listeners.forEach((f) => f());
  },
  subscribe(f: () => void) {
    listeners.add(f);
    return () => { listeners.delete(f); };
  },
};

export function useSearch(): SearchState {
  return useSyncExternalStore(search.subscribe, search.get, () => NONE);
}

/** A list the search filters: while it is drawn, the toolbar offers the search. */
export function useSearchable() {
  useEffect(() => {
    search.set({ lists: state.lists + 1 });
    return () => search.set({ lists: state.lists - 1 });
  }, []);
}

// --------------------------------------------------------------- matching

/** Lower case, no accents, "next_up" reads as "next up". */
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/_/g, ' ');

/** Every word and number in a row, ids left out (they match by accident). */
function textOf(v: unknown, depth = 0): string {
  if (v == null || typeof v === 'boolean') return '';
  if (typeof v === 'string' || typeof v === 'number') return String(v);
  if (typeof v !== 'object' || depth > 2) return '';
  if (Array.isArray(v)) return v.map((x) => textOf(x, depth + 1)).join(' ');
  return Object.entries(v)
    .filter(([k]) => k !== 'id' && !/Id$/.test(k))
    .map(([, x]) => textOf(x, depth + 1))
    .join(' ');
}

const texts = new WeakMap<object, string>();
function haystack(row: unknown): string {
  if (typeof row !== 'object' || row === null) return fold(textOf(row));
  let h = texts.get(row);
  if (h === undefined) { h = fold(textOf(row)); texts.set(row, h); }
  return h;
}

/** The words of a query; a row matches when it holds every one of them, anywhere. */
export const searchWords = (q: string) => fold(q).split(/\s+/).filter(Boolean);
export const matches = (row: unknown, words: string[]) => words.every((w) => haystack(row).includes(w));
