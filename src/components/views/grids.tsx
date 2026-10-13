'use client';

import { useEffect, useState, type ReactNode } from 'react';
import type { Bundle } from '@/lib/data/bundle';
import { byClient, byPriority, WORK_LABEL, STAGES, type CodeProject, type ProjectStage } from '@/lib/projects';
import { getSupabase } from '@/lib/supabase';
import type {
  Task, AppLink, BrainSource, VoiceRule, ContentItem, Course, GoalPeriod, Signal,
} from '@/lib/types';
import { ROOTS } from '@/lib/types';
import { Grid, type Column, type Group } from '@/components/Grid';
import { shortDate } from '@/lib/upwork';

/**
 * Every zone as a grid.
 *
 * One table, the same one, everywhere — the same rules, the same row height,
 * the same type glyphs in the header. A tab that has no source yet still
 * draws its columns and says plainly that nothing feeds them, rather than
 * showing a widget that implies data it does not have.
 */

const dash = <span className="grid2__dash">—</span>;
const text = (v: string | null | undefined) => (v && v.trim() ? v : dash);

function chip(label: string | null, tone?: string) {
  if (!label) return dash;
  return tone ? <span className={`status status--${tone}`}>{label}</span> : <>{label}</>;
}

function link(url: string | null, label = 'Open ↗') {
  return url
    ? <a className="grid2__link" href={url} target="_blank" rel="noreferrer">{label}</a>
    : dash;
}

// --------------------------------------------------------------- row types

const TASK_COLS: Column<Task>[] = [
  { key: 'title', label: 'Task', type: 'text', width: 340, render: (t) => t.title },
  { key: 'for', label: 'For', type: 'text', width: 180, render: (t) => text(t.clientName ?? t.area) },
  { key: 'status', label: 'Status', type: 'select', width: 140,
    render: (t) => chip(t.status.replace('_', ' '), t.status === 'done' ? 'done' : 'active') },
  { key: 'priority', label: 'Priority', type: 'select', width: 120,
    render: (t) => chip(t.priority, t.priority === 'urgent' || t.priority === 'high' ? 'contact' : undefined) },
  { key: 'due', label: 'Due', type: 'date', width: 130, render: (t) => shortDate(t.dueDate ?? t.doDate) },
];

const APP_COLS: Column<AppLink>[] = [
  { key: 'name', label: 'App', type: 'text', width: 240, render: (a) => a.name },
  { key: 'note', label: 'What for', type: 'text', width: 300, render: (a) => text(a.note) },
  { key: 'category', label: 'Category', type: 'select', width: 190, render: (a) => text(a.category) },
  { key: 'connected', label: 'Wired to the brain', type: 'check', width: 170,
    render: (a) => (a.connected ? <span className="status status--active">Yes</span> : dash) },
  { key: 'open', label: 'Open', type: 'link', width: 110, render: (a) => link(a.url) },
];

const SOURCE_COLS: Column<BrainSource>[] = [
  { key: 'name', label: 'Source', type: 'text', width: 240, render: (s) => s.name },
  { key: 'kind', label: 'Kind', type: 'select', width: 120, render: (s) => s.kind },
  { key: 'state', label: 'State', type: 'select', width: 160,
    render: (s) => chip(
      s.state === 'needs_auth' ? 'needs authorising' : s.state,
      s.state === 'connected' ? 'active' : s.state === 'needs_auth' ? 'done' : 'sleeping',
    ) },
  { key: 'reach', label: 'Reach', type: 'text', width: 300, render: (s) => text(s.reach) },
  { key: 'feeds', label: 'Feeds', type: 'text', width: 220, render: (s) => text(s.feeds.join(', ')) },
];

const VOICE_COLS: Column<VoiceRule>[] = [
  { key: 'title', label: 'Rule', type: 'text', width: 300, render: (r) => r.title },
  { key: 'kind', label: 'Kind', type: 'select', width: 140, render: (r) => r.kind },
  { key: 'detail', label: 'What it means', type: 'text', width: 520, render: (r) => text(r.detail) },
];

