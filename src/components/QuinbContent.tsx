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
import { useScreenFit } from '@/components/useScreenFit';
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
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * The open year and month live in the address (?year=2027&month=2027-03), so
 * a reload or a link opens the same place. Written with history, not the
 * router: a choice here needs nothing new from the server.
 */
function remember(year: number | null, month: string | null) {
  const next = new URLSearchParams(window.location.search);
  if (year) next.set('year', String(year)); else next.delete('year');
  if (month) next.set('month', month); else next.delete('month');
  const qs = next.toString();
  window.history.replaceState(window.history.state, '', qs ? `${window.location.pathname}?${qs}` : window.location.pathname);
}

/**
 * QuinB Community › Content strategy (Giulia, 18 Oct 2026): the years are a
 * gallery of cards, as in Notion. A card opens its year in a window on the
 * other half of the screen: its cover, its fields and its months, again as
 * cards. A month opens in the same window, with its weeks as a list that
 * folds open to the week's theme, its plan and a post for every day.
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
  const [open, setOpen] = useState<{ year: number | null; month: string | null }>(() => {
    const y = Number(params.get('year'));
    if (!yearList.includes(y)) return { year: null, month: null };
    const m = params.get('month') ?? '';
    return { year: y, month: MONTH_RE.test(m) && m.startsWith(`${y}-`) ? m : null };
  });
  // Opened by her hand, not by the address: the keyboard follows her into the window.
  const byHand = useRef(false);
  const go = (year: number | null, month: string | null = null) => {
    byHand.current = true;
    setOpen({ year, month });
    remember(year, month);
  };
  const cards = useRef(new Map<number, HTMLButtonElement>());
  const close = () => {
    const y = open.year;
    go(null);
    // The keyboard goes back to the card the window came from.
    if (y) requestAnimationFrame(() => cards.current.get(y)?.focus());
  };

  const box = useRef<HTMLDivElement>(null);
  useScreenFit(box);

  const monthRow = useMemo(() => new Map(months.map((m) => [m.month, m])), [months]);
  const weekRow = useMemo(() => new Map(weeks.map((w) => [w.monday, w])), [weeks]);
  const typeByDay = useMemo(() => new Map(types.map((t) => [t.weekday, t])), [types]);
  const postsByDay = useMemo(() => {
    const m = new Map<string, QuinbPost[]>();
    for (const p of posts) if (p.plannedFor) m.set(p.plannedFor, [...(m.get(p.plannedFor) ?? []), p]);
    return m;
  }, [posts]);
  const planned = (y: number) => months.filter((m) => m.month.startsWith(`${y}-`) && m.theme).length;

  return (
    <div ref={box} className={`plan${open.year ? ' plan--open' : ''}`}>
      <section className="plan__side" aria-label="Years">
        <div className="plan__gallery">
          {yearList.map((yy, i) => {
            const row = years.find((r) => r.year === yy);
            const n = planned(yy);
            return (
              <PlanCard key={yy} id={String(yy)} tone={TONES[i % 4]} cover={row?.coverUrl ?? null} big={String(yy)}
                title={String(yy)} subtitle={row?.theme ?? null} meta={n ? `${n} of 12 months planned` : 'No months planned yet'}
                current={yy === open.year} onPick={() => go(yy)}
                cardRef={(el) => { if (el) cards.current.set(yy, el); else cards.current.delete(yy); }} />
            );
          })}
        </div>
      </section>
      {open.year ? (
        <PlanWindow year={open.year} month={open.month} tone={TONES[yearList.indexOf(open.year) % 4]} byHand={byHand}
          yearRow={years.find((r) => r.year === open.year)} monthRow={monthRow} weekRow={weekRow} typeByDay={typeByDay}
          postsByDay={postsByDay} postsHref={postsHref} today={today}
          onMonth={(m) => go(open.year, m)} onYear={() => go(open.year)} onClose={close} />
      ) : null}
    </div>
  );
}

/** A card in the gallery, as in Notion: the cover on top, her picture or a designed one; under it the name, the theme and a count. */
function PlanCard({ id, tone, cover, big, title, subtitle, meta, current, onPick, cardRef }: {
  id: string; tone: string; cover: string | null; big: string; title: string; subtitle: string | null; meta: string | null;
  current: boolean; onPick: () => void; cardRef?: (el: HTMLButtonElement | null) => void;
}) {
  return (
    <button ref={cardRef} type="button" data-card={id} className={`ccard${current ? ' ccard--on' : ''}`} aria-current={current ? 'true' : undefined} onClick={onPick}>
      <span className={`ccard__cover cover--${tone}`}>
        {cover
          // eslint-disable-next-line @next/next/no-img-element -- her own picture, drawn as it is
          ? <img src={cover} alt="" loading="lazy" />
          : <span className="ccard__big" aria-hidden="true">{big}</span>}
      </span>
      <span className="ccard__body">
        <span className="ccard__title">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" aria-hidden="true">
            <rect x="2.5" y="3.5" width="11" height="10" rx="1.5" /><path d="M2.5 6.5h11M5.5 2v3M10.5 2v3" />
          </svg>
          {title}
        </span>
        <span className={`ccard__sub${subtitle ? '' : ' ccard__sub--none'}`}>{subtitle ?? 'No theme yet'}</span>
        {meta ? <span className="ccard__meta">{meta}</span> : null}
      </span>
    </button>
  );
}

