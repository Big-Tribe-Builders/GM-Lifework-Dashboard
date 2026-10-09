'use client';

import type { QuinbMember } from '@/lib/book';
import type { ColumnSetting } from '@/lib/grid';
import { addMember, updateMember, removeMember } from '@/app/d/quinb/actions';
import { saveGridColumn } from '@/app/d/actions';
import { Grid, type Column } from '@/components/Grid';
import { EditableCell } from '@/components/EditableCell';
import { AddRow, Remove, DateCell } from '@/components/rowkit';

/** How long since a date, in years and months: "2 y 3 m", "5 m", "less than a month". */
function since(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return '—';
  const now = new Date();
  let months = (now.getUTCFullYear() - d.getUTCFullYear()) * 12 + (now.getUTCMonth() - d.getUTCMonth());
  if (now.getUTCDate() < d.getUTCDate()) months -= 1;
  if (months < 1) return 'less than a month';
  const y = Math.floor(months / 12), m = months % 12;
  return [y ? `${y} y` : '', m ? `${m} m` : ''].filter(Boolean).join(' ');
}

/** QuinB Community › Members. Loaded from the Mighty Networks export until the network can be read. */
export function Members({ rows, settings, accent, store }: {
  rows: QuinbMember[]; settings?: Record<string, ColumnSetting>; accent?: string; store: string;
}) {
  const sorted = [...rows].sort((a, b) => a.name.localeCompare(b.name) || (a.email ?? '').localeCompare(b.email ?? '') || a.id.localeCompare(b.id));
  const text = (field: 'name' | 'email' | 'notes', label: string) => (r: QuinbMember) => (
    <EditableCell kind="text" value={r[field]} label={`${label} of ${r.name}`} onSave={(v) => updateMember(r.id, field, v)} />
  );
  const columns: Column<QuinbMember>[] = [
    { key: 'name', label: 'Name', type: 'text', width: 220, render: text('name', 'Name') },
    { key: 'email', label: 'Email', type: 'text', width: 240, render: text('email', 'Email') },
    { key: 'since', label: 'Member since', type: 'date', width: 150, render: (r) => <DateCell value={r.memberSince} label={`Member since, ${r.name}`} onSave={(v) => updateMember(r.id, 'memberSince', v)} /> },
    { key: 'inside', label: 'Inside for', type: 'number', width: 130, render: (r) => <span className="cell muted">{since(r.memberSince)}</span> },
    { key: 'login', label: 'Last visit', type: 'date', width: 150, render: (r) => <DateCell value={r.lastLogin} label={`Last visit, ${r.name}`} onSave={(v) => updateMember(r.id, 'lastLogin', v)} /> },
    { key: 'interactions', label: 'Interactions', type: 'number', width: 120, numeric: true, render: (r) => (
      <EditableCell kind="text" value={r.interactions == null ? null : String(r.interactions)} label={`Interactions of ${r.name}`} onSave={(v) => updateMember(r.id, 'interactions', v)} />
    ) },
    { key: 'notes', label: 'Notes', type: 'text', width: 320, render: text('notes', 'Notes') },
    { key: 'del', label: 'Delete', type: 'text', width: 60, bare: true, render: (r) => <Remove what={r.name} onRemove={() => removeMember(r.id)} /> },
  ];
  return (
    <div className="mailstack">
      <AddRow label="+ Add member" onAdd={(f) => addMember(f)} fields={[
        { key: 'name', placeholder: 'Name' }, { key: 'email', placeholder: 'Email', type: 'email' },
        { key: 'memberSince', placeholder: 'Member since', type: 'date' }, { key: 'lastLogin', placeholder: 'Last visit', type: 'date' },
        { key: 'interactions', placeholder: 'Interactions', type: 'number' },
      ]} />
      <Grid rows={sorted} columns={columns} rowKey={(r) => r.id} store={store} settings={settings} accent={accent}
        onColumnSettings={(k, i) => saveGridColumn(store, k, i)}
        empty="No members yet. They are loaded from the Mighty Networks member export." />
    </div>
  );
}
