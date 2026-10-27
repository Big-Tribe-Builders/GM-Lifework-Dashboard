/**
 * QuinB Community › Events (Giulia, 27 Oct 2026: "an additional tab with all
 * the events that are planned").
 *
 * The Admin API lists an event once, with its first start and, for a
 * repeating one, its rule (an iCalendar RRULE: "FREQ=MONTHLY;BYDAY=1TH").
 * The dates to come are worked out here, at the event's own clock time in its
 * own time zone, so 19:00 stays 19:00 when summer time starts. A rule this
 * file cannot read is never guessed at: the event shows once, marked as
 * repeating, and QuinB has the rest.
 */

/** An event as the Admin API sends it. Every field is optional: the list's shape is not in the spec. */
export type MnEvent = {
  id: number;
  title?: string | null;
  name?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
  time_zone?: string | null;
  recurrence_rule?: string | null;
  frequency?: string | null;
  space_id?: number | null;
  permalink?: string | null;
};

/** One date of an event. */
export type Occurrence = {
  id: number;
  title: string;
  start: string;
  end: string;
  /** In words: "Every month, the first Thursday". Null for a one-off. */
  repeats: string | null;
  /** The rule could not be read: later dates are in QuinB only. */
  unread: boolean;
  spaceId: number | null;
  permalink: string | null;
};

const MIN = 60_000;
const DAY = 86_400_000;
const WD = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'] as const;
const WD_WORD = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const NTH = ['first', 'second', 'third', 'fourth', 'fifth'];

// ------------------------------------------------------------- time zones

/** Whether the runtime knows this zone (IANA, as "Europe/Brussels"). */
function knownZone(tz: string | null | undefined): tz is string {
  if (!tz) return false;
  try { new Intl.DateTimeFormat('en-GB', { timeZone: tz }); return true; } catch { return false; }
}

type Wall = { y: number; m: number; d: number; h: number; mi: number };

/** The clock on the wall in `tz` at instant `t`. */
function wallOf(t: number, tz: string): Wall {
  const p = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' })
    .formatToParts(new Date(t)).reduce<Record<string, number>>((a, x) => (x.type === 'literal' ? a : { ...a, [x.type]: Number(x.value) }), {});
  return { y: p.year, m: p.month, d: p.day, h: p.hour, mi: p.minute };
}

/** The instant the wall in `tz` shows `w`. */
function instantOf(w: Wall, tz: string): number {
  const guess = Date.UTC(w.y, w.m - 1, w.d, w.h, w.mi);
  // Two rounds: the second settles the hour when the first guess lands across a clock change.
  let t = guess;
  for (let i = 0; i < 2; i++) {
    const s = wallOf(t, tz);
    t += guess - Date.UTC(s.y, s.m - 1, s.d, s.h, s.mi);
  }
  return t;
}

/** "+01:00" at the end of an ISO string, in minutes; 0 for Z or none. */
function offsetOf(iso: string): number {
  const m = /([+-])(\d{2}):?(\d{2})$/.exec(iso.trim());
  if (!m) return 0;
  return (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3]));
}

// ------------------------------------------------------------------ rules

type Rule = {
  freq: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
  interval: number;
  count: number | null;
  until: number | null;
  byDay: { n: number; wd: number }[];
  byMonthDay: number[];
  bySetPos: number[];
};

