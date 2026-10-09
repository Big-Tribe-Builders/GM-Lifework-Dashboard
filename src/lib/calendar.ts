/**
 * Calendar arithmetic for the content plan: years → months → weeks → days.
 *
 * A week runs Monday to Sunday and belongs to the month its Monday falls in,
 * so every week sits under exactly one month. Everything here works on plain
 * 'YYYY-MM-DD' strings in UTC, so a server in another time zone draws the
 * same calendar.
 */

export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;
export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'] as const;

const iso = (d: Date) => d.toISOString().slice(0, 10);
const utc = (s: string) => new Date(`${s}T00:00:00Z`);

export const addDays = (s: string, n: number) => { const d = utc(s); d.setUTCDate(d.getUTCDate() + n); return iso(d); };

/** 1 = Monday … 7 = Sunday. */
export const weekday = (s: string) => ((utc(s).getUTCDay() + 6) % 7) + 1;

/** The Monday of the week a date is in. */
export const mondayOf = (s: string) => addDays(s, 1 - weekday(s));

/** 'YYYY-MM' of a date. */
export const monthOf = (s: string) => s.slice(0, 7);

/** The Mondays whose week belongs to this month ('2027-01'). */
export function weeksOfMonth(month: string): string[] {
  const first = `${month}-01`;
  let m = mondayOf(first);
  if (monthOf(m) !== month) m = addDays(m, 7);
  const out: string[] = [];
  while (monthOf(m) === month) { out.push(m); m = addDays(m, 7); }
  return out;
}

/** The seven dates of the week starting on this Monday. */
export const daysOfWeek = (monday: string) => Array.from({ length: 7 }, (_, i) => addDays(monday, i));

/** '2027-01' → 'January 2027'. */
export const monthLabel = (month: string) => `${MONTHS[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`;

/** '2027-01-04' → 'Mon 4 Jan'. */
export function dayLabel(s: string): string {
  const d = utc(s);
  return `${WEEKDAYS[weekday(s) - 1].slice(0, 3)} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()].slice(0, 3)}`;
}

/** The months from `from` ('2026-10') to `to` ('2027-12'), inclusive. */
export function monthsBetween(from: string, to: string): string[] {
  const out: string[] = [];
  let [y, m] = from.split('-').map(Number);
  const [ty, tm] = to.split('-').map(Number);
  while (y < ty || (y === ty && m <= tm)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`);
    m += 1; if (m > 12) { m = 1; y += 1; }
  }
  return out;
}

export const todayIso = () => iso(new Date());
