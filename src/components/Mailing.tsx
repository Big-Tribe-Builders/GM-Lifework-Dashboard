'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { CrmEmail } from '@/lib/crm';
import type { ColumnSetting } from '@/lib/grid';
import {
  VENTURES, MAIL_STYLES, CAMPAIGN_STATUS, CAMPAIGN_TONE, SEND_STATUS, PLACEHOLDERS, render, isoToBrussels,
  type MailList, type MailListMember, type MailTemplate, type MailSender, type MailCampaign, type MailStep, type MailSend,
  type MailSuppression, type MailStyle, type CampaignKind,
} from '@/lib/mail';
import {
  updateMail, addMail, removeMail, setListMember, addManyToList, setPersonalLine, suppress, unsuppress,
  prepareCampaign, sendBatch, sendTest, cancelScheduled, type MailTable,
} from '@/app/d/mailing/actions';
import { saveGridColumn } from '@/app/d/actions';
import { Grid, type Column } from '@/components/Grid';
import { EditableCell } from '@/components/EditableCell';
import { ConfirmDialog } from '@/components/ClientTable';
import { shortDate } from '@/lib/upwork';

/**
 * Mailing.
 *
 *   Lists       labels over CRM › Emails; tick who belongs
 *   Templates   subject + body with placeholders; a style per venture
 *   Campaigns   senders, broadcasts, the suppression list
 *   Sequences   broadcasts with steps on day offsets
 *
 * Sending itself happens in server actions; this file only draws and asks.
 */

const VENTURE_LANE: Record<string, number> = { 'Big Tribe Builders': 0, 'QuinB Academy': 1, 'Giulia May': 2 };
const lane = (v: string) => `lane--${VENTURE_LANE[v] ?? 9}`;
const ventureOpts = VENTURES.map((v) => ({ value: v, label: v }));

export type MailData = {
  lists: MailList[]; members: MailListMember[]; templates: MailTemplate[]; senders: MailSender[];
  campaigns: MailCampaign[]; steps: MailStep[]; sends: MailSend[]; suppressions: MailSuppression[];
  emails: CrmEmail[];
  /** The env var that is missing before anything can be sent, or null. */
  resendMissing: string | null;
};
type Common = { settings?: Record<string, ColumnSetting>; accent?: string; store: string; peek?: string; base: string };

// ------------------------------------------------------------------ cells

const text = (table: MailTable) => (field: string, label: string) =>
  (r: { id: string } & Record<string, unknown>) => (
    <EditableCell kind="text" value={(r[field] as string | null) == null ? null : String(r[field])}
      label={label} onSave={(v) => updateMail(table, r.id, field, v)} />
  );

function Sel({ table, id, field, value, options, className, blank }: {
  table: MailTable; id: string; field: string; value: string | null;
  options: { value: string; label: string }[]; className?: string; blank?: string;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="cell cell--lead">
      <select className={className ?? 'stagesel'} value={value ?? ''} disabled={pending}
        onChange={(e) => { const v = e.target.value; setError(null); start(async () => { const r = await updateMail(table, id, field, v); if (r.error) setError(r.error); }); }}>
        {blank !== undefined ? <option value="">{blank}</option> : null}
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {error ? <span className="cell__error" title={error}>{error}</span> : null}
    </span>
  );
}

const VentureCell = ({ table, id, value }: { table: MailTable; id: string; value: string }) => (
  <span className={`cell cell--lead ${lane(value)}`}>
    <span className="lane__dot" />
    <Sel table={table} id={id} field="venture" value={value} options={ventureOpts} />
  </span>
);

function Remove({ table, id, what, body = 'It cannot be undone.' }: { table: MailTable; id: string; what: string; body?: string }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();
  return (
    <>
      <button type="button" className="iconbtn iconbtn--delete" title="Delete" aria-label={`Delete ${what}`} disabled={pending} onClick={() => setConfirming(true)}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>
      </button>
      {confirming ? <ConfirmDialog title={`Delete "${what}"?`} body={body} confirmLabel="Delete"
        onCancel={() => setConfirming(false)} onConfirm={() => { setConfirming(false); start(async () => { await removeMail(table, id); }); }} /> : null}
    </>
  );
}

type Field = { key: string; placeholder: string; wide?: boolean; options?: { value: string; label: string }[]; type?: string };

function AddRow({ table, fields, defaults = {}, label = '+ Add' }: { table: MailTable; fields: Field[]; defaults?: Record<string, string>; label?: string }) {
  const [form, setForm] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form className="addrow" onSubmit={(e) => {
      e.preventDefault(); setError(null);
      start(async () => { const r = await addMail(table, { ...defaults, ...form }); if (r.error) setError(r.error); else setForm({}); });
    }}>
      {fields.map((f) => f.options ? (
        <select key={f.key} value={form[f.key] ?? defaults[f.key] ?? ''} aria-label={f.placeholder} onChange={(e) => setForm((x) => ({ ...x, [f.key]: e.target.value }))}>
          <option value="">{f.placeholder}</option>
          {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ) : (
        <input key={f.key} type={f.type ?? 'text'} className={f.wide ? 'addrow__wide' : undefined} placeholder={f.placeholder} aria-label={f.placeholder}
          value={form[f.key] ?? defaults[f.key] ?? ''} onChange={(e) => setForm((x) => ({ ...x, [f.key]: e.target.value }))} />
      ))}
      <button type="submit" className="btn btn--primary" disabled={pending}>{pending ? 'Adding…' : label}</button>
      {error ? <span className="cell__error">{error}</span> : null}
    </form>
  );
}

