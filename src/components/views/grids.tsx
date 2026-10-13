'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Bundle } from '@/lib/data/bundle';
import { byClient, byPriority, STAGES, STAGE_LABEL, BOARD_STAGES, PUT_AWAY, type CodeProject, type ProjectStage, type ProjectsSync } from '@/lib/projects';
import { getSupabase } from '@/lib/supabase';
import type {
  Task, AppLink, BrainSource, VoiceRule, ContentItem, Course, GoalPeriod, Signal,
} from '@/lib/types';
import { ROOTS } from '@/lib/types';
import { Grid, type Column, type Group } from '@/components/Grid';
import { Kanban, type KanbanList } from '@/components/Kanban';
import { ProjectsRefresh } from '@/components/ProjectsRefresh';
import { ColorPicker } from '@/components/ColorPicker';
import { saveGroupColor } from '@/app/d/actions';
import type { PaletteKey } from '@/lib/palette';
import type { ViewMode } from '@/lib/grid';
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
 * A stage change draws the project again somewhere else (another fold, another
 * list), which drops the keyboard focus; give it back to its dropdown there,
 * so arrowing through the stages keeps going.
 */
const keepStageFocus = (id: string) => requestAnimationFrame(() => {
  const at = document.activeElement;
  if (at && at !== document.body) return;
  document.querySelector<HTMLElement>(`[data-stage-for="${CSS.escape(id)}"]`)?.focus();
});

/**
 * The bar above every project tab: what that tab puts there (Building: All /
 * Working on), why a change did not save, and on the right Refresh, with when
 * the list was last brought up to date with Claude Code.
 */
function ProjectsBar({ error, sync, children }: { error: string | null; sync: ProjectsSync | null; children?: ReactNode }) {
  return (
    <div className="buildbar" role="group" aria-label="Projects">
      {children}
      {error ? <span className="cell__error buildbar__error" role="alert">{error}</span> : null}
      <span className="buildbar__spacer" />
      <ProjectsRefresh sync={sync} />
    </div>
  );
}

/**
 * The status dropdown: her stages (src/lib/projects.ts), one write per change.
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
        data-stage-for={p.sessionId}
        onChange={(e) => { onStage(p, e.target.value as ProjectStage); keepStageFocus(p.sessionId); }}
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
  { key: 'database', label: 'Database', type: 'text', width: 130, render: (p) => text(p.database) },
  { key: 'auth', label: 'Login', type: 'text', width: 120, render: (p) => text(p.auth) },
  { key: 'services', label: 'Services', type: 'text', width: 200, render: (p) => text(p.services) },
  { key: 'updated', label: 'Updated', type: 'date', width: 120, render: (p) => shortDate(p.updatedAt) },
];

// Not shown (Giulia, 13 Oct 2026): the session's own state ("Running", "Needs
// you"), one field with Status now, the last action, and the branch and the
// framework (kept in the table, not important at this moment).

/** Her session list's group (Giulia, 13 Oct 2026: "Group", not "Client"). */
const GROUP_COL: Column<CodeProject> = { key: 'client', label: 'Group', type: 'select', width: 160, render: (p) => text(p.client) };

/** "Working on": a hammer, drawn in the header and on a card. */
const HAMMER = (
  <svg className="hammer" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M2.2 13.8 8.6 7.4" strokeWidth="2" />
    <path d="M8 2 14 8 11.6 10.4 5.6 4.4Z" fill="currentColor" strokeWidth="1" />
  </svg>
);

/** The projects, folded by client the way her session list groups them. */
function ProjectsGrid({ rows, store, empty, onStage, error, sync }: {
  rows: CodeProject[];
  store: string;
  empty: string;
  onStage: (p: CodeProject, v: ProjectStage) => void;
  error: string | null;
  sync: ProjectsSync | null;
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
    <>
      <ProjectsBar error={error} sync={sync} />
      <Grid
        columns={columns}
        {...(rows.length > 0 ? { groups } : {})}
        rowKey={(p) => p.sessionId}
        store={store}
        empty={empty}
      />
    </>
  );
}

