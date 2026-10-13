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

/** Her session list's group (Giulia, 13 Oct 2026: "Group / Client"). */
const GROUP_COL: Column<CodeProject> = { key: 'client', label: 'Group / Client', type: 'select', width: 170, render: (p) => text(p.client) };

/** "Working on": a hammer, drawn in the header and on a card. */
const HAMMER = (
  <svg className="hammer" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M2.2 13.8 8.6 7.4" strokeWidth="2" />
    <path d="M8 2 14 8 11.6 10.4 5.6 4.4Z" fill="currentColor" strokeWidth="1" />
  </svg>
);

/** The projects, folded by client the way her session list groups them. */
function ProjectsGrid({ rows, store, empty, onStage, error, sync, colors, grid }: {
  rows: CodeProject[];
  store: string;
  empty: string;
  onStage: (p: CodeProject, v: ProjectStage) => void;
  error: string | null;
  sync: ProjectsSync | null;
  colors: Record<string, PaletteKey>;
  grid: string;
}) {
  const [closed, setClosed] = useState<Record<string, boolean>>({});
  const columns = [PROJECT_COLS[0], stageColumn(onStage), ...PROJECT_COLS.slice(1)];
  const groups: Group<CodeProject>[] = byClient(rows).map(([client, list]) => ({
    key: client,
    head: <span className="grid2__foldname">{client}</span>,
    tone: 'grey',
    ...groupFold(client, colors, grid),
    rows: list,
    open: !closed[client],
    onToggle: () => setClosed((c) => ({ ...c, [client]: !c[client] })),
  }));
  return (
    <div className="mailstack">
      <ProjectsBar error={error} sync={sync} />
      <Grid
        columns={columns}
        {...(rows.length > 0 ? { groups } : {})}
        rowKey={(p) => p.sessionId}
        store={store}
        empty={empty}
      />
    </div>
  );
}

/**
 * Vibe Coding › Active projects (Giulia, 13 Oct 2026; was Building): every
 * project with the status Building, per group the way her session list
 * groups them, with the hammer to tick what she is working on now. A ticked
 * project goes to Focus, at the bottom of her order there.
 */
type Focus = { onFocus: (p: CodeProject, on: boolean) => void; onNumbers: (numbers: { p: CodeProject; n: number | null }[]) => void };
const ONLY = 'lifework.apps.building.only';