/**
 * The window on the other half: a year, or a month of it. The cover on top
 * takes her own picture; the fields save as she leaves them; the months are
 * cards that open in this same window, with the year one step back above.
 */
function PlanWindow({ year, month, tone, byHand, yearRow, monthRow, weekRow, typeByDay, postsByDay, postsHref, today, onMonth, onYear, onClose }: {
  year: number; month: string | null; tone: string; byHand: React.RefObject<boolean>;
  yearRow: QuinbYear | undefined; monthRow: Map<string, QuinbMonth>; weekRow: Map<string, QuinbWeek>;
  typeByDay: Map<number, QuinbPostType>; postsByDay: Map<string, QuinbPost[]>; postsHref: string; today: string;
  onMonth: (m: string) => void; onYear: () => void; onClose: () => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  // A newly opened year or month starts at its top; opened by her, the keyboard comes along.
  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 });
    if (byHand.current) heading.current?.focus({ preventScroll: true });
  }, [year, month, byHand]);

  // Escape closes the window, unless something nearer is using it: a field being typed in, a dialog.
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      if ((e.target as Element | null)?.closest('input, textarea, select, dialog')) return;
      if (document.querySelector('dialog[open]')) return;
      closeRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const y = yearRow;
  const mi = month ? Number(month.slice(5)) - 1 : -1;
  const m = month ? monthRow.get(month) : undefined;
  const postsIn = (mondays: string[]) => mondays.flatMap(daysOfWeek).flatMap((d) => postsByDay.get(d) ?? []);
  const mPosts = month ? postsIn(weeksOfMonth(month)) : [];

  return (
    <section className="pwin" aria-label={month ? monthLabel(month) : String(year)}>
      <div className="pwin__bar">
        <button type="button" className="peek__btn" aria-label="Close" title="Close (Esc)" onClick={onClose}>
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true"><path d="m4 4 8 8M12 4l-8 8" /></svg>
        </button>
        <nav className="pwin__crumbs" aria-label="Where you are">
          {month ? (
            <>
              <button type="button" className="pwin__crumb" onClick={onYear}>{year}</button>
              <span aria-hidden="true">›</span>
              <span className="pwin__crumb pwin__crumb--here" aria-current="page">{MONTHS[mi]}</span>
            </>
          ) : <span className="pwin__crumb pwin__crumb--here" aria-current="page">{year}</span>}
        </nav>
      </div>

      <div className="pwin__scroll" ref={scroller}>
        {month ? (
          <>
            <Cover key={month} url={m?.coverUrl ?? null} tone={TONES[mi % 4]} big={MONTH_SHORT[mi]} alt={`Cover of ${monthLabel(month)}`}
              prefix={`cover-${month}`} onSave={(url) => savePlan('month', month, 'coverUrl', url)} />
            <div className="pwin__page">
              <h2 className="pwin__title" ref={heading} tabIndex={-1}>{monthLabel(month)}</h2>
              {mPosts.length ? <p className="muted pwin__sub">{mPosts.length} post{mPosts.length === 1 ? '' : 's'} · {mPosts.filter((p) => isApproved(p.status)).length} approved</p> : null}
              <div className="plan__fields" key={`mf-${month}`}>
                <Field wide label="Monthly theme" value={m?.theme ?? null} onSave={(v) => savePlan('month', month, 'theme', v)} />
                <Field label="Focus" value={m?.focus ?? null} onSave={(v) => savePlan('month', month, 'focus', v)} />
                <Field label="Goal" value={m?.goal ?? null} onSave={(v) => savePlan('month', month, 'goal', v)} />
                <Field wide multiline rows={3} label="Note" placeholder="What we do this month, in your words." value={m?.note ?? null} onSave={(v) => savePlan('month', month, 'note', v)} />
                <Field wide label="Link to NotebookLM" placeholder="https://notebooklm.google.com/…" value={m?.notebooklmUrl ?? null} onSave={(v) => savePlan('month', month, 'notebooklmUrl', v)} />
              </div>
              <h3 className="pwin__h">Weeks</h3>
              <Weeks key={month} mondays={weeksOfMonth(month)} weekRow={weekRow} typeByDay={typeByDay} postsByDay={postsByDay} postsHref={postsHref} today={today} />
            </div>
          </>
        ) : (
          <>
            <Cover key={year} url={y?.coverUrl ?? null} tone={tone} big={String(year)} alt={`Cover of ${year}`}
              prefix={`cover-${year}`} onSave={(url) => savePlan('year', String(year), 'coverUrl', url)} />
            <div className="pwin__page">
              <h2 className="pwin__title" ref={heading} tabIndex={-1}>{year}</h2>
              <div className="plan__fields" key={`yf-${year}`}>
                <Field wide label="Theme of the year" value={y?.theme ?? null} onSave={(v) => savePlan('year', String(year), 'theme', v)} />
                <label className="pfield">
                  <span className="pfield__label">Audience</span>
                  <Sel value={y?.audience ?? ''} blank="—" options={AUDIENCES.map((a) => ({ value: a, label: a }))} label="Audience"
                    onChange={(v) => savePlan('year', String(year), 'audience', v)} />
                </label>
                <Field label="Focus" value={y?.focus ?? null} onSave={(v) => savePlan('year', String(year), 'focus', v)} />
                <Field wide label="Goal" value={y?.goal ?? null} onSave={(v) => savePlan('year', String(year), 'goal', v)} />
                <Field wide multiline rows={3} label="Notes" value={y?.notes ?? null} onSave={(v) => savePlan('year', String(year), 'notes', v)} />
              </div>
              <h3 className="pwin__h">Months</h3>
              <div className="plan__gallery plan__gallery--months">
                {MONTH_SHORT.map((short, i) => {
                  const mm = `${year}-${String(i + 1).padStart(2, '0')}`;
                  const row = monthRow.get(mm);
                  const n = postsIn(weeksOfMonth(mm)).length;
                  return (
                    <PlanCard key={mm} id={mm} tone={TONES[i % 4]} cover={row?.coverUrl ?? null} big={short}
                      title={MONTHS[i]} subtitle={row?.theme ?? null} meta={n ? `${n} post${n === 1 ? '' : 's'}` : null}
                      current={false} onPick={() => onMonth(mm)} />
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

/** The cover at the top of the window, as in Notion: her picture, or the designed cover until she adds one. */
function Cover({ url, tone, big, alt, prefix, onSave }: {
  url: string | null; tone: string; big: string; alt: string; prefix: string; onSave: (url: string) => Promise<Result>;
}) {
  const up = useImageUpload(prefix, onSave);
  return (
    <div className="pcover-wrap">
      <div className={`pcover cover--${tone}`}>
        {url
          // eslint-disable-next-line @next/next/no-img-element -- her own picture, drawn as it is
          ? <img src={url} alt={alt} />
          : <span className="pcover__big" aria-hidden="true">{big}</span>}
        <div className="pcover__actions">
          <input ref={up.input} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={up.onPick} />
          <button type="button" className="pcover__btn" disabled={up.busy} onClick={up.choose}>
            {up.busy ? 'Uploading…' : url ? 'Change cover' : 'Add your own picture'}
          </button>
          {url ? <button type="button" className="pcover__btn" disabled={up.busy} onClick={up.remove}>Remove</button> : null}
        </div>
      </div>
      {up.error ? <p className="cell__error pcover__error" role="alert">{up.error}</p> : null}
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

/** Uploads a picture to the banner bucket and saves its address; saving '' removes it. */
function useImageUpload(prefix: string, onSave: (url: string) => Promise<Result>) {
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

  return {
    input, busy, error,
    choose: () => input.current?.click(),
    onPick: (e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void upload(f); },
    remove: async () => {
      setError(null); setBusy(true);
      const r = await onSave('');
      setBusy(false);
      if (r.error) setError(r.error);
    },
  };
}

function Banner({ url, alt, prefix, note, onSave }: { url: string | null; alt: string; prefix: string; note?: string; onSave: (url: string) => Promise<Result> }) {
  const up = useImageUpload(prefix, onSave);

  return (
    <div className="banner">
      {url ? <img className="banner__img" src={url} alt={alt} /> : <div className="banner__empty">No banner yet</div>}
      {note ? <p className="muted banner__note">{note}</p> : null}
      <div className="banner__actions">
        <input ref={up.input} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={up.onPick} />
        <button type="button" className="btn btn--ghost btn--tiny" disabled={up.busy} onClick={up.choose}>
          {up.busy ? 'Uploading…' : url && !note ? 'Replace banner' : 'Upload banner'}
        </button>
        {url && !note ? (
          <>
            <a className="btn btn--ghost btn--tiny" href={url} target="_blank" rel="noreferrer">Open full size</a>
            <button type="button" className="btn btn--ghost btn--tiny" disabled={up.busy} onClick={up.remove}>Remove</button>
          </>
        ) : null}
        {up.error ? <span className="cell__error">{up.error}</span> : null}
      </div>
    </div>
  );
}
