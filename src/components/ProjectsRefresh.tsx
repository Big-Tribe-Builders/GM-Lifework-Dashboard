'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { refreshProjects } from '@/app/d/apps/actions';
import { getSupabase } from '@/lib/supabase';
import type { ProjectsSync } from '@/lib/projects';

/** "13 Oct, 11:35", in her time. */
const when = (iso: string) => new Date(iso).toLocaleString('en-GB', {
  day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Brussels',
});

const LOOK_EVERY = 15_000;
const GIVE_UP = 15 * 60_000;

/**
 * Vibe Coding › Refresh (Giulia, 13 Oct 2026): start the routine that brings
 * the projects up to date with her Claude Code sessions, wait for it (a few
 * minutes), and redraw the page once it has run. Next to it, when that last
 * happened, so she can see how fresh "Updated" is.
 */
export function ProjectsRefresh({ sync }: { sync: ProjectsSync | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // The run that is going: the refresh it has to beat, and where to watch it.
  const [running, setRunning] = useState<{ before: string | null; url?: string } | null>(null);
  const [lastRun, setLastRun] = useState<string | undefined>();
  const [done, setDone] = useState<ProjectsSync | null>(null);
  const shown = done ?? sync;

  // While it runs, look for a newer refresh than the one known when she pressed.
  useEffect(() => {
    if (!running) return;
    const db = getSupabase();
    if (!db) return;
    let stop = false;
    const look = async () => {
      const { data } = await db.from('code_projects_sync_api').select('*').maybeSingle();
      const row = data as ProjectsSync | null;
      if (stop || !row || row.syncedAt === running.before) return;
      setDone(row);
      setRunning(null);
      router.refresh();
    };
    const every = setInterval(look, LOOK_EVERY);
    const quit = setTimeout(() => {
      setRunning(null);
      setError('The refresh has not reported back after 15 minutes. Open the run to see what happened.');
    }, GIVE_UP);
    return () => { stop = true; clearInterval(every); clearTimeout(quit); };
  }, [running, router]);

  const press = () => {
    // Not disabled while busy (a disabled button drops the keyboard focus); a second press is ignored.
    if (pending || running) return;
    setError(null);
    start(async () => {
      const r = await refreshProjects();
      if (r.error) { setError(r.error); return; }
      setLastRun(r.sessionUrl);
      setRunning({ before: shown?.syncedAt ?? null, url: r.sessionUrl });
    });
  };

  const status = running || pending
    ? <>Refreshing from Claude Code, a few minutes{running?.url ? <> · <a className="grid2__link" href={running.url} target="_blank" rel="noreferrer">watch ↗</a></> : null}</>
    : shown
      ? <>Refreshed {when(shown.syncedAt)}{done ? ` · ${done.added} new, ${done.updated} updated` : ''}</>
      : <>Not refreshed from Claude Code yet</>;

  return (
    <span className="refresh">
      <span className="refresh__when" aria-live="polite">{status}</span>
      <button type="button" className="btn btn--ghost btn--tiny refresh__btn" onClick={press}
        aria-busy={pending || !!running} title="Bring the projects up to date with your Claude Code sessions">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9" /><path d="M13.5 2.5v3h-3" />
        </svg>
        Refresh
      </button>
      {error ? (
        <span className="cell__error refresh__error" role="alert" title={error}>
          {error}{lastRun ? <> <a className="grid2__link" href={lastRun} target="_blank" rel="noreferrer">Open the run ↗</a></> : null}
        </span>
      ) : null}
    </span>
  );
}