function ActiveList({ rows, store, empty, onStage, onFocus, error, sync, colors, grid }: {
  rows: CodeProject[]; store: string; empty: string; error: string | null; sync: ProjectsSync | null;
  colors: Record<string, PaletteKey>; grid: string;
  onStage: (p: CodeProject, v: ProjectStage) => void; onFocus: Focus['onFocus'];
}) {
  const [only, setOnly] = useState(false);
  const [closed, setClosed] = useState<Record<string, boolean>>({});
  // Which of the two she looked at last, kept in this browser.
  useEffect(() => { try { setOnly(localStorage.getItem(ONLY) === '1'); } catch { /* private mode */ } }, []);
  const pick = (v: boolean) => { setOnly(v); try { localStorage.setItem(ONLY, v ? '1' : '0'); } catch { /* private mode */ } };

  const byGroup = byClient(rows).map(([group, list]) => ({ group, shown: only ? list.filter((p) => p.workingOn) : list }));
  const now = rows.filter((p) => p.workingOn).length;

  const columns: Column<CodeProject>[] = [
    // Square: 32 for the row number, 32 for the tick, as tall as a row (Giulia, 13 Oct 2026).
    { key: 'now', label: 'Working on', type: 'check', width: 64, fixed: true, glyph: HAMMER, render: (p) => (
      <span className="flagcell">
        <input type="checkbox" className="flagcell__box" checked={!!p.workingOn} aria-label={`Working on ${p.name}`}
          onChange={(e) => onFocus(p, e.target.checked)} />
      </span>
    ) },
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
    ...groupFold(g.group, colors, grid),
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

/**
 * Vibe Coding › Focus (Giulia, 13 Oct 2026): what she is working on now,
 * the projects with the hammer ticked, in her order, 1 first. A line moves
 * by its handle (≡): drag it to its place, or, on the handle, press arrow
 * up or down. The list is then numbered 1, 2, 3 … as it reads.
 */
function FocusList({ rows, store, onNumbers, onFocus, error, sync }: {
  rows: CodeProject[]; store: string; error: string | null; sync: ProjectsSync | null;
  onNumbers: Focus['onNumbers']; onFocus: Focus['onFocus'];
}) {
  const list = [...rows].sort(byPriority);
  // The line being dragged, and where it would land: before or after another line.
  const [drag, setDrag] = useState<{ id: string; over: string | null; after: boolean } | null>(null);

  const renumber = (order: CodeProject[]) => onNumbers(order.flatMap((x, i) => (x.priority === i + 1 ? [] : [{ p: x, n: i + 1 }])));
  function place(p: CodeProject, target: CodeProject, after: boolean) {
    const rest = list.filter((x) => x !== p);
    const at = rest.indexOf(target) + (after ? 1 : 0);
    if (at < 0) return;
    renumber([...rest.slice(0, at), p, ...rest.slice(at)]);
  }
  function step(p: CodeProject, dir: -1 | 1) {
    const other = list[list.indexOf(p) + dir];
    if (other) place(p, other, dir === 1);
  }

  const columns: Column<CodeProject>[] = [
    { key: 'order', label: 'Order', type: 'number', width: 76, fixed: true, render: (p) => (
      <span className="focusorder">
        <button type="button" className="focusorder__handle" data-handle-for={p.sessionId}
          aria-label={`Move ${p.name}: drag, or press arrow up or down`} title="Drag to move"
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            // Safari and Firefox on a Mac do not focus a clicked button; the arrows need it.
            e.currentTarget.focus();
            e.currentTarget.setPointerCapture(e.pointerId);
            setDrag({ id: p.sessionId, over: null, after: false });
          }}
          onPointerMove={(e) => {
            if (drag?.id !== p.sessionId) return;
            const row = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('tr[data-key]');
            const key = row?.dataset.key ?? null;
            if (!row || !key || key === p.sessionId) { setDrag({ id: p.sessionId, over: null, after: false }); return; }
            const r = row.getBoundingClientRect();
            setDrag({ id: p.sessionId, over: key, after: e.clientY > r.top + r.height / 2 });
          }}
          onPointerUp={() => {
            const target = drag?.over ? list.find((x) => x.sessionId === drag.over) : undefined;
            if (target) place(p, target, drag!.after);
            setDrag(null);
          }}
          onPointerCancel={() => setDrag(null)}
          onKeyDown={(e) => {
            if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
            e.preventDefault();
            step(p, e.key === 'ArrowUp' ? -1 : 1);
            keepHandleFocus(p.sessionId);
          }}>
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true"><path d="M3 5h10M3 8h10M3 11h10" /></svg>
        </button>
        {/* Its place in the list, always 1, 2, 3 …, whatever is stored. */}
        <span className="focusorder__num">{list.indexOf(p) + 1}</span>
      </span>
    ) },
    // Whatever its stage, a project stays here until she unticks it (Giulia, 13 Oct 2026).
    { key: 'now', label: 'Working on', type: 'check', width: 48, fixed: true, glyph: HAMMER, render: (p) => (
      <span className="flagcell">
        <input type="checkbox" className="flagcell__box" checked={!!p.workingOn} aria-label={`Working on ${p.name}`}
          onChange={(e) => onFocus(p, e.target.checked)} />
      </span>
    ) },
    PROJECT_COLS[0],
    GROUP_COL,
    PROJECT_COLS.find((c) => c.key === 'live')!,
  ];
  const lineClass = (p: CodeProject) =>
    drag?.id === p.sessionId ? 'focusrow--lifted'
    : drag?.over === p.sessionId ? (drag.after ? 'focusrow--after' : 'focusrow--before')
    : undefined;
  return (
    <div className={`mailstack focuslist${drag ? ' focuslist--dragging' : ''}`}>
      <ProjectsBar error={error} sync={sync} />
      <Grid columns={columns} rows={list} rowKey={(p) => p.sessionId} store={store} numbered={false} rowClass={lineClass}
        empty="Nothing in Focus yet. Tick the hammer of a project in Active projects and it arrives here." />
    </div>
  );
}

/** A line that moved is drawn again in its new place; its handle keeps the keyboard focus. */
const keepHandleFocus = (id: string) => requestAnimationFrame(() => {
  const at = document.activeElement;
  if (at && at !== document.body && at.getAttribute('data-handle-for') === id) return;
  document.querySelector<HTMLElement>(`[data-handle-for="${CSS.escape(id)}"]`)?.focus();
});

/**
 * A group's fold (a client block) in its colour, with the dot to pick it
 * (Giulia, 13 Oct 2026). Saved once for the space, so a group has the same
 * colour on Building, Live and Archived.
 */
function groupFold(group: string, colors: Record<string, PaletteKey>, grid: string) {
  return {
    tint: colors[group] ?? null,
    tools: <ColorPicker value={colors[group] ?? null} label={`Colour of ${group}`} onPick={(v) => saveGroupColor(grid, group, v)} />,
  };
}