const grid = <T,>(props: Common & { columns: Column<T>[]; rows: T[]; rowKey: (r: T) => string; empty: string }) => (
  <Grid rows={props.rows} columns={props.columns} rowKey={props.rowKey} store={props.store} empty={props.empty}
    settings={props.settings} onColumnSettings={(k, i) => saveGridColumn(props.store, k, i)} accent={props.accent} />
);

const OpenArrow = ({ href, what }: { href: string; what: string }) => (
  <Link href={href} scroll={false} className="grid2__open" aria-label={`Open ${what}`} title="Open">
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4" /></svg>
  </Link>
);

const nameOf = (p?: CrmEmail) => [p?.firstName, p?.lastName].filter(Boolean).join(' ');

// ------------------------------------------------------------------ lists

export function Lists({ data, ...c }: Common & { data: MailData }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [pending, start] = useTransition();
  const t = text('mail_lists');
  const list = data.lists.find((l) => l.id === selected) ?? null;
  const onList = useMemo(() => new Set(data.members.filter((m) => m.listId === selected).map((m) => m.email.toLowerCase())), [data.members, selected]);

  const columns: Column<MailList>[] = [
    { key: 'open', label: 'Open', type: 'text', width: 44, bare: true, render: (r) => (
      <button type="button" className={`grid2__open${r.id === selected ? ' grid2__open--on' : ''}`} title="Who is on it" aria-label={`Who is on ${r.name}`} onClick={() => setSelected(r.id === selected ? null : r.id)}>
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4" /></svg>
      </button>
    ) },
    { key: 'venture', label: 'Venture', type: 'select', width: 190, render: (r) => <VentureCell table="mail_lists" id={r.id} value={r.venture} /> },
    { key: 'name', label: 'List', type: 'text', width: 260, render: t('name', 'List') as never },
    { key: 'count', label: 'People', type: 'number', width: 90, numeric: true, render: (r) => <span className="cell">{r.memberCount}</span> },
    { key: 'description', label: 'Description', type: 'text', width: 420, render: t('description', 'Description') as never },
    { key: 'del', label: 'Delete', type: 'text', width: 60, bare: true, render: (r) => <Remove table="mail_lists" id={r.id} what={r.name} body="The addresses stay in CRM › Emails; only the label goes." /> },
  ];

  const needle = q.trim().toLowerCase();
  const people = data.emails
    .filter((p) => !needle || [p.email, p.firstName, p.lastName, p.city, p.state, p.source].some((v) => v?.toLowerCase().includes(needle)))
    .sort((a, b) => Number(onList.has(b.email.toLowerCase())) - Number(onList.has(a.email.toLowerCase())) || a.email.localeCompare(b.email));

  const memberCols: Column<CrmEmail>[] = [
    { key: 'on', label: 'On list', type: 'check', width: 96, render: (p) => <MemberBox listId={selected!} email={p.email} on={onList.has(p.email.toLowerCase())} /> },
    { key: 'email', label: 'Email', type: 'text', width: 260, render: (p) => <span className="cell">{p.email}</span> },
    { key: 'name', label: 'Name', type: 'text', width: 200, render: (p) => <span className="cell">{nameOf(p) || '—'}</span> },
    { key: 'source', label: 'Came from', type: 'text', width: 180, render: (p) => <span className="cell">{p.source ?? '—'}</span> },
    { key: 'city', label: 'City', type: 'text', width: 140, render: (p) => <span className="cell">{[p.city, p.state].filter(Boolean).join(', ') || '—'}</span> },
    { key: 'client', label: 'Client', type: 'check', width: 80, render: (p) => <span className="cell">{p.isClient ? '✓' : ''}</span> },
    { key: 'community', label: 'In community', type: 'check', width: 120, render: (p) => <span className="cell">{p.inCommunity ? '✓' : ''}</span> },
  ];

  return (
    <div className="mailstack">
      <AddRow table="mail_lists" fields={[{ key: 'venture', placeholder: 'Venture', options: ventureOpts }, { key: 'name', placeholder: 'List name' }, { key: 'description', placeholder: 'What this list is for', wide: true }]} label="+ Add list" />
      {grid({ ...c, columns, rows: data.lists, rowKey: (r) => r.id, empty: 'No lists yet. Add the first one above, then click its arrow to pick who is on it.' })}
      {list ? (
        <section className="members">
          <div className="dash__head">
            <span className="grid2__foldname">On “{list.name}”</span>
            <span className="muted" style={{ fontSize: 12 }}>{onList.size} of {data.emails.length} addresses</span>
            <input className="members__search" placeholder="Search addresses…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search addresses" />
            <button type="button" className="btn btn--ghost" disabled={pending || !people.length}
              onClick={() => start(async () => { await addManyToList(list.id, people.map((p) => p.email)); })}>
              {pending ? 'Adding…' : `Add all shown (${people.length})`}
            </button>
            <button type="button" className="btn btn--ghost" onClick={() => setSelected(null)}>Close</button>
          </div>
          <Grid rows={people} columns={memberCols} rowKey={(p) => p.email} store={`${c.store}.members`} accent={c.accent}
            empty={needle ? 'No match.' : 'No addresses in CRM › Emails yet.'} />
        </section>
      ) : null}
    </div>
  );
}

