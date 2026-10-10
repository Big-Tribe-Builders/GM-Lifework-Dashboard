import type { ReactNode } from 'react';
import type { Domain, Tab } from '@/lib/nav';
import type { Bundle } from '@/lib/data/bundle';
import { SourceNote } from '@/components/ui';
import { Portal } from '@/components/views/shared';
import { ZoneGrid } from '@/components/views/grids';
import type { ViewOpts } from '@/lib/grid';

import { clientsZone } from '@/components/views/clients';
import { upworkZone } from '@/components/views/upwork';
import { Roadmap, Experiments, Playbook } from '@/components/BtbPlan';
import { Pulse } from '@/components/Pulse';
import { Dashboard, RoadmapBoard, Years, Quarters, Actions, YearsGallery, QuartersGallery } from '@/components/GoalNav';
import { colorsFor } from '@/lib/palette';
import { Lists, Templates, Campaigns, type MailData } from '@/components/Mailing';
import { About, Chapters } from '@/components/Book';
import { Members } from '@/components/QuinbMembers';
import { Plan, PostTypes, Posts } from '@/components/QuinbContent';
import { CommentsTab, NewMembersTab } from '@/components/QuinbLive';
import { todayIso } from '@/lib/calendar';
import { RESEND_ENV } from '@/lib/resend';
import { pulseFor } from '@/lib/pulse';
import { columnsFor } from '@/lib/grid';

/**
 * The view registry.
 *
 * Every zone is the same grid under the same chrome. Clients and Upwork have
 * their own because they write back; everything else is columns over the
 * bundle, and a tab with no source yet still draws its columns.
 */
export function renderZone(domain: Domain, tab: Tab, b: Bundle, q = '', view: ViewOpts = {}): ReactNode {
  switch (domain.slug) {
    case 'clients': return clientsZone(domain, tab, b, q, view);
    case 'upwork': return upworkZone(domain, tab, b, q);
    case 'big-tribe-builders': return btbZone(domain, tab, b, view) ?? gridZone(domain, tab, b);
    case 'goal-navigator': return goalZone(domain, tab, b, view);
    case 'mailing': return mailingZone(domain, tab, b, view);
    case 'book': return bookZone(domain, tab, b, view);
    case 'quinb-community': return membersZone(domain, tab, b, view);
    default: return gridZone(domain, tab, b);
  }
}

/** The book: About, and the chapters with their text. */
function bookZone(domain: Domain, tab: Tab, b: Bundle, view: ViewOpts): ReactNode {
  const store = `lifework.book.${tab.slug}.cols`;
  const body = tab.slug === 'chapters'
    ? <Chapters rows={b.chapters} settings={columnsFor(view.columns ?? [], store)} accent={domain.accent} store={store} peek={view.peek} base={`/d/${domain.slug}/${tab.slug}`} />
    : <About book={b.book} />;
  return (
    <Portal note={<SourceNote source={b.source} error={b.error} missingEnv={b.missingEnv} />}>
      {body}
    </Portal>
  );
}

/**
 * QuinB Community: Comments and New members read the network itself; Mails is
 * the Mailing system narrowed to QuinB Academy; the rest is the content plan
 * and the member list.
 */
function membersZone(domain: Domain, tab: Tab, b: Bundle, view: ViewOpts): ReactNode {
  const store = `lifework.quinb-community.${tab.slug}.cols`;
  const base = `/d/${domain.slug}/${tab.slug}`;
  const today = todayIso();
  return (
    <Portal note={<SourceNote source={b.source} error={b.error} missingEnv={b.missingEnv} />}>
      {tab.slug === 'comments' ? <CommentsTab />
        : tab.slug === 'new-members' ? <NewMembersTab members={b.quinbMembers} store={store} accent={domain.accent} />
        : tab.slug === 'upcoming' ? <Posts rows={b.quinbPosts.filter((p) => !!p.plannedFor && p.plannedFor >= today && p.status !== 'posted' && p.status !== 'cancelled')}
            types={b.quinbPostTypes} settings={columnsFor(view.columns ?? [], store)} accent={domain.accent} store={store} peek={view.peek} base={base}
            empty="No posts to come. Posts with a post date from today on show here until they are posted." />
        : tab.slug === 'mails' ? <Campaigns data={mailData(b)} kind="broadcast" venture="QuinB Academy" settings={columnsFor(view.columns ?? [], store)} accent={domain.accent} store={store} peek={view.peek} base={base} />
        : tab.slug === 'strategy' ? <Plan years={b.quinbYears} months={b.quinbMonths} weeks={b.quinbWeeks} types={b.quinbPostTypes} posts={b.quinbPosts} postsHref={`/d/${domain.slug}/posts`} />
        : tab.slug === 'types' ? <PostTypes rows={b.quinbPostTypes} settings={columnsFor(view.columns ?? [], store)} accent={domain.accent} store={store} peek={view.peek} base={base} />
        : tab.slug === 'posts' ? <Posts rows={b.quinbPosts} types={b.quinbPostTypes} settings={columnsFor(view.columns ?? [], store)} accent={domain.accent} store={store} peek={view.peek} base={base} />
        : <Members rows={b.quinbMembers} settings={columnsFor(view.columns ?? [], store)} accent={domain.accent} store={store} />}
    </Portal>
  );
}