/** Projects on the board and in the table: by group, then by name. */
const byGroupThenName = (a: CodeProject, b: CodeProject) =>
  (a.client ?? 'Other').localeCompare(b.client ?? 'Other') || a.name.localeCompare(b.name);

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
  const inStage = (s: ProjectStage) => rows.filter((p) => p.status === s).sort(byGroupThenName);
  if (mode === 'kanban') {
    const lists: KanbanList<CodeProject>[] = BOARD_STAGES.map((s) => ({ key: s, title: STAGE_LABEL[s], items: inStage(s) }));
    return (
      <div className="mailstack">
        <ProjectsBar error={error} sync={sync} />
        <Kanban grid={grid} lists={lists} colors={colors} label="Projects by stage" itemKey={(p) => p.sessionId}
          card={(p) => <ProjectCard p={p} onStage={onStage} />} />
      </div>
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
    <div className="mailstack">
      <ProjectsBar error={error} sync={sync} />
      <Grid columns={[PROJECT_COLS[0], GROUP_COL, stageColumn(onStage), ...PROJECT_COLS.slice(1)]}
        groups={groups} rowKey={(p) => p.sessionId} store={store} />
    </div>
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
  /** For a tab with a Kanban: which view, the colours she gave its lists, and where they are saved;
      and the colours she gave the groups (clients), shared by every project tab. */
  view?: { mode?: ViewMode; colors?: Record<string, PaletteKey>; grid?: string; groupColors?: Record<string, PaletteKey> };
}): ReactNode {
  const store = `lifework.${domain}.${tab}.cols`;
  // Her changes land here first, so a row changes the moment she picks —
  // and snaps back if the database refuses the write.
  type Staged = Partial<Pick<CodeProject, 'status' | 'workingOn' | 'priority'>>;
  const [staged, setStaged] = useState<Record<string, Staged>>({});
  const [writeError, setWriteError] = useState<string | null>(null);
  const projects = b.codeProjects.map(
    (p) => (staged[p.sessionId] ? { ...p, ...staged[p.sessionId] } : p));
  // Focus: the projects she is working on now, unless put away.
  const inFocus = projects.filter((p) => p.workingOn && !PUT_AWAY.includes(p.status));
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
      // A stage that went back moves its project back: its dropdown keeps the focus there too.
      for (const c of failed) if ('status' in c.local) keepStageFocus(c.p.sessionId);
    }
  }
  const moveStage = (p: CodeProject, v: ProjectStage) => write([{ p, local: { status: v }, column: { status: v } }]);
  const focus: Focus = {
    // Ticked: it arrives in Focus at the bottom of her order. Unticked: it
    // leaves Focus and its place, and the others close up to 1, 2, 3 ….
    onFocus: (p, on) => {
      const others = inFocus.filter((x) => x.sessionId !== p.sessionId).sort(byPriority);
      if (on) {
        const n = Math.max(0, ...others.map((x) => x.priority ?? 0)) + 1;
        return write([{ p, local: { workingOn: true, priority: n }, column: { working_on: true, priority: n } }]);
      }
      return write([
        { p, local: { workingOn: false, priority: null }, column: { working_on: false, priority: null } },
        ...others.flatMap((x, i) => (x.priority === i + 1 ? [] : [{ p: x, local: { priority: i + 1 }, column: { priority: i + 1 } }])),
      ]);
    },
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
    case 'apps/focus':
      return <FocusList rows={inFocus} store={store} onNumbers={focus.onNumbers} onFocus={focus.onFocus} error={writeError} sync={b.projectsSync} />;
    case 'apps/building':
      return <ActiveList rows={projects.filter((p) => p.status === 'building')}
        store={store} onStage={moveStage} onFocus={focus.onFocus} error={writeError} sync={b.projectsSync}
        colors={view.groupColors ?? {}} grid={`${domain}/groups`}
        empty="No projects loaded. They come from the code_projects table." />;
    case 'apps/stages':
      return <Stages rows={projects} mode={view.mode ?? 'kanban'} colors={view.colors ?? {}} grid={view.grid ?? `${domain}/${tab}`}
        store={store} onStage={moveStage} error={writeError} sync={b.projectsSync} />;
    case 'apps/live':
      return <ProjectsGrid rows={projects.filter((p) => p.status === 'running')}
        store={store} onStage={moveStage} error={writeError} sync={b.projectsSync}
        colors={view.groupColors ?? {}} grid={`${domain}/groups`}
        empty="Nothing Running yet. Set a project's Status to Running and it moves here." />;
    case 'apps/archived':
      return <ProjectsGrid rows={projects.filter((p) => PUT_AWAY.includes(p.status))}
        store={store} onStage={moveStage} error={writeError} sync={b.projectsSync}
        colors={view.groupColors ?? {}} grid={`${domain}/groups`}
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
