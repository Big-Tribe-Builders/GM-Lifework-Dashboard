'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import type { ColumnSetting, ViewMode } from '@/lib/grid';
import {
  JOB_STATUS, JOB_STATUSES, JOB_TONE, JOB_FIT, JOB_FITS, JOB_PLATFORMS, JOB_WORK_TYPES, COVER_LETTER_MAX,
  shortDate, type UpworkJob, type JobStatus,
} from '@/lib/upwork';
import type { PaletteKey } from '@/lib/palette';
import { addJob, updateJob, removeJob } from '@/app/d/upwork/actions';
import { saveGridColumn } from '@/app/d/actions';
import { Grid, type Column } from '@/components/Grid';
import { EditableCell } from '@/components/EditableCell';
import { AddRow, Remove, Sel, DateCell, OpenArrow } from '@/components/rowkit';
import { Gallery, type GalleryList } from '@/components/Gallery';
import { Field, CloseLink, usePanelKeys } from '@/components/panel';

/**
 * Upwork › Proposals: the job pipeline (Giulia, 10 Oct 2026), moved over
 * from her Notion "Upwork Pipeline". A job is found, judged (Fit, Why it
 * fits), gets a proposal, is approved, posted, and answered. The board
 * shows a list per status, like her Notion board; the table shows every
 * field. A job opens in the panel on the right, where the proposal is read
 * and edited.
 *
 * Nothing here talks to Upwork. Sending a proposal costs Connects and stays
 * a separate step she takes herself.
 */

const statusOpts = JOB_STATUSES.map((k) => ({ value: k, label: JOB_STATUS[k] }));
const fitOpts = JOB_FITS.map((k) => ({ value: k, label: JOB_FIT[k] }));
const platformOpts = JOB_PLATFORMS.map((p) => ({ value: p, label: p }));
const FIT_TINT: Record<string, PaletteKey> = { strong: 'dark-green', possible: 'yellow', skip: 'gray' };

/** The statuses always drawn as lists; the others appear once a job is in them. */
const ALWAYS: JobStatus[] = ['open', 'proposal_draft', 'approved', 'posted'];

const peekHref = (here: string, id: string) => `${here}${here.includes('?') ? '&' : '?'}peek=${id}`;
const newestFirst = (a: UpworkJob, b: UpworkJob) =>
  (b.postedOn ?? b.foundOn).localeCompare(a.postedOn ?? a.foundOn) || a.title.localeCompare(b.title);

export function Pipeline({ rows, mode, here, peek, colors, grid, settings, accent, store }: {
  rows: UpworkJob[]; mode: ViewMode; here: string; peek?: string;
  colors: Record<string, PaletteKey>; grid: string;
  settings?: Record<string, ColumnSetting>; accent?: string; store: string;
}) {
  const open = peek ? rows.find((r) => r.id === peek) ?? null : null;
  return (
    <div className="mailstack">
      <AddRow label="+ Add job" onAdd={(f) => addJob(f)} fields={[
        { key: 'title', placeholder: 'Job title', wide: true },
        { key: 'url', placeholder: 'Upwork link (https://www.upwork.com/jobs/~02…)', wide: true },
        { key: 'fit', placeholder: 'Fit', options: fitOpts },
      ]} />
      {mode === 'gallery'
        ? <Board rows={rows} here={here} colors={colors} grid={grid} />
        : <Table rows={rows} here={here} settings={settings} accent={accent} store={store} />}
      {open ? <JobPanel key={open.id} job={open} closeHref={here} /> : null}
    </div>
  );
}

// ----------------------------------------------------------------- board

