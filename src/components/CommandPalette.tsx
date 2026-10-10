'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { DOMAINS, domainHref, withOverride, type DomainOverride } from '@/lib/nav';

/**
 * The command palette — the real answer to "I don't want to click too many
 * times".
 *
 * Every domain, every tab, every client and every external app is two
 * keystrokes away. This is what lets the left rail stay small and the tab
 * strip stay at five: nothing has to be visible to be reachable.
 *
 * Cmd/Ctrl-K opens it. Typing filters. Enter goes.
 */

export type PaletteEntry = {
  id: string;
  label: string;
  group: string;
  href: string;
  external?: boolean;
  /** Extra words that should match but are not shown. */
  keywords?: string;
  hint?: string;
};

export function CommandPalette({ extra, overrides = {} }: { extra: PaletteEntry[]; overrides?: Record<string, DomainOverride> }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Navigation entries are derived from the same config the sidebar uses,
  // so the palette can never drift out of sync with the IA.
  const entries = useMemo<PaletteEntry[]>(() => {
    const nav: PaletteEntry[] = [
      { id: 'home', label: 'Command Center', group: 'Go to', href: '/', keywords: 'today home dashboard start' },
      { id: 'settings', label: 'Settings', group: 'Go to', href: '/settings', keywords: 'config supabase connect' },
    ];

    // Her names, her collections; spaces and tabs she hid in Settings are
    // left out. The names from the code still match, so an old name finds
    // the renamed space or tab.
    for (const base of DOMAINS) {
      const o = overrides[base.slug];
      const d = withOverride(base, o);
      if (d.hidden) continue;
      const group = o?.groupName ?? d.group;
      const hide = new Set(d.hiddenTabs ?? []);
      nav.push({
        id: `d-${d.slug}`,
        label: d.label,
        group: 'Go to',
        href: domainHref(d),
        keywords: `${group} ${d.blurb} ${base.label}`,
      });
      d.tabs.forEach((t, i) => {
        if (hide.has(t.slug)) return;
        nav.push({
          id: `d-${d.slug}-${t.slug}`,
          label: `${d.label} — ${t.label}`,
          group,
          href: `/d/${d.slug}/${t.slug}`,
          keywords: `${t.blurb} ${base.label} ${base.tabs[i].label}`,
          hint: t.label,
        });
      });
    }
    return [...nav, ...extra];
  }, [extra, overrides]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entries.slice(0, 40);

    // Score: a label that starts with the query beats one that merely
    // contains it, which beats a keyword-only match. Keeps "up" finding
    // Upwork before "Wrap up".
    const scored = entries
      .map((e) => {
        const label = e.label.toLowerCase();
        const hay = `${label} ${e.keywords ?? ''} ${e.group}`.toLowerCase();
        if (label.startsWith(q)) return { e, s: 0 };
        if (label.includes(q)) return { e, s: 1 };
        if (hay.includes(q)) return { e, s: 2 };
        return null;
      })
      .filter((x): x is { e: PaletteEntry; s: number } => x !== null)
      .sort((a, b) => a.s - b.s);

    return scored.slice(0, 40).map((x) => x.e);
  }, [entries, query]);

  const go = useCallback((entry: PaletteEntry) => {
    setOpen(false);
    setQuery('');
    if (entry.external) {
      window.open(entry.href, '_blank', 'noopener,noreferrer');
    } else {
      router.push(entry.href);
    }
  }, [router]);

  // Global hotkey.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Let any button carry data-open-palette instead of importing this state.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      const t = e.target as HTMLElement | null;
      if (t?.closest('[data-open-palette]')) setOpen(true);
    }
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  useEffect(() => {
    if (open) {
      setCursor(0);
      // Focus after paint, or the input is not in the DOM yet.
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => { setCursor(0); }, [query]);

  // Keep the highlighted row in view when arrowing past the fold.
  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector<HTMLElement>(`[data-index="${cursor}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [cursor, open]);

  if (!open) return null;

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setCursor((c) => (results.length === 0 ? 0 : (c + 1) % results.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setCursor((c) => (results.length === 0 ? 0 : (c - 1 + results.length) % results.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const hit = results[cursor];
      if (hit) go(hit);
    }
  }

  // Group headings, in the order the results first introduce them.
  const groups: string[] = [];
  for (const r of results) if (!groups.includes(r.group)) groups.push(r.group);

  return (
    <div
      className="palette__scrim"
      role="presentation"
      onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
    >
      <div className="palette" role="dialog" aria-modal="true" aria-label="Command palette">
        <input
          ref={inputRef}
          className="palette__input"
          placeholder="Jump to anything — a domain, a client, an app…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          aria-label="Search"
        />

        <div className="palette__list" ref={listRef}>
          {results.length === 0 ? (
            <p className="palette__empty muted">Nothing matches “{query}”.</p>
          ) : (
            groups.map((g) => (
              <div key={g}>
                <p className="palette__group">{g}</p>
                {results.map((r, i) => (r.group === g ? (
                  <button
                    key={r.id}
                    type="button"
                    className="palette__item"
                    data-index={i}
                    data-active={i === cursor}
                    onMouseEnter={() => setCursor(i)}
                    onClick={() => go(r)}
                  >
                    <span className="palette__label">{r.label}</span>
                    {r.external ? <span className="palette__hint">opens {new URL(r.href).hostname.replace('www.', '')}</span> : null}
                  </button>
                ) : null))}
              </div>
            ))
          )}
        </div>

        <div className="palette__foot">
          <span><span className="kbd" style={{ marginLeft: 0 }}>↑↓</span> move</span>
          <span><span className="kbd" style={{ marginLeft: 0 }}>↵</span> open</span>
          <span><span className="kbd" style={{ marginLeft: 0 }}>esc</span> close</span>
        </div>
      </div>
    </div>
  );
}
