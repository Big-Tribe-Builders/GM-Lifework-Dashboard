'use client';

import { useState, useTransition } from 'react';
import type { CrmEmail } from '@/lib/crm';
import { type ColumnSetting } from '@/lib/grid';
import { updateEmailField, setEmailFlag, deleteEmail, type EmailField, type EmailFlag } from '@/app/d/clients/actions';
import { saveGridColumn } from '@/app/d/actions';
import { Grid, type Column } from '@/components/Grid';
import { EditableCell } from '@/components/EditableCell';
import { ConfirmDialog } from '@/components/ClientTable';

export const EMAILS_GRID = 'lifework.crm.emails.cols';

/**
 * The email list.
 *
 * One row per address. Every text field is typed into in place; the two
 * flags are checkboxes that save on click. Newest first, so what she just
 * added is at the top.
 */
export function EmailTable({
  rows, q = '', settings = {}, accent,
}: {
  rows: CrmEmail[];
  q?: string;
  settings?: Record<string, ColumnSetting>;
  accent?: string;
}) {
  const needle = q.trim().toLowerCase();
  const list = rows
    .filter((r) => !needle || [r.email, r.firstName, r.lastName, r.city, r.state, r.source]
      .some((v) => v?.toLowerCase().includes(needle)))
    .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));

  const text = (key: EmailField, label: string) => (r: CrmEmail) => (
    <EditableCell kind="text" value={r[key]} label={`${label} of ${r.email}`} onSave={(v) => updateEmailField(r.email, key, v)} />
  );

  const columns: Column<CrmEmail>[] = [
    { key: 'email', label: 'Email', type: 'text', width: 260,
      render: (r) => <a className="grid2__link" href={`mailto:${r.email}`}>{r.email}</a> },
    { key: 'first', label: 'First name', type: 'text', width: 150, render: text('firstName', 'First name') },
    { key: 'last', label: 'Last name', type: 'text', width: 150, render: text('lastName', 'Last name') },
    { key: 'city', label: 'City', type: 'text', width: 140, render: text('city', 'City') },
    { key: 'state', label: 'State', type: 'text', width: 100, render: text('state', 'State') },
    { key: 'source', label: 'Came from', type: 'text', width: 180, render: text('source', 'Source') },
    { key: 'client', label: 'Client', type: 'check', width: 90, render: (r) => <Flag row={r} flag="isClient" label="Client" /> },
    { key: 'community', label: 'In community', type: 'check', width: 130, render: (r) => <Flag row={r} flag="inCommunity" label="In community" /> },
    { key: 'notes', label: 'Notes', type: 'text', width: 280, render: text('notes', 'Notes') },
    { key: 'delete', label: 'Delete', type: 'text', width: 60, bare: true, render: (r) => <DeleteCell row={r} /> },
  ];

  return (
    <Grid
      rows={list}
      columns={columns}
      rowKey={(r) => r.email}
      store={EMAILS_GRID}
      empty={needle ? 'No match.' : 'No addresses yet. Add the first one with the button above.'}
      settings={settings}
      onColumnSettings={(key, input) => saveGridColumn(EMAILS_GRID, key, input)}
      accent={accent}
    />
  );
}

function Flag({ row, flag, label }: { row: CrmEmail; flag: EmailFlag; label: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="flagcell">
      <input
        type="checkbox"
        className="flagcell__box"
        checked={row[flag]}
        disabled={pending}
        aria-label={`${label}: ${row.email}`}
        onChange={(e) => {
          const on = e.target.checked;
          setError(null);
          start(async () => { const r = await setEmailFlag(row.email, flag, on); if (r.error) setError(r.error); });
        }}
      />
      {error ? <span className="cell__error" title={error}>{error}</span> : null}
    </span>
  );
}

function DeleteCell({ row }: { row: CrmEmail }) {
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState(false);
  return (
    <>
      <button type="button" className="iconbtn iconbtn--delete" title="Delete" aria-label={`Delete ${row.email}`}
        disabled={pending} onClick={() => setConfirming(true)}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
        </svg>
      </button>
      {confirming ? (
        <ConfirmDialog
          title={`Remove ${row.email}?`}
          body="It leaves the list. It cannot be undone."
          confirmLabel="Remove"
          onCancel={() => setConfirming(false)}
          onConfirm={() => { setConfirming(false); start(async () => { await deleteEmail(row.email); }); }}
        />
      ) : null}
    </>
  );
}
