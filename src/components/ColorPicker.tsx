'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState, useTransition } from 'react';
import { createPortal } from 'react-dom';
import { PALETTE, isPaletteKey, type PaletteKey } from '@/lib/palette';

type Result = { error: string | null };

const MENU_W = 260;
const GAP = 4;

/**
 * A dot that opens the palette: ten colours and "No colour". The choice
 * shows at once and is saved behind it; if the save fails, the old colour
 * comes back and the reason is shown under the dot.
 *
 * The menu and the message are drawn on the page itself (a portal to
 * <body>, fixed to the dot), so a table cell or a scrolling list can never
 * clip them.
 */
export function ColorPicker({ value, label, onPick }: {
  value: PaletteKey | null;
  /** What is being coloured, for screen readers: "Colour of 2026". */
  label: string;
  onPick: (color: string) => Promise<Result>;
}) {
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState<PaletteKey | null>(value);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [at, setAt] = useState<{ top: number; left: number } | null>(null);
  const box = useRef<HTMLSpanElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  // A refresh brings the saved colour; follow it unless a save is on its way.
  useEffect(() => { if (!pending) setShown(value); }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  const floating = open || !!error;

  // Under the dot, kept inside the window.
  const place = useCallback(() => {
    const r = button.current?.getBoundingClientRect();
    if (!r) return;
    const left = Math.max(8, Math.min(r.left, window.innerWidth - MENU_W - 8));
    setAt({ top: r.bottom + GAP, left });
  }, []);
  useLayoutEffect(() => {
    if (!floating) return;
    place();
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => { window.removeEventListener('scroll', place, true); window.removeEventListener('resize', place); };
  }, [floating, place]);

  const close = useCallback((refocus: boolean) => {
    setOpen(false);
    if (refocus) button.current?.focus();
  }, []);

  // While open: a click elsewhere closes it; Escape closes it and nothing
  // else (an open panel stays open), wherever the focus is.
  useEffect(() => {
    if (!open) return;
    const inside = (n: Node | null) => !!n && (!!box.current?.contains(n) || !!menu.current?.contains(n));
    const away = (e: MouseEvent) => { if (!inside(e.target as Node)) close(false); };
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault(); e.stopPropagation();
      close(true);
    };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', key, true);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', key, true); };
  }, [open, close]);

  // Focus moves into the menu when it opens (once it is placed and drawn).
  const placed = at !== null;
  useEffect(() => {
    if (open && placed) menu.current?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.focus();
  }, [open, placed]);

  function pick(next: PaletteKey | null) {
    const before = shown;
    close(true); setShown(next); setError(null);
    if (next === before) return;
    start(async () => {
      const r = await onPick(next ?? '');
      if (r.error) { setShown(before); setError(r.error); }
    });
  }

  // Tabbing out of the menu closes it.
  function blurred(e: React.FocusEvent) {
    const to = e.relatedTarget as Node | null;
    if (to && (box.current?.contains(to) || menu.current?.contains(to))) return;
    if (to) setOpen(false);
  }

  const name = shown ? PALETTE.find((p) => p.key === shown)?.label : 'No colour';
  const layer = floating && at && typeof document !== 'undefined' ? createPortal(
    <>
      {open ? (
        <div ref={menu} className="colorpick__menu" role="group" aria-label={label} style={{ top: at.top, left: at.left }} onBlur={blurred}
          onKeyDown={(e) => {
            // The menu lives at the end of the page; tabbing past its first or
            // last colour goes back to the dot, so the order stays where it was.
            if (e.key !== 'Tab') return;
            const opts = [...(menu.current?.querySelectorAll<HTMLButtonElement>('.colorpick__opt') ?? [])];
            const i = opts.indexOf(document.activeElement as HTMLButtonElement);
            if ((e.shiftKey && i === 0) || (!e.shiftKey && i === opts.length - 1)) { e.preventDefault(); close(true); }
          }}>
          <button type="button" className="colorpick__opt" aria-pressed={shown === null} onClick={() => pick(null)}>
            <span className="colorpick__dot colorpick__dot--none" aria-hidden="true" />No colour
          </button>
          {PALETTE.map((p) => (
            <button key={p.key} type="button" className="colorpick__opt" aria-pressed={shown === p.key} onClick={() => pick(p.key)}>
              <span className={`colorpick__dot tint-${p.key} tint-swatch`} aria-hidden="true" />{p.label}
            </button>
          ))}
        </div>
      ) : null}
      {error && !open ? (
        <div className="colorpick__error" role="alert" style={{ top: at.top, left: at.left }}>
          <span>{error}</span>
          <button type="button" className="colorpick__x" aria-label="Close this message" onClick={() => setError(null)}>×</button>
        </div>
      ) : null}
    </>,
    document.body,
  ) : null;

  return (
    <span className="colorpick" ref={box} onBlur={blurred}>
      <button type="button" ref={button} className="colorpick__btn" aria-expanded={open}
        aria-label={`${label}: ${name}. Change colour`} title={`Colour: ${name}`}
        onClick={() => { if (open) close(false); else { setError(null); setOpen(true); } }}>
        <span className={`colorpick__dot ${isPaletteKey(shown) ? `tint-${shown} tint-swatch` : 'colorpick__dot--none'}`} aria-hidden="true" />
      </button>
      {layer}
    </span>
  );
}