function MemberBox({ listId, email, on }: { listId: string; email: string; on: boolean }) {
  const [pending, start] = useTransition();
  return (
    <span className="flagcell">
      <input type="checkbox" className="flagcell__box" checked={on} disabled={pending} aria-label={`${email} on list`}
        onChange={(e) => { const v = e.target.checked; start(async () => { await setListMember(listId, email, v); }); }} />
    </span>
  );
}

// -------------------------------------------------------------- templates

export function Templates({ data, ...c }: Common & { data: MailData }) {
  const [editing, setEditing] = useState<MailTemplate | null>(null);
  const t = text('mail_templates');
  const styleOpts = (Object.keys(MAIL_STYLES) as MailStyle[]).map((k) => ({ value: k, label: MAIL_STYLES[k] }));
  const columns: Column<MailTemplate>[] = [
    { key: 'venture', label: 'Venture', type: 'select', width: 190, render: (r) => <VentureCell table="mail_templates" id={r.id} value={r.venture} /> },
    { key: 'name', label: 'Template', type: 'text', width: 220, render: t('name', 'Template') as never },
    { key: 'subject', label: 'Subject', type: 'text', width: 320, render: t('subject', 'Subject') as never },
    { key: 'style', label: 'Style', type: 'select', width: 170, render: (r) => <Sel table="mail_templates" id={r.id} field="style" value={r.style} options={styleOpts} /> },
    { key: 'body', label: 'Body', type: 'text', width: 360, render: (r) => (
      <span className="cell cell--lead">
        <span className="cell cell--clip">{r.body.trim() ? r.body.trim().split('\n')[0] : <span className="muted">Empty</span>}</span>
        <button type="button" className="btn btn--ghost btn--tiny" onClick={() => setEditing(r)}>Edit</button>
      </span>
    ) },
    { key: 'updated', label: 'Changed', type: 'date', width: 110, render: (r) => <span className="cell muted">{shortDate(r.updatedAt)}</span> },
    { key: 'del', label: 'Delete', type: 'text', width: 60, bare: true, render: (r) => <Remove table="mail_templates" id={r.id} what={r.name} /> },
  ];
  // Keep the editor on the row as it is now, after each save.
  const live = editing ? data.templates.find((x) => x.id === editing.id) ?? null : null;
  return (
    <>
      <AddRow table="mail_templates" fields={[{ key: 'venture', placeholder: 'Venture', options: ventureOpts }, { key: 'name', placeholder: 'Template name' }, { key: 'subject', placeholder: 'Subject line', wide: true }]} label="+ Add template" />
      {grid({ ...c, columns, rows: data.templates, rowKey: (r) => r.id, empty: 'No templates yet. Add one above, then Edit to write the body.' })}
      {live ? <TemplateEditor template={live} senders={data.senders} onClose={() => setEditing(null)} /> : null}
    </>
  );
}

