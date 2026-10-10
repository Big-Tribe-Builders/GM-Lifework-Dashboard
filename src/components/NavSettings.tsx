'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { GROUP_ORDER, DOMAIN_BY_SLUG, type NavSection, type Domain, type Tab } from '@/lib/nav';
import { Icon } from '@/components/Icon';
import { EditDialog } from '@/components/DomainSettings';
import { moveDomain, moveDomainToCollection, moveCollection, setSpaceHidden, setTabHidden, renameTab } from '@/app/d/actions';

type Result = { error: string | null };

/**
 * Settings › Spaces: everything in the rail, in the order it is drawn.
 *
 *   a collection   its place in the rail
 *   a space        its place, its collection, its name, icon and colour,
 *                  and whether it is shown in the rail
 *   a tab          its name, and whether it is shown in its space's tab strip
 *
 * Hiding takes nothing away: a hidden space or tab is back the moment it is
 * shown again.
 */
export function NavSettings({ sections }: { sections: NavSection[] }) {
  // The space she came from (the cog: /settings#space-<slug>) is marked. Read
  // from the address in the browser, because a link inside the app does not
  // set the CSS :target.
  const [target, setTarget] = useState<string | null>(null);
  useEffect(() => {
    const read = () => {
      const m = /^#space-(.+)$/.exec(window.location.hash);
      setTarget(m ? decodeURIComponent(m[1]) : null);
      if (m) document.getElementById(`space-${m[1]}`)?.scrollIntoView({ block: 'start' });
    };
    read();
    window.addEventListener('hashchange', read);
    return () => window.removeEventListener('hashchange', read);
  }, []);
  return (
    <div className="navset">
      {sections.map((s, si) => (
        <section key={s.group} className="navset__collection" aria-label={s.group}>
          <div className="navset__chead">
            <h3 className="navset__cname">{s.group}</h3>
            <span className="navset__muted">{s.domains.length} space{s.domains.length === 1 ? '' : 's'}</span>
            <span className="navset__spacer" />
            <Mover what={`the collection ${s.group}`} canUp={si > 0} canDown={si < sections.length - 1}
              onMove={(dir) => moveCollection(s.group, dir)} />
          </div>
          {s.domains.map((d, di) => (
            <Space key={d.slug} d={d} group={s.group} canUp={di > 0} canDown={di < s.domains.length - 1} marked={d.slug === target} />
          ))}
        </section>
      ))}
    </div>
  );
}

/**
 * Run a save, show its error in place, and redraw the page and the rail.
 * Controls stay enabled while it saves (a disabled control drops the
 * keyboard focus); a second click while saving is simply ignored.
 */
function useSave() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<Result>) => {
    if (pending) return;
    setError(null);
    start(async () => {
      const r = await fn();
      if (r.error) setError(r.error); else router.refresh();
    });
  };
  return { error, pending, run };
}

function Mover({ what, canUp, canDown, onMove }: {
  what: string; canUp: boolean; canDown: boolean; onMove: (dir: 'up' | 'down') => Promise<Result>;
}) {
  const { error, pending, run } = useSave();
  return (
    <span className="navset__mover">
      <button type="button" className="navset__arrow" disabled={!canUp} aria-busy={pending} aria-label={`Move ${what} up`} title="Move up" onClick={() => run(() => onMove('up'))}>
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m4 10 4-4 4 4" /></svg>
      </button>
      <button type="button" className="navset__arrow" disabled={!canDown} aria-busy={pending} aria-label={`Move ${what} down`} title="Move down" onClick={() => run(() => onMove('down'))}>
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m4 6 4 4 4-4" /></svg>
      </button>
      {error ? <span className="cell__error navset__error" role="alert">{error}</span> : null}
    </span>
  );
}

