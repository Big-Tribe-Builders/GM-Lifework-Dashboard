'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import type { ColumnSetting } from '@/lib/grid';
import {
  POST_STATUS, POST_TONE, POST_STATUSES, BANNER_BUCKET, AUDIENCES, POST_KINDS,
  type PostStatus, type QuinbPost, type QuinbPostType, type QuinbYear, type QuinbMonth, type QuinbWeek,
} from '@/lib/quinb';
import { WEEKDAYS, MONTHS, weeksOfMonth, daysOfWeek, dayLabel, monthLabel, weekday, addDays, todayIso } from '@/lib/calendar';
import { addPost, updatePost, removePost, savePlan, addPostType, updatePostType, removePostType } from '@/app/d/quinb/actions';
import { saveGridColumn } from '@/app/d/actions';
import { getSupabase } from '@/lib/supabase';
import { Grid, type Column } from '@/components/Grid';
import { EditableCell } from '@/components/EditableCell';
import { AddRow, Remove, Sel, DateCell, OpenArrow } from '@/components/rowkit';
import { Field, CloseLink, usePanelKeys } from '@/components/panel';
import { shortDate } from '@/lib/upwork';

/**
 * QuinB Community › Content strategy, Daily post types, Posts.
 *
 * The plan is her Notion Content Strategy: a year theme, monthly themes, a
 * theme and a plan per week, and every day a post of that weekday's type.
 * Rows for a year, month or week are created on the first save, never as
 * empty placeholders. Posting into Mighty Networks is by hand: the app has
 * no connection to the QuinB network.
 */

type Result = { error: string | null };
const statusOpts = POST_STATUSES.map((k) => ({ value: k, label: POST_STATUS[k] }));
const isApproved = (s: PostStatus) => s === 'approved' || s === 'scheduled' || s === 'posted';

// ------------------------------------------------------------------ plan

/** Covers rotate through the four brand colours: decoration, never meaning (docs/DESIGN.md). */
const TONES = ['violet', 'red', 'green', 'orange'] as const;
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * The open year and month live in the address (?year=2027&month=2027-03), so
 * a reload or a link opens the same place. Written with history, not the
 * router: a choice here needs nothing new from the server.
 */
function remember(params: Record<string, string>) {
  const next = new URLSearchParams(window.location.search);
  for (const [k, v] of Object.entries(params)) next.set(k, v);
  window.history.replaceState(window.history.state, '', `${window.location.pathname}?${next.toString()}`);
}

/**
 * QuinB Community › Content strategy (Giulia, 17 Oct 2026): the years as a
 * gallery of cards; a year opens its months as a second gallery under it;
 * a month opens its weeks as a list, each week folding open to its theme,
 * its plan and a post for every day.
 */
