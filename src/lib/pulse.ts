import type { PlanItem } from '@/lib/btb';
import type { CrmEmail } from '@/lib/crm';
import type { UpworkLead } from '@/lib/upwork';

/**
 * Pulse: the rules.
 *
 * Nothing here knows anything. Each rule reads what she typed — a roadmap
 * line's end date and % done, the date an email was added, who wrote last in
 * an Upwork room — and compares it with today. True → a line. A ticked line
 * is hidden until its key changes (a new deadline, a new message).
 */

export type Signal = {
  key: string;             // stable while the situation is the same
  kind: 'late' | 'soon' | 'stalled' | 'unstarted' | 'reply' | 'new';
  text: string;
  detail: string | null;
  href: string;
  rule: string;            // which rule fired, in plain words
};

const DAY = 86400000;
const days = (iso: string, now: Date) => Math.round((new Date(iso).getTime() - now.getTime()) / DAY);
const ago = (iso: string, now: Date) => -days(iso, now);
const week = (now: Date) => `${now.getUTCFullYear()}-W${Math.ceil(((now.getTime() - Date.UTC(now.getUTCFullYear(), 0, 1)) / DAY + 1) / 7)}`;

export const PULSE_RULES = [
  'A roadmap line ends within 5 days, or has ended, and is not Done or Parked.',
  'A roadmap line is Doing but nothing on it changed for 7 days.',
  'A roadmap line should have started (start date passed) and is still To do at 0 %.',
  'An Upwork conversation where they wrote last and you have not replied.',
  'Addresses added to the CRM email list in the last 7 days (one line, with the count).',
];

export function pulseFor(
  plan: PlanItem[], emails: CrmEmail[], leads: UpworkLead[], dismissed: Set<string>, now = new Date(),
): Signal[] {
  const out: Signal[] = [];
  const push = (s: Signal) => { if (!dismissed.has(s.key)) out.push(s); };
  const road = '/d/big-tribe-builders/roadmap';

  for (const p of plan) {
    if (p.status === 'done' || p.status === 'parked') continue;
    if (p.endDate) {
      const d = days(p.endDate, now);
      if (d < 0) push({ key: `plan:${p.id}:late:${p.endDate}`, kind: 'late', text: `"${p.title}" ended ${-d} day${d === -1 ? '' : 's'} ago`, detail: `${p.progress} % done`, href: road, rule: PULSE_RULES[0] });
      else if (d <= 5) push({ key: `plan:${p.id}:soon:${p.endDate}`, kind: 'soon', text: `"${p.title}" ends ${d === 0 ? 'today' : d === 1 ? 'tomorrow' : `in ${d} days`}`, detail: `${p.progress} % done`, href: road, rule: PULSE_RULES[0] });
    }
    if (p.status === 'doing' && p.updatedAt && ago(p.updatedAt, now) >= 7) {
      push({ key: `plan:${p.id}:stalled:${week(now)}`, kind: 'stalled', text: `Nothing moved on "${p.title}" for ${ago(p.updatedAt, now)} days`, detail: `${p.progress} % done`, href: road, rule: PULSE_RULES[1] });
    }
    if (p.status === 'todo' && p.progress === 0 && p.startDate && days(p.startDate, now) < 0) {
      push({ key: `plan:${p.id}:unstarted:${p.startDate}`, kind: 'unstarted', text: `"${p.title}" should have started ${-days(p.startDate, now)} days ago`, detail: 'still To do', href: road, rule: PULSE_RULES[2] });
    }
  }

  for (const l of leads) {
    if (l.needsReply) {
      push({ key: `upwork:${l.id}:${l.lastMessageAt ?? ''}`, kind: 'reply', text: `${l.name} is waiting for your reply on Upwork`, detail: l.jobTitle ?? l.lastMessage?.slice(0, 80) ?? null, href: '/d/upwork/messages', rule: PULSE_RULES[3] });
    }
  }

  const fresh = emails.filter((e) => e.createdAt && ago(e.createdAt, now) <= 7).length;
  if (fresh > 0) {
    push({ key: `crm:new:${week(now)}`, kind: 'new', text: `${fresh} new address${fresh === 1 ? '' : 'es'} in the CRM this week`, detail: null, href: '/d/clients/emails', rule: PULSE_RULES[4] });
  }

  const order: Record<Signal['kind'], number> = { late: 0, reply: 1, soon: 2, unstarted: 3, stalled: 4, new: 5 };
  return out.sort((a, b) => order[a.kind] - order[b.kind]);
}
