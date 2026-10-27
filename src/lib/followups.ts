import type { QuinbMember } from '@/lib/book';

/**
 * QuinB Community › Follow-ups (Giulia, 27 Oct 2026, after Thomas Burbidge's
 * client progress tracker): who to write to today, and every follow-up
 * tracked until the member answers or comes back.
 *
 * Every limit is here, and the tab's help text says the same numbers. Days
 * are Brussels days: a visit at 00:30 in Brussels on 28 September is a visit
 * on the 28th, whatever the server's clock says.
 */

/** Keep an eye on: this many days without a visit, up to WRITE_FROM. */
export const WATCH_FROM = 14;
/** Write now: this many days without a visit, up to WIN_BACK_FROM. */
export const WRITE_FROM = 30;
/** Win back: this many days without a visit, or never. */
export const WIN_BACK_FROM = 90;
/** Waiting for an answer: this many days after she wrote; then they return to their group. */
export const WAIT_DAYS = 7;
/** "Visited in the last 30 days", and "Answered your messages" of the follow-ups of the last 30 days. */
export const RECENT_DAYS = 30;
/** Pause 30 days. */
export const PAUSE_DAYS = 30;

/** Said when migration 0025 has not run: the columns and tables it adds are missing. */
export const DB_STEP = 'The database step for Follow-ups is not done yet (migration 0025_quinb_followups.sql).';

export type FollowupVia = 'sent' | 'by_hand';
export type Followup = {
  id: string; memberId: string; writtenAt: string; via: FollowupVia;
  message: string | null; note: string | null;
  conversationId: string | null; conversationUrl: string | null;
  answeredAt: string | null; answeredHow: 'chat' | 'by_hand' | null; answerStart: string | null;
};

export type Group = 'write' | 'watch' | 'winback' | 'waiting';
export const GROUPS: { key: Group | 'all'; label: string }[] = [
  { key: 'write', label: 'Write now' },
  { key: 'watch', label: 'Keep an eye on' },
  { key: 'winback', label: 'Win back' },
  { key: 'waiting', label: 'Waiting for an answer' },
  { key: 'all', label: 'All' },
];

// ------------------------------------------------------------------ days

/** The Brussels day of an instant, 'YYYY-MM-DD'. */
export function brusselsDay(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return d.toLocaleDateString('en-CA', { timeZone: 'Europe/Brussels' });
}
export const todayBrussels = () => brusselsDay(new Date());
const utc = (day: string) => Date.UTC(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10));
/** Whole days from one Brussels day to another. */
export const daysBetween = (from: string, to: string) => Math.round((utc(to) - utc(from)) / 86_400_000);
export const addDay = (day: string, n: number) => new Date(utc(day) + n * 86_400_000).toISOString().slice(0, 10);

/** The day of the last visit: from the exact time when the refresh has it, else the stored day. */
export const lastVisitDay = (m: QuinbMember): string | null => (m.lastActiveAt ? brusselsDay(m.lastActiveAt) : m.lastLogin ?? null);

/** Days since the last visit; null when there never was one. */
export function daysAway(m: QuinbMember, today: string): number | null {
  const d = lastVisitDay(m);
  return d ? Math.max(0, daysBetween(d, today)) : null;
}

/** The group the days without a visit put a member in, before any follow-up. */
export function dayGroup(days: number | null): Exclude<Group, 'waiting'> | null {
  if (days == null || days >= WIN_BACK_FROM) return 'winback';
  if (days >= WRITE_FROM) return 'write';
  if (days >= WATCH_FROM) return 'watch';
  return null;
}

// ----------------------------------------------------------- who counts

/** Why a member is not in the follow-ups, or null when they are. */
export function leftOutBecause(m: QuinbMember, today: string): string | null {
  if (m.leftQuinbAt) return 'No longer in QuinB';
  if (!m.seenAt) return 'Not read from QuinB yet';
  if (m.membershipStatus !== 'ACTIVE') return m.membershipStatus ? `Membership ${m.membershipStatus.toLowerCase()}` : 'No active membership';
  if (m.memberType !== 'FULL_MEMBER') return 'Limited member (cannot get a private message)';
  if (m.role === 'HOST' || m.role === 'MODERATOR') return m.role === 'HOST' ? 'Host' : 'Moderator';
  if (m.followupOff) return 'Left out of follow-ups';
  if (m.pausedUntil && m.pausedUntil >= today) return `Paused until ${shortDay(m.pausedUntil)}`;
  return null;
}

// ------------------------------------------------------------ follow-ups

export type FollowupState =
  | { kind: 'answered'; on: string }
  | { kind: 'came_back'; on: string }
  | { kind: 'waiting'; until: string }
  | { kind: 'no_answer' };

