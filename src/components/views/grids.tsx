'use client';

import { useState, type ReactNode } from 'react';
import type { Bundle } from '@/lib/data/bundle';
import { byClient, WORK_LABEL, STAGES, type CodeProject, type ProjectStage } from '@/lib/projects';
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
  // Status changes land here first, so a row changes tab the moment she
  // picks — and snaps back if the database refuses the write.
  const [staged, setStaged] = useState<Record<string, ProjectStage>>({});
  const projects = b.codeProjects.map(
    (p) => (staged[p.sessionId] ? { ...p, status: staged[p.sessionId] } : p));
  async function moveStage(p: CodeProject, v: ProjectStage) {
    const prev = p.status;
    setStaged((m) => ({ ...m, [p.sessionId]: v }));
    const db = getSupabase();
    if (!db) return;
    const { error } = await db.from('code_projects')
      .update({ status: v }).eq('session_id', p.sessionId);
    if (error) setStaged((m) => ({ ...m, [p.sessionId]: prev }));
  }
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
      return <ProjectsGrid rows={projects.filter((p) => p.status === 'building')}
        store={store} onStage={moveStage}
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
