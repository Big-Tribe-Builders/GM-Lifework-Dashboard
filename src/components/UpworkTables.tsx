'use client';

import type { UpworkLead, UpworkInvoice } from '@/lib/upwork';
import {
  byActivity, clientsOnly, moneyFor, money, shortDate,
  CONTRACT_LABEL, CONTRACT_TONE, ROOM_LABEL,
} from '@/lib/upwork';
import { Grid, type Column } from '@/components/Grid';

/**
 * The two Upwork grids.
 *
 * Both are the same grid with a different column spec. Filtering comes from
 * the toolbar search as a URL parameter, so there is no control inside the
 * table itself — Airtable keeps the table surface for data only.
 */

const dash = <span className="grid2__dash">—</span>;

function openCell(url: string | null) {
  return url
    ? <a className="grid2__link" href={url} target="_blank" rel="noreferrer">Open ↗</a>
    : dash;
}

// ---------------------------------------------------------------- messages

export function MessagesGrid({ leads, q = '' }: { leads: UpworkLead[]; q?: string }) {
  const needle = q.trim().toLowerCase();
  // Rooms where they wrote last come first: that is the work.
  const rows = byActivity(leads)
    .filter((l) => !needle || l.name.toLowerCase().includes(needle))
    .sort((a, b) => Number(Boolean(b.needsReply)) - Number(Boolean(a.needsReply)));

  const columns: Column<UpworkLead>[] = [
    { key: 'name', label: 'Name', type: 'text', width: 280, render: (l) => l.name },
    { key: 'reply', label: 'Waiting for you', type: 'check', width: 150,
      render: (l) => (l.needsReply ? <span className="status status--contact">Reply</span> : dash) },
    { key: 'type', label: 'Type', type: 'select', width: 110,
      render: (l) => (l.roomType ? (ROOM_LABEL[l.roomType] ?? l.roomType) : dash) },
    { key: 'last', label: 'Last message', type: 'date', width: 150,
      render: (l) => shortDate(l.lastActivityAt) },
    { key: 'client', label: 'Became a client', type: 'check', width: 150,
      render: (l) => (l.contractId ? <span className="status status--active">Yes</span> : dash) },
    { key: 'open', label: 'Conversation', type: 'link', width: 130,
      render: (l) => openCell(l.roomUrl) },
  ];

  return (
    <Grid
      rows={rows}
      columns={columns}
      rowKey={(l) => l.id}
      store="lifework.upwork.messages.cols"
      empty="No conversation matches."
    />
  );
}

// ----------------------------------------------------------------- clients

export function UpworkClientsGrid({ leads, invoices, q = '' }: {
  leads: UpworkLead[];
  invoices: UpworkInvoice[];
  q?: string;
}) {
  type Row = { lead: UpworkLead; billed: number; earned: number };

  const all: Row[] = clientsOnly(leads)
    .map((l) => {
      const m = moneyFor(invoices, l.id);
      // The invoice rows are the record. When none carry this room — a
      // contract that never billed, or one Upwork bills under another name —
      // the total stored on the lead is what there is.
      return {
        lead: l,
        billed: m.years > 0 ? m.billed : Number(l.billedTotal),
        earned: m.years > 0 ? m.earned : Number(l.earnedTotal),
      };
    })
    .sort((a, b) => b.earned - a.earned);

  const needle = q.trim().toLowerCase();
  const rows = all.filter(({ lead }) =>
    !needle
    || lead.name.toLowerCase().includes(needle)
    || (lead.contractTitle ?? '').toLowerCase().includes(needle));

  const columns: Column<Row>[] = [
    { key: 'name', label: 'Client', type: 'text', width: 240, render: (r) => r.lead.name },
    { key: 'contract', label: 'Contract', type: 'text', width: 280,
      render: (r) => r.lead.contractTitle ?? dash },
    { key: 'signed', label: 'Signed', type: 'date', width: 130,
      render: (r) => shortDate(r.lead.firstContactAt) },
    { key: 'state', label: 'Status', type: 'select', width: 120,
      render: (r) => (r.lead.contractStatus ? (
        <span className={`status status--${CONTRACT_TONE[r.lead.contractStatus] ?? 'archived'}`}>
          {CONTRACT_LABEL[r.lead.contractStatus] ?? r.lead.contractStatus}
        </span>
      ) : dash) },
    { key: 'billed', label: 'Invoiced', type: 'currency', width: 130, numeric: true,
      render: (r) => money(r.billed, r.lead.rateCurrency) },
    { key: 'earned', label: 'Earned', type: 'currency', width: 130, numeric: true,
      render: (r) => money(r.earned, r.lead.rateCurrency) },
    { key: 'open', label: 'Conversation', type: 'link', width: 130,
      render: (r) => openCell(r.lead.roomUrl) },
  ];

  return (
    <Grid
      rows={rows}
      columns={columns}
      rowKey={(r) => r.lead.id}
      store="lifework.upwork.clients.cols"
      empty="No client matches."
    />
  );
}