/** Everything Mailing reads. On the server, so the panel can say exactly what is missing. */
const mailData = (b: Bundle): MailData => ({
  lists: b.mailLists, members: b.mailListMembers, templates: b.mailTemplates, senders: b.mailSenders,
  campaigns: b.mailCampaigns, steps: b.mailSteps, sends: b.mailSends, suppressions: b.mailSuppressions,
  emails: b.crmEmails, resendMissing: process.env.RESEND_API_KEY ? null : RESEND_ENV,
});

/** Mailing: lists over the CRM emails, templates, campaigns, sequences. */
function mailingZone(domain: Domain, tab: Tab, b: Bundle, view: ViewOpts): ReactNode {
  const store = `lifework.mailing.${tab.slug}.cols`;
  const common = { settings: columnsFor(view.columns ?? [], store), accent: domain.accent, store, peek: view.peek, base: `/d/${domain.slug}/${tab.slug}` };
  const data = mailData(b);
  const body =
    tab.slug === 'templates' ? <Templates data={data} {...common} />
    : tab.slug === 'campaigns' ? <Campaigns data={data} kind="broadcast" {...common} />
    : tab.slug === 'sequences' ? <Campaigns data={data} kind="sequence" {...common} />
    : <Lists data={data} {...common} />;
  return (
    <Portal note={<SourceNote source={b.source} error={b.error} missingEnv={b.missingEnv} />}>
      {body}
    </Portal>
  );
}

/** The Goal Navigator: her Notion structure, five tabs over three tables. */
function goalZone(domain: Domain, tab: Tab, b: Bundle, view: ViewOpts): ReactNode {
  const store = `lifework.goals.${tab.slug}.cols`;
  const common = { settings: columnsFor(view.columns ?? [], store), accent: domain.accent, store };
  // Yearly and quarterly goals: a gallery (Trello lists) or the table, and
  // the colour she gave each year or quarter, shared by both.
  const grid = `${domain.slug}/${tab.slug}`;
  const colors = colorsFor(view.groupColors, grid);
  const base = `/d/${domain.slug}/${tab.slug}`;
  const here = view.mode && view.mode !== tab.views?.[0] ? `${base}?view=${view.mode}` : base;
  const gallery = view.mode === 'gallery';
  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Brussels' });
  const body =
    tab.slug === 'roadmap' ? <RoadmapBoard goals={b.goalQuarters} actions={b.goalActions} />
    : tab.slug === 'years' ? (gallery
      ? <YearsGallery rows={b.goalYears} quarters={b.goalQuarters} actions={b.goalActions} colors={colors} grid={grid} here={here} peek={view.peek} />
      : <Years rows={b.goalYears} colors={colors} grid={grid} {...common} />)
    : tab.slug === 'quarters' ? (gallery
      ? <QuartersGallery rows={b.goalQuarters} years={b.goalYears} actions={b.goalActions} colors={colors} grid={grid} here={here} peek={view.peek} />
      : <Quarters rows={b.goalQuarters} years={b.goalYears} actions={b.goalActions} colors={colors} grid={grid} {...common} />)
    : tab.slug === 'actions' ? <Actions rows={b.goalActions} goals={b.goalQuarters} {...common} />
    : <Dashboard goals={b.goalQuarters} actions={b.goalActions} today={today} {...common} />;
  return (
    <Portal note={<SourceNote source={b.source} error={b.error} missingEnv={b.missingEnv} />}>
      {body}
    </Portal>
  );
}

/** The three plan tabs; the rest of BTB stays on the generic grid. */
function btbZone(domain: Domain, tab: Tab, b: Bundle, view: ViewOpts): ReactNode | null {
  const store = `lifework.btb.${tab.slug}.cols`;
  const common = { settings: columnsFor(view.columns ?? [], store), accent: domain.accent, store };
  const body =
    tab.slug === 'todo' ? (
      <Pulse
        signals={pulseFor(b.btbPlan, new Set(b.pulseDismissed))}
        today={new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Brussels' })}
      />
    )
    : tab.slug === 'roadmap' ? <Roadmap rows={b.btbPlan} {...common} />
    : tab.slug === 'tests' ? <Experiments rows={b.btbExperiments} {...common} />
    : tab.slug === 'story' ? <Playbook rows={b.btbPlaybook} {...common} />
    : null;
  if (!body) return null;
  return (
    <Portal note={<SourceNote source={b.source} error={b.error} missingEnv={b.missingEnv} />}>
      {body}
    </Portal>
  );
}

function gridZone(domain: Domain, tab: Tab, b: Bundle): ReactNode {
  return (
    <Portal note={<SourceNote source={b.source} error={b.error} missingEnv={b.missingEnv} />}>
      <ZoneGrid domain={domain.slug} tab={tab.slug} blurb={tab.blurb} b={b} />
    </Portal>
  );
}

/** Counts on the tab strip. Only where the number is honest. */
export function zoneCounts(domain: Domain, b: Bundle): Record<string, number> {
  switch (domain.slug) {
    // Client counts only appear once the live Notion read has returned; an
    // unconnected zone shows no numbers rather than zeros, which would read
    // as "you have no clients".
    // Counts only once the CRM is connected; zeros would read as "you have no
    // clients", which is a different and wrong statement.
    case 'clients':
      // One tab, and the strip is not drawn for it. The status counts live on
      // the page itself, where they can be read against the list.
      return {};
    case 'content':
      return {
        today: b.content.filter((c) => c.state === 'review' || c.state === 'scheduled').length,
        pipeline: b.content.filter((c) => c.state !== 'published').length,
      };
    case 'brain':
      return { sources: b.brainSources.filter((s) => s.state === 'connected').length };
    default:
      return {};
  }
}
