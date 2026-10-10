'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import type { YearGoal, QuarterGoal, ActionPoint, GoalStatus } from '@/lib/goals';
import { VENTURES, GOAL_STATUS, GOAL_TONE, thisQuarter, progressOf, nextQuarter, quarterMonths, quarterLabel, ownersOf } from '@/lib/goals';
import type { ColumnSetting } from '@/lib/grid';
import { updateGoal, addGoal, removeGoal, type GoalTable } from '@/app/d/goals/actions';
import { saveGridColumn, saveGroupColor } from '@/app/d/actions';
import { Grid, type Column, type Group } from '@/components/Grid';
import { EditableCell } from '@/components/EditableCell';
import { ConfirmDialog } from '@/components/ClientTable';
import { shortDate } from '@/lib/upwork';
import type { PaletteKey } from '@/lib/palette';
import { Gallery, AddCard, Avatars, type GalleryList } from '@/components/Gallery';
import { ColorPicker } from '@/components/ColorPicker';
import { Field, CloseLink, usePanelKeys } from '@/components/panel';
import { Sel, Remove as RemoveButton } from '@/components/rowkit';

/**
 * The Goal Navigator, after her Notion page.
 *
 *   Dashboard       this quarter: goals with progress, action points this week
 *   Roadmap         the board — ventures down, quarters across, goals as cards
 *   Yearly goals    gallery (one list per year, after Trello) or grid folded by year
 *   Quarterly goals gallery (one list per quarter) or grid folded by quarter
 *   Action points   grid folded by quarter
 *
 * Every row has a venture, so one board holds all three businesses. Each
 * venture has a fixed colour across the whole space.
 */

const VENTURE_LANE: Record<string, number> = { 'Big Tribe Builders': 0, 'QuinB Academy': 1, 'Giulia May': 2 };
const lane = (v: string) => `lane--${VENTURE_LANE[v] ?? 9}`;

type Common = { settings?: Record<string, ColumnSetting>; accent?: string; store: string };
/** The colours she gave the groups, and the collection they are saved under. */
type Colors = { colors?: Record<string, PaletteKey>; grid?: string };

/** The tint and the colour dot of a fold, when the tab keeps colours. */
const foldColor = (c: Colors, key: string, title: string) => (c.grid ? {
  tint: c.colors?.[key] ?? null,
  tools: <ColorPicker value={c.colors?.[key] ?? null} label={`Colour of ${title}`} onPick={(v) => saveGroupColor(c.grid!, key, v)} />,
} : {});

// ------------------------------------------------------------------ cells

const text = (table: GoalTable) => (field: string, label: string) =>
  (r: { id: string } & Record<string, unknown>) => (
    <EditableCell kind="text" value={(r[field] as string | number | null) == null ? null : String(r[field])}
      label={label} onSave={(v) => updateGoal(table, r.id, field, v)} />
  );

