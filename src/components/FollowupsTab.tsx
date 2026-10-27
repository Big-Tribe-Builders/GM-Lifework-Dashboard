import { cookies } from 'next/headers';
import { getSupabase } from '@/lib/supabase';
import type { QuinbMember } from '@/lib/book';
import { DB_STEP, todayBrussels, type Followup } from '@/lib/followups';
import { Followups, type LastRun } from '@/components/QuinbFollowups';
import type { RefreshNote } from '@/app/d/quinb/followup-actions';
import { chatStatus, SAID_COOKIE } from '@/lib/mighty-oauth';
import { draftStatus } from '@/lib/draft';
import { followupsDb, followupOf, FOLLOWUP_COLS, FOLLOWUPS_NEED_ADMIN } from '@/lib/followups-db';

/**
 * QuinB Community › Follow-ups, on the server: the follow-up log (with the
 * service role: it holds private messages, see lib/followups-db.ts) and the
 * last "Refresh from QuinB", read here so a missing table never reaches the
 * rest of the app. Before migration 0025 has run, the tab says so and the
 * other tabs work as before. Where private messages and drafting stand
 * (connected as whom, what is missing) is read here too; the tokens and keys
 * never leave the server.
 */

const missing = (msg: string) => /does not exist|could not find|schema cache/i.test(msg);
const when = (iso: string) => new Date(iso).toLocaleString('en-GB', { timeZone: 'Europe/Brussels', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

function Notice({ title, text }: { title: string; text: string }) {
  return (
    <div className="notice">
      <span className="icon-chip icon-chip--sm accent-orange">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="8.5" /><path d="M12 8v5M12 16h.01" /></svg>
      </span>
      <div>
        <p className="row__title" style={{ fontSize: 14 }}>{title}</p>
        <p className="muted" style={{ marginTop: 2 }}>{text}</p>
      </div>
    </div>
  );
}

type RunRow = { ranAt: string; read: number; added: number; updated: number; gone: number; error: string | null; notes: RefreshNote[] | null };

export async function FollowupsTab({ members }: { members: QuinbMember[] }) {
  const db = getSupabase();
  if (!db) return <Notice title="Follow-ups cannot be read" text="Supabase is not configured." />;
  const admin = followupsDb();
  if (!admin) return <Notice title="Follow-ups cannot be read" text={FOLLOWUPS_NEED_ADMIN} />;
  const [fu, runs] = await Promise.all([
    admin.from('quinb_followups').select(FOLLOWUP_COLS),
    db.from('quinb_refresh_runs_api').select('*').order('ranAt', { ascending: false }).limit(1),
  ]);
  const err = fu.error?.message ?? runs.error?.message ?? null;
  if (err) {
    return missing(err)
      ? <Notice title={DB_STEP} text="Follow-ups needs new columns on the members and two new tables. Until that step is done this tab waits; every other tab works as before." />
      : <Notice title="Follow-ups cannot be read" text={err} />;
  }
  const r = (runs.data?.[0] ?? null) as RunRow | null;
  const lastRun: LastRun | null = r ? {
    at: when(r.ranAt),
    summary: r.error ? null : `${r.read} read: ${r.added} new, ${r.updated} updated, ${r.gone} gone`,
    error: r.error,
    notes: r.notes ?? [],
  } : null;
  const [chat, draft, jar] = await Promise.all([chatStatus(), draftStatus(), cookies()]);
  const followups: Followup[] = (fu.data ?? []).map(followupOf);
  return <Followups members={members} followups={followups} today={todayBrussels()} lastRun={lastRun}
    chat={chat} draft={draft} said={jar.get(SAID_COOKIE)?.value ?? null} />;
}
