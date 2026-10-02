import Link from 'next/link';
import type { ReactNode } from 'react';
import type { Domain, Tab } from '@/lib/nav';
import type { Bundle } from '@/lib/data/bundle';
import type { Company } from '@/lib/crm';
import {
  STATUS_LABEL, PHASE_LABEL, fullName, contactsFor, appsFor, companyLinks, platformOf,
} from '@/lib/crm';
import { Widget, Rows, Row, Empty, Badge, SourceNote } from '@/components/ui';
import { Portal } from '@/components/views/shared';
import { ClientTable } from '@/components/ClientTable';
import { EmailTable, EMAILS_GRID } from '@/components/EmailTable';
import { Peek } from '@/components/Peek';
import { CLIENTS_GRID, columnsFor, type ViewOpts } from '@/lib/grid';

/**
 * Clients.
 *
 * One table, every client, grouped by status in Notion's order. Done and
 * archived start folded so the three she works from are what she sees.
 * The name opens the detail page; the status cell moves the row.
 */
export function clientsZone(domain: Domain, tab: Tab, b: Bundle, q = '', view: ViewOpts = {}): ReactNode {
  if (tab.slug === 'emails') return emailsView(domain, b, q, view);
  if (!b.crmConnected) return notConnected(domain, tab, b);
  return listView(domain, tab, b, q, view);
}

function emailsView(domain: Domain, b: Bundle, q: string, view: ViewOpts): ReactNode {
  return (
    <Portal note={<SourceNote source={b.source} error={b.error} missingEnv={b.missingEnv} />}>
      <EmailTable
        rows={b.crmEmails}
        q={q}
        settings={columnsFor(view.columns ?? [], EMAILS_GRID)}
        accent={domain.accent}
      />
    </Portal>
  );
}

// ------------------------------------------------------------------- list

// The top bar already says "Clients", so the page draws no heading of its own.
function listView(domain: Domain, _tab: Tab, b: Bundle, q: string, view: ViewOpts): ReactNode {
  const peek = view.peek ? b.companies.find((c) => c.id === view.peek) ?? null : null;
  const listHref = q ? `/d/clients/all?q=${encodeURIComponent(q)}` : '/d/clients/all';
  return (
    <Portal
      note={<SourceNote source={b.source} error={b.error} missingEnv={b.missingEnv} />}
    >
      <ClientTable
        companies={b.companies}
        contacts={b.contacts}
        q={q}
        settings={columnsFor(view.columns ?? [], CLIENTS_GRID)}
        accent={domain.accent}
      />
      {peek ? (
        <Peek title={peek.name} closeHref={listHref} fullHref={`/d/clients/all/${peek.id}`}>
          <CompanyCard c={peek} b={b} compact />
        </Peek>
      ) : null}
    </Portal>
  );
}

// ----------------------------------------------------------------- detail

export function companyDetail(c: Company, b: Bundle): ReactNode {
  return (
    <main className="content content--wide stack">
      <CompanyCard c={c} b={b} />
    </main>
  );
}

/**
 * The client card: the same body on the full page and in the panel. Compact
 * drops the back link, since the panel has its own way out.
 */
export function CompanyCard({ c, b, compact = false }: { c: Company; b: Bundle; compact?: boolean }) {
  const people = contactsFor(b.contacts, c.id);
  const apps = appsFor(b.clientApps, c.id);
  const links = companyLinks(c);

  return (
    <div className={compact ? 'stack card--peek' : 'stack'}>
      <div className="pagehead">
        <div className="pagehead__text">
          {compact ? null : <p><Link href="/d/clients/all" className="backlink">← All clients</Link></p>}
          <h1 className="page-title">{c.name}</h1>
          <p className="muted" style={{ marginTop: 4 }}>
            {[c.legalName, platformOf(c), c.phase ? PHASE_LABEL[c.phase] : null]
              .filter(Boolean).join(' · ') || 'No further details recorded.'}
          </p>
        </div>
        <div className="pagehead__actions">
          <span className={`status status--${c.status}`}>{STATUS_LABEL[c.status]}</span>
        </div>
      </div>

      <Widget title="Details" accent="orange">
        <dl className="facts">
          <Fact label="Status"><span className={`status status--${c.status}`}>{STATUS_LABEL[c.status]}</span></Fact>
          <Fact label="Phase">{c.phase ? PHASE_LABEL[c.phase] : '—'}</Fact>
          <Fact label="Priority">{c.priority ?? '—'}</Fact>
          <Fact label="Source">{c.source}</Fact>
          <Fact label="Platform">{platformOf(c) ?? '—'}</Fact>
          <Fact label="Legal name">{c.legalName ?? '—'}</Fact>
          <Fact label="Running">
            {[c.hasAutomations && 'Automations', c.hasContentBot && 'Content bot', c.hasCm && 'CM',
              c.inMighty && 'In Mighty', c.inKit && 'In Kit'].filter(Boolean).join(' · ') || '—'}
          </Fact>
          <Fact label="Notion">{c.notionUrl ? <a href={c.notionUrl} target="_blank" rel="noreferrer">Open ↗</a> : '—'}</Fact>
        </dl>
      </Widget>

      <Widget title="People" accent="violet" flush>
        {people.length === 0 ? <Empty>No contact recorded.</Empty> : (
          <Rows>
            {people.map((p) => (
              <Row
                key={p.id}
                title={fullName(p)}
                sub={[p.role, p.email, p.phone].filter(Boolean).join(' · ') || null}
                aside={
                  <>
                    {p.isPrimary ? <Badge tone="green">Primary</Badge> : null}
                    {p.needsCheck ? <Badge tone="orange">Check name</Badge> : null}
                  </>
                }
              />
            ))}
          </Rows>
        )}
      </Widget>

      <Widget title="Open" accent="orange" flush>
        {links.length === 0 ? <Empty>No links recorded.</Empty> : (
          <Rows>
            {links.map((l) => (
              <Row key={l.url} title={l.label} sub={l.url} href={l.url} external />
            ))}
          </Rows>
        )}
      </Widget>

      <Widget title="Built for them" accent="green" flush>
        {apps.length === 0 ? <Empty>Nothing recorded yet.</Empty> : (
          <Rows>
            {apps.map((a) => (
              <Row
                key={a.id}
                title={a.name}
                sub={[a.description, a.host].filter(Boolean).join(' · ') || null}
                href={a.liveUrl}
                external
                aside={<Badge>{a.state}</Badge>}
              />
            ))}
          </Rows>
        )}
      </Widget>

      {c.notes || c.remarks ? (
        <Widget title="Notes" accent="violet">
          {c.notes ? <p style={{ lineHeight: 1.65 }}>{c.notes}</p> : null}
          {c.remarks ? <p className="muted" style={{ marginTop: 8, lineHeight: 1.65 }}>{c.remarks}</p> : null}
        </Widget>
      ) : null}
    </div>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="facts__item">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

// ---------------------------------------------------------- not connected

function notConnected(_domain: Domain, _tab: Tab, b: Bundle): ReactNode {
  return (
    <Portal note={<SourceNote source={b.source} error={b.error} missingEnv={b.missingEnv} />}>
      <ClientTable companies={[]} contacts={[]} />
    </Portal>
  );
}
