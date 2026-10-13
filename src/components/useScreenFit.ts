'use client';

import { useEffect, type RefObject } from 'react';

/**
 * Always in view (Giulia, 13 Oct 2026): a box that scrolls on its own (a
 * table, a Kanban board) is fitted to the room left under it on the screen,
 * so what sits at its top (the header row) and at its bottom (the sideways
 * scrollbar) both stay on the screen, and the page around it stays put.
 *
 * Sets --screen-fit on the box. A box that starts too low on the page for
 * that (under `min` pixels of room) keeps its CSS default: the height of the
 * screen under the chrome.
 */
export function useScreenFit(ref: RefObject<HTMLElement | null>, min = 150) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      // clientHeight, not innerHeight: it leaves out the page's own sideways
      // scrollbar, which would otherwise cover the box's.
      const screen = document.documentElement.clientHeight;
      const room = Math.floor(screen - (el.getBoundingClientRect().top + window.scrollY));
      const want = room >= min ? `${room}px` : '';
      if (el.style.getPropertyValue('--screen-fit') === want) return;
      if (want) el.style.setProperty('--screen-fit', want); else el.style.removeProperty('--screen-fit');
    };
    fit();
    // What sits above the box can grow or shrink (a note, an error, a section
    // opening or closing): watch the box's ancestors and what comes before
    // each of them, as well as the window.
    const watch = new ResizeObserver(fit);
    for (let n: Element | null = el; n && n !== document.body; n = n.parentElement) {
      watch.observe(n);
      for (let s = n.previousElementSibling; s; s = s.previousElementSibling) watch.observe(s);
    }
    window.addEventListener('resize', fit);
    return () => { watch.disconnect(); window.removeEventListener('resize', fit); };
  }, [ref, min]);
}
