'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { ConfirmDialog } from '@/components/ClientTable';

/**
 * Small grid parts shared by the newer zones: the add row above a grid, the
 * delete button with its confirm, a select that saves on change, a date
 * cell, and the arrow that opens a record.
 */

type Result = { error: string | null };

export type Field = { key: string; placeholder: string; wide?: boolean; type?: string; options?: { value: string; label: string }[] };

export function AddRow({ fields, defaults = {}, label = '+ Add', onAdd }: {
  fields: Field[]; defaults?: Record<string, string>; label?: string; onAdd: (form: Record<string, string>) => Promise<Result>;
}) {
  const [form, setForm] = useState<Record<string, string>>(defaults);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form className="addrow" onSubmit={(e) => {
      e.preventDefault(); setError(null);
      start(async () => { const r = await onAdd({ ...defaults, ...form }); if (r.error) setError(r.error); else setForm(defaults); });
    }}>
      {fields.map((f) => f.options ? (
        <select key={f.key} value={form[f.key] ?? ''} aria-label={f.placeholder} onChange={(e) => setForm((x) => ({ ...x, [f.key]: e.target.value }))}>
          <option value="">{f.placeholder}</option>
          {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ) : (
        <input key={f.key} type={f.type ?? 'text'} className={f.wide ? 'addrow__wide' : undefined} placeholder={f.placeholder} aria-label={f.placeholder}
          title={f.placeholder} value={form[f.key] ?? ''} onChange={(e) => setForm((x) => ({ ...x, [f.key]: e.target.value }))} />
      ))}
      <button type="submit" className="btn btn--primary" disabled={pending}>{pending ? 'Adding…' : label}</button>
      {error ? <span className="cell__error">{error}</span> : null}
    </form>
  );
}

export function Remove({ what, body = 'It cannot be undone.', onRemove }: { what: string; body?: string; onRemove: () => Promise<Result> }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();
  return (
    <>
      <button type="button" className="iconbtn iconbtn--delete" title="Delete" aria-label={`Delete ${what}`} disabled={pending} onClick={() => setConfirming(true)}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>
      </button>
      {confirming ? <ConfirmDialog title={`Delete "${what}"?`} body={body} confirmLabel="Delete"
        onCancel={() => setConfirming(false)} onConfirm={() => { setConfirming(false); start(async () => { await onRemove(); }); }} /> : null}
    </>
  );
}

export function Sel({ value, options, className = 'stagesel', blank, label, onChange }: {
  value: string | null; options: { value: string; label: string }[]; className?: string; blank?: string; label?: string;
  onChange: (v: string) => Promise<Result>;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="cell cell--lead">
      <select className={className} value={value ?? ''} disabled={pending} aria-label={label}
        onChange={(e) => { const v = e.target.value; setError(null); start(async () => { const r = await onChange(v); if (r.error) setError(r.error); }); }}>
        {blank !== undefined ? <option value="">{blank}</option> : null}
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {error ? <span className="cell__error" title={error}>{error}</span> : null}
    </span>
  );
}

export function DateCell({ value, label, onSave }: { value: string | null; label: string; onSave: (v: string) => Promise<Result> }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="cell cell--lead">
      <input type="date" className="cellinput" value={value ?? ''} disabled={pending} aria-label={label}
        onChange={(e) => { const v = e.target.value; setError(null); start(async () => { const r = await onSave(v); if (r.error) setError(r.error); }); }} />
      {error ? <span className="cell__error" title={error}>{error}</span> : null}
    </span>
  );
}

export const OpenArrow = ({ href, what }: { href: string; what: string }) => (
  <Link href={href} scroll={false} className="grid2__open" aria-label={`Open ${what}`} title="Open">
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4" /></svg>
  </Link>
);
