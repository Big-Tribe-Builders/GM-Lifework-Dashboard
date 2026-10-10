'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Icon, SearchIcon } from '@/components/Icon';
import { DOMAIN_BY_SLUG, findTab, withOverride, viewOf, type DomainOverride, type Tab } from '@/lib/nav';
import { VIEW_LABEL, type ViewMode } from '@/lib/grid';
import { DomainSettings } from '@/components/DomainSettings';
import { Tabs } from '@/components/Tabs';
import { ClientsBar } from '@/components/ClientsBar';
import { EmailsBar } from '@/components/EmailsBar';
import { TabHelp } from '@/components/TabHelp';
import { ZoneSearch } from '@/components/ZoneSearch';

type Pin = { id: string; name: string; url: string };

/** Zones whose body is a table the toolbar search can filter. */
const SEARCHABLE = new Set(['clients', 'upwork']);

/**
 * The chrome above a zone, three rows, after Airtable.
 *
 *   1. Identity — the mark, the name. White, 56px.
 *   2. Tabs — edge to edge, tinted with the domain's colour. 32px. The active
 *      tab is white and flush to the bottom, so it merges into row three.
 *   3. Toolbar — the view you are in, and the controls that act on it. 44px,
 *      white, one hairline under it. The grid starts immediately below.
 *
 * Nothing in row three is drawn unless it does something. A toolbar of
 * buttons that do not work is worse than a short toolbar.
 */
export function Topbar({ pins, overrides = {} }: { pins: Pin[]; overrides?: Record<string, DomainOverride> }) {
  const pathname = usePathname();
  const parts = pathname.split('/');
  const base = pathname.startsWith('/d/') ? DOMAIN_BY_SLUG.get(parts[2]) : undefined;
  const domain = base ? withOverride(base, overrides[base.slug]) : undefined;

  if (domain) {
    const tab = findTab(domain, parts[3]);
    const isClients = domain.slug === 'clients';
    return (
      <header className={`chrome accent-${domain.accent}`}>
        {/* Left, the domain. Middle, where you are inside it — the tab now,
            and whatever sits under a tab later. Right, its settings. */}
        <div className="chrome__top">
          <div className="chrome__id">
            <span className="chrome__mark"><Icon name={domain.icon} /></span>
            <span className="chrome__name">{domain.label}</span>
            <Caret />
          </div>
          <div className="chrome__where">{tab.label}</div>
          <div className="chrome__actions">
            <PinRail pins={pins} />
            <DomainSettings domain={domain} />
          </div>
        </div>

        <div className="chrome__tabs">
          <Tabs domain={domain} active={tab.slug} />
        </div>

        <div className="chrome__tool">
          <span className="chrome__burger" aria-hidden="true">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M2.5 4.5h11M2.5 8h11M2.5 11.5h11" />
            </svg>
          </span>
          <span className="chrome__viewicon" aria-hidden="true">
            {(tab.views?.length ?? 0) > 1
              ? <Suspense fallback={<ViewGlyph mode={tab.views![0]} />}><CurrentViewGlyph tab={tab} /></Suspense>
              : <ViewGlyph mode="table" />}
          </span>
          <span className="chrome__view">{tab.label}</span>
          <Caret />
          <TabHelp tab={tab} domainLabel={domain.label} />
          <div className="chrome__spacer" />
          {SEARCHABLE.has(domain.slug) ? (
            <Suspense fallback={null}>
              <ZoneSearch placeholder={`Search ${tab.label.toLowerCase()}`} />
            </Suspense>
          ) : null}
          {isClients && tab.slug === 'all' ? <Suspense fallback={null}><ClientsBar part="add" /></Suspense> : null}
          {isClients && tab.slug === 'emails' ? <EmailsBar /> : null}
          {(tab.views?.length ?? 0) > 1 ? (
            <Suspense fallback={null}>
              <ViewSwitch tab={tab} path={pathname} />
            </Suspense>
          ) : null}
        </div>
      </header>
    );
  }

  const title = pathname.startsWith('/settings') ? 'Settings'
    : 'Command Center';

  // The Command Center bar is purple and carries nothing but its name: no
  // pins, no search (Giulia, 23 Sep 2026). The other pages keep the light bar.
  const isHome = title === 'Command Center';

  return (
    <header className={isHome ? 'topbar topbar--purple' : 'topbar'}>
      <div className="topbar__crumbs">
        <span className="topbar__title">{title}</span>
      </div>
      <div className="topbar__spacer" />
      {isHome ? null : <PinRail pins={pins} />}
      {isHome ? null : <PaletteButton />}
    </header>
  );
}

/** The glyph before the tab's name: a table, or the cards of a gallery. */
function ViewGlyph({ mode }: { mode: ViewMode }) {
  return mode === 'gallery' ? (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
      <rect x="1.5" y="2.5" width="4" height="11" rx="1.2" />
      <rect x="7" y="2.5" width="4" height="7.5" rx="1.2" />
      <rect x="12.5" y="2.5" width="2.5" height="9" rx="1" />
    </svg>
  ) : (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
      <rect x="1.5" y="2.5" width="13" height="11" rx="1.5" />
      <path d="M1.5 6h13M6 6v7.5" />
    </svg>
  );
}

function CurrentViewGlyph({ tab }: { tab: Tab }) {
  const params = useSearchParams();
  return <ViewGlyph mode={viewOf(tab, params.get('view'))} />;
}

/**
 * Table or gallery, on the right of the toolbar, for a tab that offers both.
 * The view is in the address (?view=), so back returns to the other one and
 * a link opens where it was sent from. An open panel closes on a switch.
 */
function ViewSwitch({ tab, path }: { tab: Tab; path: string }) {
  const params = useSearchParams();
  const current = viewOf(tab, params.get('view'));
  return (
    <div className="viewswitch" role="group" aria-label="View">
      {tab.views!.map((m) => (
        <Link key={m} href={`${path}?view=${m}`} scroll={false} aria-current={m === current ? 'true' : undefined}
          aria-label={VIEW_LABEL[m]} title={VIEW_LABEL[m]}
          className={`viewswitch__btn${m === current ? ' viewswitch__btn--on' : ''}`}>
          <ViewGlyph mode={m} />
          <span className="viewswitch__label">{VIEW_LABEL[m]}</span>
        </Link>
      ))}
    </div>
  );
}

/** The small chevron Airtable puts after a name you can act on. */
function Caret() {
  return (
    <svg className="caret" viewBox="0 0 16 16" fill="none" stroke="currentColor"
      strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m4.5 6.5 3.5 3.5 3.5-3.5" />
    </svg>
  );
}

function PaletteButton() {
  return (
    <button type="button" className="searchbtn" data-open-palette aria-label="Search">
      <SearchIcon />
      Search
    </button>
  );
}

function PinRail({ pins }: { pins: Pin[] }) {
  return (
    <div className="pinrail" aria-label="Pinned apps">
      {pins.map((p, i) => (
        <a
          key={p.id}
          className={`pin accent-${(['violet', 'red', 'green', 'orange'] as const)[i % 4]}`}
          href={p.url}
          target="_blank"
          rel="noreferrer"
        >
          <span className="dot" />
          {p.name}
        </a>
      ))}
    </div>
  );
}
