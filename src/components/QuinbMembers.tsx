'use client';

import { useSearchParams } from 'next/navigation';
import type { QuinbMember } from '@/lib/book';
import type { ColumnSetting } from '@/lib/grid';
import { updateMember, removeMember } from '@/app/d/quinb/actions';
import { saveGridColumn } from '@/app/d/actions';
import { Grid, type Column } from '@/components/Grid';
import { EditableCell } from '@/components/EditableCell';
import { Remove, DateCell } from '@/components/rowkit';
import { INACTIVE_DAYS, MEMBER_FILTER_PARAM, NEW_DAYS, inFilter, memberFilterOf } from '@/lib/members';

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

/**
 * QuinB Community › Members: one list, with new and inactive members as
 * filters picked in the toolbar ("All members ⌄"), and Add member next to
 * the search there (Giulia, 16 Oct 2026).
 */
export function Members({ rows, settings, accent, store }: {
  rows: QuinbMember[]; settings?: Record<string, ColumnSetting>; accent?: string; store: string;
}) {
  const filter = memberFilterOf(useSearchParams().get(MEMBER_FILTER_PARAM));
  const sorted = rows.filter((m) => inFilter(m, filter)).sort((a, b) => a.name.localeCompare(b.name) || (a.email ?? '').localeCompare(b.email ?? '') || a.id.localeCompare(b.id));
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
  const empty = filter === 'new' ? `Nobody joined in the last ${NEW_DAYS} days.`
    : filter === 'inactive' ? `Everyone has visited in the last ${INACTIVE_DAYS} days.`
    : 'No members yet. Add one with + Add member.';
  return (
    <div className="mailstack">
      <Grid rows={sorted} columns={columns} rowKey={(r) => r.id} store={store} settings={settings} accent={accent}
        onColumnSettings={(k, i) => saveGridColumn(store, k, i)} empty={empty} />
    </div>
  );
}
