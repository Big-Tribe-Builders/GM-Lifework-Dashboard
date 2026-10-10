'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

/**
 * What every panel on the right shares: a field that saves on blur, the ×,
 * and the keys (Escape closes, Ctrl/Cmd+S saves).
 */

type Result = { error: string | null };

/** One field of a panel: saves when she clicks away, says whether it did. */
export function Field({ label, value, onSave, multiline, rows = 3, placeholder, wide }: {
  label: string; value: string | null; onSave: (v: string) => Promise<Result>;
  multiline?: boolean; rows?: number; placeholder?: string; wide?: boolean;
}) {
  const [draft, setDraft] = useState(value ?? '');
  const [state, setState] = useState<'idle' | 'dirty' | 'saving' | 'saved' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();
  // What is on its way to the server, and which save is the latest.
  const sent = useRef<string | null>(null);
  const seq = useRef(0);
  // A refresh after a save may not overwrite what she is typing now.
  useEffect(() => { if (state === 'idle' || state === 'saved') setDraft(value ?? ''); }, [value]); // eslint-disable-line react-hooks/exhaustive-deps
  function commit() {
    const base = sent.current ?? value ?? '';
    if (draft.trim() === base.trim()) { setState((s) => (s === 'dirty' ? 'idle' : s)); setError(null); return; }
    const v = draft;
    const n = ++seq.current;
    sent.current = v;
    setState('saving'); setError(null);
    start(async () => {
      const r = await onSave(v);
      if (n !== seq.current) return; // a newer save owns the field now
      sent.current = null;
      if (r.error) { setState('error'); setError(r.error); } else setState((s) => (s === 'dirty' ? s : 'saved'));
    });
  }
  const common = {
    value: draft, placeholder, 'aria-label': label,
    onChange: (e: { target: { value: string } }) => { setDraft(e.target.value); setState('dirty'); },
    onBlur: commit,
  };
  return (
    <label className={`pfield${wide ? ' pfield--wide' : ''}`}>
      <span className="pfield__label">{label}<span className="pfield__state">{state === 'saving' ? 'Saving…' : state === 'saved' ? 'Saved' : state === 'error' ? 'Not saved' : ''}</span></span>
      {multiline ? <textarea rows={rows} {...common} /> : <input {...common} />}
      {error ? <span className="cell__error">{error}</span> : null}
    </label>
  );
}

/** The × in a panel's bar. */
export function CloseLink({ href }: { href: string }) {
  return (
    <Link href={href} scroll={false} className="peek__btn" aria-label="Close" title="Close (Esc)">
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true"><path d="m4 4 8 8M12 4l-8 8" /></svg>
    </Link>
  );
}

/** Escape closes the panel (unless something nearer has focus); Ctrl/Cmd+S saves. */
export function usePanelKeys(closeHref: string, onSave?: () => void) {
  const router = useRouter();
  const save = useRef(onSave);
  save.current = onSave;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's' && save.current) { e.preventDefault(); save.current(); return; }
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      const t = e.target as Element | null;
      if (t?.closest('input, textarea, select, dialog') || document.querySelector('dialog[open]')) return;
      router.push(closeHref, { scroll: false });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [closeHref, router]);
}
