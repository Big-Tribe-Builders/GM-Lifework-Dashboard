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
