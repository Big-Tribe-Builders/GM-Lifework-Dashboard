'use client';

import { useEffect, useState, useTransition } from 'react';
import type { PlanItem, Experiment, PlaybookEntry } from '@/lib/btb';
import { PLAN_STATUS, EXP_STATUS, quarterWeeks, quarterPos } from '@/lib/btb';
import type { ColumnSetting } from '@/lib/grid';
import { updateBtb, addBtb, removeBtb, type BtbTable } from '@/app/d/btb/actions';
import { saveGridColumn } from '@/app/d/actions';
import { Grid, type Column, type Group } from '@/components/Grid';
import { EditableCell } from '@/components/EditableCell';
import { ConfirmDialog } from '@/components/ClientTable';
import { shortDate } from '@/lib/upwork';

/**
 * Big Tribe Builders' plan, three grids.
 *
 * Roadmap: the quarter's work, folded by quarter, with a timeline above it
 * (one bar per row across the quarter's 13 weeks, the done part filled).
 * Experiments: the marketing tests. Playbook: the frameworks, answered.
 * Everything is typed into in place.
 */

const cell = (table: BtbTable, kind: 'text' | 'link' = 'text') =>
  (field: string, label: string) => (r: { id: string } & Record<string, unknown>) => (
    <EditableCell
      kind={kind}
      value={(r[field] as string | number | null) == null ? null : String(r[field])}
      label={label}
      onSave={(v) => updateBtb(table, r.id, field, v)}
    />
  );

function StatusCell<T extends string>({ table, id, value, labels, tones }: {
  table: BtbTable; id: string; value: T; labels: Record<T, string>; tones: Record<T, string>;
}) {
  const [pending, start] = useTransition();
  return (
    <select
      className={`status status--${tones[value]} status--select`}
      value={value}
      disabled={pending}
      onChange={(e) => { const v = e.target.value; start(async () => { await updateBtb(table, id, 'status', v); }); }}
    >
      {(Object.keys(labels) as T[]).map((k) => <option key={k} value={k}>{labels[k]}</option>)}
    </select>
  );
}

function Remove({ table, id, what }: { table: BtbTable; id: string; what: string }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();
  return (
    <>
      <button type="button" className="iconbtn iconbtn--delete" title="Delete" aria-label={`Delete ${what}`} disabled={pending} onClick={() => setConfirming(true)}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>
      </button>
      {confirming ? (
        <ConfirmDialog title={`Delete "${what}"?`} body="It cannot be undone." confirmLabel="Delete"
          onCancel={() => setConfirming(false)}
          onConfirm={() => { setConfirming(false); start(async () => { await removeBtb(table, id); }); }} />
      ) : null}
    </>
  );
}

/** The add row: one line of inputs above the grid. */
function AddRow({ table, fields, label }: { table: BtbTable; fields: { key: string; placeholder: string; wide?: boolean }[]; label: string }) {
  const [form, setForm] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="addrow"
      onSubmit={(e) => {
        e.preventDefault(); setError(null);
        start(async () => { const r = await addBtb(table, form); if (r.error) setError(r.error); else setForm({}); });
      }}
    >
      {fields.map((f) => (
        <input key={f.key} className={f.wide ? 'addrow__wide' : undefined} placeholder={f.placeholder}
          value={form[f.key] ?? ''} onChange={(e) => setForm((x) => ({ ...x, [f.key]: e.target.value }))} aria-label={f.placeholder} />
      ))}
      <button type="submit" className="btn btn--primary" disabled={pending}>{pending ? 'Adding…' : label}</button>
      {error ? <span className="cell__error">{error}</span> : null}
    </form>
  );
}

// ------------------------------------------------------------------ roadmap

const PLAN_TONE: Record<PlanItem['status'], string> = { todo: 'sleeping', doing: 'active', done: 'done', parked: 'archived' };

/** Ten lane colours, assigned in the order lanes first appear. */
export function laneIndex(rows: { track: string | null }[]): Record<string, number> {
  const out: Record<string, number> = {};
  let n = 0;
  for (const r of rows) {
    const k = r.track ?? '';
    if (!(k in out)) out[k] = n++ % 10;
  }
  return out;
}