function TemplateEditor({ template, senders, onClose }: { template: MailTemplate; senders: MailSender[]; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [subject, setSubject] = useState(template.subject);
  const [preheader, setPreheader] = useState(template.preheader ?? '');
  const [body, setBody] = useState(template.body);
  const [style, setStyle] = useState<MailStyle>(template.style);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  useEffect(() => {
    const d = ref.current; if (!d) return;
    if (!d.open) d.showModal();
    const closed = () => onClose();
    d.addEventListener('close', closed);
    return () => d.removeEventListener('close', closed);
  }, [onClose]);
  const sender = senders.find((s) => s.venture === template.venture) ?? senders[0];
  const preview = render({
    subject, preheader, body, style,
    recipient: { email: 'someone@example.com', firstName: 'Misty', lastName: 'Example', city: 'Austin', personal: '(the personal line for this person)' },
    quote: '(the quote set on the campaign)', sender: { fromName: sender?.fromName ?? 'Giulia May', address: sender?.address }, unsubscribeUrl: '#',
  });
  function save() {
    setError(null);
    start(async () => {
      for (const [field, value] of [['subject', subject], ['preheader', preheader], ['body', body], ['style', style]] as const) {
        const r = await updateMail('mail_templates', template.id, field, value);
        if (r.error) { setError(r.error); return; }
      }
      ref.current?.close();
    });
  }
  return (
    <dialog ref={ref} className="dialog dialog--wide" onClick={(e) => { if (e.target === ref.current) ref.current?.close(); }}>
      <div className="dialog__body tpl">
        <div className="tpl__form">
          <p className="dialog__title">{template.name}</p>
          <div className="field"><label htmlFor="tpl-subject">Subject</label><input id="tpl-subject" value={subject} onChange={(e) => setSubject(e.target.value)} /></div>
          <div className="field"><label htmlFor="tpl-pre">Preheader <span className="muted">(the grey line after the subject in the inbox)</span></label><input id="tpl-pre" value={preheader} onChange={(e) => setPreheader(e.target.value)} /></div>
          <div className="field"><label htmlFor="tpl-style">Style</label>
            <select id="tpl-style" value={style} onChange={(e) => setStyle(e.target.value as MailStyle)}>{(Object.keys(MAIL_STYLES) as MailStyle[]).map((k) => <option key={k} value={k}>{MAIL_STYLES[k]}</option>)}</select></div>
          <div className="field"><label htmlFor="tpl-body">Body</label>
            <textarea id="tpl-body" rows={14} value={body} onChange={(e) => setBody(e.target.value)} placeholder={'Hi {{first_name}},\n\n{{personal}}\n\nA blank line makes a paragraph. **bold**, *italic*, [a link](https://…).'} /></div>
          <ul className="ph">{PLACEHOLDERS.map((p) => <li key={p.key}><code>{p.key}</code> <span className="muted">{p.what}</span></li>)}</ul>
          {error ? <p className="field__error" role="alert">{error}</p> : null}
          <div className="dialog__actions">
            <button type="button" className="btn btn--ghost" onClick={() => ref.current?.close()} disabled={pending}>Cancel</button>
            <button type="button" className="btn btn--primary" onClick={save} disabled={pending}>{pending ? 'Saving…' : 'Save'}</button>
          </div>
        </div>
        <div className="tpl__preview">
          <p className="tpl__subject"><strong>{preview.subject || <span className="muted">No subject yet</span>}</strong>{preheader ? <span className="muted"> — {preheader}</span> : null}</p>
          <iframe title="Preview" srcDoc={preview.html} sandbox="" />
        </div>
      </div>
    </dialog>
  );
}

// -------------------------------------------------------------- campaigns

export function Campaigns({ data, kind, ...c }: Common & { data: MailData; kind: CampaignKind }) {
  const t = text('mail_campaigns');
  const rows = data.campaigns.filter((x) => x.kind === kind).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const listOpts = data.lists.map((l) => ({ value: l.id, label: `${l.name} (${l.memberCount})` }));
  const tplOpts = data.templates.map((x) => ({ value: x.id, label: x.name }));
  const senderOpts = data.senders.map((s) => ({ value: s.id, label: `${s.fromName} <${s.fromEmail}>` }));
  const sendsBy = useMemo(() => {
    const m = new Map<string, MailSend[]>();
    for (const s of data.sends) m.set(s.campaignId, [...(m.get(s.campaignId) ?? []), s]);
    return m;
  }, [data.sends]);
  const stepsBy = useMemo(() => {
    const m = new Map<string, MailStep[]>();
    for (const s of data.steps) m.set(s.campaignId, [...(m.get(s.campaignId) ?? []), s].sort((a, b) => a.step - b.step));
    return m;
  }, [data.steps]);

  const columns: Column<MailCampaign>[] = [
    { key: 'open', label: 'Open', type: 'text', width: 44, bare: true, render: (r) => <OpenArrow href={`${c.base}?peek=${r.id}`} what={r.name} /> },
    { key: 'name', label: kind === 'sequence' ? 'Sequence' : 'Campaign', type: 'text', width: 240, render: t('name', 'Name') as never },
    { key: 'venture', label: 'Venture', type: 'select', width: 190, render: (r) => <VentureCell table="mail_campaigns" id={r.id} value={r.venture} /> },
    { key: 'list', label: 'List', type: 'select', width: 200, render: (r) => <Sel table="mail_campaigns" id={r.id} field="listId" value={r.listId} options={listOpts} blank="Pick a list" /> },
    ...(kind === 'broadcast'
      ? [{ key: 'template', label: 'Template', type: 'select', width: 200, render: (r: MailCampaign) => <Sel table="mail_campaigns" id={r.id} field="templateId" value={r.templateId} options={tplOpts} blank="Pick a template" /> } as Column<MailCampaign>]
      : [{ key: 'steps', label: 'Steps', type: 'number', width: 80, numeric: true, render: (r: MailCampaign) => <span className="cell">{stepsBy.get(r.id)?.length ?? 0}</span> } as Column<MailCampaign>]),
    { key: 'sender', label: 'From', type: 'select', width: 230, render: (r) => <Sel table="mail_campaigns" id={r.id} field="senderId" value={r.senderId} options={senderOpts} blank="Pick a sender" /> },
    { key: 'sendAt', label: kind === 'sequence' ? 'Starts' : 'Send at', type: 'date', width: 200, render: (r) => <WhenCell id={r.id} value={r.sendAt} /> },
    { key: 'status', label: 'Status', type: 'select', width: 130, render: (r) => <span className={`status status--${CAMPAIGN_TONE[r.status]}`}>{CAMPAIGN_STATUS[r.status]}</span> },
    { key: 'progress', label: 'Recipients', type: 'text', width: 240, render: (r) => <span className="cell muted">{summary(sendsBy.get(r.id) ?? [])}</span> },
    { key: 'notes', label: 'Notes', type: 'text', width: 260, render: t('notes', 'Notes') as never },
    { key: 'del', label: 'Delete', type: 'text', width: 60, bare: true, render: (r) => <Remove table="mail_campaigns" id={r.id} what={r.name} body="Its recipients and their personal lines go with it. Emails already handed to Resend still go." /> },
  ];

  const open = c.peek ? rows.find((r) => r.id === c.peek) ?? null : null;
  return (
    <div className="mailstack">
      {kind === 'broadcast' ? <Senders data={data} store={`${c.store}.senders`} accent={c.accent} /> : null}
      <AddRow table="mail_campaigns" defaults={{ kind }} label={kind === 'sequence' ? '+ Add sequence' : '+ Add campaign'} fields={[
        { key: 'venture', placeholder: 'Venture', options: ventureOpts }, { key: 'name', placeholder: kind === 'sequence' ? 'Sequence name' : 'Campaign name', wide: true },
        { key: 'listId', placeholder: 'List', options: listOpts },
        ...(kind === 'broadcast' ? [{ key: 'templateId', placeholder: 'Template', options: tplOpts }] : []),
        { key: 'senderId', placeholder: 'From', options: senderOpts },
      ]} />
      {grid({ ...c, columns, rows, rowKey: (r) => r.id, empty: kind === 'sequence' ? 'No sequences yet. Add one above.' : 'No campaigns yet. Add one above.' })}
      {kind === 'broadcast' ? <Suppressions data={data} store={`${c.store}.never`} accent={c.accent} /> : null}
      {open ? <CampaignPanel campaign={open} data={data} sends={sendsBy.get(open.id) ?? []} steps={stepsBy.get(open.id) ?? []} closeHref={c.base} accent={c.accent} /> : null}
    </div>
  );
}

function summary(sends: MailSend[]): string {
  if (!sends.length) return 'Not prepared yet';
  const n = (k: string[]) => sends.filter((s) => k.includes(s.status)).length;
  const parts = [
    [n(['planned']), 'planned'], [n(['queued']), 'with Resend'], [n(['sent', 'delivered']), 'delivered'],
    [n(['opened', 'clicked']), 'opened'], [n(['bounced', 'complained', 'failed']), 'failed'], [n(['skipped']), 'skipped'],
  ] as const;
  return parts.filter(([k]) => k > 0).map(([k, w]) => `${k} ${w}`).join(' · ');
}

function WhenCell({ id, value }: { id: string; value: string | null }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="cell cell--lead">
      <input type="datetime-local" className="cellinput" value={isoToBrussels(value)} disabled={pending} aria-label="Send at (Brussels time)"
        onChange={(e) => { const v = e.target.value; setError(null); start(async () => { const r = await updateMail('mail_campaigns', id, 'sendAt', v); if (r.error) setError(r.error); }); }} />
      {error ? <span className="cell__error" title={error}>{error}</span> : null}
    </span>
  );
}