export function Plan({ years, months, weeks, types, posts, postsHref }: {
  years: QuinbYear[]; months: QuinbMonth[]; weeks: QuinbWeek[]; types: QuinbPostType[]; posts: QuinbPost[];
  /** Where a post opens: the Posts tab with ?peek=. */
  postsHref: string;
}) {
  const today = todayIso();
  const thisYear = Number(today.slice(0, 4));
  // The years with a plan, and this year and the next, which always have a card.
  const yearList = useMemo(() => [...new Set([
    ...years.map((y) => y.year), ...months.map((m) => Number(m.month.slice(0, 4))), thisYear, thisYear + 1,
  ])].sort((a, b) => a - b), [years, months, thisYear]);

  const params = useSearchParams();
  const [year, setYear] = useState(() => {
    const y = Number(params.get('year'));
    return yearList.includes(y) ? y : thisYear;
  });
  const monthsOfYear = MONTH_SHORT.map((_, i) => `${year}-${String(i + 1).padStart(2, '0')}`);
  const [month, setMonth] = useState(() => {
    const m = params.get('month') ?? '';
    return m.startsWith(`${year}-`) && /^\d{4}-(0[1-9]|1[0-2])$/.test(m) ? m : year === thisYear ? today.slice(0, 7) : `${year}-01`;
  });
  const pickYear = (y: number) => {
    const m = y === thisYear ? today.slice(0, 7) : `${y}-01`;
    setYear(y); setMonth(m); remember({ year: String(y), month: m });
  };
  const pickMonth = (m: string) => { setMonth(m); remember({ year: String(year), month: m }); };

  const yearRow = (y: number) => years.find((r) => r.year === y);
  const monthRow = useMemo(() => new Map(months.map((m) => [m.month, m])), [months]);
  const weekRow = useMemo(() => new Map(weeks.map((w) => [w.monday, w])), [weeks]);
  const typeByDay = useMemo(() => new Map(types.map((t) => [t.weekday, t])), [types]);
  const postsByDay = useMemo(() => {
    const m = new Map<string, QuinbPost[]>();
    for (const p of posts) if (p.plannedFor) m.set(p.plannedFor, [...(m.get(p.plannedFor) ?? []), p]);
    return m;
  }, [posts]);
  const planned = (y: number) => months.filter((m) => m.month.startsWith(`${y}-`) && m.theme).length;
  const postsIn = (mondays: string[]) => mondays.flatMap(daysOfWeek).flatMap((d) => postsByDay.get(d) ?? []);

  const y = yearRow(year);
  const m = monthRow.get(month);
  const mondays = weeksOfMonth(month);
  const mPosts = postsIn(mondays);

  return (
    <div className="plan">
      <Gallery label="Years" active={String(year)}>
        {yearList.map((yy, i) => {
          const row = yearRow(yy);
          const n = planned(yy);
          return (
            <CoverCard key={yy} id={String(yy)} size="year" tone={TONES[i % 4]} cover={row?.coverUrl ?? null} big={String(yy)}
              title={String(yy)} subtitle={row?.theme ?? null} meta={n ? `${n} of 12 months planned` : 'No months planned yet'}
              active={yy === year} onPick={() => pickYear(yy)} />
          );
        })}
      </Gallery>

      <section className="plan__level" aria-label={`${year}`}>
        <LevelHead title={String(year)} theme={y?.theme ?? null} empty="No theme for this year yet" editLabel="Edit year" startOpen={!y?.theme} key={`yh-${year}`}>
          <div className="plan__fields">
            <Field wide label="Theme of the year" value={y?.theme ?? null} onSave={(v) => savePlan('year', String(year), 'theme', v)} />
            <label className="pfield">
              <span className="pfield__label">Audience</span>
              <Sel value={y?.audience ?? ''} blank="—" options={AUDIENCES.map((a) => ({ value: a, label: a }))} label="Audience"
                onChange={(v) => savePlan('year', String(year), 'audience', v)} />
            </label>
            <Field label="Focus" value={y?.focus ?? null} onSave={(v) => savePlan('year', String(year), 'focus', v)} />
            <Field label="Goal" value={y?.goal ?? null} onSave={(v) => savePlan('year', String(year), 'goal', v)} />
            <Field wide multiline rows={2} label="Notes" value={y?.notes ?? null} onSave={(v) => savePlan('year', String(year), 'notes', v)} />
          </div>
          <Banner noun="cover" url={y?.coverUrl ?? null} alt={`Cover of ${year}`} prefix={`cover-${year}`}
            note={y?.coverUrl ? undefined : 'No picture: the card shows a designed cover.'}
            onSave={(url) => savePlan('year', String(year), 'coverUrl', url)} />
        </LevelHead>

        <Gallery label={`Months of ${year}`} active={month}>
          {monthsOfYear.map((mm, i) => {
            const row = monthRow.get(mm);
            const n = postsIn(weeksOfMonth(mm)).length;
            return (
              <CoverCard key={mm} id={mm} size="month" tone={TONES[i % 4]} cover={row?.coverUrl ?? null} big={MONTH_SHORT[i]}
                title={MONTHS[i]} subtitle={row?.theme ?? null} meta={n ? `${n} post${n === 1 ? '' : 's'}` : null}
                active={mm === month} onPick={() => pickMonth(mm)} />
            );
          })}
        </Gallery>

        <section className="plan__level plan__level--month" aria-label={monthLabel(month)}>
          <LevelHead title={monthLabel(month)} theme={m?.theme ?? null} empty="No theme for this month yet" editLabel="Edit month"
            startOpen={!m?.theme} key={`mh-${month}`}
            extra={mPosts.length ? `${mPosts.length} post${mPosts.length === 1 ? '' : 's'} · ${mPosts.filter((p) => isApproved(p.status)).length} approved` : null}>
            <div className="plan__fields">
              <Field wide label="Monthly theme" value={m?.theme ?? null} onSave={(v) => savePlan('month', month, 'theme', v)} />
              <Field label="Focus" value={m?.focus ?? null} onSave={(v) => savePlan('month', month, 'focus', v)} />
              <Field label="Goal" value={m?.goal ?? null} onSave={(v) => savePlan('month', month, 'goal', v)} />
              <Field wide multiline rows={3} label="Note" placeholder="What we do this month, in your words." value={m?.note ?? null} onSave={(v) => savePlan('month', month, 'note', v)} />
              <Field label="Link to NotebookLM" placeholder="https://notebooklm.google.com/…" value={m?.notebooklmUrl ?? null} onSave={(v) => savePlan('month', month, 'notebooklmUrl', v)} />
            </div>
            <Banner noun="cover" url={m?.coverUrl ?? null} alt={`Cover of ${monthLabel(month)}`} prefix={`cover-${month}`}
              note={m?.coverUrl ? undefined : 'No picture: the card shows a designed cover.'}
              onSave={(url) => savePlan('month', month, 'coverUrl', url)} />
          </LevelHead>
          <Weeks key={month} mondays={mondays} weekRow={weekRow} typeByDay={typeByDay} postsByDay={postsByDay} postsHref={postsHref} today={today} />
        </section>
      </section>
    </div>
  );
}