/**
 * Vibe Coding › Building (Giulia, 13 Oct 2026): the projects per group, the
 * way her session list groups them, each group in its own order of priority,
 * 1 first. A tick for what she is working on now, and a switch between all
 * of them and only those.
 */
type Focus = { onFocus: (p: CodeProject, on: boolean) => void; onNumbers: (numbers: { p: CodeProject; n: number | null }[]) => void };
const ONLY = 'lifework.apps.building.only';

function BuildingList({ rows, store, empty, onStage, onFocus, onNumbers, error, sync }: Focus & {
  rows: CodeProject[]; store: string; empty: string; error: string | null; sync: ProjectsSync | null;
  onStage: (p: CodeProject, v: ProjectStage) => void;
}) {
  const [only, setOnly] = useState(false);
  const [closed, setClosed] = useState<Record<string, boolean>>({});
  // Which of the two she looked at last, kept in this browser.
  useEffect(() => { try { setOnly(localStorage.getItem(ONLY) === '1'); } catch { /* private mode */ } }, []);
  const pick = (v: boolean) => { setOnly(v); try { localStorage.setItem(ONLY, v ? '1' : '0'); } catch { /* private mode */ } };

  // Each group in its own order: numbered first (1, 2, 3 …), then the rest by name.
  const byGroup = byClient(rows).map(([group, list]) => {
    const all = [...list].sort(byPriority);
    return { group, all, shown: only ? all.filter((p) => p.workingOn) : all };
  });
  const groupOf = new Map(byGroup.flatMap((g) => g.all.map((p) => [p.sessionId, g] as const)));
  const now = rows.filter((p) => p.workingOn).length;

  // A group numbered 1, 2, 3 … as it reads; only the numbers that change are written.
  const renumber = (order: CodeProject[]) => onNumbers(order.flatMap((x, i) => (x.priority === i + 1 ? [] : [{ p: x, n: i + 1 }])));
  // Move one place among what is shown of its group.
  function move(p: CodeProject, dir: -1 | 1) {
    const g = groupOf.get(p.sessionId);
    if (!g) return;
    const other = g.shown[g.shown.indexOf(p) + dir];
    if (!other) return;
    const rest = g.all.filter((x) => x !== p);
    const at = rest.indexOf(other) + (dir === 1 ? 1 : 0);
    renumber([...rest.slice(0, at), p, ...rest.slice(at)]);
  }
  // A typed number puts the project in that place in its group. An emptied
  // one drops it to the group's projects without a number, and the numbered
  // ones close up.
  function place(p: CodeProject, n: number | null) {
    const g = groupOf.get(p.sessionId);
    if (!g) return;
    const rest = g.all.filter((x) => x !== p);
    if (n === null) {
      const numbered = rest.filter((x) => x.priority != null);
      onNumbers([...numbered.flatMap((x, i) => (x.priority === i + 1 ? [] : [{ p: x, n: i + 1 }])), ...(p.priority == null ? [] : [{ p, n: null }])]);
      return;
    }
    const at = Math.min(n, rest.length + 1) - 1;
    renumber([...rest.slice(0, at), p, ...rest.slice(at)]);
  }

  const columns: Column<CodeProject>[] = [
    { key: 'now', label: 'Working on', type: 'check', width: 84, glyph: HAMMER, render: (p) => (
      <span className="flagcell">
        <input type="checkbox" className="flagcell__box" checked={!!p.workingOn} aria-label={`Working on ${p.name}`}
          onChange={(e) => onFocus(p, e.target.checked)} />
      </span>
    ) },
    { key: 'priority', label: 'Priority', type: 'number', width: 140, render: (p) => {
      const shown = groupOf.get(p.sessionId)?.shown ?? [];
      const i = shown.indexOf(p);
      return <PriorityCell p={p} canUp={i > 0} canDown={i < shown.length - 1} onMove={(d) => move(p, d)} onSet={(n) => place(p, n)} />;
    } },
    PROJECT_COLS[0],
    GROUP_COL,
    stageColumn(onStage),
    ...PROJECT_COLS.slice(1),
  ];
  // A group with nothing to show (none ticked, under Working on) is left out.
  const groups: Group<CodeProject>[] = byGroup.filter((g) => g.shown.length > 0).map((g) => ({
    key: g.group,
    head: <span className="grid2__foldname">{g.group}</span>,
    tone: 'grey',
    rows: g.shown,
    open: !closed[g.group],
    onToggle: () => setClosed((c) => ({ ...c, [g.group]: !c[g.group] })),
  }));
  return (
    <div className="mailstack buildlist">
      <ProjectsBar error={error} sync={sync}>
        <span className="buildbar__chips" role="group" aria-label="Show">
          <button type="button" className={`chip${!only ? ' chip--active' : ''}`} aria-pressed={!only} onClick={() => pick(false)}>All · {rows.length}</button>
          <button type="button" className={`chip${only ? ' chip--active' : ''}`} aria-pressed={only} onClick={() => pick(true)}>Working on · {now}</button>
        </span>
      </ProjectsBar>
      <Grid columns={columns} {...(groups.length > 0 ? { groups } : {})} rowKey={(p) => p.sessionId} store={store}
        empty={only ? 'Nothing ticked as Working on. Tick a project in All.' : empty} />
    </div>
  );
}