function Timeline({ quarter, rows }: { quarter: string; rows: PlanItem[] }) {
  const weeks = quarterWeeks(quarter);
  const lanes = laneIndex(rows);
  // Today's marker is placed in the browser only: the server's clock and the
  // browser's differ by a few seconds, and a position computed twice would
  // not match on hydration.
  const [today, setToday] = useState<number | null>(null);
  useEffect(() => { setToday(quarterPos(quarter, new Date().toISOString())); }, [quarter]);
  if (!weeks.length) return null;
  return (
    <div className="tl">
      <div className="tl__legend">
        {Object.entries(lanes).map(([k, i]) => (
          <span key={k} className={`lane lane--${i}`}><span className="lane__dot" />{k || 'No lane'}</span>
        ))}
      </div>
      <div className="tl__head">
        <div className="tl__label">{quarter}</div>
        <div className="tl__weeks">
          {weeks.map((w, i) => <div key={i} className="tl__week">{w.getUTCDate()}/{w.getUTCMonth() + 1}</div>)}
          {today != null ? <div className="tl__today" style={{ left: `${today * 100}%` }} /> : null}
        </div>
      </div>
      {rows.map((r) => {
        const a = quarterPos(quarter, r.startDate), b = quarterPos(quarter, r.endDate);
        const left = a ?? 0, right = b ?? (a != null ? Math.min(1, a + 1 / 13) : 1);
        return (
          <div key={r.id} className={`tl__row lane--${lanes[r.track ?? '']}`}>
            <div className="tl__label" title={r.title}>
              <span className="lane__dot" /><span className="tl__title">{r.title}</span>
              {r.owner ? <span className="tl__owner">{r.owner}</span> : null}
            </div>
            <div className="tl__weeks">
              {a == null && b == null ? <span className="tl__nodate">no dates yet</span> : (
                <div className={`tl__bar tl__bar--${r.status}`} data-lane={lanes[r.track ?? '']} style={{ left: `${left * 100}%`, width: `${Math.max(2, (right - left) * 100)}%` }}>
                  <span className="tl__fill" style={{ width: `${r.progress}%` }} />
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function Roadmap({ rows, settings = {}, accent, store }: { rows: PlanItem[]; settings?: Record<string, ColumnSetting>; accent?: string; store: string }) {
  const [closed, setClosed] = useState<Record<string, boolean>>({});
  const t = cell('btb_plan');
  const lanes = laneIndex(rows);
  const columns: Column<PlanItem>[] = [
    { key: 'title', label: 'What', type: 'text', width: 300, render: t('title', 'What') as never },
    { key: 'track', label: 'Lane', type: 'select', width: 170,
      render: (r) => (
        <span className={`cell cell--lead lane--${lanes[r.track ?? '']}`}>
          <span className="lane__dot" />
          {(t('track', 'Lane') as (x: PlanItem) => React.ReactNode)(r)}
        </span>
      ) },
    { key: 'owner', label: 'Who', type: 'text', width: 110, render: t('owner', 'Who') as never },
    { key: 'status', label: 'Status', type: 'select', width: 120, render: (r) => <StatusCell table="btb_plan" id={r.id} value={r.status} labels={PLAN_STATUS} tones={PLAN_TONE} /> },
    { key: 'progress', label: '% done', type: 'number', width: 90, numeric: true, render: t('progress', '% done') as never },
    { key: 'start', label: 'Start', type: 'date', width: 120, render: t('startDate', 'Start') as never },
    { key: 'end', label: 'End', type: 'date', width: 120, render: t('endDate', 'End') as never },
    { key: 'notes', label: 'Notes', type: 'text', width: 320, render: t('notes', 'Notes') as never },
    { key: 'del', label: 'Delete', type: 'text', width: 60, bare: true, render: (r) => <Remove table="btb_plan" id={r.id} what={r.title} /> },
  ];
  const quarters = [...new Set(rows.map((r) => r.quarter))].sort().reverse();
  const sorted = (q: string) => rows.filter((r) => r.quarter === q).sort((a, b) => a.sortOrder - b.sortOrder || (a.startDate ?? '').localeCompare(b.startDate ?? ''));
  const groups: Group<PlanItem>[] = quarters.map((q) => ({
    key: q, tone: 'grey', head: <span className="grid2__foldname">{q}</span>, rows: sorted(q),
    open: !closed[q], onToggle: () => setClosed((c) => ({ ...c, [q]: !c[q] })),
  }));
  const current = quarters[0];
  return (
    <>
      {current ? <Timeline quarter={current} rows={sorted(current)} /> : null}
      <AddRow table="btb_plan" label="+ Add" fields={[
        { key: 'quarter', placeholder: current ?? '2026-Q4' },
        { key: 'track', placeholder: 'Lane' },
        { key: 'title', placeholder: 'What', wide: true },
        { key: 'owner', placeholder: 'Who' },
      ]} />
      <Grid columns={columns} {...(rows.length ? { groups } : {})} rowKey={(r) => r.id} store={store}
        empty="No plan yet. Add the first line above." settings={settings}
        onColumnSettings={(k, i) => saveGridColumn(store, k, i)} accent={accent} />
    </>
  );
}

// -------------------------------------------------------------- experiments

const EXP_TONE: Record<Experiment['status'], string> = { idea: 'sleeping', running: 'active', done: 'done', dropped: 'archived' };

export function Experiments({ rows, settings = {}, accent, store }: { rows: Experiment[]; settings?: Record<string, ColumnSetting>; accent?: string; store: string }) {
  const t = cell('btb_experiments');
  const columns: Column<Experiment>[] = [
    { key: 'title', label: 'Test', type: 'text', width: 260, render: t('title', 'Test') as never },
    { key: 'hypothesis', label: 'We believe that…', type: 'text', width: 300, render: t('hypothesis', 'Hypothesis') as never },
    { key: 'channel', label: 'Channel', type: 'select', width: 130, render: t('channel', 'Channel') as never },
    { key: 'owner', label: 'Who', type: 'text', width: 100, render: t('owner', 'Who') as never },
    { key: 'status', label: 'Status', type: 'select', width: 120, render: (r) => <StatusCell table="btb_experiments" id={r.id} value={r.status} labels={EXP_STATUS} tones={EXP_TONE} /> },
    { key: 'start', label: 'Start', type: 'date', width: 120, render: t('startDate', 'Start') as never },
    { key: 'end', label: 'End', type: 'date', width: 120, render: t('endDate', 'End') as never },
    { key: 'result', label: 'Result', type: 'text', width: 240, render: t('result', 'Result') as never },
    { key: 'learning', label: 'Learning', type: 'text', width: 300, render: t('learning', 'Learning') as never },
    { key: 'del', label: 'Delete', type: 'text', width: 60, bare: true, render: (r) => <Remove table="btb_experiments" id={r.id} what={r.title} /> },
  ];
  const sorted = [...rows].sort((a, b) => a.sortOrder - b.sortOrder || (b.startDate ?? '').localeCompare(a.startDate ?? ''));
  return (
    <>
      <AddRow table="btb_experiments" label="+ Add" fields={[
        { key: 'title', placeholder: 'Test', wide: true },
        { key: 'hypothesis', placeholder: 'We believe that…', wide: true },
        { key: 'channel', placeholder: 'Channel' },
        { key: 'owner', placeholder: 'Who' },
      ]} />
      <Grid columns={columns} rows={sorted} rowKey={(r) => r.id} store={store}
        empty="No tests yet. Add the first one above." settings={settings}
        onColumnSettings={(k, i) => saveGridColumn(store, k, i)} accent={accent} />
    </>
  );
}

// ----------------------------------------------------------------- playbook

export function Playbook({ rows, settings = {}, accent, store }: { rows: PlaybookEntry[]; settings?: Record<string, ColumnSetting>; accent?: string; store: string }) {
  const [closed, setClosed] = useState<Record<string, boolean>>({});
  const t = cell('btb_playbook');
  const columns: Column<PlaybookEntry>[] = [
    { key: 'step', label: 'Step', type: 'text', width: 200, render: t('step', 'Step') as never },
    { key: 'question', label: 'Question', type: 'text', width: 340, render: t('question', 'Question') as never },
    { key: 'answer', label: 'BTB answer', type: 'text', width: 520, render: t('answer', 'Answer') as never },
    { key: 'del', label: 'Delete', type: 'text', width: 60, bare: true, render: (r) => <Remove table="btb_playbook" id={r.id} what={r.step} /> },
  ];
  const frameworks = [...new Set(rows.map((r) => r.framework))];
  const groups: Group<PlaybookEntry>[] = frameworks.map((f) => ({
    key: f, tone: 'grey', head: <span className="grid2__foldname">{f}</span>,
    rows: rows.filter((r) => r.framework === f).sort((a, b) => a.sortOrder - b.sortOrder),
    open: !closed[f], onToggle: () => setClosed((c) => ({ ...c, [f]: !c[f] })),
  }));
  return (
    <>
      <AddRow table="btb_playbook" label="+ Add" fields={[
        { key: 'framework', placeholder: 'Framework' },
        { key: 'step', placeholder: 'Step' },
        { key: 'question', placeholder: 'Question', wide: true },
      ]} />
      <Grid columns={columns} {...(rows.length ? { groups } : {})} rowKey={(r) => r.id} store={store}
        empty="Nothing in the playbook yet." settings={settings}
        onColumnSettings={(k, i) => saveGridColumn(store, k, i)} accent={accent} />
    </>
  );
}