function Senders({ data, store, accent }: { data: MailData; store: string; accent?: string }) {
  const t = text('mail_senders');
  const columns: Column<MailSender>[] = [
    { key: 'venture', label: 'Venture', type: 'select', width: 190, render: (r) => <VentureCell table="mail_senders" id={r.id} value={r.venture} /> },
    { key: 'fromName', label: 'From name', type: 'text', width: 180, render: t('fromName', 'From name') as never },
    { key: 'fromEmail', label: 'From address', type: 'text', width: 240, render: t('fromEmail', 'From address') as never },
    { key: 'replyTo', label: 'Reply to', type: 'text', width: 220, render: t('replyTo', 'Reply to') as never },
    { key: 'address', label: 'Postal address (footer)', type: 'text', width: 360, render: t('address', 'Postal address') as never },
    { key: 'del', label: 'Delete', type: 'text', width: 60, bare: true, render: (r) => <Remove table="mail_senders" id={r.id} what={`${r.fromName} <${r.fromEmail}>`} /> },
  ];
  return (
    <details className="mailsec" open={data.senders.length === 0}>
      <summary><span className="grid2__foldname">Senders</span><span className="muted">{data.senders.length === 0 ? 'Who the emails are from. Add one per venture; the domain must be verified in Resend.' : `${data.senders.length} sender${data.senders.length === 1 ? '' : 's'}`}</span></summary>
      <AddRow table="mail_senders" label="+ Add sender" fields={[
        { key: 'venture', placeholder: 'Venture', options: ventureOpts }, { key: 'fromName', placeholder: 'From name' }, { key: 'fromEmail', placeholder: 'from@yourdomain.com', type: 'email' },
        { key: 'replyTo', placeholder: 'Reply-to (optional)', type: 'email' }, { key: 'address', placeholder: 'Postal address for the footer', wide: true },
      ]} />
      <Grid rows={data.senders} columns={columns} rowKey={(r) => r.id} store={store} accent={accent} empty="No senders yet."
        onColumnSettings={(k, i) => saveGridColumn(store, k, i)} />
    </details>
  );
}