function Space({ d, group, canUp, canDown, marked }: { d: Domain; group: string; canUp: boolean; canDown: boolean; marked: boolean }) {
  const [editing, setEditing] = useState(false);
  const { error, pending, run } = useSave();
  const hidden = new Set(d.hiddenTabs ?? []);
  return (
    <div className={`navset__space${d.hidden ? ' navset__space--hidden' : ''}${marked ? ' navset__space--marked' : ''}`} id={`space-${d.slug}`}
      role="group" aria-label={d.label}>
      <div className="navset__row">
        <span className={`icon-chip icon-chip--sm accent-${d.accent}`}><Icon name={d.icon} /></span>
        <span className="navset__name">{d.label}</span>
        {d.hidden ? <span className="navset__badge">Hidden</span> : null}
        <span className="navset__spacer" />
        <Mover what={d.label} canUp={canUp} canDown={canDown} onMove={(dir) => moveDomain(d.slug, dir)} />
        <label className="navset__field">
          <span className="sr-only">Collection of {d.label}</span>
          <select value={group} aria-busy={pending} onChange={(e) => { const g = e.target.value; run(() => moveDomainToCollection(d.slug, g)); }}>
            {GROUP_ORDER.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </label>
        <button type="button" className="btn btn--ghost btn--tiny" aria-label={`Name, icon and colour of ${d.label}`} onClick={() => setEditing(true)}>Name, icon, colour</button>
        <button type="button" className="btn btn--ghost btn--tiny" aria-busy={pending} aria-label={d.hidden ? `Show ${d.label} in the rail` : `Hide ${d.label} from the rail`}
          onClick={() => run(() => setSpaceHidden(d.slug, !d.hidden))}>
          {d.hidden ? 'Show in the rail' : 'Hide'}
        </button>
      </div>
      <div className="navset__tabs" role="group" aria-label={`Tabs of ${d.label}`}>
        <span className="navset__muted">Tabs</span>
        {d.tabs.map((t) => (
          <span key={t.slug} className={`navset__tab${hidden.has(t.slug) ? ' navset__tab--off' : ''}`}>
            <input type="checkbox" checked={!hidden.has(t.slug)} aria-busy={pending}
              aria-label={`Show ${t.label} in the tab strip`} title={hidden.has(t.slug) ? 'Hidden: tick to show' : 'Shown: untick to hide'}
              onChange={(e) => { const show = e.target.checked; run(() => setTabHidden(d.slug, t.slug, !show)); }} />
            <TabName slug={d.slug} tab={t} />
          </span>
        ))}
      </div>
      {error ? <p className="field__error navset__rowerror" role="alert">{error}</p> : null}
      {/* The dialog's Save wears this space's colour, as it does from the space's own cog. */}
      {editing ? <span className={`accent-${d.accent}`}><EditDialog domain={d} onClose={() => setEditing(false)} /></span> : null}
    </div>
  );
}

/**
 * A tab's name, typed in place. Saved when she presses Enter or clicks away;
 * an empty name gives the tab back the name it has in the code.
 */
function TabName({ slug, tab }: { slug: string; tab: Tab }) {
  const original = DOMAIN_BY_SLUG.get(slug)?.tabs.find((t) => t.slug === tab.slug)?.label ?? tab.label;
  const [draft, setDraft] = useState(tab.label);
  const { error, pending, run } = useSave();
  // After a save the page redraws with the stored name; follow it.
  useEffect(() => { setDraft(tab.label); }, [tab.label]);
  const commit = () => {
    const v = draft.trim();
    if (v === tab.label) return;
    if (!v) setDraft(original);
    run(() => renameTab(slug, tab.slug, v));
  };
  return (
    <>
      <input className="navset__tabname" value={draft} placeholder={original} maxLength={40} aria-busy={pending}
        aria-label={`Name of the tab ${original}`} size={Math.max(6, draft.length + 1)}
        onChange={(e) => setDraft(e.target.value)} onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLInputElement).blur(); } if (e.key === 'Escape') { e.preventDefault(); setDraft(tab.label); } }} />
      {error ? <span className="cell__error navset__error" role="alert" title={error}>{error}</span> : null}
    </>
  );
}
