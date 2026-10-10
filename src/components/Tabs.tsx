'use client';

import Link from 'next/link';
import type { Domain } from '@/lib/nav';

/**
 * The tab strip.
 *
 * Airtable's table tabs: the strip is tinted with the base's colour and runs
 * the full width; the active tab is white, square-shouldered and flush to the
 * bottom, so it reads as continuous with the toolbar below.
 *
 * A pipe divides two neighbours only when both are dark. Next to the active
 * tab there is nothing to divide — its own white edge already separates it,
 * and a pipe there would be a second line doing the first one's job.
 */
export function Tabs({ domain, active }: { domain: Domain; active: string }) {
  // Tabs she hid in Settings are left out, unless it is the one open now
  // (an old link, or the tab she just hid), so she always sees where she is.
  const hide = new Set(domain.hiddenTabs ?? []);
  const tabs = domain.tabs.filter((t) => !hide.has(t.slug) || t.slug === active);
  return (
    <nav className="tabs" aria-label={`${domain.label} sections`}>
      {tabs.map((t, i) => {
        const isActive = t.slug === active;
        const prev = tabs[i - 1];
        const divide = Boolean(prev) && !isActive && prev.slug !== active;
        return (
          <span key={t.slug} className="tabs__slot">
            {divide ? <span className="tabs__divider" aria-hidden="true" /> : null}
            <Link
              href={`/d/${domain.slug}/${t.slug}`}
              className={`tabs__item${isActive ? ' tabs__item--active' : ''}`}
              aria-current={isActive ? 'page' : undefined}
            >
              {t.label}
            </Link>
          </span>
        );
      })}
    </nav>
  );
}