function Board({ rows, here, colors, grid }: { rows: UpworkJob[]; here: string; colors: Record<string, PaletteKey>; grid: string }) {
  const lists: GalleryList<UpworkJob>[] = JOB_STATUSES
    .filter((s) => ALWAYS.includes(s) || rows.some((r) => r.status === s))
    .map((s) => ({ key: s, title: JOB_STATUS[s], items: rows.filter((r) => r.status === s).sort(newestFirst) }));
  return (
    <Gallery grid={grid} lists={lists} colors={colors} label="Job pipeline" itemKey={(r) => r.id}
      href={(r) => peekHref(here, r.id)} card={(r) => (
        <>
          <span className="gcard__labels">
            {r.fit ? <span className={`tint-tag tint-${FIT_TINT[r.fit]} gcard__chip`}>{JOB_FIT[r.fit]} fit</span> : null}
            {r.platform ? <span className="gcard__chip gcard__chip--plain">{r.platform}</span> : null}
          </span>
          <span className="gcard__title">{r.title}</span>
          <span className="gcard__foot">
            {r.budget ? <span className="gcard__badge" title="Budget">{r.budget}</span> : null}
            {r.postedOn ? <span className="gcard__badge" title="Posted on Upwork">Posted {shortDate(r.postedOn)}</span> : null}
            {r.country ? <span className="gcard__badge" title="Client country">{r.country}</span> : null}
            <span className="gcard__spacer" />
            {r.proposal.trim() ? <span className="gcard__badge" title="Has a proposal"><span aria-hidden="true">✎</span><span className="sr-only">has a proposal</span></span> : null}
          </span>
        </>
      )} />
  );
}

// ----------------------------------------------------------------- table

function Table({ rows, here, settings, accent, store }: {
  rows: UpworkJob[]; here: string; settings?: Record<string, ColumnSetting>; accent?: string; store: string;
}) {
  const sorted = [...rows].sort((a, b) => JOB_STATUSES.indexOf(a.status) - JOB_STATUSES.indexOf(b.status) || newestFirst(a, b));
  const text = (field: 'title' | 'budget' | 'country' | 'nextAction' | 'proposalsAtScan', label: string) => (r: UpworkJob) => (
    <EditableCell kind="text" value={r[field]} label={`${label} of ${r.title}`} onSave={(v) => updateJob(r.id, field, v)} />
  );
  const columns: Column<UpworkJob>[] = [
    { key: 'open', label: 'Open', type: 'text', width: 44, bare: true, render: (r) => <OpenArrow href={peekHref(here, r.id)} what={r.title} /> },
    { key: 'title', label: 'Job', type: 'text', width: 320, render: text('title', 'Job title') },
    { key: 'status', label: 'Status', type: 'select', width: 170, render: (r) => (
      <Sel value={r.status} options={statusOpts} className={`status status--${JOB_TONE[r.status]} status--select`} label={`Status of ${r.title}`} onChange={(v) => updateJob(r.id, 'status', v)} />
    ) },
    { key: 'fit', label: 'Fit', type: 'select', width: 120, render: (r) => (
      <Sel value={r.fit} options={fitOpts} blank="—" label={`Fit of ${r.title}`} onChange={(v) => updateJob(r.id, 'fit', v)} />
    ) },
    { key: 'platform', label: 'Platform', type: 'select', width: 160, render: (r) => (
      <Sel value={r.platform} options={platformOpts} blank="—" label={`Platform of ${r.title}`} onChange={(v) => updateJob(r.id, 'platform', v)} />
    ) },
    { key: 'budget', label: 'Budget', type: 'text', width: 140, render: text('budget', 'Budget') },
    { key: 'posted', label: 'Posted on', type: 'date', width: 140, render: (r) => <DateCell value={r.postedOn} label={`Posted on, ${r.title}`} onSave={(v) => updateJob(r.id, 'postedOn', v)} /> },
    { key: 'found', label: 'Found on', type: 'date', width: 140, render: (r) => <span className="cell muted">{shortDate(r.foundOn)}</span> },
    { key: 'proposals', label: 'Proposals at scan', type: 'text', width: 150, render: text('proposalsAtScan', 'Proposals at scan') },
    { key: 'country', label: 'Country', type: 'text', width: 130, render: text('country', 'Country') },
    { key: 'next', label: 'Next action', type: 'text', width: 280, render: text('nextAction', 'Next action') },
    { key: 'link', label: 'Upwork link', type: 'link', width: 200, render: (r) => (
      <EditableCell kind="link" value={r.url} label={`Upwork link of ${r.title}`} onSave={(v) => updateJob(r.id, 'url', v)} />
    ) },
    { key: 'del', label: 'Delete', type: 'text', width: 60, bare: true, render: (r) => <Remove what={r.title} onRemove={() => removeJob(r.id)} /> },
  ];
  return (
    <Grid rows={sorted} columns={columns} rowKey={(r) => r.id} store={store} settings={settings} accent={accent}
      onColumnSettings={(k, i) => saveGridColumn(store, k, i)}
      empty="No jobs in the pipeline yet. Add one above, or they come in with the job scan." />
  );
}

