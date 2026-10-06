import type { ReactNode } from 'react';
import type { Domain, Tab } from '@/lib/nav';
import type { Bundle } from '@/lib/data/bundle';
import { SourceNote } from '@/components/ui';
import { Portal } from '@/components/views/shared';
import { ZoneGrid } from '@/components/views/grids';
import type { ViewOpts } from '@/lib/grid';

import { clientsZone } from '@/components/views/clients';
import { upworkZone } from '@/components/views/upwork';
import { Roadmap, Experiments, Playbook } from '@/components/BtbPlan';
import { Pulse } from '@/components/Pulse';
import { pulseFor } from '@/lib/pulse';
import { columnsFor } from '@/lib/grid';

/**
 * The view registry.
 *
 * Every zone is the same grid under the same chrome. Clients and Upwork have
 * their own because they write back; everything else is columns over the
 * bundle, and a tab with no source yet still draws its columns.
 */
export function renderZone(domain: Domain, tab: Tab, b: Bundle, q = '', view: ViewOpts = {}): ReactNode {
  switch (domain.slug) {
    case 'clients': return clientsZone(domain, tab, b, q, view);
    case 'upwork': return upworkZone(domain, tab, b, q);
    case 'big-tribe-builders': return btbZone(domain, tab, b, view) ?? gridZone(domain, tab, b);
    default: return gridZone(domain, tab, b);
  }
}

/** The three plan tabs; the rest of BTB stays on the generic grid. */
function btbZone(domain: Domain, tab: Tab, b: Bundle, view: ViewOpts): ReactNode | null {
  const store = `lifework.btb.${tab.slug}.cols`;
  const common = { settings: columnsFor(view.columns ?? [], store), accent: domain.accent, store };
  const body =
    tab.slug === 'todo' ? (
      <Pulse
        signals={pulseFor(b.btbPlan, new Set(b.pulseDismissed))}
        today={new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Brussels' })}
      />
    )
    : tab.slug === 'roadmap' ? <Roadmap rows={b.btbPlan} {...common} />
    : tab.slug === 'tests' ? <Experiments rows={b.btbExperiments} {...common} />
    : tab.slug === 'story' ? <Playbook rows={b.btbPlaybook} {...common} />
    : null;
  if (!body) return null;
  return (
    <Portal note={<SourceNote source={b.source} error={b.error} missingEnv={b.missingEnv} />}>
      {body}
    </Portal>
  );
}

function gridZone(domain: Domain, tab: Tab, b: Bundle): ReactNode {
  return (
    <Portal note={<SourceNote source={b.source} error={b.error} missingEnv={b.missingEnv} />}>
      <ZoneGrid domain={domain.slug} tab={tab.slug} blurb={tab.blurb} b={b} />
    </Portal>
  );
}

/** Counts on the tab strip. Only where the number is honest. */
export function zoneCounts(domain: Domain, b: Bundle): Record<string, number> {
  switch (domain.slug) {
    // Client counts only appear once the live Notion read has returned; an
    // unconnected zone shows no numbers rather than zeros, which would read
    // as "you have no clients".
    // Counts only once the CRM is connected; zeros would read as "you have no
    // clients", which is a different and wrong statement.
    case 'clients':
      // One tab, and the strip is not drawn for it. The status counts live on
      // the page itself, where they can be read against the list.
      return {};
    case 'content':
      return {
        today: b.content.filter((c) => c.state === 'review' || c.state === 'scheduled').length,
        pipeline: b.content.filter((c) => c.state !== 'published').length,
      };
    case 'brain':
      return { sources: b.brainSources.filter((s) => s.state === 'connected').length };
    case 'studying':
      return { courses: b.courses.filter((c) => c.state !== 'done').length };
    default:
      return {};
  }
}