function Suppressions({ data, store, accent }: { data: MailData; store: string; accent?: string }) {
  const [form, setForm] = useState({ email: '', note: '' });
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const reason: Record<MailSuppression['reason'], string> = { unsubscribed: 'Unsubscribed', bounced: 'Bounced', complained: 'Marked spam', manual: 'By hand' };
  const columns: Column<MailSuppression>[] = [
    { key: 'email', label: 'Email', type: 'text', width: 260, render: (r) => <span className="cell">{r.email}</span> },
    { key: 'reason', label: 'Why', type: 'select', width: 140, render: (r) => <span className="cell">{reason[r.reason]}</span> },
    { key: 'note', label: 'Note', type: 'text', width: 320, render: (r) => <span className="cell muted">{r.note ?? ''}</span> },
    { key: 'when', label: 'Since', type: 'date', width: 110, render: (r) => <span className="cell muted">{shortDate(r.createdAt)}</span> },
    { key: 'undo', label: 'Allow again', type: 'text', width: 110, bare: true, render: (r) => <Unsuppress email={r.email} /> },
  ];
  return (
    <details className="mailsec">
      <summary><span className="grid2__foldname">Never email</span><span className="muted">{data.suppressions.length} address{data.suppressions.length === 1 ? '' : 'es'}: unsubscribed, bounced, marked us as spam, or added by hand. Always skipped.</span></summary>
      <form className="addrow" onSubmit={(e) => { e.preventDefault(); setError(null); start(async () => { const r = await suppress(form.email, form.note); if (r.error) setError(r.error); else setForm({ email: '', note: '' }); }); }}>
        <input type="email" placeholder="email@…" aria-label="Email to never write to" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
        <input className="addrow__wide" placeholder="Why (optional)" aria-label="Why" value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} />
        <button type="submit" className="btn btn--primary" disabled={pending}>{pending ? 'Adding…' : '+ Never email'}</button>
        {error ? <span className="cell__error">{error}</span> : null}
      </form>
      <Grid rows={[...data.suppressions].sort((a, b) => b.createdAt.localeCompare(a.createdAt))} columns={columns} rowKey={(r) => r.email} store={store} accent={accent} empty="Nobody yet." />
    </details>
  );
}

function Unsuppress({ email }: { email: string }) {
  const [pending, start] = useTransition();
  return <button type="button" className="btn btn--ghost btn--tiny" disabled={pending} onClick={() => start(async () => { await unsuppress(email); })}>{pending ? '…' : 'Allow again'}</button>;
}

// ------------------------------------------------------------------ panel

