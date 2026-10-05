'use client';

import { useEffect, useRef, useState } from 'react';
import type { Tab } from '@/lib/nav';

/**
 * The (i) next to the view name. Opens the tab's explanation: what it is,
 * where it came from, how we work with it. Written in nav.ts next to the tab.
 */
export function TabHelp({ tab, domainLabel }: { tab: Tab; domainLabel: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d || !open) return;
    if (!d.open) d.showModal();
    const closed = () => setOpen(false);
    d.addEventListener('close', closed);
    return () => d.removeEventListener('close', closed);
  }, [open]);
  if (!tab.help) return null;
  const paragraphs = tab.help.split(/\n\s*\n/);
  return (
    <>
      <button type="button" className="chrome__info" aria-label={`What is ${tab.label}?`} title="What is this?" onClick={() => setOpen(true)}>
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
          <circle cx="8" cy="8" r="6.2" /><path d="M8 7.2v4M8 5.1v.1" />
        </svg>
      </button>
      {open ? (
        <dialog ref={ref} className="dialog dialog--help" onClick={(e) => { if (e.target === ref.current) ref.current?.close(); }}>
          <div className="dialog__body">
            <p className="eyebrow">{domainLabel}</p>
            <p className="dialog__title" style={{ marginTop: 4 }}>{tab.label}</p>
            <p className="muted" style={{ marginTop: 4 }}>{tab.blurb}</p>
            <div className="help">
              {paragraphs.map((p, i) => {
                const m = /^([A-Z][^:]{2,40}):\s*/.exec(p);
                return (
                  <p key={i}>
                    {m ? <><strong>{m[1]}.</strong> {p.slice(m[0].length)}</> : p}
                  </p>
                );
              })}
            </div>
            <div className="dialog__actions">
              <button type="button" className="btn btn--primary" onClick={() => ref.current?.close()}>Got it</button>
            </div>
          </div>
        </dialog>
      ) : null}
    </>
  );
}
