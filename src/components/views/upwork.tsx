import type { ReactNode } from 'react';
import type { Domain, Tab } from '@/lib/nav';
import { columnsFor, type ViewOpts } from '@/lib/grid';
import { colorsFor } from '@/lib/palette';
import { Pipeline } from '@/components/UpworkPipeline';
import type { Bundle } from '@/lib/data/bundle';
import { clientsOnly } from '@/lib/upwork';
import { Empty, SourceNote } from '@/components/ui';
import { Portal } from '@/components/views/shared';
import { MessagesGrid, UpworkClientsGrid } from '@/components/UpworkTables';

/**
 * Upwork.
 *
 * Read from the freelancer account and imported into Supabase; this zone
 * never calls Upwork at render time. A dashboard that hits a third-party API
 * on every page load is a dashboard that is rate-limited by lunchtime.
 *
 * Three tabs. Messages is every conversation. Clients is the ones that came
 * to a contract, with what they paid — contracts and money are columns on the
 * client, not places of their own. Proposals is the job pipeline: jobs found
 * on Upwork, why they fit, the proposal for each, and where it stands.
 */
export function upworkZone(domain: Domain, tab: Tab, b: Bundle, q = '', view: ViewOpts = {}): ReactNode {
  return (
    <Portal
      note={<SourceNote source={b.source} error={b.error} missingEnv={b.missingEnv} />}
    >
      {tab.slug === 'proposals' ? pipeline(domain, tab, b, q, view) : body(tab, b, q)}
    </Portal>
  );
}

/** Upwork › Proposals: the job pipeline, as a board by status or as a table. */
function pipeline(domain: Domain, tab: Tab, b: Bundle, q: string, view: ViewOpts): ReactNode {
  const store = `lifework.upwork.${tab.slug}.cols`;
  const grid = `${domain.slug}/${tab.slug}`;
  const base = `/d/${domain.slug}/${tab.slug}`;
  const mode = view.mode ?? 'table';
  // Where a job opens and closes: the same view and the same search.
  const sp = new URLSearchParams();
  if (mode !== tab.views?.[0]) sp.set('view', mode);
  if (q.trim()) sp.set('q', q.trim());
  const here = sp.size ? `${base}?${sp.toString()}` : base;
  // The toolbar search: the job, the client, the country, the platform, the notes.
  const needle = q.trim().toLowerCase();
  const rows = needle
    ? b.upworkJobs.filter((j) => [j.title, j.client, j.country, j.platform, j.notes, j.whyItFits, j.budget].some((v) => v?.toLowerCase().includes(needle)))
    : b.upworkJobs;
  return (
    <Pipeline rows={rows} mode={mode} here={here} peek={view.peek} colors={colorsFor(view.groupColors, grid)} grid={grid}
      settings={columnsFor(view.columns ?? [], store)} accent={domain.accent} store={store} />
  );
}

function body(tab: Tab, b: Bundle, q: string): ReactNode {
  if (b.upworkLeads.length === 0) {
    return <Empty>Nothing imported from Upwork yet.</Empty>;
  }

  switch (tab.slug) {
    case 'clients': {
      const clients = clientsOnly(b.upworkLeads);
      if (clients.length === 0) return <Empty>No conversation has become a contract yet.</Empty>;
      return <UpworkClientsGrid leads={b.upworkLeads} invoices={b.upworkInvoices} q={q} />;
    }

    case 'messages':
    default:
      return <MessagesGrid leads={b.upworkLeads} q={q} />;
  }
}