/** Projects on the board and in the table: by group, then in her order. */
const byGroupThenPriority = (a: CodeProject, b: CodeProject) =>
  (a.client ?? 'Other').localeCompare(b.client ?? 'Other') || byPriority(a, b);

/**
 * Vibe Coding › Stages (Giulia, 13 Oct 2026): every project by stage, a
 * Kanban list per stage from Idea phase to Paused, or the table folded the
 * same way. A list and its fold share the colour she gives them.
 */
function Stages({ rows, mode, colors, grid, store, onStage, error, sync }: {
  rows: CodeProject[]; mode: ViewMode; colors: Record<string, PaletteKey>; grid: string; store: string;
  onStage: (p: CodeProject, v: ProjectStage) => void; error: string | null; sync: ProjectsSync | null;
}) {
  const [closed, setClosed] = useState<Record<string, boolean>>({});
  const inStage = (s: ProjectStage) => rows.filter((p) => p.status === s).sort(byGroupThenPriority);
  if (mode === 'kanban') {
    const lists: KanbanList<CodeProject>[] = BOARD_STAGES.map((s) => ({ key: s, title: STAGE_LABEL[s], items: inStage(s) }));
    return (
      <>
        <ProjectsBar error={error} sync={sync} />
        <Kanban grid={grid} lists={lists} colors={colors} label="Projects by stage" itemKey={(p) => p.sessionId}
          card={(p) => <ProjectCard p={p} onStage={onStage} />} />
      </>
    );
  }
  const groups: Group<CodeProject>[] = BOARD_STAGES.map((s) => ({
    key: s,
    head: <span className="grid2__foldname">{STAGE_LABEL[s]}</span>,
    tone: 'grey',
    tint: colors[s] ?? null,
    tools: <ColorPicker value={colors[s] ?? null} label={`Colour of ${STAGE_LABEL[s]}`} onPick={(v) => saveGroupColor(grid, s, v)} />,
    rows: inStage(s),
    open: !closed[s],
    onToggle: () => setClosed((c) => ({ ...c, [s]: !c[s] })),
    empty: 'Nothing in this stage.',
  }));
  return (
    <>
      <ProjectsBar error={error} sync={sync} />
      <Grid columns={[PROJECT_COLS[0], GROUP_COL, stageColumn(onStage), ...PROJECT_COLS.slice(1)]}
        groups={groups} rowKey={(p) => p.sessionId} store={store} />
    </>
  );
}

