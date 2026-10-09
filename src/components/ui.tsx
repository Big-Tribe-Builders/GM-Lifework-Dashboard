import Link from 'next/link';
import type { ReactNode } from 'react';
import { Icon, ExternalIcon } from '@/components/Icon';
import type { Accent, IconName } from '@/lib/nav';

export function Widget({
  title, accent, action, children, flush, className = '',
}: {
  title: string;
  accent?: Accent;
  action?: ReactNode;
  children: ReactNode;
  flush?: boolean;
  className?: string;
}) {
  return (
    <section className={`card widget ${accent ? `accent-${accent}` : ''} ${className}`}>
      <header className="widget__head">
        <h2 className="widget__title">{title}</h2>
        {action ? <div className="widget__action">{action}</div> : null}
      </header>
      <div className={flush ? 'widget__body widget__body--flush' : 'widget__body'}>{children}</div>
    </section>
  );
}

export function Stat({
  label, value, meta, accent, href,
}: {
  label: string;
  value: ReactNode;
  meta?: string;
  accent: Accent;
  href?: string;
}) {
  const body = (
    <>
      <p className="eyebrow">{label}</p>
      <p className="stat__value">{value}</p>
      {meta ? <p className="muted stat__meta">{meta}</p> : null}
    </>
  );
  const cls = `card stat accent-${accent}${href ? ' card--hover' : ''}`;
  return href ? (
    <Link href={href} className={cls} style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/** A list row. Renders as a link when href is given, otherwise as a plain div. */
export function Row({
  icon, accent, title, sub, aside, href, external,
}: {
  icon?: IconName;
  accent?: Accent;
  title: string;
  sub?: string | null;
  aside?: ReactNode;
  href?: string | null;
  external?: boolean;
}) {
  const inner = (
    <>
      {icon ? (
        <span className={`icon-chip ${accent ? `accent-${accent}` : ''}`}><Icon name={icon} /></span>
      ) : accent ? (
        <span className={`dot accent-${accent}`} />
      ) : null}
      <div className="row__main">
        <p className="row__title">{title}</p>
        {sub ? <p className="row__sub">{sub}</p> : null}
      </div>
      {aside ? <div className="row__aside">{aside}</div> : null}
      {external ? <ExternalIcon /> : null}
    </>
  );

  if (!href) return <div className="row">{inner}</div>;
  if (external) {
    return <a className="row" href={href} target="_blank" rel="noreferrer">{inner}</a>;
  }
  return <Link className="row" href={href}>{inner}</Link>;
}

export function Rows({ children }: { children: ReactNode }) {
  return <div className="rows">{children}</div>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="empty">{children}</p>;
}

export function Badge({
  children, tone,
}: {
  children: ReactNode;
  tone?: 'violet' | 'red' | 'green' | 'orange';
}) {
  return <span className={`badge${tone ? ` badge--${tone}` : ''}`}>{children}</span>;
}

export function Progress({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <span className="progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <span style={{ width: `${pct}%` }} />
    </span>
  );
}

/** The page title block that sits above every grid. */
export function PageHead({
  title, blurb, actions,
}: {
  title: string;
  blurb: string;
  actions?: ReactNode;
}) {
  return (
    <div className="pagehead">
      <div className="pagehead__text">
        <h1 className="page-title">{title}</h1>
        {blurb ? <p className="muted" style={{ marginTop: 4 }}>{blurb}</p> : null}
      </div>
      {actions ? <div className="pagehead__actions">{actions}</div> : null}
    </div>
  );
}

/** A grid of external app links. The dashboard links out; it never rebuilds. */
export function Launcher({
  apps,
}: {
  apps: { id: string; name: string; url: string; note: string; connected: boolean }[];
}) {
  if (apps.length === 0) return <Empty>No apps linked to this area yet.</Empty>;
  return (
    <div className="launch">
      {apps.map((a, i) => (
        <a key={a.id} className={`launch__tile accent-${(['violet', 'red', 'green', 'orange'] as const)[i % 4]}`} href={a.url} target="_blank" rel="noreferrer">
          <span className="icon-chip icon-chip--sm">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {a.connected
                ? <><circle cx="12" cy="12" r="3" /><path d="M12 3v6M12 15v6M3 12h6M15 12h6" /></>
                : <><rect x="3.5" y="3.5" width="17" height="17" rx="4" /></>}
            </svg>
          </span>
          <div style={{ minWidth: 0 }}>
            <p className="launch__name">{a.name}</p>
            <p className="launch__note">{a.connected ? `${a.note} · wired` : a.note}</p>
          </div>
        </a>
      ))}
    </div>
  );
}

/** Says where the rows on screen came from. Honest by default. */
/** One line per failed read; the bundle joins them with newlines. */
const errorLines = (e: string) => e.split('\n').filter(Boolean);

export function SourceNote({
  source, error, missingEnv = [],
}: {
  source: 'supabase' | 'seed';
  error?: string | null;
  missingEnv?: string[];
}) {
  if (source === 'supabase' && !error) return null;
  return (
    <div className="notice">
      <span className="icon-chip icon-chip--sm accent-orange">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" aria-hidden="true">
          <circle cx="12" cy="12" r="8.5" /><path d="M12 8v5M12 16h.01" />
        </svg>
      </span>
      <div>
        <p className="row__title" style={{ fontSize: 14 }}>
          {!error ? 'Running on seed data'
            : source === 'seed' ? 'Supabase query failed — showing seed data'
            : `${errorLines(error).length === 1 ? 'A table' : `${errorLines(error).length} tables`} could not be read — everything else reads normally`}
        </p>
        {error ? (
          <ul className="muted notice__list" style={{ marginTop: 2 }}>
            {errorLines(error).map((e) => <li key={e}>{e}</li>)}
          </ul>
        ) : (
          <p className="muted" style={{ marginTop: 2 }}>
            {missingEnv.length > 0
              ? `This build could not see ${missingEnv.join(' or ')}. Check the name in Vercel matches character for character, then redeploy.`
              : 'The database is configured but returned no rows.'}
          </p>
        )}
      </div>
    </div>
  );
}
