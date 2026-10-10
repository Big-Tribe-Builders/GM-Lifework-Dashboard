/**
 * The Goal Navigator: yearly goals → quarterly goals → action points.
 *
 * Her Notion structure, kept as three tables in Supabase. Every row has a
 * venture so one board holds all three businesses.
 */

export const VENTURES = ['Big Tribe Builders', 'QuinB Academy', 'Giulia May'] as const;
export type Venture = (typeof VENTURES)[number];

export type GoalStatus = 'todo' | 'doing' | 'done' | 'parked';
export const GOAL_STATUS: Record<GoalStatus, string> = { todo: 'To do', doing: 'Doing', done: 'Done', parked: 'Parked' };
export const GOAL_TONE: Record<GoalStatus, string> = { todo: 'sleeping', doing: 'active', done: 'done', parked: 'archived' };

export type YearGoal = {
  id: string;
  year: number;
  venture: string;
  title: string;
  status: GoalStatus;
  notes: string | null;
  sortOrder: number;
};

export type QuarterGoal = {
  id: string;
  quarter: string;          // '2026-Q4'
  venture: string;
  yearGoalId: string | null;
  title: string;
  status: GoalStatus;
  notes: string | null;
  sortOrder: number;
};

export type ActionPoint = {
  id: string;
  quarter: string;
  venture: string;
  quarterGoalId: string | null;
  title: string;
  owner: string | null;
  status: GoalStatus;
  doDate: string | null;
  dueDate: string | null;
  priority: 'high' | 'normal' | 'low' | null;
  notes: string | null;
  sortOrder: number;
  updatedAt?: string | null;
};

export const thisQuarter = (d = new Date()) => `${d.getUTCFullYear()}-Q${Math.floor(d.getUTCMonth() / 3) + 1}`;
export const quarterOf = (iso: string) => thisQuarter(new Date(iso));

/** Share of a goal's action points that are done, 0..1, or null with none. */
export function progressOf(goal: QuarterGoal, actions: ActionPoint[]): number | null {
  const mine = actions.filter((a) => a.quarterGoalId === goal.id);
  if (!mine.length) return null;
  return mine.filter((a) => a.status === 'done').length / mine.length;
}

/** The quarter after this one: '2026-Q4' → '2027-Q1'. */
export function nextQuarter(q: string): string {
  const y = Number(q.slice(0, 4)); const n = Number(q.slice(6));
  return n >= 4 ? `${y + 1}-Q1` : `${y}-Q${n + 1}`;
}

/** The months of a quarter: '2026-Q4' → 'Oct – Dec'. */
export function quarterMonths(q: string): string {
  const M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const n = Number(q.slice(6));
  return n >= 1 && n <= 4 ? `${M[(n - 1) * 3]} – ${M[(n - 1) * 3 + 2]}` : '';
}

/** '2026-Q4' → 'Q4 2026', the way it is said. */
export const quarterLabel = (q: string) => (/^\d{4}-Q[1-4]$/.test(q) ? `${q.slice(5)} ${q.slice(0, 4)}` : q);

/**
 * The people on a run of action points, from the "Who" field as she writes
 * it: "Giulia & Marty" is two people. Each name once, as first written.
 */
export function ownersOf(actions: ActionPoint[]): string[] {
  const seen = new Map<string, string>();
  for (const a of actions) {
    for (const part of (a.owner ?? '').split(/\s*(?:&|,|\+|\/|\band\b)\s*/i)) {
      const n = part.trim();
      if (n && !seen.has(n.toLowerCase())) seen.set(n.toLowerCase(), n);
    }
  }
  return [...seen.values()];
}