/** A project on the board: its group, its name, the stage to change it to, and its links. */
function ProjectCard({ p, onStage }: { p: CodeProject; onStage: (p: CodeProject, v: ProjectStage) => void }) {
  return (
    <>
      <span className="gcard__labels">
        {p.client ? <span className="gcard__chip gcard__chip--plain">{p.client}</span> : null}
        {p.workingOn ? <span className="gcard__badge gcard__now" title="Working on">{HAMMER}<span className="sr-only">Working on</span></span> : null}
      </span>
      <span className="gcard__title">{p.name}</span>
      <span className="gcard__foot">
        <select className="stagesel gcard__stage" value={p.status} aria-label={`Stage of ${p.name}`} data-stage-for={p.sessionId}
          onChange={(e) => { onStage(p, e.target.value as ProjectStage); keepStageFocus(p.sessionId); }}>
          {STAGES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <a className="gcard__badge grid2__link" href={p.sessionUrl} target="_blank" rel="noreferrer" aria-label={`Session of ${p.name}`}>Session ↗</a>
        {p.repoUrl ? <a className="gcard__badge grid2__link" href={p.repoUrl} target="_blank" rel="noreferrer" aria-label={`GitHub of ${p.name}`}>GitHub ↗</a> : null}
        {p.liveUrl ? <a className="gcard__badge grid2__link" href={p.liveUrl} target="_blank" rel="noreferrer" aria-label={`${p.name} live`}>Live ↗</a> : null}
      </span>
    </>
  );
}

/** The priority number, typed in place, with arrows to move a place up or down. */
function PriorityCell({ p, canUp, canDown, onMove, onSet }: {
  p: CodeProject; canUp: boolean; canDown: boolean; onMove: (dir: -1 | 1) => void; onSet: (n: number | null) => void;
}) {
  // What she is typing; null when she is not, and the box shows the saved number.
  const [draft, setDraft] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  // A row that changes place is lifted out of the page and put back, which
  // drops the keyboard focus. Give it back, to the other arrow if this one is
  // now at the end.
  const keep = (el: HTMLElement | null) => requestAnimationFrame(() => {
    if (!el?.isConnected || document.activeElement === el) return;
    if (el instanceof HTMLButtonElement && el.disabled) (el.parentElement?.querySelector<HTMLElement>('button:not(:disabled)') ?? input.current)?.focus();
    else el.focus();
  });
  // Clicking away saves only what she typed. Enter always counts, even on the
  // number already there: it puts the project ahead of one that shares it.
  const commit = (enter = false) => {
    if (draft === null && !enter) return;
    const v = (draft ?? (p.priority == null ? '' : String(p.priority))).trim();
    setDraft(null);
    const n = v === '' ? null : Number(v);
    if (n !== null && (!Number.isInteger(n) || n < 1 || n > 9999)) return;
    onSet(n);
  };
  return (
    <span className="prio">
      <input ref={input} className="prio__num" inputMode="numeric" value={draft ?? (p.priority == null ? '' : String(p.priority))} placeholder="—"
        aria-label={`Priority of ${p.name}`}
        onChange={(e) => setDraft(e.target.value.replace(/[^0-9]/g, ''))} onBlur={() => commit()}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); commit(true); keep(input.current); }
          if (e.key === 'Escape') { e.preventDefault(); setDraft(null); }
        }} />
      <button type="button" className="prio__arrow" disabled={!canUp} aria-label={`Move ${p.name} up`} title="Move up"
        onClick={(e) => { const el = e.currentTarget; onMove(-1); keep(el); }}>
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m4 10 4-4 4 4" /></svg>
      </button>
      <button type="button" className="prio__arrow" disabled={!canDown} aria-label={`Move ${p.name} down`} title="Move down"
        onClick={(e) => { const el = e.currentTarget; onMove(1); keep(el); }}>
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
export function ZoneGrid({ domain, tab, blurb, b, view = {} }: {
  domain: string;
  tab: string;
  blurb: string;
  b: Bundle;
  /** For a tab with a Kanban: which view, the colours she gave its lists, and where they are saved. */
  view?: { mode?: ViewMode; colors?: Record<string, PaletteKey>; grid?: string };
}): ReactNode {
  const store = `lifework.${domain}.${tab}.cols`;
  // Her changes land here first, so a row changes the moment she picks —
  // and snaps back if the database refuses the write.
  type Staged = Partial<Pick<CodeProject, 'status' | 'workingOn' | 'priority'>>;
  const [staged, setStaged] = useState<Record<string, Staged>>({});
  const [writeError, setWriteError] = useState<string | null>(null);
  const projects = b.codeProjects.map(
    (p) => (staged[p.sessionId] ? { ...p, ...staged[p.sessionId] } : p));
  // Writes go one after the other, so a quick second change never lands
  // before the first and leaves the older value in the database.
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  // What the database has taken since the page loaded: a refused write goes
  // back to this, or to the loaded value, never to another unsaved change.
  const saved = useRef<Record<string, Staged>>({});
  /** One or more rows at once: shown first, written, put back if the database says no. */
  async function write(changes: { p: CodeProject; local: Staged; column: Record<string, unknown> }[]) {
    if (!changes.length) return;
    setWriteError(null);
    setStaged((m) => {
      const next = { ...m };
      for (const c of changes) next[c.p.sessionId] = { ...next[c.p.sessionId], ...c.local };
      return next;
    });
    // Put back only the fields this write set, and only where nothing newer has replaced them.
    const undo = (list: typeof changes) => setStaged((m) => {
      const next = { ...m };
      for (const c of list) {
        const id = c.p.sessionId;
        const row: Record<string, unknown> = { ...next[id] };
        const was = (saved.current[id] ?? {}) as Record<string, unknown>;
        for (const [k, v] of Object.entries(c.local)) {
          if (row[k] !== v) continue;
          if (k in was) row[k] = was[k]; else delete row[k];
        }
        next[id] = row as Staged;
      }
      return next;
    });
    const db = getSupabase();
    if (!db) { undo(changes); setWriteError('Supabase is not configured, so this is not saved.'); return; }
    const run = queue.current.then(() => Promise.all(changes.map((c) =>
      db.from('code_projects').update(c.column).eq('session_id', c.p.sessionId).then((r) => r.error?.message ?? null))));
    queue.current = run.catch(() => null);
    const errors = await run.catch((e: unknown) => changes.map(() => (e instanceof Error ? e.message : 'The database could not be reached.')));
    changes.forEach((c, i) => { if (!errors[i]) saved.current[c.p.sessionId] = { ...saved.current[c.p.sessionId], ...c.local }; });
    // Only what the database refused goes back; what it took stays.
    const failed = changes.filter((_, i) => errors[i]);
    if (failed.length) {
      undo(failed);
      setWriteError(errors.find(Boolean)!);
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
        store={store} onStage={moveStage} {...focus} error={writeError} sync={b.projectsSync}
        empty="No projects loaded. They come from the code_projects table." />;
    case 'apps/stages':
      return <Stages rows={projects} mode={view.mode ?? 'kanban'} colors={view.colors ?? {}} grid={view.grid ?? `${domain}/${tab}`}
        store={store} onStage={moveStage} error={writeError} sync={b.projectsSync} />;
    case 'apps/live':
      return <ProjectsGrid rows={projects.filter((p) => p.status === 'running')}
        store={store} onStage={moveStage} error={writeError} sync={b.projectsSync}
        empty="Nothing Running yet. Set a project's Status to Running and it moves here." />;
    case 'apps/archived':
      return <ProjectsGrid rows={projects.filter((p) => PUT_AWAY.includes(p.status))}
        store={store} onStage={moveStage} error={writeError} sync={b.projectsSync}
        empty="Nothing closed or archived. Set a project's Status to Closed or Archived to put it away here." />;
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
