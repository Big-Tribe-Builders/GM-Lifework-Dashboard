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

/**
 * The left rail: where you are.
 *
 * Stable order, never reordered by activity — but hers to arrange. The three
 * dots on a collection or a space move it; nothing moves on its own.
 *
 * Collapsed, the rail is icons only. The choice is kept in this browser, so
 * the rail opens the way she left it.
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

  useEffect(() => {
    try { setTight(localStorage.getItem(TIGHT) === '1'); } catch { /* private mode */ }
  }, []);

  function toggle() {
    setTight((t) => {
      try { localStorage.setItem(TIGHT, t ? '0' : '1'); } catch { /* private mode */ }
      return !t;
    });
  }

  const sections = resolveNav(overrides, collections);

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

        {sections.map((section, si) => (
          <div className="sidebar__group" key={section.group}>
            <p className="eyebrow eyebrow--row">
              <span>{section.group}</span>
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
        ))}
      </nav>

      <div className="sidebar__foot">
        <Link
          href="/launchpad"
          className={`sidebar__item${pathname.startsWith('/launchpad') ? ' sidebar__item--active' : ''}`}
          title={tight ? 'Launchpad' : undefined}
        >
          <span className="icon-chip icon-chip--sm accent-orange"><Icon name="grid" /></span>
          <span className="sidebar__label">Launchpad</span>
        </Link>
        <Link
          href="/settings"
          className={`sidebar__item${pathname.startsWith('/settings') ? ' sidebar__item--active' : ''}`}
          title={tight ? 'Settings' : undefined}
        >
          <span className="icon-chip icon-chip--sm accent-green"><Icon name="settings" /></span>
          <span className="sidebar__label">Settings</span>
        </Link>
      
        {signedIn ? (
          <button type="button" className="sidebar__item sidebar__signout" onClick={() => signOut()} title={tight ? 'Sign out' : undefined}>
            <span className="icon-chip icon-chip--sm accent-red"><Icon name="logout" /></span>
            <span className="sidebar__label">Sign out</span>
          </button>
        ) : null}
      </div>
    </aside>
  );
}