function CampaignPanel({ campaign, data, sends, steps, closeHref, accent }: {
  campaign: MailCampaign; data: MailData; sends: MailSend[]; steps: MailStep[]; closeHref: string; accent?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [testTo, setTestTo] = useState('');
  const [testStep, setTestStep] = useState<string>('');
  const [quote, setQuote] = useState(campaign.quote ?? '');
  useEffect(() => { setQuote(campaign.quote ?? ''); }, [campaign.quote]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      const t = e.target as Element | null;
      if (t?.closest('input, textarea, select, dialog') || document.querySelector('dialog[open]')) return;
      router.push(closeHref, { scroll: false });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [closeHref, router]);

  const person = useMemo(() => new Map(data.emails.map((p) => [p.email.toLowerCase(), p])), [data.emails]);
  const list = data.lists.find((l) => l.id === campaign.listId);
  const template = data.templates.find((x) => x.id === campaign.templateId);
  const sender = data.senders.find((s) => s.id === campaign.senderId);
  const isSeq = campaign.kind === 'sequence';
  const future = campaign.sendAt ? new Date(campaign.sendAt).getTime() > Date.now() : false;
  const missing = [
    !list && 'a list', !sender && 'a sender', !isSeq && !template && 'a template', isSeq && !steps.length && 'at least one step',
    isSeq && steps.some((s) => !s.templateId) && 'a template on every step',
  ].filter(Boolean) as string[];
  const planned = sends.filter((s) => s.status === 'planned').length;

  function run(label: string, fn: () => Promise<void>) {
    setBusy(label); setErr(null); setMsg(null);
    fn().catch((e: unknown) => setErr(e instanceof Error ? e.message : 'Something went wrong.')).finally(() => { setBusy(null); router.refresh(); });
  }
  const doPrepare = () => run('Preparing…', async () => {
    const r = await prepareCampaign(campaign.id);
    if (r.error) { setErr(r.error); return; }
    setMsg(`${r.created} recipient${r.created === 1 ? '' : 's'} added${r.skipped ? `, ${r.skipped} skipped (never email)` : ''}.`);
  });
  const doSend = () => run(future ? 'Scheduling…' : 'Sending…', async () => {
    const p = await prepareCampaign(campaign.id);
    if (p.error) { setErr(p.error); return; }
    let total = 0;
    for (let i = 0; i < 200; i++) {
      const r = await sendBatch(campaign.id, 20);
      if (r.error) { setErr(r.error); break; }
      total += r.handed;
      setMsg(`${total} handed to Resend${r.remaining ? `, ${r.remaining} to go` : ''}.`);
      if (r.remaining <= 0) break;
      if (r.handed === 0) { setMsg(`${total} handed to Resend. ${r.remaining} are more than 30 days out and go with the daily tick.`); break; }
    }
  });
  const doTest = () => run('Sending test…', async () => {
    const r = await sendTest(campaign.id, testTo, isSeq ? testStep || steps[0]?.id : null);
    if (r.error) setErr(r.error); else setMsg(`Test sent to ${testTo}.`);
  });
  const doCancel = () => run('Taking back…', async () => {
    const r = await cancelScheduled(campaign.id);
    if (r.error) setErr(r.error); else setMsg(`${r.cancelled} taken back from Resend. The campaign is paused.`);
  });
  const doStatus = (status: 'draft' | 'paused') => run('Saving…', async () => { const r = await updateMail('mail_campaigns', campaign.id, 'status', status); if (r.error) setErr(r.error); });
  const saveQuote = () => { if ((campaign.quote ?? '') !== quote) run('Saving…', async () => { const r = await updateMail('mail_campaigns', campaign.id, 'quote', quote); if (r.error) setErr(r.error); }); };

  const stepById = new Map(steps.map((s) => [s.id, s]));
  const tplOpts = data.templates.map((x) => ({ value: x.id, label: x.name }));
  const stepCols: Column<MailStep>[] = [
    { key: 'step', label: 'Step', type: 'number', width: 90, numeric: true, render: (r) => <span className="cell">{r.step}</span> },
    { key: 'day', label: 'Day', type: 'number', width: 90, numeric: true, render: (r) => <EditableCell kind="text" value={String(r.dayOffset)} label="Day offset" onSave={(v) => updateMail('mail_sequence_steps', r.id, 'dayOffset', v)} /> },
    { key: 'template', label: 'Template', type: 'select', width: 240, render: (r) => <Sel table="mail_sequence_steps" id={r.id} field="templateId" value={r.templateId} options={tplOpts} blank="Pick a template" /> },
    { key: 'del', label: 'Delete', type: 'text', width: 60, bare: true, render: (r) => <Remove table="mail_sequence_steps" id={r.id} what={`step ${r.step}`} /> },
  ];
  const sendCols: Column<MailSend>[] = [
    { key: 'email', label: 'Email', type: 'text', width: 230, render: (r) => <span className="cell">{r.email}</span> },
    { key: 'name', label: 'Name', type: 'text', width: 150, render: (r) => <span className="cell">{nameOf(person.get(r.email.toLowerCase())) || '—'}</span> },
    ...(isSeq ? [{ key: 'step', label: 'Step', type: 'number', width: 60, numeric: true, render: (r: MailSend) => <span className="cell">{r.stepId ? stepById.get(r.stepId)?.step ?? '?' : ''}</span> } as Column<MailSend>] : []),
    { key: 'personal', label: 'Personal line', type: 'text', width: 360, render: (r) => <EditableCell kind="text" value={r.personalLine} label={`Personal line for ${r.email}`} onSave={(v) => setPersonalLine(r.id, v)} /> },
    { key: 'status', label: 'Status', type: 'select', width: 140, render: (r) => <span className={`cell ${['bounced', 'complained', 'failed'].includes(r.status) ? 'is-bad' : ''}`}>{SEND_STATUS[r.status]}</span> },
    { key: 'when', label: 'When', type: 'date', width: 150, render: (r) => <span className="cell muted">{r.sentAt ? shortDate(r.sentAt) : r.scheduledFor ? isoToBrussels(r.scheduledFor).replace('T', ' ') : 'now'}</span> },
    { key: 'error', label: 'Note', type: 'text', width: 260, render: (r) => <span className="cell muted">{r.error ?? ''}</span> },
  ];
  const sorted = [...sends].sort((a, b) => (stepById.get(a.stepId ?? '')?.step ?? 0) - (stepById.get(b.stepId ?? '')?.step ?? 0) || a.email.localeCompare(b.email));

  return (
    <aside className="peek peek--wide" role="dialog" aria-label={campaign.name}>
      <div className="peek__bar">
        <Link href={closeHref} scroll={false} className="peek__btn" aria-label="Close" title="Close (Esc)">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true"><path d="m4 4 8 8M12 4l-8 8" /></svg>
        </Link>
        <span className="peek__title">{campaign.name}</span>
        <span className={`status status--${CAMPAIGN_TONE[campaign.status]}`}>{CAMPAIGN_STATUS[campaign.status]}</span>
      </div>
      <div className="peek__body">
        <dl className="facts">
          <dt>Venture</dt><dd><span className={`lane__dot ${lane(campaign.venture)}`} /> {campaign.venture}</dd>
          <dt>List</dt><dd>{list ? `${list.name} · ${list.memberCount} people` : <span className="is-bad">none picked</span>}</dd>
          {isSeq ? null : <><dt>Template</dt><dd>{template ? template.name : <span className="is-bad">none picked</span>}</dd></>}
          <dt>From</dt><dd>{sender ? `${sender.fromName} <${sender.fromEmail}>` : <span className="is-bad">none picked</span>}</dd>
          <dt>{isSeq ? 'Starts' : 'Send at'}</dt><dd>{campaign.sendAt ? `${isoToBrussels(campaign.sendAt).replace('T', ' ')} Brussels` : 'as soon as you press Send'}</dd>
        </dl>
        <div className="field">
          <label htmlFor="cmp-quote">Quote from you <span className="muted">(goes where the template says {'{{quote}}'})</span></label>
          <textarea id="cmp-quote" rows={2} value={quote} onChange={(e) => setQuote(e.target.value)} onBlur={saveQuote} />
        </div>

        {isSeq ? (
          <section className="panelsec">
            <div className="dash__head"><span className="grid2__foldname">Steps</span><span className="muted" style={{ fontSize: 12 }}>Day 0 is the start; each step goes that many days later.</span></div>
            <AddRow table="mail_sequence_steps" label="+ Add step" defaults={{ campaignId: campaign.id, step: String((steps.at(-1)?.step ?? 0) + 1) }} fields={[
              { key: 'step', placeholder: 'Step', type: 'number' }, { key: 'dayOffset', placeholder: 'Day', type: 'number' }, { key: 'templateId', placeholder: 'Template', options: tplOpts },
            ]} />
            <Grid rows={steps} columns={stepCols} rowKey={(r) => r.id} store="lifework.mailing.steps" accent={accent} empty="No steps yet." />
          </section>
        ) : null}

        {data.resendMissing ? (
          <p className="note note--warn">Nothing can be sent yet: <code>{data.resendMissing}</code> is not set in Vercel. Everything else here works; add the key and redeploy.</p>
        ) : null}
        {missing.length ? <p className="note">Still needed before sending: {missing.join(', ')}.</p> : null}

        <div className="sendbar">
          <button type="button" className="btn btn--ghost" disabled={!!busy || !list} onClick={doPrepare}>{busy === 'Preparing…' ? busy : isSeq ? 'Enrol the list' : 'Prepare recipients'}</button>
          <span className="sendbar__test">
            {isSeq && steps.length > 1 ? (
              <select value={testStep} onChange={(e) => setTestStep(e.target.value)} aria-label="Step to test">{steps.map((s) => <option key={s.id} value={s.id}>Step {s.step}</option>)}</select>
            ) : null}
            <input type="email" placeholder="your@email" aria-label="Send a test to" value={testTo} onChange={(e) => setTestTo(e.target.value)} />
            <button type="button" className="btn btn--ghost" disabled={!!busy || !testTo || !!data.resendMissing || !sender} onClick={doTest}>Send test</button>
          </span>
          {campaign.status === 'paused' ? (
            <button type="button" className="btn btn--ghost" disabled={!!busy} onClick={() => doStatus('draft')}>Resume</button>
          ) : campaign.status === 'scheduled' ? (
            <button type="button" className="btn btn--ghost" disabled={!!busy} onClick={doCancel}>Take back from Resend</button>
          ) : null}
          <button type="button" className="btn btn--primary" disabled={!!busy || !!missing.length || !!data.resendMissing || campaign.status === 'paused'} onClick={doSend}>
            {busy && busy !== 'Preparing…' && busy !== 'Sending test…' ? busy : future ? `Schedule ${planned || list?.memberCount || ''}`.trim() : `Send now ${planned || list?.memberCount || ''}`.trim()}
          </button>
        </div>
        {msg ? <p className="note note--ok" role="status">{msg}</p> : null}
        {err ? <p className="field__error" role="alert">{err}</p> : null}

        <section className="panelsec">
          <div className="dash__head"><span className="grid2__foldname">Recipients</span><span className="muted" style={{ fontSize: 12 }}>{sends.length ? summary(sends) : `Press “${isSeq ? 'Enrol the list' : 'Prepare recipients'}” to list everyone here, then write the personal line per person.`}</span></div>
          <Grid rows={sorted} columns={sendCols} rowKey={(r) => r.id} store="lifework.mailing.sends" accent={accent} empty="Nobody yet." />
        </section>
      </div>
    </aside>
  );
}

