import { notFound } from 'next/navigation';

// Read on every request. The client table writes, and a page built once at
// deploy time would keep showing the row where it used to be.
export const dynamic = 'force-dynamic';
import { DOMAIN_BY_SLUG, findTab, withOverride, overrideMap, viewOf } from '@/lib/nav';
import { renderZone } from '@/components/views';
import { loadAll } from '@/lib/data/bundle';
import { getDomainSettings, getGridColumns, getViewGroups } from '@/lib/data';

export async function generateMetadata({ params }: { params: Promise<{ domain: string; tab?: string[] }> }) {
  const { domain: slug, tab } = await params;
  const base = DOMAIN_BY_SLUG.get(slug);
  if (!base) return { title: 'Not found — Big Tribe Builders' };
  // Her names for the space and the tab, as the bar shows them.
  const { rows } = await getDomainSettings();
  const domain = withOverride(base, overrideMap(rows)[slug]);
  const t = findTab(domain, tab?.[0]);
  return { title: `${domain.label} · ${t.label} — Big Tribe Builders` };
}

/**
 * One route serves every domain and every tab.
 *
 * The left rail picks the domain, the tab strip picks the zone, and the view
 * registry in src/components/views decides what to draw. Adding a zone is a
 * config entry plus a case — never a new route.
 */
export default async function DomainPage({
  params, searchParams,
}: {
  params: Promise<{ domain: string; tab?: string[] }>;
  searchParams: Promise<{ q?: string; peek?: string; view?: string }>;
}) {
  const { domain: slug, tab } = await params;
  const { q = '', peek, view } = await searchParams;
  const base = DOMAIN_BY_SLUG.get(slug);
  if (!base) notFound();

  const [bundle, { rows: settings }, { rows: columns }, { rows: groupColors }] = await Promise.all([
    loadAll(), getDomainSettings(), getGridColumns(), getViewGroups(),
  ]);
  // A recolour has to reach the zone as well, or the widgets inside it would
  // keep the old accent while the chrome around them changed.
  const domain = withOverride(base, overrideMap(settings)[base.slug]);
  // An unknown tab falls back to the first one she has not hidden rather than
  // 404ing — a stale bookmark should land you somewhere useful. Resolved on
  // the space as she has set it up, so the body, the tab strip and the bar
  // always agree on which tab this is.
  const active = findTab(domain, tab?.[0]);

  return (
    // The zone carries its colour, so everything inside (buttons, panels,
    // dialogs) takes the same colour as the top bar of the header.
    // display: contents keeps the page layout exactly as it was.
    <div className={`accent-${domain.accent}`} style={{ display: 'contents' }}>
      {renderZone(domain, active, bundle, q, { peek, columns, mode: viewOf(active, view), groupColors })}
    </div>
  );
}
