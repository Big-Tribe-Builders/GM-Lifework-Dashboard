'use client';

import { useTransition } from 'react';
import Link from 'next/link';
import type { Signal } from '@/lib/pulse';
import { dismissSignal } from '@/app/d/btb/actions';

/**
 * Pulse: the lines the rules produced today. Each says what, why (the rule),
 * where to go, and has a tick. Ticked lines leave until their key changes.
 */
export function Pulse({ signals, today }: { signals: Signal[]; today: string }) {
  return (
    <div className="pulse">
      <div className="pulse__head">
        <span className="grid2__foldname">{today}</span>
        <span className="pulse__count">{signals.length === 0 ? 'Nothing to do from the plan today.' : `${signals.length} to do`}</span>
      </div>
      {signals.map((s) => <Line key={s.key} s={s} />)}
    </div>
  );
}

const KIND: Record<Signal['kind'], { label: string; tone: string }> = {
  late: { label: 'Late', tone: 'contact' },
  reply: { label: 'Reply', tone: 'contact' },
  soon: { label: 'Soon', tone: 'done' },
  unstarted: { label: 'Not started', tone: 'done' },
  stalled: { label: 'Stalled', tone: 'sleeping' },
  new: { label: 'New', tone: 'active' },
};

function Line({ s }: { s: Signal }) {
  const [pending, start] = useTransition();
  const k = KIND[s.kind];
  return (
    <div className={pending ? 'pulse__line pulse__line--pending' : 'pulse__line'}>
      <button type="button" className="pulse__tick" aria-label="Done" title="Tick off" disabled={pending}
        onClick={() => start(async () => { await dismissSignal(s.key); })}>
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m3.5 8.5 3 3 6-7" /></svg>
      </button>
      <span className={`status status--${k.tone}`}>{k.label}</span>
      <span className="pulse__text" title={s.rule}>{s.text}{s.detail ? <span className="pulse__detail"> · {s.detail}</span> : null}</span>
      <Link href={s.href} className="pulse__go">open →</Link>
    </div>
  );
}
