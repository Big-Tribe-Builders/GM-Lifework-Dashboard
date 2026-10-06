import type { PlanItem } from '@/lib/btb';

/**
 * Pulse: the rules.
 *
 * Nothing here knows anything. Each rule reads what she typed — a roadmap
 * line's end date, start date and % done — and compares it with today. True → a line. A ticked line
 * is hidden until its key changes (a new deadline, a new message).
 */

export type Signal = {
  key: string;             // stable while the situation is the same
  kind: 'late' | 'soon' | 'stalled' | 'unstarted';
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
];

export function pulseFor(plan: PlanItem[], dismissed: Set<string>, now = new Date()): Signal[] {
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

  const order: Record<Signal['kind'], number> = { late: 0, soon: 1, unstarted: 2, stalled: 3 };
  return out.sort((a, b) => order[a.kind] - order[b.kind]);
}
