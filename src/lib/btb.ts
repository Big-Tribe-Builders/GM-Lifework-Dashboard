/**
 * Big Tribe Builders' launch plan: the roadmap, the experiments, the playbook.
 *
 * All three are tables in Supabase, edited in place from the grid. Nothing
 * here is seeded in code: the rows are hers.
 */

export type PlanItem = {
  id: string;
  quarter: string;        // '2026-Q4'
  track: string | null;   // the lane: Re-engage clients, Webinars, …
  title: string;
  owner: string | null;
  status: 'todo' | 'doing' | 'done' | 'parked';
  startDate: string | null;
  endDate: string | null;
  progress: number;       // 0–100
  notes: string | null;
  sortOrder: number;
  updatedAt?: string | null;
};

export type Experiment = {
  id: string;
  title: string;
  hypothesis: string | null;
  channel: string | null;
  owner: string | null;
  status: 'idea' | 'running' | 'done' | 'dropped';
  startDate: string | null;
  endDate: string | null;
  result: string | null;
  learning: string | null;
  sortOrder: number;
};

export type PlaybookEntry = {
  id: string;
  framework: string;      // StoryBrand, Purple Cow, …
  step: string;
  question: string;
  answer: string | null;
  sortOrder: number;
};

export const PLAN_STATUS: Record<PlanItem['status'], string> = {
  todo: 'To do', doing: 'Doing', done: 'Done', parked: 'Parked',
};
export const EXP_STATUS: Record<Experiment['status'], string> = {
  idea: 'Idea', running: 'Running', done: 'Done', dropped: 'Dropped',
};

/** The weeks of a quarter, for the timeline. '2026-Q4' → 13 Mondays. */
export function quarterWeeks(q: string): Date[] {
  const m = /^(\d{4})-Q([1-4])$/.exec(q);
  if (!m) return [];
  const start = new Date(Date.UTC(Number(m[1]), (Number(m[2]) - 1) * 3, 1));
  const out: Date[] = [];
  for (let i = 0; i < 13; i++) out.push(new Date(start.getTime() + i * 7 * 86400000));
  return out;
}

/** Where a date lands in the quarter, 0..1, clamped. */
export function quarterPos(q: string, iso: string | null): number | null {
  if (!iso) return null;
  const weeks = quarterWeeks(q);
  if (!weeks.length) return null;
  const a = weeks[0].getTime(), b = a + 13 * 7 * 86400000;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.min(1, Math.max(0, (t - a) / (b - a)));
}

/** The quarter today falls in, e.g. '2026-Q4'. */
export function thisQuarter(d = new Date()): string {
  return `${d.getUTCFullYear()}-Q${Math.floor(d.getUTCMonth() / 3) + 1}`;
}