/** An RRULE, or null when it holds something this file does not do. */
export function parseRule(raw: string | null | undefined): Rule | null {
  if (!raw) return null;
  // It may come as "RRULE:…", or with a DTSTART line before it.
  const line = raw.split(/\r?\n/).map((l) => l.trim()).find((l) => /FREQ=/i.test(l));
  if (!line) return null;
  const parts = Object.fromEntries(line.replace(/^RRULE:/i, '').split(';').filter(Boolean).map((kv) => {
    const [k, v = ''] = kv.split('=');
    return [k.trim().toUpperCase(), v.trim().toUpperCase()];
  }));
  const freq = parts.FREQ;
  if (freq !== 'DAILY' && freq !== 'WEEKLY' && freq !== 'MONTHLY' && freq !== 'YEARLY') return null;
  const known = new Set(['FREQ', 'INTERVAL', 'COUNT', 'UNTIL', 'BYDAY', 'BYMONTHDAY', 'BYSETPOS', 'WKST']);
  if (Object.keys(parts).some((k) => !known.has(k))) return null;
  const interval = parts.INTERVAL ? Number(parts.INTERVAL) : 1;
  const count = parts.COUNT ? Number(parts.COUNT) : null;
  if (!Number.isInteger(interval) || interval < 1 || (count != null && (!Number.isInteger(count) || count < 1))) return null;
  let until: number | null = null;
  if (parts.UNTIL) {
    const u = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})Z?)?$/.exec(parts.UNTIL);
    if (!u) return null;
    // A date alone means the whole of that day.
    until = u[4] ? Date.UTC(+u[1], +u[2] - 1, +u[3], +u[4], +u[5], +u[6]) : Date.UTC(+u[1], +u[2] - 1, +u[3], 23, 59, 59);
  }
  const byDay: Rule['byDay'] = [];
  for (const x of (parts.BYDAY ?? '').split(',').filter(Boolean)) {
    const m = /^([+-]?\d{1,2})?(MO|TU|WE|TH|FR|SA|SU)$/.exec(x);
    if (!m) return null;
    byDay.push({ n: m[1] ? Number(m[1]) : 0, wd: WD.indexOf(m[2] as (typeof WD)[number]) });
  }
  const byMonthDay = (parts.BYMONTHDAY ?? '').split(',').filter(Boolean).map(Number);
  const bySetPos = (parts.BYSETPOS ?? '').split(',').filter(Boolean).map(Number);
  if ([...byMonthDay, ...bySetPos].some((n) => !Number.isInteger(n) || n === 0)) return null;
  return { freq, interval, count, until, byDay, byMonthDay, bySetPos };
}