/** A row of cards that slides sideways, with buttons to slide and the chosen card kept in view. */
function Gallery({ label, active, children }: { label: string; active: string; children: React.ReactNode }) {
  const track = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ start: true, end: true });
  const measure = () => {
    const el = track.current;
    if (!el) return;
    setEdge({ start: el.scrollLeft <= 2, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 2 });
  };
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    el.querySelector<HTMLElement>(`[data-card="${CSS.escape(active)}"]`)?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [active]);
  const slide = (dir: number) => track.current?.scrollBy({ left: dir * track.current.clientWidth * 0.8, behavior: 'smooth' });
  return (
    <div className="gallery" role="group" aria-label={label}>
      <button type="button" className="gallery__nav" aria-label={`${label}: back`} disabled={edge.start} onClick={() => slide(-1)}>‹</button>
      <div className="gallery__track" ref={track} onScroll={measure}>{children}</div>
      <button type="button" className="gallery__nav" aria-label={`${label}: further`} disabled={edge.end} onClick={() => slide(1)}>›</button>
    </div>
  );
}

/** A card in a gallery: her picture, or a designed cover; under it the name and the theme. */
function CoverCard({ id, size, tone, cover, big, title, subtitle, meta, active, onPick }: {
  id: string; size: 'year' | 'month'; tone: string; cover: string | null; big: string;
  title: string; subtitle: string | null; meta: string | null; active: boolean; onPick: () => void;
}) {
  return (
    <button type="button" data-card={id} className={`ccard ccard--${size}${active ? ' ccard--on' : ''}`} aria-pressed={active} onClick={onPick}>
      <span className={`ccard__cover ccard__cover--${tone}`}>
        {cover
          // eslint-disable-next-line @next/next/no-img-element -- her own picture, drawn as it is
          ? <img src={cover} alt="" loading="lazy" />
          : <span className="ccard__big" aria-hidden="true">{big}</span>}
      </span>
      <span className="ccard__body">
        <span className="ccard__title">{title}</span>
        <span className={`ccard__sub${subtitle ? '' : ' ccard__sub--none'}`}>{subtitle ?? 'No theme yet'}</span>
        {meta ? <span className="ccard__meta">{meta}</span> : null}
      </span>
    </button>
  );
}

