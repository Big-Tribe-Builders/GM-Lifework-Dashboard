'use client';

import { useEffect, useMemo, useRef, useState, useTransition, type KeyboardEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import type { QuinbMember } from '@/lib/book';
import {
  planOf, stateOf, stateWords, shortDay, brusselsDay, lastVisitDay, percent, GROUPS, RECENT_DAYS, PAUSE_DAYS,
  type Followup, type Group, type Row,
} from '@/lib/followups';
import { refreshFromQuinb, logWrittenByHand, setAnswered, setPaused, setLeftOut, type RefreshNote } from '@/app/d/quinb/followup-actions';
import { sendInQuinb, readChats, readMemberChat } from '@/app/d/quinb/chat-actions';
import type { ChatStatus } from '@/lib/mighty-oauth';
import { updateMember } from '@/app/d/quinb/actions';
import { Face } from '@/components/QuinbInbox';
import { Field } from '@/components/panel';
import { useScreenFit } from '@/components/useScreenFit';
import { matches, searchWords, useSearch, useSearchable } from '@/lib/search';

/**
 * QuinB Community › Follow-ups (Giulia, 27 Oct 2026): the list on one half,
 * the open member on the other, as in Conversations. The list is who to write
 * to (lib/followups.ts holds every rule and limit); the member half is what
 * to know before writing, the message, and what was written before.
 * Sending and reading private messages need sign-in and the QuinB
 * connection (`chat`); without them the tab says why and Copy and open QuinB
 * does the job by hand.
 */

export type LastRun = { at: string; summary: string | null; error: string | null; notes: RefreshNote[] };
type Show = Group | 'all';
const MEMBER_PARAM = 'member';

const daysWords = (days: number | null) => (days == null ? 'Never visited' : days === 0 ? 'Visited today' : days === 1 ? '1 day' : `${days} days`);

/** How long since a day, in years and months: "2 y 3 m", "5 m", "less than a month". */
function inside(day: string | null, today: string): string {
  if (!day) return '';
  let months = (Number(today.slice(0, 4)) - Number(day.slice(0, 4))) * 12 + (Number(today.slice(5, 7)) - Number(day.slice(5, 7)));
  if (Number(today.slice(8, 10)) < Number(day.slice(8, 10))) months -= 1;
  if (months < 1) return 'less than a month';
  const y = Math.floor(months / 12), m = months % 12;
  return [y ? `${y} y` : '', m ? `${m} m` : ''].filter(Boolean).join(' ');
}

export function Followups({ members, followups, today, lastRun, chat, said }: {
  members: QuinbMember[]; followups: Followup[]; today: string; lastRun: LastRun | null; chat: ChatStatus; said: string | null;
}) {
  useSearchable();
  const { q } = useSearch();
  const words = useMemo(() => searchWords(q), [q]);
  const inQuinb = useMemo(() => members.filter((m) => !m.leftQuinbAt), [members]);
  const plan = useMemo(() => planOf(inQuinb, followups, today), [inQuinb, followups, today]);
  const refreshed = members.some((m) => m.seenAt);

  const [show, setShow] = useState<Show>('write');
  const counts: Record<Show, number> = { ...Object.fromEntries(Object.entries(plan.lists).map(([k, v]) => [k, v.length])) as Record<Group, number>, all: plan.rows.length };
  // While she searches, every member in QuinB whose name matches, whatever the group.
  const shown: Row[] = words.length
    ? plan.rows.filter((r) => matches({ name: r.member.name }, words))
    : show === 'all' ? plan.rows : plan.lists[show];

  // The open member lives in the address, without asking the server again.
  const params = useSearchParams();
  const [picked, setPicked] = useState<string | null>(() => params.get(MEMBER_PARAM));
  const chosen = plan.rows.find((r) => r.member.id === picked) ?? null;
  const open = chosen ?? shown[0] ?? null;
  const select = (id: string | null) => {
    setPicked(id);
    const next = new URLSearchParams(window.location.search);
    if (id) next.set(MEMBER_PARAM, id); else next.delete(MEMBER_PARAM);
    const qs = next.toString();
    window.history.replaceState(null, '', qs ? `${window.location.pathname}?${qs}` : window.location.pathname);
  };

  const split = useRef<HTMLDivElement>(null);
  useScreenFit(split);
  const detail = useRef<HTMLElement>(null);
  useEffect(() => { detail.current?.scrollTo({ top: 0 }); }, [open?.member.id]);
  const rows = useRef<(HTMLButtonElement | null)[]>([]);
  const onRowKey = (e: KeyboardEvent, i: number) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const j = Math.min(shown.length - 1, Math.max(0, i + (e.key === 'ArrowDown' ? 1 : -1)));
    rows.current[j]?.focus();
    select(shown[j].member.id);
  };

  const answeredPct = percent(plan.recentAnswered, plan.recentFollowups);
  const visitedPct = percent(plan.visitedRecently, plan.counted);
  const numbers: [string, string, string | null][] = [
    [`Visited in the last ${RECENT_DAYS} days`, String(plan.visitedRecently), visitedPct == null ? null : `${visitedPct}% of ${plan.counted}`],
    ['Answered your messages', answeredPct == null ? '—' : `${answeredPct}%`, `${plan.recentAnswered} of ${plan.recentFollowups} in ${RECENT_DAYS} days`],
    ['Write now', String(counts.write), null],
    ['Keep an eye on', String(counts.watch), null],
    ['Win back', String(counts.winback), null],
  ];

  return (
    <div className="fu">
      <RefreshBar lastRun={lastRun} chat={chat} said={said} />
      <div className={`convo${chosen ? ' convo--open' : ''}`} ref={split}>
        <section className="convo__side" aria-label="Follow-ups">
          <dl className="fu__numbers">
            {numbers.map(([label, value, meta]) => (
              <div key={label} className="fu__number">
                <dt className="eyebrow">{label}</dt>
                <dd className="stat__value">{value}</dd>
                {meta ? <dd className="muted stat__meta">{meta}</dd> : null}
              </div>
            ))}
          </dl>
          <div className="convo__bar">
            <div className="convo__filter" role="group" aria-label="Show">
              {GROUPS.map(({ key, label }) => (
                <button key={key} type="button" className={`chip${!words.length && show === key ? ' chip--active' : ''}`} aria-pressed={!words.length && show === key} onClick={() => setShow(key)}>
                  {label}<span className="convo__count">{counts[key]}</span>
                </button>
              ))}
            </div>
          </div>
          {words.length ? <p className="tabnote">Every member in QuinB whose name matches, whatever their group.</p> : null}
          {!refreshed ? <p className="tabnote">Nobody has been read from QuinB yet: click Refresh from QuinB above. Until then nobody is counted.</p> : null}
          {shown.length ? (
            <ul className="convo__rows">
              {shown.map((r, i) => {
                const on = r.member.id === open?.member.id;
                const plans = r.member.plans?.length ? r.member.plans.join(', ') : null;
                return (
                  <li key={r.member.id}>
                    <button ref={(el) => { rows.current[i] = el; }} type="button" className={`convo__item${on ? ' convo__item--on' : ''}`}
                      aria-current={on ? 'true' : undefined} onClick={() => select(r.member.id)} onKeyDown={(e) => onRowKey(e, i)}>
                      <Face name={r.member.name} avatar={r.member.avatarUrl} small />
                      <span className="convo__rowmain">
                        <span className="convo__rowtop">
                          <span className="convo__rowwho">{r.member.name}</span>
                          <span className="convo__rowwhen">{daysWords(r.days)}</span>
                        </span>
                        {plans ? <span className="convo__rowtitle">{plans}</span> : null}
                        <span className="convo__rowmeta">{[r.chip, r.out].filter(Boolean).join(' · ') || ' '}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : <p className="convo__empty">{words.length ? 'No member by that name.' : refreshed ? 'Nobody in this group right now.' : 'No members read from QuinB yet.'}</p>}
        </section>
        <section className="convo__detail" ref={detail} aria-label={open ? `Member: ${open.member.name}` : 'Member'}>
          {open ? (
            <>
              <button type="button" className="convo__back" onClick={() => select(null)}>← All follow-ups</button>
              <MemberCard key={open.member.id} row={open} followups={followups.filter((f) => f.memberId === open.member.id)} today={today} chat={chat} />
            </>
          ) : null}
        </section>
      </div>
    </div>
  );
}

/**
 * Refresh from QuinB, with when it last ran and what it found; then, when
 * connected, her private messages. Beside it, the connection.
 */
function RefreshBar({ lastRun, chat, said }: { lastRun: LastRun | null; chat: ChatStatus; said: string | null }) {
  const [pending, start] = useTransition();
  const [step, setStep] = useState<'members' | 'chats'>('members');
  const [result, setResult] = useState<{ error: string | null; summary?: string; notes?: RefreshNote[] } | null>(null);
  const [chats, setChats] = useState<{ error: string | null; summary?: string } | null>(null);
  const refresh = () => {
    setResult(null); setChats(null); setStep('members');
    start(async () => {
      setResult(await refreshFromQuinb());
      if (!chat.ready) return;
      setStep('chats');
      setChats(await readChats());
    });
  };
  const notes = result?.notes ?? lastRun?.notes ?? [];
  const error = result ? result.error : lastRun?.error ?? null;
  return (
    <div className="convo__bar fu__top">
      <span className="muted fu__last">
        {pending ? (step === 'chats' ? 'Reading private messages…' : 'Reading QuinB…')
          : result?.summary ? `Refreshed just now · ${result.summary}`
          : lastRun ? `Last refreshed ${lastRun.at}${lastRun.summary ? ` · ${lastRun.summary}` : ''}` : 'Not refreshed from QuinB yet'}
      </span>
      <button type="button" className="btn btn--ghost btn--tiny" disabled={pending} onClick={refresh}>{pending ? 'Refreshing…' : 'Refresh from QuinB'}</button>
      {chat.ready ? <span className="muted">Private messages: connected as {chat.connectedAs}</span>
        : chat.canConnect ? <a className="btn btn--ghost btn--tiny" href="/api/mighty/connect">{chat.reconnect ? 'Connect again' : 'Connect'}</a>
        : <button type="button" className="btn btn--ghost btn--tiny" disabled title="Locked: see below why">Connect</button>}
      {said ? <p className="muted fu__error" role="status">{said}</p> : null}
      {error ? <p className="field__error fu__error" role="alert">{error}</p> : null}
      {chats?.summary ? <p className="muted fu__error" role="status">{chats.summary}</p> : null}
      {chats?.error ? <p className="field__error fu__error" role="alert">{chats.error}</p> : null}
      {chat.ready && chat.lastError && !chats ? <p className="muted fu__error">Last problem with private messages: {chat.lastError}</p> : null}
      {!chat.ready && chat.blockers.length ? (
        <details className="typebrief fu__notes">
          <summary>Sending from here is locked: why, and what to set up</summary>
          <ul>{chat.blockers.map((b) => <li key={b}>{b}</li>)}</ul>
        </details>
      ) : null}
      {notes.length ? (
        <details className="typebrief fu__notes">
          <summary>{notes.length} {notes.length === 1 ? 'thing differs' : 'things differ'} between here and QuinB (yours were kept)</summary>
          <ul>{notes.map((n, i) => <li key={i}><strong>{n.member}</strong>, {n.field}: here “{n.here}”, QuinB “{n.quinb}”</li>)}</ul>
        </details>
      ) : null}
    </div>
  );
}

/** The open member: who they are, the message, what was written before, notes, pause and leave out. */
function MemberCard({ row, followups, today, chat }: { row: Row; followups: Followup[]; today: string; chat: ChatStatus }) {
  const m = row.member;
  const [text, setText] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [said, setSaid] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ error: string | null }>, done?: string) => {
    setError(null); setSaid(null);
    start(async () => { const r = await fn(); if (r.error) setError(r.error); else if (done) setSaid(done); });
  };
  const visit = lastVisitDay(m);
  const since = m.memberSince;
  const paused = !!m.pausedUntil && m.pausedUntil >= today;
  const history = [...followups].sort((a, b) => Date.parse(b.writtenAt) - Date.parse(a.writtenAt));

  // Opening a member who has not answered yet reads their conversation again
  // (after a moment, so moving through the list with the keys reads nothing).
  const waits = followups.some((f) => !f.answeredAt);
  const [readError, setReadError] = useState<string | null>(null);
  useEffect(() => {
    if (!chat.ready || !waits || !m.dmConversationId) return;
    const t = setTimeout(() => { readMemberChat(m.id).then((r) => setReadError(r.error)).catch(() => {}); }, 700);
    return () => clearTimeout(t);
  }, [chat.ready, waits, m.id, m.dmConversationId]);

  const copyAndOpen = async () => {
    setError(null); setSaid(null);
    try { await navigator.clipboard.writeText(text); } catch { setError('The text could not be copied; select it and copy it by hand.'); }
    if (m.profileUrl) window.open(m.profileUrl, '_blank', 'noopener');
    setSaid('Copied. After writing in QuinB, click “I wrote in QuinB”.');
  };

  return (
    <article className="convo__thread" aria-label={m.name}>
      <div className="convo__post">
        <header className="convo__head">
          <Face name={m.name} avatar={m.avatarUrl} />
          <div className="convo__who">
            <strong>{m.name}</strong>
            {m.plans?.length ? <span className="convo__where">{m.plans.join(', ')}</span> : null}
          </div>
        </header>
        {m.bio ? <p className="convo__text">{m.bio}</p> : null}
        <dl className="fu__facts">
          <dt>Member since</dt><dd>{since ? `${shortDay(since, today)} · ${inside(since, today)}` : '—'}</dd>
          <dt>Last visit</dt><dd>{visit ? `${shortDay(visit, today)} · ${daysWords(row.days)}${row.days ? ' ago' : ''}` : 'Never'}</dd>
          {m.lastDmFromMemberAt ? <><dt>Their last private message</dt><dd>{shortDay(brusselsDay(m.lastDmFromMemberAt), today)}</dd></> : null}
          {m.lastDmFromMeAt ? <><dt>Your last private message</dt><dd>{shortDay(brusselsDay(m.lastDmFromMeAt), today)}</dd></> : null}
          {row.out ? <><dt>Not in the follow-ups</dt><dd>{row.out}</dd></> : null}
        </dl>
        <div className="convo__actions convo__row">
          {m.profileUrl ? <a className="btn btn--ghost btn--tiny" href={m.profileUrl} target="_blank" rel="noreferrer">Open profile in QuinB</a>
            : <span className="muted">No profile link from QuinB yet (Refresh from QuinB reads it).</span>}
          {m.dmConversationUrl ? <a className="btn btn--ghost btn--tiny" href={m.dmConversationUrl} target="_blank" rel="noreferrer">Open chat in QuinB</a> : null}
        </div>
      </div>

      <div className="convo__comments">
        <div className="convo__composer">
          <label className="pfield__label" htmlFor={`fu-msg-${m.id}`}>The message</label>
          <textarea id={`fu-msg-${m.id}`} rows={5} value={text} onChange={(e) => setText(e.target.value)} placeholder={`Write to ${m.firstName ?? m.name.split(' ')[0]}…`} />
          <div className="convo__row">
            {chat.ready ? (
              <button type="button" className="btn btn--primary btn--tiny" disabled={!text.trim() || pending}
                onClick={() => run(async () => { const r = await sendInQuinb(m.id, text); if (r.sent) setText(''); return r; }, 'Sent in QuinB. They wait for an answer for 7 days.')}>
                Send in QuinB
              </button>
            ) : (
              <>
                <button type="button" className="btn btn--primary btn--tiny" disabled={!text.trim() || pending} onClick={copyAndOpen}>Copy and open QuinB</button>
                <button type="button" className="btn btn--ghost btn--tiny" disabled title="Locked: the top of the tab says why">Send in QuinB</button>
              </>
            )}
          </div>
        </div>
        <div className="convo__row">
          <input className="fu__note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" aria-label="Note for this follow-up" />
          <button type="button" className="btn btn--ghost btn--tiny" disabled={pending}
            onClick={() => run(async () => { const r = await logWrittenByHand(m.id, text, note); if (!r.error) { setText(''); setNote(''); } return r; }, 'Logged. They wait for an answer for 7 days.')}>
            I wrote in QuinB
          </button>
        </div>
        {error ? <p className="field__error" role="alert">{error}</p> : null}
        {said ? <p className="muted" role="status">{said}</p> : null}
        {readError ? <p className="muted">Private messages could not be read: {readError}</p> : null}
      </div>

      <div className="convo__post">
        <h3 className="pfield__label">History</h3>
        {history.length ? (
          <ul className="fu__history">
            {history.map((f) => {
              const s = stateOf(f, m, today);
              const w = stateWords(f, s, today);
              const day = brusselsDay(f.writtenAt);
              return (
                <li key={f.id} className="fu__entry">
                  <div className="convo__row">
                    <strong>{shortDay(day, today)}</strong>
                    <span className="muted">{f.via === 'sent' ? 'Sent from here' : 'Written in QuinB'}</span>
                    <span>{w.status}</span>
                    {s.kind === 'waiting' || s.kind === 'no_answer'
                      ? <button type="button" className="btn btn--ghost btn--tiny" disabled={pending} onClick={() => run(() => setAnswered(f.id, true))}>Answered</button>
                      : f.answeredHow === 'by_hand' ? <button type="button" className="btn btn--ghost btn--tiny" disabled={pending} onClick={() => run(() => setAnswered(f.id, false))}>Undo answered</button> : null}
                  </div>
                  {f.message ? <p className="convo__text">{f.message}</p> : null}
                  {f.answerStart ? <p className="convo__text muted">“{f.answerStart}”</p> : null}
                  {f.note ? <p className="muted">Note: {f.note}</p> : null}
                </li>
              );
            })}
          </ul>
        ) : <p className="muted">No follow-ups yet.</p>}
      </div>

      <div className="convo__post">
        <Field wide multiline rows={3} label="Notes" value={m.notes} onSave={(v) => updateMember(m.id, 'notes', v)} />
        <div className="convo__row">
          {paused
            ? <><span>Paused until {shortDay(m.pausedUntil!, today)}</span><button type="button" className="btn btn--ghost btn--tiny" disabled={pending} onClick={() => run(() => setPaused(m.id, false))}>Undo</button></>
            : <button type="button" className="btn btn--ghost btn--tiny" disabled={pending} onClick={() => run(() => setPaused(m.id, true))}>Pause {PAUSE_DAYS} days</button>}
          {m.followupOff
            ? <><span>Left out of follow-ups</span><button type="button" className="btn btn--ghost btn--tiny" disabled={pending} onClick={() => run(() => setLeftOut(m.id, false))}>Undo</button></>
            : <button type="button" className="btn btn--ghost btn--tiny" disabled={pending} onClick={() => run(() => setLeftOut(m.id, true))}>Leave out of follow-ups</button>}
        </div>
      </div>
    </article>
  );
}
