import { getApps } from '@/lib/data';
import { PageHead, Widget, Stat, Launcher, SourceNote } from '@/components/ui';
import { accentAt } from '@/lib/nav';
import type { AppCategory } from '@/lib/types';

export const metadata = { title: 'Launchpad — Big Tribe Builders' };

const ORDER: AppCategory[] = [
  'Communities', 'Work & Delivery', 'Content & Social',
  'Email & Audience', 'Build & Deploy', 'Money', 'Learning', 'Personal',
];

/**
 * The Launchpad.
 *
 * The dashboard does not rebuild your tools, it opens them. This page is the
 * single answer to "where was that thing again" — and the `wired` marker tells
 * you which of them this dashboard can also read, not just link to.
 */
export default async function Launchpad() {
  const { rows: apps, source, error } = await getApps();
  const wired = apps.filter((a) => a.connected);

  return (
    <main className="content content--wide stack">
      <PageHead
        title="Launchpad"
        blurb="Every tool you move between, one click away. Marked “wired” means this dashboard can read it too."
        actions={<button type="button" className="btn btn--ghost" data-open-palette>Search instead</button>}
      />

      <SourceNote source={source} error={error} />

      <section className="grid">
        <div className="col-4"><Stat label="Apps linked" value={apps.length} meta="Across every area" accent="violet" /></div>
        <div className="col-4"><Stat label="Wired to the brain" value={wired.length} meta="Readable, not just clickable" accent="green" /></div>
        <div className="col-4"><Stat label="Pinned" value={apps.filter((a) => a.pinned).length} meta="On the top bar all day" accent="orange" /></div>
      </section>

      {ORDER.map((cat, i) => {
        const rows = apps.filter((a) => a.category === cat);
        if (rows.length === 0) return null;
        return (
          <section key={cat}>
            <Widget title={cat} accent={accentAt(i)}>
              <Launcher apps={rows} />
            </Widget>
          </section>
        );
      })}
    </main>
  );
}
