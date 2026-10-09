'use client';

import type { QuinbMember } from '@/lib/book';
import type { ColumnSetting } from '@/lib/grid';
import { addMember, updateMember, removeMember } from '@/app/d/quinb/actions';
import { saveGridColumn } from '@/app/d/actions';
import { Grid, type Column } from '@/components/Grid';
import { EditableCell } from '@/components/EditableCell';
import { AddRow, Remove, DateCell } from '@/components/rowkit';

/** QuinB Academy › Members. Typed by hand until Mighty Networks can be read. */
export function Members({ rows, settings, accent, store }: {
  rows: QuinbMember[]; settings?: Record<string, ColumnSetting>; accent?: string; store: string;
}) {
  const sorted = [...rows].sort((a, b) => a.name.localeCompare(b.name));
  const text = (field: 'name' | 'email' | 'notes', label: string) => (r: QuinbMember) => (
    <EditableCell kind="text" value={r[field]} label={`${label} of ${r.name}`} onSave={(v) => updateMember(r.id, field, v)} />
  );
  const columns: Column<QuinbMember>[] = [
    { key: 'name', label: 'Name', type: 'text', width: 220, render: text('name', 'Name') },
    { key: 'email', label: 'Email', type: 'text', width: 240, render: text('email', 'Email') },
    { key: 'since', label: 'Member since', type: 'date', width: 150, render: (r) => <DateCell value={r.memberSince} label={`Member since, ${r.name}`} onSave={(v) => updateMember(r.id, 'memberSince', v)} /> },
    { key: 'login', label: 'Last logged in', type: 'date', width: 150, render: (r) => <DateCell value={r.lastLogin} label={`Last logged in, ${r.name}`} onSave={(v) => updateMember(r.id, 'lastLogin', v)} /> },
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
        { key: 'memberSince', placeholder: 'Member since', type: 'date' }, { key: 'lastLogin', placeholder: 'Last logged in', type: 'date' },
        { key: 'interactions', placeholder: 'Interactions', type: 'number' },
      ]} />
      <Grid rows={sorted} columns={columns} rowKey={(r) => r.id} store={store} settings={settings} accent={accent}
        onColumnSettings={(k, i) => saveGridColumn(store, k, i)}
        empty="No members yet. They come from Mighty Networks once we can read it; until then, add them with the row above." />
    </div>
  );
}