/** The chosen year or month: its name and theme, and its fields behind "Edit". */
function LevelHead({ title, theme, empty, editLabel, startOpen, extra, children }: {
  title: string; theme: string | null; empty: string; editLabel: string; startOpen: boolean; extra?: string | null; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(startOpen);
  return (
    <div className="plan__levelhead">
      <div className="plan__levelrow">
        <h2 className="plan__leveltitle">{title}</h2>
        <span className={`plan__leveltheme${theme ? '' : ' muted'}`}>{theme ?? empty}</span>
        {extra ? <span className="muted plan__count">{extra}</span> : null}
        <button type="button" className="btn btn--ghost btn--tiny plan__edit" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? 'Done' : editLabel}</button>
      </div>
      {open ? <div className="plan__levelbody">{children}</div> : null}
    </div>
  );
}

/** A month's weeks as a list; each folds open to its theme, its plan and its days. */
function Weeks({ mondays, weekRow, typeByDay, postsByDay, postsHref, today }: {
  mondays: string[]; weekRow: Map<string, QuinbWeek>; typeByDay: Map<number, QuinbPostType>;
  postsByDay: Map<string, QuinbPost[]>; postsHref: string; today: string;
}) {
  // The week holding today starts open; otherwise the first.
  const [open, setOpen] = useState<Record<string, boolean>>(() => {
    const now = mondays.find((d) => d <= today && today <= addDays(d, 6));
    return mondays.length ? { [now ?? mondays[0]]: true } : {};
  });
  const all = mondays.every((d) => open[d]);
  return (
    <div className="plan__weeks">
      <div className="plan__weekbar">
        <span className="plan__weekcount">{mondays.length} weeks</span>
        <button type="button" className="btn btn--ghost btn--tiny" onClick={() => setOpen(all ? {} : Object.fromEntries(mondays.map((d) => [d, true])))}>
          {all ? 'Close all' : 'Open all'}
        </button>
      </div>
      {mondays.map((monday, wi) => {
        const w = weekRow.get(monday);
        const isOpen = !!open[monday];
        const wPosts = daysOfWeek(monday).flatMap((d) => postsByDay.get(d) ?? []);
        return (
          <div key={monday} className={`plan__week${isOpen ? ' is-open' : ''}`}>
            <div className="plan__head plan__head--week">
              <button type="button" className="plan__toggle" aria-expanded={isOpen} onClick={() => setOpen((o) => ({ ...o, [monday]: !o[monday] }))}>
                <span className="plan__caret">{isOpen ? '▾' : '▸'}</span>Week {wi + 1}
                <span className="muted plan__dates">{dayLabel(monday)} – {dayLabel(addDays(monday, 6))}</span>
              </button>
              <span className="plan__theme">{w?.theme ? w.theme : <span className="muted">no week theme yet</span>}</span>
              <span className="muted plan__count">{wPosts.length}/7</span>
            </div>
            {isOpen ? (
              <div className="plan__body plan__body--week">
                <div className="plan__fields" key={monday}>
                  <Field wide label="Week theme" value={w?.theme ?? null} onSave={(v) => savePlan('week', monday, 'theme', v)} />
                  <Field wide multiline rows={3} label="What we do this week" placeholder="Explain the week: what members do, learn, share." value={w?.plan ?? null} onSave={(v) => savePlan('week', monday, 'plan', v)} />
                </div>
                <div className="plan__days">
                  {daysOfWeek(monday).map((day) => (
                    <DayRow key={day} day={day} type={typeByDay.get(weekday(day))} posts={postsByDay.get(day) ?? []} postsHref={postsHref} />
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function DayRow({ day, type, posts, postsHref }: { day: string; type?: QuinbPostType; posts: QuinbPost[]; postsHref: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const add = () => {
    setError(null);
    start(async () => {
      const r = await addPost({ title: type?.title ?? `Post for ${dayLabel(day)}`, plannedFor: day, postTypeId: type?.id ?? '', status: 'idea' });
      if (r.error) setError(r.error);
    });
  };
  return (
    <div className="plan__day">
      <span className="plan__dayname">{dayLabel(day)}</span>
      <span className="plan__type">{type ? type.title : <span className="muted">no post type for {WEEKDAYS[weekday(day) - 1]}</span>}</span>
      <span className="plan__posts">
        {posts.map((p) => (
          <Link key={p.id} href={`${postsHref}?peek=${p.id}`} className="plan__post">
            <span className={`status status--${POST_TONE[p.status]}`}>{POST_STATUS[p.status]}</span>
            <span className="plan__posttitle">{p.title}</span>
          </Link>
        ))}
        {posts.length === 0 ? <button type="button" className="btn btn--ghost btn--tiny" disabled={pending} onClick={add}>{pending ? 'Adding…' : '+ Add post'}</button> : null}
        {error ? <span className="cell__error">{error}</span> : null}
      </span>
    </div>
  );
}

// ------------------------------------------------------- daily post types

const dayOpts = WEEKDAYS.map((d, i) => ({ value: String(i + 1), label: d }));
const kindOpts = POST_KINDS.map((k) => ({ value: k, label: k }));

export function PostTypes({ rows, settings, accent, store, peek, base }: {
  rows: QuinbPostType[]; settings?: Record<string, ColumnSetting>; accent?: string; store: string; peek?: string; base: string;
}) {
  const sorted = [...rows].sort((a, b) => a.weekday - b.weekday);
  const taken = new Set(rows.map((r) => r.weekday));
  const free = dayOpts.filter((d) => !taken.has(Number(d.value)));
  const text = (field: 'title' | 'hour' | 'space' | 'postedBy', label: string) => (r: QuinbPostType) => (
    <EditableCell kind="text" value={r[field]} label={`${label}, ${WEEKDAYS[r.weekday - 1]}`} onSave={(v) => updatePostType(r.id, field, v)} />
  );
  const columns: Column<QuinbPostType>[] = [
    { key: 'open', label: 'Open', type: 'text', width: 44, bare: true, render: (r) => <OpenArrow href={`${base}?peek=${r.id}`} what={r.title} /> },
    { key: 'day', label: 'Day', type: 'select', width: 140, render: (r) => <Sel value={String(r.weekday)} options={dayOpts} label="Day" onChange={(v) => updatePostType(r.id, 'weekday', v)} /> },
    { key: 'title', label: 'Post title', type: 'text', width: 300, render: text('title', 'Post title') },
    { key: 'kind', label: 'Post type', type: 'select', width: 140, render: (r) => <Sel value={r.kind} blank="—" options={kindOpts} label="Post type" onChange={(v) => updatePostType(r.id, 'kind', v)} /> },
    { key: 'hour', label: 'Hour of posting', type: 'text', width: 130, render: text('hour', 'Hour of posting') },
    { key: 'space', label: 'Community space', type: 'text', width: 200, render: text('space', 'Community space') },
    { key: 'postedBy', label: 'Posted by', type: 'text', width: 160, render: text('postedBy', 'Posted by') },
    { key: 'banner', label: 'Banner', type: 'text', width: 96, render: (r) => <span className="cell">{r.bannerUrl ? <img className="banner__thumb" src={r.bannerUrl} alt="" /> : <span className="muted">—</span>}</span> },
    { key: 'filled', label: 'Purpose · prompt · example', type: 'text', width: 200, render: (r) => (
      <span className="cell muted">{[r.purpose, r.prompt, r.example].map((t) => (t.trim() ? '●' : '○')).join(' ')}</span>
    ) },
    { key: 'del', label: 'Delete', type: 'text', width: 60, bare: true, render: (r) => <Remove what={r.title} body="Posts that follow it keep their text; they lose the link to this type." onRemove={() => removePostType(r.id)} /> },
  ];
  const open = peek ? rows.find((r) => r.id === peek) ?? null : null;
  return (
    <div className="mailstack">
      {free.length ? (
        <AddRow label="+ Add post type" defaults={{ weekday: free[0].value }} onAdd={(f) => addPostType(f)} fields={[
          { key: 'weekday', placeholder: 'Day', options: free }, { key: 'title', placeholder: 'Post title, e.g. the series name', wide: true },
          { key: 'kind', placeholder: 'Post type', options: kindOpts },
        ]} />
      ) : null}
      <Grid rows={sorted} columns={columns} rowKey={(r) => r.id} store={store} settings={settings} accent={accent}
        onColumnSettings={(k, i) => saveGridColumn(store, k, i)}
        empty="No daily post types yet. Add one per weekday above, then open it to write the purpose, prompt and example." />
      {open ? <TypePanel key={open.id} type={open} closeHref={base} /> : null}
    </div>
  );
}

function TypePanel({ type, closeHref }: { type: QuinbPostType; closeHref: string }) {
  usePanelKeys(closeHref);
  return (
    <aside className="peek peek--wide chapter" role="dialog" aria-label={type.title}>
      <div className="peek__bar">
        <CloseLink href={closeHref} />
        <span className="peek__title">{WEEKDAYS[type.weekday - 1]} · {type.title}</span>
      </div>
      <div className="peek__body chapter__body">
        <Banner url={type.bannerUrl} alt={`Banner for ${type.title}`} prefix={`types/${type.id}`} onSave={(u) => updatePostType(type.id, 'bannerUrl', u)} />
        <Field multiline rows={6} label="Post purpose" placeholder="What this day's post does in the weekly rhythm." value={type.purpose} onSave={(v) => updatePostType(type.id, 'purpose', v)} />
        <Field multiline rows={10} label="Post prompt" placeholder="The instruction a draft is written from: format, length, structure, tone." value={type.prompt} onSave={(v) => updatePostType(type.id, 'prompt', v)} />
        <Field multiline rows={12} label="Post example" placeholder="A worked example of a finished post." value={type.example} onSave={(v) => updatePostType(type.id, 'example', v)} />
      </div>
    </aside>
  );
}

// ------------------------------------------------------------------ posts

export function Posts({ rows, types, settings, accent, store, peek, base, empty = 'No posts yet. Add them here or from a day in the Content strategy.' }: {
  rows: QuinbPost[]; types: QuinbPostType[]; settings?: Record<string, ColumnSetting>; accent?: string; store: string; peek?: string; base: string; empty?: string;
}) {
  // Planned date first, undated ones last, then by title.
  const sorted = [...rows].sort((a, b) =>
    (a.plannedFor ?? '9999').localeCompare(b.plannedFor ?? '9999') || a.title.localeCompare(b.title) || a.id.localeCompare(b.id));
  const typeOpts = [...types].sort((a, b) => a.weekday - b.weekday).map((t) => ({ value: t.id, label: `${WEEKDAYS[t.weekday - 1].slice(0, 3)} · ${t.title}` }));
  const text = (field: 'title' | 'space', label: string) => (r: QuinbPost) => (
    <EditableCell kind="text" value={r[field]} label={`${label} of ${r.title}`} onSave={(v) => updatePost(r.id, field, v)} />
  );
  const columns: Column<QuinbPost>[] = [
    { key: 'open', label: 'Open', type: 'text', width: 44, bare: true, render: (r) => <OpenArrow href={`${base}?peek=${r.id}`} what={r.title} /> },
    { key: 'banner', label: 'Banner', type: 'text', width: 96, render: (r) => (
      <span className="cell">{r.bannerUrl ? <img className="banner__thumb" src={r.bannerUrl} alt="" /> : <span className="muted">—</span>}</span>
    ) },
    { key: 'title', label: 'Post', type: 'text', width: 300, render: text('title', 'Title') },
    { key: 'type', label: 'Daily post type', type: 'select', width: 220, render: (r) => (
      <Sel value={r.postTypeId} blank="—" options={typeOpts} label="Daily post type" onChange={(v) => updatePost(r.id, 'postTypeId', v)} />
    ) },
    { key: 'planned', label: 'Post date', type: 'date', width: 150, render: (r) => <DateCell value={r.plannedFor} label={`Post date, ${r.title}`} onSave={(v) => updatePost(r.id, 'plannedFor', v)} /> },
    { key: 'status', label: 'Progress', type: 'select', width: 130, render: (r) => (
      <Sel value={r.status} options={statusOpts} className={`status status--${POST_TONE[r.status]} status--select`} label="Progress" onChange={(v) => updatePost(r.id, 'status', v)} />
    ) },
    { key: 'space', label: 'Space', type: 'text', width: 160, render: text('space', 'Space') },
    { key: 'posted', label: 'Post link', type: 'link', width: 200, render: (r) => (
      <EditableCell kind="link" value={r.postedUrl} label={`Post link of ${r.title}`} onSave={(v) => updatePost(r.id, 'postedUrl', v)} />
    ) },
    { key: 'del', label: 'Delete', type: 'text', width: 60, bare: true, render: (r) => <Remove what={r.title} onRemove={() => removePost(r.id)} /> },
  ];
  const open = peek ? rows.find((r) => r.id === peek) ?? null : null;
  const openType = open?.postTypeId ? types.find((t) => t.id === open.postTypeId) ?? null : null;
  return (
    <div className="mailstack">
      <AddRow label="+ Add post" onAdd={(f) => addPost(f)} fields={[
        { key: 'title', placeholder: 'Post title', wide: true }, { key: 'plannedFor', placeholder: 'Post date', type: 'date' },
        { key: 'postTypeId', placeholder: 'Daily post type', options: typeOpts },
      ]} />
      <Grid rows={sorted} columns={columns} rowKey={(r) => r.id} store={store} settings={settings} accent={accent}
        onColumnSettings={(k, i) => saveGridColumn(store, k, i)} empty={empty} />
      {open ? <PostPanel key={open.id} post={open} type={openType} closeHref={base} /> : null}
    </div>
  );
}

function PostPanel({ post, type, closeHref }: { post: QuinbPost; type: QuinbPostType | null; closeHref: string }) {
  const [body, setBody] = useState(post.body);
  const [state, setState] = useState<'idle' | 'dirty' | 'saving' | 'saved' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [, start] = useTransition();

  function save() {
    if (body === post.body) { setState((s) => (s === 'dirty' ? 'idle' : s)); return; }
    setState('saving'); setError(null);
    start(async () => {
      const r = await updatePost(post.id, 'body', body);
      if (r.error) { setState('error'); setError(r.error); } else setState((s) => (s === 'dirty' ? s : 'saved'));
    });
  }
  usePanelKeys(closeHref, save);

  async function copy() {
    try { await navigator.clipboard.writeText(`${post.title}\n\n${body}`); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    catch { setError('The browser did not allow copying. Select the text and copy it by hand.'); }
  }

  return (
    <aside className="peek peek--wide chapter" role="dialog" aria-label={post.title}>
      <div className="peek__bar">
        <CloseLink href={closeHref} />
        <span className="peek__title">{post.title}</span>
        <span className="chapter__meta muted">{state === 'saving' ? 'Saving…' : state === 'saved' ? 'Saved' : state === 'dirty' ? 'Unsaved — click away or Ctrl+S' : state === 'error' ? 'Not saved' : ''}</span>
        <button type="button" className="btn btn--ghost btn--tiny" onClick={copy}>{copied ? 'Copied' : 'Copy text'}</button>
        <Sel value={post.status} options={statusOpts} className={`status status--${POST_TONE[post.status]} status--select`} label="Progress" onChange={(v) => updatePost(post.id, 'status', v)} />
      </div>
      <div className="peek__body chapter__body">
        <Banner url={post.bannerUrl ?? type?.bannerUrl ?? null} alt={`Banner for ${post.title}`} prefix={`posts/${post.id}`}
          note={!post.bannerUrl && type?.bannerUrl ? 'This is the daily post type’s banner. Upload one to use a different banner for this post.' : undefined}
          onSave={(u) => updatePost(post.id, 'bannerUrl', u)} />
        <dl className="facts">
          <dt>Post date</dt><dd>{post.plannedFor ? `${dayLabel(post.plannedFor)} ${post.plannedFor.slice(0, 4)}` : <span className="muted">not set</span>}</dd>
          <dt>Post type</dt><dd>{type ? `${WEEKDAYS[type.weekday - 1]} · ${type.title}${type.kind ? ` · ${type.kind}` : ''}` : <span className="muted">none</span>}</dd>
          <dt>Space</dt><dd>{post.space ?? type?.space ?? <span className="muted">not set</span>}</dd>
          <dt>Post link</dt><dd>{post.postedUrl ? <a href={post.postedUrl} target="_blank" rel="noreferrer">{post.postedUrl}</a> : <span className="muted">not posted yet</span>}</dd>
        </dl>
        {type && (type.purpose.trim() || type.prompt.trim()) ? (
          <details className="typebrief">
            <summary>What a {WEEKDAYS[type.weekday - 1]} post does</summary>
            {type.purpose.trim() ? <p className="typebrief__text">{type.purpose}</p> : null}
            {type.prompt.trim() ? <p className="typebrief__text muted">{type.prompt}</p> : null}
          </details>
        ) : null}
        <textarea className="chapter__text post__text" placeholder="The text of the post. A blank line makes a paragraph." aria-label="Post text"
          value={body} onChange={(e) => { setBody(e.target.value); setState('dirty'); }} onBlur={save} />
        {error ? <p className="field__error" role="alert">{error}</p> : null}
      </div>
    </aside>
  );
}

// ---------------------------------------------------------------- shared

const MAX_BYTES = 5 * 1024 * 1024;

function Banner({ url, alt, prefix, note, onSave, noun = 'banner' }: { url: string | null; alt: string; prefix: string; note?: string; onSave: (url: string) => Promise<Result>; noun?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setError(null);
    if (!file.type.startsWith('image/')) { setError('Pick an image: PNG, JPG, WebP or GIF.'); return; }
    if (file.size > MAX_BYTES) { setError('The image is larger than 5 MB.'); return; }
    const db = getSupabase();
    if (!db) { setError('Supabase is not configured.'); return; }
    setBusy(true);
    const ext = (file.name.split('.').pop() ?? 'png').toLowerCase().replace(/[^a-z0-9]/g, '') || 'png';
    const path = `${prefix}-${Date.now()}.${ext}`;
    const { error: upErr } = await db.storage.from(BANNER_BUCKET).upload(path, file, { contentType: file.type, upsert: false });
    if (upErr) { setBusy(false); setError(upErr.message); return; }
    const { data } = db.storage.from(BANNER_BUCKET).getPublicUrl(path);
    const r = await onSave(data.publicUrl);
    setBusy(false);
    if (r.error) setError(r.error);
  }

  return (
    <div className="banner">
      {url ? <img className="banner__img" src={url} alt={alt} /> : <div className="banner__empty">No {noun} yet</div>}
      {note ? <p className="muted banner__note">{note}</p> : null}
      <div className="banner__actions">
        <input ref={input} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden
          onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void upload(f); }} />
        <button type="button" className="btn btn--ghost btn--tiny" disabled={busy} onClick={() => input.current?.click()}>
          {busy ? 'Uploading…' : url && !note ? `Replace ${noun}` : `Upload ${noun}`}
        </button>
        {url && !note ? (
          <>
            <a className="btn btn--ghost btn--tiny" href={url} target="_blank" rel="noreferrer">Open full size</a>
            <button type="button" className="btn btn--ghost btn--tiny" disabled={busy} onClick={async () => { const r = await onSave(''); if (r.error) setError(r.error); }}>Remove</button>
          </>
        ) : null}
        {error ? <span className="cell__error">{error}</span> : null}
      </div>
    </div>
  );
}