/** Monday = 0 … Sunday = 6, for a calendar date. */
const weekdayOf = (y: number, m: number, d: number) => (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
const daysIn = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

/** The days of one month a monthly rule picks, in order. */
function monthDays(r: Rule, y: number, m: number, startDay: number): number[] {
  const n = daysIn(y, m);
  let days: number[];
  if (r.byMonthDay.length) {
    days = r.byMonthDay.map((x) => (x > 0 ? x : n + 1 + x)).filter((x) => x >= 1 && x <= n);
  } else if (r.byDay.length) {
    days = [];
    for (const { n: nth, wd } of r.byDay) {
      const all = Array.from({ length: n }, (_, i) => i + 1).filter((d) => weekdayOf(y, m, d) === wd);
      if (nth === 0) days.push(...all);
      else { const pick = nth > 0 ? all[nth - 1] : all[all.length + nth]; if (pick) days.push(pick); }
    }
  } else {
    days = startDay <= n ? [startDay] : [];
  }
  days = [...new Set(days)].sort((a, b) => a - b);
  if (r.bySetPos.length) days = r.bySetPos.map((p) => (p > 0 ? days[p - 1] : days[days.length + p])).filter((x): x is number => x != null).sort((a, b) => a - b);
  return days;
}

/** The rule in her words: "Every week on Wednesday", "Every month, the first Thursday". */
export function ruleWords(r: Rule): string {
  const every = (one: string, many: string) => (r.interval === 1 ? `Every ${one}` : `Every ${r.interval} ${many}`);
  const days = r.byDay.map(({ n, wd }) => (n === 0 ? WD_WORD[wd] : n > 0 ? `the ${NTH[n - 1] ?? `${n}th`} ${WD_WORD[wd]}` : n === -1 ? `the last ${WD_WORD[wd]}` : `${-n} from the end ${WD_WORD[wd]}`));
  let s: string;
  if (r.freq === 'DAILY') s = every('day', 'days');
  else if (r.freq === 'WEEKLY') s = `${every('week', 'weeks')}${days.length ? ` on ${days.join(' and ')}` : ''}`;
  else if (r.freq === 'MONTHLY') {
    const pos = r.bySetPos.length && r.byDay.length && r.byDay.every((d) => d.n === 0)
      ? `, the ${r.bySetPos.map((p) => (p > 0 ? NTH[p - 1] ?? `${p}th` : 'last')).join(' and ')} ${days.join(' or ')}`
      : days.length ? `, ${days.join(' and ')}` : r.byMonthDay.length ? `, on day ${r.byMonthDay.join(' and ')}` : '';
    s = `${every('month', 'months')}${pos}`;
  } else s = every('year', 'years');
  if (r.count) s += `, ${r.count} times`;
  return s;
}

// -------------------------------------------------------------- expansion

/**
 * The dates of `ev` that are not over before `from` and start before `to`.
 * A one-off gives one date or none; a repeating event gives each of its
 * dates in that window, at most `max`.
 */
export function occurrences(ev: MnEvent, from: number, to: number, max = 200): Occurrence[] {
  const startIso = ev.starts_at ?? null;
  const t0 = startIso ? Date.parse(startIso) : NaN;
  if (!startIso || Number.isNaN(t0)) return [];
  const t1 = ev.ends_at ? Date.parse(ev.ends_at) : NaN;
  const length = Number.isNaN(t1) || t1 < t0 ? 60 * MIN : t1 - t0;
  const title = (ev.title ?? ev.name ?? '').trim() || `Event ${ev.id}`;
  const base = { id: ev.id, title, spaceId: ev.space_id ?? null, permalink: ev.permalink ?? null };
  const one = (t: number, repeats: string | null, unread: boolean): Occurrence => ({ ...base, start: new Date(t).toISOString(), end: new Date(t + length).toISOString(), repeats, unread });

  const raw = ev.recurrence_rule?.trim() || null;
  const rule = parseRule(raw);
  if (!rule) {
    // A repeating event whose rule this file cannot read: its first date only, marked.
    const repeating = !!raw || !!ev.frequency;
    return t0 + length > from && t0 < to ? [one(t0, repeating ? 'Repeats (the later dates are in QuinB)' : null, repeating)] : [];
  }

  // The clock time and the calendar of the event's own zone; without a zone the start's own offset.
  const zone = knownZone(ev.time_zone) ? ev.time_zone : null;
  const off = offsetOf(startIso);
  const wall0 = zone ? wallOf(t0, zone) : (() => { const d = new Date(t0 + off * MIN); return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(), h: d.getUTCHours(), mi: d.getUTCMinutes() }; })();
  const at = (y: number, m: number, d: number) => (zone ? instantOf({ y, m, d, h: wall0.h, mi: wall0.mi }, zone) : Date.UTC(y, m - 1, d, wall0.h, wall0.mi) - off * MIN);
  const words = ruleWords(rule);

  const out: Occurrence[] = [];
  let made = 0;
  const take = (t: number): boolean => {
    if (t < t0) return true;
    if (rule.until != null && t > rule.until) return false;
    if (rule.count != null && made >= rule.count) return false;
    made++;
    if (t >= to) return false;
    if (t + length > from) out.push(one(t, words, false));
    return out.length < max;
  };

  const startDate = Date.UTC(wall0.y, wall0.m - 1, wall0.d);
  // Enough periods to pass `to` even for a rule that picks few days.
  for (let i = 0, guard = 0; guard < 5000; i++, guard++) {
    let dates: [number, number, number][] = [];
    if (rule.freq === 'DAILY') {
      const d = new Date(startDate + i * rule.interval * DAY);
      dates = [[d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()]];
    } else if (rule.freq === 'WEEKLY') {
      const monday = startDate - weekdayOf(wall0.y, wall0.m, wall0.d) * DAY + i * rule.interval * 7 * DAY;
      const wds = rule.byDay.length ? [...new Set(rule.byDay.map((x) => x.wd))].sort((a, b) => a - b) : [weekdayOf(wall0.y, wall0.m, wall0.d)];
      dates = wds.map((wd) => { const d = new Date(monday + wd * DAY); return [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()]; });
    } else if (rule.freq === 'MONTHLY') {
      const k = wall0.m - 1 + i * rule.interval;
      const y = wall0.y + Math.floor(k / 12), m = (k % 12) + 1;
      dates = monthDays(rule, y, m, wall0.d).map((d) => [y, m, d]);
    } else {
      const y = wall0.y + i * rule.interval;
      dates = wall0.d <= daysIn(y, wall0.m) ? [[y, wall0.m, wall0.d]] : [];
    }
    let more = true;
    for (const [y, m, d] of dates) { if (!take(at(y, m, d))) { more = false; break; } }
    if (!more) break;
    // Past the window and past the start: nothing later can fall inside it.
    const last = dates.length ? at(...dates[dates.length - 1]) : null;
    if (last != null && last >= to) break;
    if (rule.freq !== 'DAILY' && rule.freq !== 'WEEKLY' && i > 12 * 40) break;
  }
  return out;
}
