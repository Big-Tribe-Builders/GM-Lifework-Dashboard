'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Icon } from '@/components/Icon';
import { NavMenu } from '@/components/NavMenu';
import { signOut } from '@/app/auth/actions';
import {
  GROUP_ORDER, domainHref, resolveNav,
  type DomainOverride, type CollectionOrder,
} from '@/lib/nav';

const TIGHT = 'lifework.rail.tight';
const CLOSED = 'lifework.rail.closed';

/**
 * The left rail: where you are.
 *
 * Stable order, never reordered by activity — but hers to arrange. The three
 * dots on a collection or a space move it; nothing moves on its own.
 *
 * Collapsed, the rail is icons only. A collection can also be folded shut
 * by its name, so the rail takes less room. Both choices are kept in this
 * browser, so the rail opens the way she left it. Spaces she hid in
 * Settings are not drawn.
 */
export function Sidebar({ counts, overrides = {}, collections = [], signedIn = false }: {
  counts: Record<string, number>;
  overrides?: Record<string, DomainOverride>;
  collections?: CollectionOrder[];
  /** True when a session exists, so the sign-out row is drawn. */
  signedIn?: boolean;
}) {
  const pathname = usePathname();
  const [tight, setTight] = useState(false);
  const [closed, setClosed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try { setTight(localStorage.getItem(TIGHT) === '1'); } catch { /* private mode */ }
    try {
      const v = JSON.parse(localStorage.getItem(CLOSED) ?? '{}');
      if (v && typeof v === 'object') setClosed(v as Record<string, boolean>);
    } catch { /* private mode, or nothing stored */ }
  }, []);

  function fold(group: string) {
    setClosed((c) => {
      const next = { ...c, [group]: !c[group] };
      if (!next[group]) delete next[group];
      try { localStorage.setItem(CLOSED, JSON.stringify(next)); } catch { /* private mode */ }
      return next;
    });
  }

  function toggle() {
    setTight((t) => {
      try { localStorage.setItem(TIGHT, t ? '0' : '1'); } catch { /* private mode */ }
      return !t;
    });
  }

  // Hidden spaces are left out; a collection with nothing left to show goes too.
  const sections = resolveNav(overrides, collections)
    .map((s) => ({ ...s, domains: s.domains.filter((d) => !d.hidden) }))
    .filter((s) => s.domains.length > 0);

  return (
    <aside className={`sidebar${tight ? ' sidebar--tight' : ''}`}>
      <div className="sidebar__brand">
        <span className="sidebar__mark">BTB</span>
        <div className="sidebar__brandtext">
          <div className="sidebar__wordmark">Big Tribe Builders</div>
        </div>
        <button
          type="button"
          className="sidebar__toggle"
          onClick={toggle}
          aria-label={tight ? 'Expand the navigation' : 'Collapse the navigation'}
          title={tight ? 'Expand' : 'Collapse'}
        >
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7"
            strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d={tight ? 'm6 3.5 4.5 4.5L6 12.5' : 'M10 3.5 5.5 8l4.5 4.5'} />
          </svg>
        </button>
      </div>

      <nav className="sidebar__scroll" aria-label="Primary">
        <div className="sidebar__group">
          <Link
            href="/"
            className={`sidebar__item${pathname === '/' ? ' sidebar__item--active' : ''}`}
            title={tight ? 'Command Center' : undefined}
          >
            <span className="icon-chip icon-chip--sm accent-violet"><Icon name="home" /></span>
            <span className="sidebar__label">Command Center</span>
          </Link>
        </div>

        {sections.map((section, si) => {
          // A folded collection's spaces are hidden by CSS, and only where the
          // names show: the icons-only rail (the toggle, or a narrow window)
          // has no name to unfold by, so there it shows everything.
          const shut = !!closed[section.group];
          return (
          <div className={`sidebar__group${shut ? ' sidebar__group--shut' : ''}`} key={section.group}>
            <p className="eyebrow eyebrow--row">
              <button type="button" className="sidebar__fold" aria-expanded={!shut} onClick={() => fold(section.group)}
                title={shut ? `Show the spaces in ${section.group}` : `Fold ${section.group} shut`}>
                <svg className="sidebar__caret" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8"
                  strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d={shut ? 'm6 4 4 4-4 4' : 'm4 6 4 4 4-4'} />
                </svg>
                <span>{section.group}</span>
                {shut ? <span className="sidebar__foldcount">{section.domains.length}</span> : null}
              </button>
              <NavMenu
                kind="collection"
                name={section.group}
                canUp={si > 0}
                canDown={si < sections.length - 1}
              />
            </p>
            {section.domains.map((d, di) => {
              const active = pathname.startsWith(`/d/${d.slug}`);
              const count = counts[d.slug] ?? 0;
              return (
                <div className="sidebar__row" key={d.slug}>
                  <Link
                    href={domainHref(d)}
                    className={`sidebar__item${active ? ' sidebar__item--active' : ''}`}
                    title={tight ? d.label : undefined}
                  >
                    <span className={`icon-chip icon-chip--sm accent-${d.accent}`}><Icon name={d.icon} /></span>
                    <span className="sidebar__label">{d.label}</span>
                    {count > 0 ? <span className="sidebar__count">{count}</span> : null}
                  </Link>
                  <NavMenu
                    kind="space"
                    name={d.slug}
                    canUp={di > 0}
                    canDown={di < section.domains.length - 1}
                    groups={GROUP_ORDER.map((g) => ({ label: g, current: g === section.group }))}
                  />
                </div>
              );
            })}
          </div>
          );
        })}
      </nav>

      {/* Launchpad and Settings left the foot (Giulia, 10 Oct 2026): the room
          goes to the spaces. Settings opens from the cog at the top right. */}
      {signedIn ? (
        <div className="sidebar__foot">
          <button type="button" className="sidebar__item sidebar__signout" onClick={() => signOut()} title={tight ? 'Sign out' : undefined}>
            <span className="icon-chip icon-chip--sm accent-red"><Icon name="logout" /></span>
            <span className="sidebar__label">Sign out</span>
          </button>
        </div>
      ) : null}
    </aside>
  );
}