const CONTENT_COLS: Column<ContentItem>[] = [
  { key: 'title', label: 'Title', type: 'text', width: 340, render: (c) => c.title },
  { key: 'channel', label: 'Channel', type: 'select', width: 140, render: (c) => c.channel },
  { key: 'state', label: 'State', type: 'select', width: 140,
    render: (c) => chip(c.state, c.state === 'published' ? 'done' : c.state === 'review' ? 'contact' : 'active') },
  { key: 'when', label: 'Scheduled', type: 'date', width: 140, render: (c) => shortDate(c.scheduledFor) },
  { key: 'campaign', label: 'Campaign', type: 'text', width: 200, render: (c) => text(c.campaign) },
];

const COURSE_COLS: Column<Course>[] = [
  { key: 'title', label: 'Course', type: 'text', width: 300, render: (c) => c.title },
  { key: 'provider', label: 'Provider', type: 'text', width: 180, render: (c) => text(c.provider) },
  { key: 'progress', label: 'Lessons', type: 'number', width: 120, numeric: true,
    render: (c) => `${c.lessonsDone}/${c.lessonsTotal}` },
  { key: 'state', label: 'State', type: 'select', width: 130,
    render: (c) => chip(c.state.replace('_', ' '), c.state === 'done' ? 'done' : c.state === 'studying' ? 'active' : 'sleeping') },
  { key: 'next', label: 'Next lesson', type: 'text', width: 280, render: (c) => text(c.nextLesson) },
  { key: 'open', label: 'Open', type: 'link', width: 110, render: (c) => link(c.url) },
];

const GOAL_COLS: Column<GoalPeriod>[] = [
  { key: 'title', label: 'Theme', type: 'text', width: 340, render: (g) => g.title },
  { key: 'tier', label: 'Period', type: 'select', width: 130, render: (g) => g.tier },
  { key: 'from', label: 'From', type: 'date', width: 130, render: (g) => shortDate(g.periodStart) },
  { key: 'to', label: 'To', type: 'date', width: 130, render: (g) => shortDate(g.periodEnd) },
  { key: 'progress', label: 'Progress', type: 'number', width: 120, numeric: true,
    render: (g) => (g.progress === null ? dash : `${Math.round(g.progress * 100)}%`) },
];

const SIGNAL_COLS: Column<Signal>[] = [
  { key: 'title', label: 'Signal', type: 'text', width: 300, render: (s) => s.title },
  { key: 'detail', label: 'Detail', type: 'text', width: 420, render: (s) => text(s.detail) },
  { key: 'kind', label: 'Kind', type: 'select', width: 140, render: (s) => s.kind },
];

/**
 * The status dropdown: Building | Live | Archived, one write per change.
 *
 * Her call, not a reading — which is why it is a select and not a chip. The
 * row moves to its tab the moment she picks, and moves back if the write
 * fails, so the grid never shows a state the database refused.
 */
