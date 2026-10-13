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
 * The run that is going, kept in this browser tab's session, so it survives
 * a move between Building, Stages, Live and Archived (each draws its own
 * bar): the refresh it has to beat, when it started, where to watch it.
 */
type Run = { before: string | null; at: number; url?: string };
const RUN = 'lifework.apps.refresh';
function readRun(): Run | null {
  try {
    const r = JSON.parse(sessionStorage.getItem(RUN) ?? 'null') as Run | null;
    return r && Date.now() - r.at < GIVE_UP ? r : null;
  } catch { return null; }
}
function saveRun(r: Run | null) {
  try { if (r) sessionStorage.setItem(RUN, JSON.stringify(r)); else sessionStorage.removeItem(RUN); } catch { /* private mode */ }
}

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
  const [running, setRunning] = useState<Run | null>(null);
  // The run that did not report back in time, to open from the error.
  const [lateRun, setLateRun] = useState<string | null>(null);
  const [done, setDone] = useState<ProjectsSync | null>(null);
  const shown = done ?? sync;

  // A run started on another tab of this space is still being waited for here.
  useEffect(() => { setRunning(readRun()); }, []);

  // While it runs, look for a newer refresh than the one in the database when she pressed.
  useEffect(() => {
    if (!running) return;
    const db = getSupabase();
    let stop = false;
    const look = async () => {
      if (!db) return;
      const { data } = await db.from('code_projects_sync_api').select('*').maybeSingle();
      const row = data as ProjectsSync | null;
      if (stop || !row || row.syncedAt === running.before) return;
      saveRun(null);
      setDone(row);
      setRunning(null);
      router.refresh();
    };
    look();
    const every = setInterval(look, LOOK_EVERY);
    const quit = setTimeout(() => {
      saveRun(null);
      setRunning(null);
      setLateRun(running.url ?? null);
      setError('The refresh has not reported back after 15 minutes.');
    }, Math.max(0, GIVE_UP - (Date.now() - running.at)));
    return () => { stop = true; clearInterval(every); clearTimeout(quit); };
  }, [running, router]);

  const press = () => {
    // Not disabled while busy (a disabled button drops the keyboard focus); a second press is ignored.
    if (pending || running) return;
    setError(null);
    setLateRun(null);
    const db = getSupabase();
    if (!db) { setError('This build has no Supabase, so a refresh could not be followed here.'); return; }
    start(async () => {
      // The refresh to beat is the one in the database now, not the one the page was drawn with.
      const { data } = await db.from('code_projects_sync_api').select('*').maybeSingle();
      const before = (data as ProjectsSync | null)?.syncedAt ?? null;
      const r = await refreshProjects();
      if (r.error) { setError(r.error); return; }
      const run = { before, at: Date.now(), url: r.sessionUrl };
      saveRun(run);
      setRunning(run);
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
          {error}{lateRun ? <> <a className="grid2__link" href={lateRun} target="_blank" rel="noreferrer">Open the run ↗</a></> : null}
        </span>
      ) : null}
    </span>
  );
}