function Select({ table, id, field, value, options, className }: {
  table: GoalTable; id: string; field: string; value: string | null;
  options: { value: string; label: string }[]; className?: string;
}) {
  const [pending, start] = useTransition();
  return (
    <select className={className ?? 'stagesel'} value={value ?? ''} disabled={pending}
      onChange={(e) => { const v = e.target.value; start(async () => { await updateGoal(table, id, field, v); }); }}>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

const statusOptions = (Object.keys(GOAL_STATUS) as GoalStatus[]).map((k) => ({ value: k, label: GOAL_STATUS[k] }));
const StatusSel = ({ table, id, value }: { table: GoalTable; id: string; value: GoalStatus }) => (
  <Select table={table} id={id} field="status" value={value} options={statusOptions} className={`status status--${GOAL_TONE[value]} status--select`} />
);
const VentureCell = ({ table, id, value }: { table: GoalTable; id: string; value: string }) => (
  <span className={`cell cell--lead ${lane(value)}`}>
    <span className="lane__dot" />
    <Select table={table} id={id} field="venture" value={value} options={VENTURES.map((v) => ({ value: v, label: v }))} />
  </span>
);

function Remove({ table, id, what }: { table: GoalTable; id: string; what: string }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();
  return (
    <>
      <button type="button" className="iconbtn iconbtn--delete" title="Delete" aria-label={`Delete ${what}`} disabled={pending} onClick={() => setConfirming(true)}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>
      </button>
      {confirming ? <ConfirmDialog title={`Delete "${what}"?`} body="It cannot be undone." confirmLabel="Delete"
        onCancel={() => setConfirming(false)} onConfirm={() => { setConfirming(false); start(async () => { await removeGoal(table, id); }); }} /> : null}
    </>
  );
}

function AddRow({ table, fields, defaults = {} }: {
  table: GoalTable;
  fields: { key: string; placeholder: string; wide?: boolean; options?: { value: string; label: string }[] }[];
  defaults?: Record<string, string>;
}) {
  const [form, setForm] = useState<Record<string, string>>(defaults);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form className="addrow" onSubmit={(e) => {
      e.preventDefault(); setError(null);
      start(async () => { const r = await addGoal(table, form); if (r.error) setError(r.error); else setForm(defaults); });
    }}>
      {fields.map((f) => f.options ? (
        <select key={f.key} value={form[f.key] ?? ''} aria-label={f.placeholder} onChange={(e) => setForm((x) => ({ ...x, [f.key]: e.target.value }))}>
          <option value="">{f.placeholder}</option>
          {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ) : (
        <input key={f.key} className={f.wide ? 'addrow__wide' : undefined} placeholder={f.placeholder} aria-label={f.placeholder}
          value={form[f.key] ?? ''} onChange={(e) => setForm((x) => ({ ...x, [f.key]: e.target.value }))} />
      ))}
      <button type="submit" className="btn btn--primary" disabled={pending}>{pending ? 'Adding…' : '+ Add'}</button>
      {error ? <span className="cell__error">{error}</span> : null}
    </form>
  );
}

const ventureOpts = VENTURES.map((v) => ({ value: v, label: v }));
const grid = <T,>(props: Common & { columns: Column<T>[]; rows?: T[]; groups?: Group<T>[]; rowKey: (r: T) => string; empty: string }) => (
  <Grid {...props} settings={props.settings} onColumnSettings={(k, i) => saveGridColumn(props.store, k, i)} />
);

// ----------------------------------------------------------------- years

export function Years({ rows, colors, grid: colorGrid, ...c }: Common & Colors & { rows: YearGoal[] }) {
  const [closed, setClosed] = useState<Record<string, boolean>>({});
  const t = text('goal_years');
  const columns: Column<YearGoal>[] = [
    { key: 'venture', label: 'Venture', type: 'select', width: 190, render: (r) => <VentureCell table="goal_years" id={r.id} value={r.venture} /> },
    { key: 'title', label: 'Goal', type: 'text', width: 420, render: t('title', 'Goal') as never },
    { key: 'status', label: 'Status', type: 'select', width: 120, render: (r) => <StatusSel table="goal_years" id={r.id} value={r.status} /> },
    { key: 'notes', label: 'Notes', type: 'text', width: 400, render: t('notes', 'Notes') as never },
    { key: 'del', label: 'Delete', type: 'text', width: 60, bare: true, render: (r) => <Remove table="goal_years" id={r.id} what={r.title} /> },
  ];
  const years = [...new Set(rows.map((r) => r.year))].sort();
  const groups: Group<YearGoal>[] = years.map((y) => ({
    key: String(y), tone: 'grey', head: <span className="grid2__foldname">{y}</span>, ...foldColor({ colors, grid: colorGrid }, String(y), String(y)),
    rows: rows.filter((r) => r.year === y).sort((a, b) => a.sortOrder - b.sortOrder || a.venture.localeCompare(b.venture)),
    open: !closed[y], onToggle: () => setClosed((x) => ({ ...x, [y]: !x[y] })),
  }));
  return (
    <>
      <AddRow table="goal_years" defaults={{ year: String(new Date().getUTCFullYear()) }} fields={[
        { key: 'year', placeholder: 'Year' }, { key: 'venture', placeholder: 'Venture', options: ventureOpts }, { key: 'title', placeholder: 'Goal', wide: true },
      ]} />
      {grid({ ...c, columns, ...(rows.length ? { groups } : {}), rowKey: (r: YearGoal) => r.id, empty: 'No yearly goals yet. Add the first one above.' })}
    </>
  );
}

// -------------------------------------------------------------- quarters

export function Quarters({ rows, years, actions, colors, grid: colorGrid, ...c }: Common & Colors & { rows: QuarterGoal[]; years: YearGoal[]; actions: ActionPoint[] }) {
  const [closed, setClosed] = useState<Record<string, boolean>>({});
  const t = text('goal_quarters');
  const yearOpts = (venture: string) => [{ value: '', label: '—' }, ...years.filter((y) => y.venture === venture).map((y) => ({ value: y.id, label: `${y.year} · ${y.title}` }))];
  const columns: Column<QuarterGoal>[] = [
    { key: 'venture', label: 'Venture', type: 'select', width: 190, render: (r) => <VentureCell table="goal_quarters" id={r.id} value={r.venture} /> },
    { key: 'title', label: 'Goal', type: 'text', width: 380, render: t('title', 'Goal') as never },
    { key: 'year', label: 'Yearly goal', type: 'select', width: 260, render: (r) => <Select table="goal_quarters" id={r.id} field="yearGoalId" value={r.yearGoalId} options={yearOpts(r.venture)} /> },
    { key: 'status', label: 'Status', type: 'select', width: 120, render: (r) => <StatusSel table="goal_quarters" id={r.id} value={r.status} /> },
    { key: 'progress', label: 'Done', type: 'number', width: 90, numeric: true, render: (r) => { const p = progressOf(r, actions); return p == null ? <span className="grid2__dash">—</span> : `${Math.round(p * 100)} %`; } },
    { key: 'notes', label: 'Notes', type: 'text', width: 360, render: t('notes', 'Notes') as never },
    { key: 'del', label: 'Delete', type: 'text', width: 60, bare: true, render: (r) => <Remove table="goal_quarters" id={r.id} what={r.title} /> },
  ];
  const quarters = [...new Set(rows.map((r) => r.quarter))].sort();
  const groups: Group<QuarterGoal>[] = quarters.map((q) => ({
    key: q, tone: 'grey', head: <span className="grid2__foldname">{q}</span>, ...foldColor({ colors, grid: colorGrid }, q, quarterLabel(q)),
    rows: rows.filter((r) => r.quarter === q).sort((a, b) => a.venture.localeCompare(b.venture) || a.sortOrder - b.sortOrder),
    open: !closed[q], onToggle: () => setClosed((x) => ({ ...x, [q]: !x[q] })),
  }));
  return (
    <>
      <AddRow table="goal_quarters" defaults={{ quarter: thisQuarter() }} fields={[
        { key: 'quarter', placeholder: 'Quarter' }, { key: 'venture', placeholder: 'Venture', options: ventureOpts }, { key: 'title', placeholder: 'Goal', wide: true },
      ]} />
      {grid({ ...c, columns, ...(rows.length ? { groups } : {}), rowKey: (r: QuarterGoal) => r.id, empty: 'No quarterly goals yet. Add the first one above.' })}
    </>
  );
}

// --------------------------------------------------------------- gallery

/** Where a card's panel opens: the same place, with ?peek=. */
const peekHref = (here: string, id: string) => `${here}${here.includes('?') ? '&' : '?'}peek=${id}`;
const todayUtc = () => new Date().toISOString().slice(0, 10);
const isOpen = (a: ActionPoint) => a.status !== 'done' && a.status !== 'parked';

/** The two labels on top of every goal card, after Trello: the venture and the status. */
function Labels({ venture, status }: { venture: string; status: GoalStatus }) {
  return (
    <span className="gcard__labels">
      <span className={`gcard__venture ${lane(venture)}`}>{venture}</span>
      <span className={`status status--${GOAL_TONE[status]}`}>{GOAL_STATUS[status]}</span>
    </span>
  );
}

const Icon = {
  goals: <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><circle cx="8" cy="8" r="6" /><circle cx="8" cy="8" r="2.5" /></svg>,
  done: <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="2.5" y="2.5" width="11" height="11" rx="2" /><path d="m5.5 8 2 2 3-4" /></svg>,
  clock: <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true"><circle cx="8" cy="8" r="6" /><path d="M8 5v3l2 1.5" /></svg>,
  notes: <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true"><path d="M3 4h10M3 8h10M3 12h6" /></svg>,
};

/** Yearly goals as Trello lists: one per year, this year and next always there. */
export function YearsGallery({ rows, quarters, actions, colors, grid, here, peek }: {
  rows: YearGoal[]; quarters: QuarterGoal[]; actions: ActionPoint[];
  colors: Record<string, PaletteKey>; grid: string; here: string; peek?: string;
}) {
  const now = new Date().getUTCFullYear();
  const years = [...new Set([...rows.map((r) => r.year), now, now + 1])].sort((a, b) => a - b);
  const lists: GalleryList<YearGoal>[] = years.map((y) => ({
    key: String(y), title: String(y), now: y === now,
    items: rows.filter((r) => r.year === y).sort((a, b) => a.sortOrder - b.sortOrder || a.venture.localeCompare(b.venture)),
    add: <AddCard label="+ Add a goal" placeholder={`A goal for ${y}`} choice={{ label: 'Venture', options: ventureOpts }}
      onAdd={(title, venture) => addGoal('goal_years', { year: String(y), venture, title })} />,
  }));
  const open = peek ? rows.find((r) => r.id === peek) ?? null : null;
  return (
    <>
      <Gallery grid={grid} lists={lists} colors={colors} label="Yearly goals" itemKey={(r) => r.id}
        href={(r) => peekHref(here, r.id)} card={(r) => {
          const qs = quarters.filter((q) => q.yearGoalId === r.id);
          const ids = new Set(qs.map((q) => q.id));
          const acts = actions.filter((a) => a.quarterGoalId && ids.has(a.quarterGoalId));
          const done = acts.filter((a) => a.status === 'done').length;
          return (
            <>
              <Labels venture={r.venture} status={r.status} />
              <span className="gcard__title">{r.title}</span>
              {qs.length ? (
                <span className="gcard__foot">
                  <span className="gcard__badge" title="Quarterly goals">{Icon.goals}<span aria-hidden="true">{qs.length}</span><span className="sr-only">{qs.length} quarterly goal{qs.length === 1 ? '' : 's'}</span></span>
                  {acts.length ? <span className="gcard__badge" title="Action points done">{Icon.done}<span aria-hidden="true">{done}/{acts.length}</span><span className="sr-only">{done} of {acts.length} action points done</span></span> : null}
                  {r.notes?.trim() ? <span className="gcard__badge" title="Has notes">{Icon.notes}<span className="sr-only">has notes</span></span> : null}
                  <span className="gcard__spacer" />
                  <Avatars names={ownersOf(acts)} />
                </span>
              ) : <span className="gcard__none">No quarterly goals yet</span>}
            </>
          );
        }} />
      {open ? <GoalPanel key={open.id} kind="year" goal={open} quarters={quarters} actions={actions} years={[]} closeHref={here} /> : null}
    </>
  );
}

/** Quarterly goals as Trello lists: one per quarter, this quarter and the next always there. */
export function QuartersGallery({ rows, years, actions, colors, grid, here, peek }: {
  rows: QuarterGoal[]; years: YearGoal[]; actions: ActionPoint[];
  colors: Record<string, PaletteKey>; grid: string; here: string; peek?: string;
}) {
  const now = thisQuarter();
  const today = todayUtc();
  const qs = [...new Set([...rows.map((r) => r.quarter), now, nextQuarter(now)])].sort();
  const lists: GalleryList<QuarterGoal>[] = qs.map((q) => ({
    key: q, title: quarterLabel(q), sub: quarterMonths(q), now: q === now,
    items: rows.filter((r) => r.quarter === q).sort((a, b) => a.venture.localeCompare(b.venture) || a.sortOrder - b.sortOrder),
    add: /^\d{4}-Q[1-4]$/.test(q) ? (
      <AddCard label="+ Add a goal" placeholder={`A goal for ${quarterLabel(q)}`} choice={{ label: 'Venture', options: ventureOpts }}
        onAdd={(title, venture) => addGoal('goal_quarters', { quarter: q, venture, title })} />
    ) : undefined,
  }));
  const open = peek ? rows.find((r) => r.id === peek) ?? null : null;
  return (
    <>
      <Gallery grid={grid} lists={lists} colors={colors} label="Quarterly goals" itemKey={(r) => r.id}
        href={(r) => peekHref(here, r.id)} card={(r) => {
          const acts = actions.filter((a) => a.quarterGoalId === r.id);
          const done = acts.filter((a) => a.status === 'done').length;
          const next = acts.filter(isOpen).map((a) => a.dueDate ?? a.doDate).filter((d): d is string => !!d).sort()[0];
          const late = !!next && next < today;
          return (
            <>
              <Labels venture={r.venture} status={r.status} />
              <span className="gcard__title">{r.title}</span>
              {acts.length ? <span className="gcard__bar" aria-hidden="true"><span style={{ width: `${(done / acts.length) * 100}%` }} /></span> : null}
              <span className="gcard__foot">
                {acts.length ? <span className="gcard__badge" title="Action points done">{Icon.done}<span aria-hidden="true">{done}/{acts.length}</span><span className="sr-only">{done} of {acts.length} action points done</span></span> : <span className="gcard__none">No action points yet</span>}
                {next ? <span className={`gcard__badge${late ? ' gcard__badge--late' : ''}`} title={late ? 'Overdue: the first open date' : 'The first open date'}>{Icon.clock}<span className="sr-only">{late ? 'overdue since' : 'next date'}</span>{shortDate(next)}</span> : null}
                {r.notes?.trim() ? <span className="gcard__badge" title="Has notes">{Icon.notes}<span className="sr-only">has notes</span></span> : null}
                <span className="gcard__spacer" />
                <Avatars names={ownersOf(acts)} />
              </span>
            </>
          );
        }} />
      {open ? <GoalPanel key={open.id} kind="quarter" goal={open} years={years} quarters={[]} actions={actions} closeHref={here} /> : null}
    </>
  );
}

/**
 * One goal, opened from its card: the same fields as the table, and what
 * hangs under it — the quarterly goals of a year, the action points of a
 * quarter. Fields save when she clicks away.
 */
function GoalPanel({ kind, goal, years, quarters, actions, closeHref }: {
  kind: 'year' | 'quarter'; goal: YearGoal | QuarterGoal; years: YearGoal[]; quarters: QuarterGoal[]; actions: ActionPoint[]; closeHref: string;
}) {
  usePanelKeys(closeHref);
  const table: GoalTable = kind === 'year' ? 'goal_years' : 'goal_quarters';
  const save = (field: string) => (v: string) => updateGoal(table, goal.id, field, v);
  const y = kind === 'year' ? (goal as YearGoal) : null;
  const q = kind === 'quarter' ? (goal as QuarterGoal) : null;
  const children = y ? quarters.filter((x) => x.yearGoalId === y.id).sort((a, b) => a.quarter.localeCompare(b.quarter) || a.sortOrder - b.sortOrder) : [];
  const steps = q ? actions.filter((a) => a.quarterGoalId === q.id).sort((a, b) => a.sortOrder - b.sortOrder) : [];
  const yearOpts = q ? [{ value: '', label: '—' }, ...years.filter((x) => x.venture === q.venture).map((x) => ({ value: x.id, label: `${x.year} · ${x.title}` }))] : [];
  return (
    <aside className="peek goalpanel" role="dialog" aria-label={goal.title}>
      <div className="peek__bar">
        <CloseLink href={closeHref} />
        <span className="peek__title">{goal.title}</span>
        <Sel value={goal.status} options={statusOptions} className={`status status--${GOAL_TONE[goal.status]} status--select`} label="Status" onChange={save('status')} />
        <RemoveButton what={goal.title} body={kind === 'year' ? 'It cannot be undone. Its quarterly goals stay, without a yearly goal.' : 'It cannot be undone. Its action points stay, without a quarterly goal.'}
          onRemove={() => removeGoal(table, goal.id)} />
      </div>
      <div className="peek__body goalpanel__body">
        <Field label="Goal" value={goal.title} onSave={save('title')} />
        <div className="goalpanel__row">
          <label className="pfield">
            <span className="pfield__label">Venture</span>
            <Sel value={goal.venture} options={ventureOpts} label="Venture" onChange={save('venture')} />
          </label>
          {y ? <Field label="Year" value={String(y.year)} onSave={save('year')} /> : null}
          {q ? <Field label="Quarter" value={q.quarter} placeholder="2026-Q4" onSave={save('quarter')} /> : null}
        </div>
        {q ? (
          <label className="pfield">
            <span className="pfield__label">Yearly goal</span>
            <Sel value={q.yearGoalId} options={yearOpts} label="Yearly goal" onChange={save('yearGoalId')} />
          </label>
        ) : null}
        <Field label="Notes" multiline rows={5} value={goal.notes} onSave={save('notes')} />
        {y ? (
          <section className="goalpanel__list">
            <h3 className="pfield__label">Quarterly goals · {children.length}</h3>
            {children.length ? (
              <ul>
                {children.map((x) => (
                  <li key={x.id}>
                    <span className="goalpanel__when">{quarterLabel(x.quarter)}</span>
                    <Link href={`/d/goal-navigator/quarters?peek=${x.id}`} className="goalpanel__link">{x.title}</Link>
                    <span className={`status status--${GOAL_TONE[x.status]}`}>{GOAL_STATUS[x.status]}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="muted goalpanel__empty">None yet. A quarterly goal is linked to this one from its own card or the Quarterly goals table.</p>}
          </section>
        ) : null}
        {q ? (
          <section className="goalpanel__list">
            <h3 className="pfield__label">Action points · {steps.filter((a) => a.status === 'done').length} of {steps.length} done</h3>
            {steps.length ? (
              <ul>
                {steps.map((a) => (
                  <li key={a.id}>
                    <span className={`status status--${GOAL_TONE[a.status]}`}>{GOAL_STATUS[a.status]}</span>
                    <span className="goalpanel__text">{a.title}</span>
                    <span className="goalpanel__when">{[a.owner, shortDate(a.dueDate ?? a.doDate)].filter((x) => x && x !== '—').join(' · ')}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="muted goalpanel__empty">None yet. Action points are added on the Action points tab.</p>}
          </section>
        ) : null}
      </div>
    </aside>
  );
}

// --------------------------------------------------------------- actions

const prioOpts = [{ value: '', label: '—' }, { value: 'high', label: 'High' }, { value: 'normal', label: 'Normal' }, { value: 'low', label: 'Low' }];

export function Actions({ rows, goals, quarter, ...c }: Common & { rows: ActionPoint[]; goals: QuarterGoal[]; quarter?: string }) {
  const [closed, setClosed] = useState<Record<string, boolean>>({});
  const t = text('goal_actions');
  const goalOpts = (r: ActionPoint) => [{ value: '', label: '—' }, ...goals.filter((g) => g.venture === r.venture && g.quarter === r.quarter).map((g) => ({ value: g.id, label: g.title }))];
  const columns: Column<ActionPoint>[] = [
    { key: 'venture', label: 'Venture', type: 'select', width: 180, render: (r) => <VentureCell table="goal_actions" id={r.id} value={r.venture} /> },
    { key: 'title', label: 'Action point', type: 'text', width: 360, render: t('title', 'Action point') as never },
    { key: 'goal', label: 'Quarterly goal', type: 'select', width: 240, render: (r) => <Select table="goal_actions" id={r.id} field="quarterGoalId" value={r.quarterGoalId} options={goalOpts(r)} /> },
    { key: 'owner', label: 'Who', type: 'text', width: 110, render: t('owner', 'Who') as never },
    { key: 'status', label: 'Status', type: 'select', width: 120, render: (r) => <StatusSel table="goal_actions" id={r.id} value={r.status} /> },
    { key: 'do', label: 'Do date', type: 'date', width: 120, render: t('doDate', 'Do date') as never },
    { key: 'due', label: 'Due date', type: 'date', width: 120, render: t('dueDate', 'Due date') as never },
    { key: 'prio', label: 'Priority', type: 'select', width: 100, render: (r) => <Select table="goal_actions" id={r.id} field="priority" value={r.priority} options={prioOpts} /> },
    { key: 'notes', label: 'Notes', type: 'text', width: 320, render: t('notes', 'Notes') as never },
    { key: 'del', label: 'Delete', type: 'text', width: 60, bare: true, render: (r) => <Remove table="goal_actions" id={r.id} what={r.title} /> },
  ];
  const list = quarter ? rows.filter((r) => r.quarter === quarter) : rows;
  const quarters = [...new Set(list.map((r) => r.quarter))].sort();
  const groups: Group<ActionPoint>[] = quarters.map((q) => ({
    key: q, tone: 'grey', head: <span className="grid2__foldname">{q}</span>,
    rows: list.filter((r) => r.quarter === q).sort((a, b) => (a.dueDate ?? a.doDate ?? '9') .localeCompare(b.dueDate ?? b.doDate ?? '9') || a.sortOrder - b.sortOrder),
    open: !closed[q], onToggle: () => setClosed((x) => ({ ...x, [q]: !x[q] })),
  }));
  return (
    <>
      <AddRow table="goal_actions" defaults={{ quarter: thisQuarter() }} fields={[
        { key: 'quarter', placeholder: 'Quarter' }, { key: 'venture', placeholder: 'Venture', options: ventureOpts },
        { key: 'title', placeholder: 'Action point', wide: true }, { key: 'owner', placeholder: 'Who' }, { key: 'dueDate', placeholder: 'Due 2026-11-30' },
      ]} />
      {grid({ ...c, columns, ...(list.length ? { groups } : {}), rowKey: (r: ActionPoint) => r.id, empty: 'No action points yet. Add the first one above.' })}
    </>
  );
}

// --------------------------------------------------------------- roadmap

export function RoadmapBoard({ goals, actions }: { goals: QuarterGoal[]; actions: ActionPoint[] }) {
  const years = [...new Set(goals.map((g) => Number(g.quarter.slice(0, 4))))].sort();
  const [year, setYear] = useState<number>(years.includes(new Date().getUTCFullYear()) ? new Date().getUTCFullYear() : (years[0] ?? new Date().getUTCFullYear()));
  const qs = [1, 2, 3, 4].map((n) => `${year}-Q${n}`);
  return (
    <div className="board">
      <div className="board__years">
        {(years.length ? years : [year]).map((y) => (
          <button key={y} type="button" className={`chip${y === year ? ' chip--active' : ''}`} onClick={() => setYear(y)}>{y}</button>
        ))}
        <span className="muted" style={{ marginLeft: 'auto', fontSize: 12 }}>Quarterly goals are added on the Quarterly goals tab.</span>
      </div>
      <div className="board__grid">
        <div className="board__corner" />
        {qs.map((q) => <div key={q} className="board__q">{q.slice(5)}</div>)}
        {VENTURES.map((v) => (
          <div key={v} className={`board__row ${lane(v)}`} style={{ display: 'contents' }}>
            <div className={`board__venture ${lane(v)}`}><span className="lane__dot" />{v}</div>
            {qs.map((q) => (
              <div key={q} className="board__cell">
                {goals.filter((g) => g.venture === v && g.quarter === q).sort((a, b) => a.sortOrder - b.sortOrder).map((g) => {
                  const p = progressOf(g, actions);
                  return (
                    <Link key={g.id} href={`/d/goal-navigator/quarters`} className={`board__card ${lane(v)} board__card--${g.status}`}>
                      <span className="board__title">{g.title}</span>
                      <span className="board__meta">{GOAL_STATUS[g.status]}{p == null ? '' : ` · ${Math.round(p * 100)} %`}</span>
                      {p != null ? <span className="board__bar"><span style={{ width: `${p * 100}%` }} /></span> : null}
                    </Link>
                  );
                })}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ------------------------------------------------------------- dashboard

export function Dashboard({ goals, actions, today, ...c }: Common & { goals: QuarterGoal[]; actions: ActionPoint[]; today: string }) {
  const q = thisQuarter();
  const mine = goals.filter((g) => g.quarter === q);
  const now = new Date(); const soon = new Date(now.getTime() + 7 * 86400000);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const week = actions
    .filter((a) => a.status !== 'done' && a.status !== 'parked')
    .filter((a) => { const d = a.dueDate ?? a.doDate; return d != null && d <= iso(soon); })
    .sort((a, b) => (a.dueDate ?? a.doDate ?? '').localeCompare(b.dueDate ?? b.doDate ?? ''));
  const overdue = (a: ActionPoint) => { const d = a.dueDate ?? a.doDate; return d != null && d < iso(now); };
  const columns: Column<ActionPoint>[] = [
    { key: 'venture', label: 'Venture', type: 'select', width: 180, render: (r) => <span className={`cell cell--lead ${lane(r.venture)}`}><span className="lane__dot" />{r.venture}</span> },
    { key: 'title', label: 'Action point', type: 'text', width: 400, render: (r) => r.title },
    { key: 'owner', label: 'Who', type: 'text', width: 110, render: (r) => r.owner ?? <span className="grid2__dash">—</span> },
    { key: 'status', label: 'Status', type: 'select', width: 120, render: (r) => <StatusSel table="goal_actions" id={r.id} value={r.status} /> },
    { key: 'when', label: 'When', type: 'date', width: 140, render: (r) => <span className={overdue(r) ? 'status status--contact' : undefined}>{shortDate(r.dueDate ?? r.doDate)}</span> },
  ];
  return (
    <div className="dash">
      <div className="dash__head"><span className="grid2__foldname">{q}</span><span className="muted" style={{ fontSize: 12 }}>{today}</span></div>
      <div className="dash__goals">
        {mine.length === 0 ? <p className="muted" style={{ padding: 12 }}>No quarterly goals for {q} yet — add them on the Quarterly goals tab.</p> : null}
        {VENTURES.filter((v) => mine.some((g) => g.venture === v)).map((v) => (
          <div key={v} className={`dash__venture ${lane(v)}`}>
            <div className="dash__vname"><span className="lane__dot" />{v}</div>
            {mine.filter((g) => g.venture === v).map((g) => {
              const p = progressOf(g, actions); const n = actions.filter((a) => a.quarterGoalId === g.id).length;
              return (
                <div key={g.id} className="dash__goal">
                  <span className={`status status--${GOAL_TONE[g.status]}`}>{GOAL_STATUS[g.status]}</span>
                  <span className="dash__gtitle">{g.title}</span>
                  <span className="board__bar dash__bar"><span style={{ width: `${(p ?? 0) * 100}%` }} /></span>
                  <span className="dash__pct">{p == null ? `${n} steps` : `${Math.round(p * 100)} %`}</span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div className="dash__head"><span className="grid2__foldname">This week</span><span className="muted" style={{ fontSize: 12 }}>{week.length === 0 ? 'Nothing due or planned in the next 7 days.' : `${week.length} action point${week.length === 1 ? '' : 's'}`}</span></div>
      {grid({ ...c, columns, rows: week, rowKey: (r: ActionPoint) => r.id, empty: 'Nothing due or planned in the next 7 days.' })}
    </div>
  );
}
