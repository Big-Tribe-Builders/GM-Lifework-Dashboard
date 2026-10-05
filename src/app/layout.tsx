import type { Metadata } from 'next';
import '@/styles/studiolo-theme.css';
import '@/styles/lifework.css';

import { Sidebar } from '@/components/Sidebar';
import { Topbar } from '@/components/Topbar';
import { CommandPalette, type PaletteEntry } from '@/components/CommandPalette';
import { getApps, getTasks, getDomainSettings, getCollectionOrder, openTasks, pinnedApps } from '@/lib/data';
import { DOMAINS, overrideMap } from '@/lib/nav';
import { currentUser } from '@/lib/auth';

// Every page reads the session cookie for the sidebar, so nothing is
// prerendered at build: a page built once would show whoever built it.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Lifework — Giulia May',
  description: 'One operational surface for every venture, client and life domain.',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [{ rows: apps }, { rows: tasks }, { rows: domainSettings }, { rows: collections }, me] =
    await Promise.all([getApps(), getTasks(), getDomainSettings(), getCollectionOrder(), currentUser()]);
  const overrides = overrideMap(domainSettings);

  // Sidebar counts: open work per domain. A number the rail can stand behind.
  const counts: Record<string, number> = {};
  for (const d of DOMAINS) {
    counts[d.slug] = openTasks(tasks).filter((t) => t.domain === d.slug).length;
  }
  // Everything reachable from the palette that is not part of the nav config.
  //
  // No client is listed here. The palette is part of the overarching
  // environment, so putting client names in it would spread them across every
  // screen — searching for a client happens inside the Clients zone, against
  // the live Notion read.
  const extra: PaletteEntry[] = [
    ...apps.map((a): PaletteEntry => ({
      id: `app-${a.id}`,
      label: a.name,
      group: 'Open app',
      href: a.url,
      external: true,
      keywords: `${a.note} ${a.category}`,
    })),
  ];

  const pins = pinnedApps(apps).slice(0, 4).map((a) => ({ id: a.id, name: a.name, url: a.url }));

  return (
    <html lang="en">
      <body>
        <div className="shell">
          <Sidebar counts={counts} overrides={overrides} collections={collections} signedIn={Boolean(me)} />
          <div className="shell__main">
            <Topbar pins={pins} overrides={overrides} />
            {children}
          </div>
        </div>
        <CommandPalette extra={extra} />
      </body>
    </html>
  );
}
