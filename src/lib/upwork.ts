/**
 * Upwork — the top of the funnel.
 *
 * One row per conversation, read from the freelancer account only. A room
 * becomes a client the moment it has a contract; everything before that is
 * still a lead. Nothing here is written back to Upwork.
 *
 * Money is kept in two numbers because Upwork reports two: `billed` is what
 * the client paid, `earned` is what arrived after Upwork's fee. The revenue
 * she recognises is `earned`; `billed` is what the client thinks they spent.
 */

export type LeadStatus = 'lead' | 'client' | 'lost';

export type UpworkLead = {
  id: string;
  accountId: string;
  name: string;
  status: LeadStatus;
  clientCompanyId: string | null;

  roomUrl: string | null;
  roomType: string | null;
  firstContactAt: string | null;
  lastActivityAt: string | null;
  /** 'you' when the ball is in her court, 'them' when she is waiting. */
  awaitingReply: string | null;
  unread: number;

  /** The last message in the room, and whether she wrote it. */
  lastMessage?: string | null;
  lastMessageAt?: string | null;
  lastMessageFromSelf?: boolean | null;
  /** Generated in the database: true when the last message was theirs. */
  needsReply?: boolean | null;

  hadAppointment: boolean;
  notes: string | null;

  proposalSent: boolean;
  proposalId: string | null;
  proposalUrl: string | null;
  proposalText: string | null;
  jobTitle: string | null;
  jobUrl: string | null;
  rate: number | null;
  rateCurrency: string;

  contractId: string | null;
  contractStatus: string | null;
  contractTitle: string | null;

  billedTotal: number;
  earnedTotal: number;

  syncedAt: string | null;
  updatedAt: string | null;
};

export type UpworkInvoice = {
  id: number;
  accountId: string;
  leadId: string | null;
  clientName: string;
  jobTitle: string;
  /** Upwork's own billing year, which runs 22 September to 21 September. */
  periodFrom: string;
  periodTo: string;
  billed: number;
  earned: number;
  fee: number;
  currency: string;
};

// ------------------------------------------------------------------ labels

export const CONTRACT_LABEL: Record<string, string> = {
  ACTIVE: 'Running',
  PAUSED: 'Paused',
  CLOSED: 'Ended',
};

/** Which chip class a contract state borrows. Colour decorates, never means. */
export const CONTRACT_TONE: Record<string, string> = {
  ACTIVE: 'active',
  PAUSED: 'sleeping',
  CLOSED: 'done',
};

export const ROOM_LABEL: Record<string, string> = {
  INTERVIEW: 'Job',
  ONE_ON_ONE: 'Direct',
  GROUP: 'Group',
};

// --------------------------------------------------------------- selectors

/** Newest conversation first — the order the Upwork inbox itself uses. */
export function byActivity(rows: UpworkLead[]): UpworkLead[] {
  return [...rows].sort((a, b) => (b.lastActivityAt ?? '').localeCompare(a.lastActivityAt ?? ''));
}

/** Anyone who signed a contract. This is what the Clients tab lists. */
export function clientsOnly(rows: UpworkLead[]): UpworkLead[] {
  return rows.filter((r) => r.status === 'client' || Boolean(r.contractId));
}

/**
 * What a lead has been paid, from the invoice rows rather than the stored
 * total. The invoices are the record; the total on the lead is a cache, and
 * a cache that disagrees with its source is worth catching early.
 */
export function moneyFor(invoices: UpworkInvoice[], leadId: string) {
  const mine = invoices.filter((i) => i.leadId === leadId);
  return {
    billed: mine.reduce((sum, i) => sum + Number(i.billed), 0),
    earned: mine.reduce((sum, i) => sum + Number(i.earned), 0),
    years: mine.length,
  };
}

/** Invoiced per Upwork billing year, newest year first. */
export function byYear(invoices: UpworkInvoice[], leadId: string) {
  const years = new Map<string, { billed: number; earned: number }>();
  for (const i of invoices.filter((x) => x.leadId === leadId)) {
    const key = i.periodTo.slice(0, 4);
    const acc = years.get(key) ?? { billed: 0, earned: 0 };
    acc.billed += Number(i.billed);
    acc.earned += Number(i.earned);
    years.set(key, acc);
  }
  return [...years.entries()]
    .map(([year, v]) => ({ year, ...v }))
    .sort((a, b) => b.year.localeCompare(a.year));
}

// ----------------------------------------------------------------- format

/** Whole dollars. Cents on a lifetime total are noise. */
export function money(n: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency, maximumFractionDigits: 0,
  }).format(n);
}

/** 3 Mar 2026. Short enough for a cell, unambiguous across locales. */
export function shortDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  }).format(d);
}
