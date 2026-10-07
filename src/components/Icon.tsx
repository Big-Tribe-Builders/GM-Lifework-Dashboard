import type { IconName } from '@/lib/nav';

/**
 * Line icons, 24-box, stroke only. Studiolo sets width/height and stroke-width
 * from .icon-chip, so nothing here carries a size.
 */
const PATHS: Record<IconName, React.ReactNode> = {
  home: <><path d="M3 10.5 12 3l9 7.5" /><path d="M5.5 9.5V21h13V9.5" /></>,
  tribe: <><circle cx="9" cy="8" r="3" /><circle cx="17" cy="10" r="2.4" /><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" /><path d="M15.5 20c0-2.2 1.4-4 3.5-4s2 1 2 4" /></>,
  academy: <><path d="M12 4 2.5 9 12 14l9.5-5L12 4Z" /><path d="M6 11.5V17c0 1.7 2.7 3 6 3s6-1.3 6-3v-5.5" /></>,
  compass: <><circle cx="12" cy="12" r="9" /><path d="m15.5 8.5-2.3 5.2-4.7 1.8 2.3-5.2z" /></>,
  star: <><path d="m12 3.5 2.6 5.6 6 .8-4.4 4.2 1.1 6-5.3-2.9-5.3 2.9 1.1-6L3.4 9.9l6-.8L12 3.5Z" /></>,
  users: <><circle cx="9" cy="8" r="3.2" /><path d="M2.5 20c0-3.6 2.9-6.5 6.5-6.5s6.5 2.9 6.5 6.5" /><path d="M16.5 5.2a3.2 3.2 0 0 1 0 5.9" /><path d="M18 13.8c2 .8 3.5 2.8 3.5 5.2" /></>,
  briefcase: <><rect x="2.5" y="7" width="19" height="13" rx="2.5" /><path d="M8.5 7V5.5A2 2 0 0 1 10.5 3.5h3a2 2 0 0 1 2 2V7" /><path d="M2.5 12.5h19" /></>,
  rocket: <><path d="M13.5 3c3.5 1 6.5 4 7.5 7.5L15 16.5l-6-6L13.5 3Z" /><path d="m9 15-3 3" /><path d="M6.5 11.5 3 13l2 2 1.5-3.5Z" /><path d="M12.5 17.5 11 21l2 2 1.5-3.5Z" /></>,
  megaphone: <><path d="M3.5 10v4a2 2 0 0 0 2 2h2l8 4.5V5.5L7.5 10h-4Z" /><path d="M19 9a4 4 0 0 1 0 6" /></>,
  brain: <><path d="M12 4.5v15" /><path d="M9 4.5a3 3 0 0 0-3 3 3 3 0 0 0-2 5 3 3 0 0 0 2 5 3 3 0 0 0 3 2.5" /><path d="M15 4.5a3 3 0 0 1 3 3 3 3 0 0 1 2 5 3 3 0 0 1-2 5 3 3 0 0 1-3 2.5" /></>,
  book: <><path d="M4 4.5h9a3 3 0 0 1 3 3V21a3 3 0 0 0-3-3H4V4.5Z" /><path d="M20 4.5h-2a3 3 0 0 0-3 3V21a3 3 0 0 1 3-3h2V4.5Z" /></>,
  heart: <><path d="M12 20s-7.5-4.6-7.5-9.7A4.3 4.3 0 0 1 12 7.4a4.3 4.3 0 0 1 7.5 2.9C19.5 15.4 12 20 12 20Z" /></>,
  coins: <><ellipse cx="12" cy="6.5" rx="7.5" ry="3" /><path d="M4.5 6.5v5c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3v-5" /><path d="M4.5 11.5v5c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3v-5" /></>,
  mail: <><rect x="3" y="5.5" width="18" height="13" rx="2.5" /><path d="m3.5 7 8.5 6 8.5-6" /></>,
  logout: <><path d="M9 4H5.5A1.5 1.5 0 0 0 4 5.5v13A1.5 1.5 0 0 0 5.5 20H9M15 8l4 4-4 4M19 12H9" /></>,
  grid: <><rect x="3.5" y="3.5" width="7" height="7" rx="2" /><rect x="13.5" y="3.5" width="7" height="7" rx="2" /><rect x="3.5" y="13.5" width="7" height="7" rx="2" /><rect x="13.5" y="13.5" width="7" height="7" rx="2" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M12 2.5v3M12 18.5v3M21.5 12h-3M5.5 12h-3M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1M18.7 18.7l-2.1-2.1M7.4 7.4 5.3 5.3" /></>,
};

export function Icon({ name }: { name: IconName }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {PATHS[name]}
    </svg>
  );
}

/** The magnifier in the search button. Sized by its own CSS, not .icon-chip. */
export function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" />
    </svg>
  );
}

/** The arrow on a link that leaves the dashboard. */
export function ExternalIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ width: 13, height: 13, flex: 'none', strokeWidth: 2 }}>
      <path d="M7 17 17 7" /><path d="M9 7h8v8" />
    </svg>
  );
}