/** Where a follow-up stands: answered, the member came back, still waiting, or no answer after WAIT_DAYS. */
export function stateOf(f: Followup, m: QuinbMember, today: string): FollowupState {
  if (f.answeredAt) return { kind: 'answered', on: brusselsDay(f.answeredAt) };
  if (m.lastActiveAt && Date.parse(m.lastActiveAt) > Date.parse(f.writtenAt)) return { kind: 'came_back', on: brusselsDay(m.lastActiveAt) };
  const written = brusselsDay(f.writtenAt);
  if (daysBetween(written, today) < WAIT_DAYS) return { kind: 'waiting', until: addDay(written, WAIT_DAYS) };
  return { kind: 'no_answer' };
}

const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "12 Oct"; with the year when it is not this year's. */
export function shortDay(day: string, today = todayBrussels()): string {
  const s = `${Number(day.slice(8, 10))} ${MONTH[Number(day.slice(5, 7)) - 1]}`;
  return day.slice(0, 4) === today.slice(0, 4) ? s : `${s} ${day.slice(0, 4)}`;
}

/** The words for a follow-up in the list and the history. */
export function stateWords(f: Followup, s: FollowupState, today: string): { chip: string; status: string } {
  const wrote = `Wrote ${shortDay(brusselsDay(f.writtenAt), today)}`;
  switch (s.kind) {
    case 'answered': return { chip: `Answered ${shortDay(s.on, today)}`, status: `Answered on ${shortDay(s.on, today)}` };
    case 'came_back': return { chip: `Came back ${shortDay(s.on, today)}`, status: `Came back on ${shortDay(s.on, today)}` };
    case 'waiting': return { chip: `${wrote}, waiting`, status: 'Waiting' };
    default: return { chip: `${wrote}, no answer`, status: `No answer after ${WAIT_DAYS} days` };
  }
}

// ------------------------------------------------------------------ plan

export type Row = {
  member: QuinbMember;
  days: number | null;
  group: Group | null;
  /** Why the member is not counted, or null. */
  out: string | null;
  last: Followup | null;
  lastState: FollowupState | null;
  chip: string | null;
};

export type Plan = {
  rows: Row[];
  lists: Record<Group, Row[]>;
  counted: number;
  visitedRecently: number;
  /** Follow-ups written in the last RECENT_DAYS days, and how many of them were answered. */
  recentFollowups: number;
  recentAnswered: number;
};

const byName = (a: Row, b: Row) => a.member.name.localeCompare(b.member.name);

/**
 * Every member with their group. Counted: in QuinB, an active full member,
 * not a host or moderator, not left out, not paused. A follow-up of the last
 * WAIT_DAYS days without an answer puts them in "Waiting"; after that they
 * are back in the group their days without a visit give them, with the chip
 * of that last follow-up. An answer, or a visit after her message, ends it.
 */
export function planOf(members: QuinbMember[], followups: Followup[], today: string): Plan {
  const byMember = new Map<string, Followup[]>();
  for (const f of followups) byMember.set(f.memberId, [...(byMember.get(f.memberId) ?? []), f]);
  for (const list of byMember.values()) list.sort((a, b) => Date.parse(b.writtenAt) - Date.parse(a.writtenAt));

  const rows: Row[] = members.map((m) => {
    const days = daysAway(m, today);
    const out = leftOutBecause(m, today);
    const last = byMember.get(m.id)?.[0] ?? null;
    const lastState = last ? stateOf(last, m, today) : null;
    const group: Group | null = out ? null : lastState?.kind === 'waiting' ? 'waiting' : dayGroup(days);
    return { member: m, days, group, out, last, lastState, chip: last && lastState ? stateWords(last, lastState, today).chip : null };
  });

  const pick = (g: Group) => rows.filter((r) => r.group === g);
  const lists: Record<Group, Row[]> = {
    // Oldest visit first.
    write: pick('write').sort((a, b) => (b.days ?? 0) - (a.days ?? 0) || byName(a, b)),
    watch: pick('watch').sort((a, b) => (b.days ?? 0) - (a.days ?? 0) || byName(a, b)),
    // Most recent visit first, never last: the likeliest to come back on top.
    winback: pick('winback').sort((a, b) => (a.days ?? Infinity) - (b.days ?? Infinity) || byName(a, b)),
    // Written to longest ago first: the first to return to their group.
    waiting: pick('waiting').sort((a, b) => Date.parse(a.last!.writtenAt) - Date.parse(b.last!.writtenAt) || byName(a, b)),
  };
  const counted = rows.filter((r) => !r.out);
  const recent = followups.filter((f) => daysBetween(brusselsDay(f.writtenAt), today) < RECENT_DAYS);
  return {
    rows: [...rows].sort(byName),
    lists,
    counted: counted.length,
    visitedRecently: counted.filter((r) => r.days != null && r.days < RECENT_DAYS).length,
    recentFollowups: recent.length,
    recentAnswered: recent.filter((f) => f.answeredAt).length,
  };
}

export const percent = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : null);