function stageColumn(onStage: (p: CodeProject, v: ProjectStage) => void): Column<CodeProject> {
  return {
    key: 'stage', label: 'Status', type: 'select', width: 130,
    render: (p) => (
      <select
        className="stagesel"
        value={p.status}
        aria-label={`Status of ${p.name}`}
        onChange={(e) => onStage(p, e.target.value as ProjectStage)}
      >
        {STAGES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
      </select>
    ),
  };
}

const PROJECT_COLS: Column<CodeProject>[] = [
  { key: 'name', label: 'Project', type: 'text', width: 250, render: (p) => p.name },
  { key: 'session', label: 'Session', type: 'link', width: 120,
    render: (p) => link(p.sessionUrl, 'Open session ↗') },
  { key: 'repo', label: 'GitHub', type: 'link', width: 260,
    render: (p) => (p.repoUrl ? link(p.repoUrl, p.repo ?? p.repoUrl) : dash) },
  { key: 'live', label: 'Live', type: 'link', width: 160, render: (p) => link(p.liveUrl) },
  { key: 'host', label: 'Host', type: 'select', width: 110, render: (p) => text(p.host) },
  { key: 'work', label: 'Work', type: 'select', width: 140,
    render: (p) => chip(
      p.sessionState === 'running' ? 'Running' : WORK_LABEL[p.workState ?? ''] ?? text(p.workState) as string,
      p.sessionState === 'running' ? 'active' : p.workState === 'need_input' ? 'contact' : p.workState === 'completed' ? 'done' : 'sleeping',
    ) },
  { key: 'last', label: 'Last action', type: 'text', width: 340, render: (p) => text(p.lastAction) },
  { key: 'branch', label: 'Branch', type: 'text', width: 220, render: (p) => text(p.branch) },
  { key: 'framework', label: 'Framework', type: 'text', width: 190, render: (p) => text(p.framework) },
  { key: 'database', label: 'Database', type: 'text', width: 130, render: (p) => text(p.database) },
  { key: 'auth', label: 'Login', type: 'text', width: 120, render: (p) => text(p.auth) },
  { key: 'services', label: 'Services', type: 'text', width: 200, render: (p) => text(p.services) },
  { key: 'updated', label: 'Updated', type: 'date', width: 120, render: (p) => shortDate(p.updatedAt) },
];

/** The projects, folded by client the way her session list groups them. */
function ProjectsGrid({ rows, store, empty, onStage }: {
  rows: CodeProject[];
  store: string;
  empty: string;
  onStage: (p: CodeProject, v: ProjectStage) => void;
}) {
  const [closed, setClosed] = useState<Record<string, boolean>>({});
  const columns = [PROJECT_COLS[0], stageColumn(onStage), ...PROJECT_COLS.slice(1)];
  const groups: Group<CodeProject>[] = byClient(rows).map(([client, list]) => ({
    key: client,
    head: <span className="grid2__foldname">{client}</span>,
    tone: 'grey',
    rows: list,
    open: !closed[client],
    onToggle: () => setClosed((c) => ({ ...c, [client]: !c[client] })),
  }));
  return (
    <Grid
      columns={columns}
      {...(rows.length > 0 ? { groups } : {})}
      rowKey={(p) => p.sessionId}
      store={store}
      empty={empty}
    />
  );
}

/**
 * Vibe Coding › Building as a priority list (Giulia, 13 Oct 2026): one list
 * in her order, 1 first, with a tick for what she is working on now and a
 * switch between all of them and only those.
 */
type Focus = { onFocus: (p: CodeProject, on: boolean) => void; onNumbers: (numbers: { p: CodeProject; n: number | null }[]) => void };
const ONLY = 'lifework.apps.building.only';

function BuildingList({ rows, store, empty, onStage, onFocus, onNumbers, error }: Focus & {
  rows: CodeProject[]; store: string; empty: string; error: string | null;
  onStage: (p: CodeProject, v: ProjectStage) => void;
}) {
  const [only, setOnly] = useState(false);
  // Which of the two she looked at last, kept in this browser.
  useEffect(() => { try { setOnly(localStorage.getItem(ONLY) === '1'); } catch { /* private mode */ } }, []);
  const pick = (v: boolean) => { setOnly(v); try { localStorage.setItem(ONLY, v ? '1' : '0'); } catch { /* private mode */ } };

  const sorted = [...rows].sort(byPriority);
  const shown = only ? sorted.filter((p) => p.workingOn) : sorted;
  const now = sorted.filter((p) => p.workingOn).length;

  // The whole list numbered 1, 2, 3 … as it reads; only the numbers that change are written.
  const renumber = (order: CodeProject[]) => onNumbers(order.flatMap((x, i) => (x.priority === i + 1 ? [] : [{ p: x, n: i + 1 }])));
  // Move one place among what is shown.
  function move(p: CodeProject, dir: -1 | 1) {
    const i = shown.indexOf(p);
    const other = shown[i + dir];
    if (!other) return;
    const rest = sorted.filter((x) => x !== p);
    const at = rest.indexOf(other) + (dir === 1 ? 1 : 0);
    renumber([...rest.slice(0, at), p, ...rest.slice(at)]);
  }
  // A typed number puts the project in that place. An emptied one drops it
  // to the projects without a number, and the numbered ones close up.
  function place(p: CodeProject, n: number | null) {
    const rest = sorted.filter((x) => x !== p);
    if (n === null) {
      const numbered = rest.filter((x) => x.priority != null);
      onNumbers([...numbered.flatMap((x, i) => (x.priority === i + 1 ? [] : [{ p: x, n: i + 1 }])), { p, n: null }]);
      return;
    }
    const at = Math.min(n, rest.length + 1) - 1;
    renumber([...rest.slice(0, at), p, ...rest.slice(at)]);
  }

  const columns: Column<CodeProject>[] = [
    { key: 'now', label: 'Working on', type: 'check', width: 150, render: (p) => (
      <span className="flagcell">
        <input type="checkbox" className="flagcell__box" checked={!!p.workingOn} aria-label={`Working on ${p.name}`}
          onChange={(e) => onFocus(p, e.target.checked)} />
      </span>
    ) },
    { key: 'priority', label: 'Priority', type: 'number', width: 140, render: (p) => {
      const i = shown.indexOf(p);
      return <PriorityCell p={p} canUp={i > 0} canDown={i < shown.length - 1} onMove={(d) => move(p, d)} onSet={(n) => place(p, n)} />;
    } },
    PROJECT_COLS[0],
    { key: 'client', label: 'Client', type: 'select', width: 160, render: (p) => text(p.client) },
    stageColumn(onStage),
    ...PROJECT_COLS.slice(1),
  ];
  return (
    <div className="mailstack">
      <div className="buildbar" role="group" aria-label="Show">
        <button type="button" className={`chip${!only ? ' chip--active' : ''}`} aria-pressed={!only} onClick={() => pick(false)}>All · {sorted.length}</button>
        <button type="button" className={`chip${only ? ' chip--active' : ''}`} aria-pressed={only} onClick={() => pick(true)}>Working on · {now}</button>
        {error ? <span className="cell__error buildbar__error" role="alert">{error}</span> : null}
      </div>
      <Grid columns={columns} rows={shown} rowKey={(p) => p.sessionId} store={store}
        empty={only ? 'Nothing ticked as Working on. Tick a project in All.' : empty} />
    </div>
  );
}

/** The priority number, typed in place, with arrows to move a place up or down. */
function PriorityCell({ p, canUp, canDown, onMove, onSet }: {
  p: CodeProject; canUp: boolean; canDown: boolean; onMove: (dir: -1 | 1) => void; onSet: (n: number | null) => void;
}) {
  const [draft, setDraft] = useState(p.priority == null ? '' : String(p.priority));
  useEffect(() => { setDraft(p.priority == null ? '' : String(p.priority)); }, [p.priority]);
  const commit = () => {
    const v = draft.trim();
    const n = v === '' ? null : Number(v);
    if (n !== null && (!Number.isInteger(n) || n < 1 || n > 9999)) { setDraft(p.priority == null ? '' : String(p.priority)); return; }
    if (n !== (p.priority ?? null)) onSet(n);
  };
  return (
    <span className="prio">
      <input className="prio__num" inputMode="numeric" value={draft} placeholder="—" aria-label={`Priority of ${p.name}`}
        onChange={(e) => setDraft(e.target.value.replace(/[^0-9]/g, ''))} onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />
      <button type="button" className="prio__arrow" disabled={!canUp} aria-label={`Move ${p.name} up`} title="Move up" onClick={() => onMove(-1)}>
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m4 10 4-4 4 4" /></svg>
      </button>
      <button type="button" className="prio__arrow" disabled={!canDown} aria-label={`Move ${p.name} down`} title="Move down" onClick={() => onMove(1)}>
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m4 6 4 4 4-4" /></svg>
      </button>
    </span>
  );
}

type RootsRow = (typeof ROOTS)[number];
const ROOTS_COLS: Column<RootsRow>[] = [
  { key: 'letter', label: 'Letter', type: 'text', width: 100, render: (r) => r.letter },
  { key: 'name', label: 'Pillar', type: 'text', width: 300, render: (r) => r.name },
  { key: 'blurb', label: 'What it covers', type: 'text', width: 520, render: (r) => r.blurb },
];

// ------------------------------------------------------------- not wired yet

/**
 * A tab with no source behind it.
 *
 * It draws the columns it will have and says what is missing. An empty grid
 * that names its fields is a promise; a widget full of nothing is a lie.
 */
function pending(labels: string[], what: string, store: string): ReactNode {
  const columns: Column<never>[] = labels.map((label, i) => ({
    key: `c${i}`,
    label,
    type: i === 0 ? 'text' : 'select',
    width: i === 0 ? 300 : 180,
    render: () => dash,
  }));
  return <Grid rows={[]} columns={columns} rowKey={() => ''} store={store} empty={what} />;
}

// ------------------------------------------------------------------ the map

/**
 * The grid for one tab.
 *
 * Takes slugs rather than the nav objects: the grid runs in the browser, so
 * only plain data crosses to it.
 */
export function ZoneGrid({ domain, tab, blurb, b }: {
  domain: string;
  tab: string;
  blurb: string;
  b: Bundle;
}): ReactNode {
  const store = `lifework.${domain}.${tab}.cols`;
  // Her changes land here first, so a row changes the moment she picks —
  // and snaps back if the database refuses the write.
  type Staged = Partial<Pick<CodeProject, 'status' | 'workingOn' | 'priority'>>;
  const [staged, setStaged] = useState<Record<string, Staged>>({});
  const [writeError, setWriteError] = useState<string | null>(null);
  const projects = b.codeProjects.map(
    (p) => (staged[p.sessionId] ? { ...p, ...staged[p.sessionId] } : p));
  /** One or more rows at once: shown first, written, put back if the database says no. */
  async function write(changes: { p: CodeProject; local: Staged; column: Record<string, unknown> }[]) {
    if (!changes.length) return;
    const before = Object.fromEntries(changes.map(({ p }) => [p.sessionId, staged[p.sessionId]]));
    setWriteError(null);
    setStaged((m) => {
      const next = { ...m };
      for (const c of changes) next[c.p.sessionId] = { ...next[c.p.sessionId], ...c.local };
      return next;
    });
    const db = getSupabase();
    if (!db) { setStaged((m) => ({ ...m, ...before })); setWriteError('Supabase is not configured, so this is not saved.'); return; }
    const results = await Promise.all(changes.map((c) => db.from('code_projects').update(c.column).eq('session_id', c.p.sessionId)));
    // Only what the database refused goes back; what it took stays.
    const failed = changes.filter((_, i) => results[i].error);
    if (failed.length) {
      setStaged((m) => ({ ...m, ...Object.fromEntries(failed.map(({ p }) => [p.sessionId, before[p.sessionId]])) }));
      setWriteError(results.find((r) => r.error)!.error!.message);
    }
  }
  const moveStage = (p: CodeProject, v: ProjectStage) => write([{ p, local: { status: v }, column: { status: v } }]);
  const focus: Focus = {
    onFocus: (p, on) => write([{ p, local: { workingOn: on }, column: { working_on: on } }]),
    onNumbers: (numbers) => write(numbers.map(({ p, n }) => ({ p, local: { priority: n }, column: { priority: n } }))),
  };
  // The open work of this domain. Inlined rather than imported from the data
  // barrel: that module reads the disk, and this grid runs in the browser.
  const mine = b.tasks.filter((t) => t.status !== 'done' && t.domain === domain);
  const work = (empty: string) => (
    <Grid rows={mine} columns={TASK_COLS} rowKey={(t) => t.id} store={store} empty={empty} />
  );

  switch (`${domain}/${tab}`) {
    // ------------------------------------------------------------ the brain
    case 'brain/voice':
    case 'content/voice':
      return <Grid rows={b.voiceRules} columns={VOICE_COLS} rowKey={(r) => r.id} store={store}
        empty="No voice rules recorded." />;
    case 'brain/method':
      return <Grid rows={[...ROOTS]} columns={ROOTS_COLS} rowKey={(r) => r.key} store={store}
        empty="No method recorded." />;
    case 'brain/sources':
      return <Grid rows={b.brainSources} columns={SOURCE_COLS} rowKey={(s) => s.id} store={store}
        empty="No sources recorded." />;
    case 'brain/library':
      return <Grid rows={b.brainSources.filter((s) => s.kind === 'corpus' || s.kind === 'graph')}
        columns={SOURCE_COLS} rowKey={(s) => s.id} store={store}
        empty="Nothing in the library yet." />;
    case 'brain/prompts':
      return pending(['Prompt', 'Runs on', 'Last used'],
        'Saved prompts are not stored anywhere yet.', store);

    // ------------------------------------------------------------- content
    case 'content/today':
      return <Grid rows={b.content.filter((c) => c.state === 'review' || c.state === 'scheduled')}
        columns={CONTENT_COLS} rowKey={(c) => c.id} store={store}
        empty="Nothing waiting on you today." />;
    case 'content/pipeline':
      return <Grid rows={b.content.filter((c) => c.state !== 'published')}
        columns={CONTENT_COLS} rowKey={(c) => c.id} store={store}
        empty="The pipeline is empty." />;
    case 'content/channels':
      return <Grid rows={b.content} columns={CONTENT_COLS} rowKey={(c) => c.id} store={store}
        empty="No posts recorded." />;
    case 'content/campaigns':
      return <Grid rows={b.content.filter((c) => c.campaign)}
        columns={CONTENT_COLS} rowKey={(c) => c.id} store={store}
        empty="Nothing is tied to a campaign." />;

    // ---------------------------------------------------------------- apps
    case 'apps/building':
      return <BuildingList rows={projects.filter((p) => p.status === 'building')}
        store={store} onStage={moveStage} {...focus} error={writeError}
        empty="No projects loaded. They come from the code_projects table." />;
    case 'apps/live':
      return <ProjectsGrid rows={projects.filter((p) => p.status === 'live')}
        store={store} onStage={moveStage}
        empty="Nothing marked Live yet. Set a project's Status to Live and it moves here." />;
    case 'apps/archived':
      return <ProjectsGrid rows={projects.filter((p) => p.status === 'archived')}
        store={store} onStage={moveStage}
        empty="Nothing archived. Set a project's Status to Archived to tuck it away here." />;
    case 'apps/workers':
      return pending(['Worker', 'Building', 'Waiting on', 'Last seen'],
        'The workers are not reporting into this yet.', store);

    // ------------------------------------------------------------ ventures
    case 'quinb-academy/pulse':
      return <Grid rows={b.signals.filter((s) => s.domain === domain)}
        columns={SIGNAL_COLS} rowKey={(s) => s.id} store={store}
        empty="Nothing moved that needs you." />;
    case 'giulia-may/list':
      return <Grid rows={b.brainSources.filter((s) => s.feeds.includes('giulia-may'))}
        columns={SOURCE_COLS} rowKey={(s) => s.id} store={store}
        empty="No audience source connected." />;

    default:
      // Every remaining tab has open work behind it and nothing else yet.
      return work(`Nothing open here. ${blurb}`);
  }
}