// ----------------------------------------------------------------- panel

function JobPanel({ job, closeHref }: { job: UpworkJob; closeHref: string }) {
  const [proposal, setProposal] = useState(job.proposal);
  const [state, setState] = useState<'idle' | 'dirty' | 'saving' | 'saved' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [, start] = useTransition();
  // A refresh may not overwrite what she is typing.
  useEffect(() => { if (state === 'idle' || state === 'saved') setProposal(job.proposal); }, [job.proposal]); // eslint-disable-line react-hooks/exhaustive-deps

  function save() {
    if (proposal === job.proposal) { setState((s) => (s === 'dirty' ? 'idle' : s)); return; }
    setState('saving'); setError(null);
    start(async () => {
      const r = await updateJob(job.id, 'proposal', proposal);
      if (r.error) { setState('error'); setError(r.error); } else setState((s) => (s === 'dirty' ? s : 'saved'));
    });
  }
  // Ctrl/Cmd+S: the field being typed in saves itself (it saves on blur),
  // then the proposal.
  const text = useRef<HTMLTextAreaElement>(null);
  usePanelKeys(closeHref, () => {
    const a = document.activeElement as HTMLElement | null;
    if (a && a !== text.current && a.closest('.jobpanel')) a.blur();
    save();
  });

  async function copy() {
    try { await navigator.clipboard.writeText(proposal); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    catch { setError('The browser did not allow copying. Select the text and copy it by hand.'); }
  }

  const save1 = (field: string) => (v: string) => updateJob(job.id, field, v);
  const length = proposal.length;
  return (
    <aside className="peek peek--wide chapter jobpanel" role="dialog" aria-label={job.title}>
      <div className="peek__bar">
        <CloseLink href={closeHref} />
        <span className="peek__title">{job.title}</span>
        <span className="chapter__meta muted">{state === 'saving' ? 'Saving…' : state === 'saved' ? 'Saved' : state === 'dirty' ? 'Unsaved — click away or Ctrl+S' : state === 'error' ? 'Not saved' : ''}</span>
        {job.url ? <a className="btn btn--ghost btn--tiny" href={job.url} target="_blank" rel="noreferrer">Open on Upwork ↗</a> : null}
        <Sel value={job.status} options={statusOpts} className={`status status--${JOB_TONE[job.status]} status--select`} label="Status" onChange={save1('status')} />
      </div>
      <div className="peek__body chapter__body">
        <div className="jobpanel__grid">
          <label className="pfield"><span className="pfield__label">Fit</span><Sel value={job.fit} options={fitOpts} blank="—" label="Fit" onChange={save1('fit')} /></label>
          <label className="pfield"><span className="pfield__label">Platform</span><Sel value={job.platform} options={platformOpts} blank="—" label="Platform" onChange={save1('platform')} /></label>
          <Field label="Budget" value={job.budget} onSave={save1('budget')} />
          <Field label="Proposals at scan" value={job.proposalsAtScan} onSave={save1('proposalsAtScan')} />
          <Field label="Client" value={job.client} onSave={save1('client')} />
          <Field label="Country" value={job.country} onSave={save1('country')} />
          <Field label="Client rating" value={job.clientRating == null ? null : String(job.clientRating)} onSave={save1('clientRating')} />
          <Field label="Client spend" value={job.clientSpend} onSave={save1('clientSpend')} />
          <label className="pfield"><span className="pfield__label">Payment verified</span>
            <Sel value={job.paymentVerified == null ? '' : String(job.paymentVerified)} options={[{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }]} blank="—" label="Payment verified" onChange={save1('paymentVerified')} />
          </label>
          <label className="pfield"><span className="pfield__label">Posted on</span><DateCell value={job.postedOn} label="Posted on" onSave={save1('postedOn')} /></label>
          <label className="pfield"><span className="pfield__label">Found on</span><DateCell value={job.foundOn} label="Found on" onSave={save1('foundOn')} /></label>
          <label className="pfield"><span className="pfield__label">Sent on</span><DateCell value={job.sentOn} label="Sent on" onSave={save1('sentOn')} /></label>
          <Field label="Connects spent" value={job.connectsSpent == null ? null : String(job.connectsSpent)} onSave={save1('connectsSpent')} />
          <label className="pfield"><span className="pfield__label">Last activity</span><DateCell value={job.lastActivity} label="Last activity" onSave={save1('lastActivity')} /></label>
          <Field label="Next action" value={job.nextAction} onSave={save1('nextAction')} />
          <label className="pfield"><span className="pfield__label">Next action date</span><DateCell value={job.nextActionDate} label="Next action date" onSave={save1('nextActionDate')} /></label>
        </div>
        <WorkTypes job={job} />
        <Field label="Why it fits" multiline rows={3} value={job.whyItFits} onSave={save1('whyItFits')} wide />
        {job.description?.trim() ? (
          <details className="typebrief">
            <summary>The job post</summary>
            <p className="typebrief__text">{job.description}</p>
          </details>
        ) : null}
        <div className="jobpanel__head">
          <span className="pfield__label">Proposal</span>
          <span className={`jobpanel__count${length > COVER_LETTER_MAX ? ' is-bad' : ''}`}>{length} / {COVER_LETTER_MAX}</span>
          <button type="button" className="btn btn--ghost btn--tiny" onClick={copy} disabled={!proposal.trim()}>{copied ? 'Copied' : 'Copy proposal'}</button>
        </div>
        <textarea ref={text} className="chapter__text post__text" placeholder="The cover letter for this job. A blank line makes a paragraph." aria-label="Proposal"
          value={proposal} onChange={(e) => { setProposal(e.target.value); setState('dirty'); }} onBlur={save} />
        {length > COVER_LETTER_MAX ? <p className="field__error">Upwork takes at most {COVER_LETTER_MAX} characters; this is {length - COVER_LETTER_MAX} over.</p> : null}
        <Field label="Notes" multiline rows={3} value={job.notes} onSave={save1('notes')} wide />
        {error ? <p className="field__error" role="alert">{error}</p> : null}
      </div>
    </aside>
  );
}

/** The work types as ticks, the way her Notion multi-select reads. */
function WorkTypes({ job }: { job: UpworkJob }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const on = new Set(job.workType);
  const toggle = (t: string) => {
    if (pending) return;
    const next = new Set(on);
    if (next.has(t)) next.delete(t); else next.add(t);
    setError(null);
    start(async () => { const r = await updateJob(job.id, 'workType', [...next].join('|')); if (r.error) setError(r.error); });
  };
  return (
    <fieldset className="jobpanel__types">
      <legend className="pfield__label">Work type</legend>
      {JOB_WORK_TYPES.map((t) => (
        <label key={t} className={`navset__tab${on.has(t) ? '' : ' navset__tab--off'}`}>
          <input type="checkbox" checked={on.has(t)} aria-busy={pending} onChange={() => toggle(t)} />
          <span className="jobpanel__typename">{t}</span>
        </label>
      ))}
      {error ? <span className="cell__error" role="alert">{error}</span> : null}
    </fieldset>
  );
}
