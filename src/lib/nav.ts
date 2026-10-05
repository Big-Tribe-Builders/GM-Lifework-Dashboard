/**
 * The information architecture.
 *
 * Two rules decide everything here:
 *
 *   1. The left rail is WHERE you are. It is stable, it never reorders, and
 *      you learn it once. Twelve destinations in five groups.
 *   2. The tab strip is WHAT you are looking at inside that place. Maximum
 *      five tabs, and there is no level below it. If something needs a third
 *      level, it is its own domain or it is a link out.
 *
 * Anything that would be a fourth click is instead reachable from the command
 * palette (cmd-K) or the pin rail.
 */

export type IconName =
  | 'home' | 'tribe' | 'academy' | 'star' | 'users' | 'briefcase'
  | 'rocket' | 'megaphone' | 'brain' | 'book' | 'heart' | 'coins'
  | 'grid' | 'settings' | 'logout';

export type Tab = {
  slug: string;
  label: string;
  /** One line explaining what this zone is for. Shown under the page title. */
  blurb: string;
  /** The longer explanation behind the (i) button: what this is, where it
      came from, how to work with it. Paragraphs separated by blank lines. */
  help?: string;
};

export type Domain = {
  slug: string;
  label: string;
  /** Sidebar group heading. */
  group: DomainGroup;
  icon: IconName;
  /** Rotates violet -> red -> green -> orange. Decoration only, never meaning. */
  accent: Accent;
  /** Shown as the page subtitle on the domain's own page. */
  blurb: string;
  tabs: Tab[];
};

export type Accent = 'violet' | 'red' | 'green' | 'orange';
export type DomainGroup = 'Ventures' | 'Work' | 'Intelligence' | 'Life';

export const GROUP_ORDER: DomainGroup[] = ['Ventures', 'Work', 'Intelligence', 'Life'];

/** Rotate the four so no two neighbours in a list ever match. */
export function accentAt(index: number): Accent {
  return (['violet', 'red', 'green', 'orange'] as const)[index % 4];
}

export const DOMAINS: Domain[] = [
  // ---------------------------------------------------------------- Ventures
  {
    slug: 'big-tribe-builders',
    label: 'Big Tribe Builders',
    group: 'Ventures',
    icon: 'tribe',
    accent: 'violet',
    blurb: 'Elite advisory for communities at scale. Build big. Stay human.',
    tabs: [
      { slug: 'pulse', label: 'Pulse', blurb: 'What moved, and what needs you.', help: 'What it is: a feed of things that moved and need you — a signal, not a to-do. Think "a client went quiet", "a webinar filled up", "a payment failed".\n\nWhere it comes from: my first sketch of the venture. Nothing feeds it yet, so it is empty.\n\nHow we would use it: once sources are connected (Mighty Networks, Kit, the CRM), signals land here automatically and you clear them. Until then it can stay empty or be removed — your call.' },
      { slug: 'roadmap', label: 'Roadmap', blurb: 'The quarter: what we do, who does it, how far along it is.', help: 'What it is: the quarter\'s plan. One line per thing we do, in a lane (QuinB → BTB, Webinars, Marketing, Sales, Clients), with who does it, status, % done and start/end dates. The bars above are the same lines drawn across the 13 weeks of the quarter; the filled part is % done, the red line is today.\n\nWhere it comes from: your words on 5 October about Q4 — QuinB becomes Big Tribe Builders, two or three products, the webinars you and Marty give, social storytelling, emails, first products sold, bigger or smaller new clients. I spread them over October–December as a proposal; the dates are yours to move.\n\nThe method behind it: a quarterly roadmap as planning tools do it (Asana timeline, Monday). Each line answers four questions: what, who, when, how far. Lanes keep the same kind of work together and give each its own colour. Status is To do → Doing → Done; Parked is for things we decided not to do now.\n\nHow we work with it: Monday, open it together, move % done, change dates, add lines with the row above the grid. Everything is typed straight into the cell.' },
      { slug: 'experiments', label: 'Experiments', blurb: 'Marketing tests: what we tried, what we learned.', help: 'What it is: the marketing tests. Each line is one thing we try — "We believe that…" (the hypothesis), the channel, who runs it, when, what happened, what we learned.\n\nWhere it comes from: you asked for marketing tests and research in the launch plan. Writing the hypothesis down first is what makes it a test rather than an activity: afterwards we know whether we were right.\n\nHow we work with it: add a test when we start one. Close it with a result and one line of learning. The learnings are what the roadmap\'s next quarter is built from.' },
      { slug: 'playbook', label: 'Playbook', blurb: 'StoryBrand and Seth Godin, answered for BTB.', help: 'What it is: the frameworks you named — Donald Miller\'s StoryBrand and Seth Godin\'s Purple Cow and This Is Marketing — turned into questions, each with a BTB answer. Plus "Our story", the move from QuinB to Big Tribe Builders in your own words.\n\nWhere the answers come from: the BTB team memory (positioning, ideal client, tagline, stakes, ROOTS) and your message of 5 October. Nothing is invented; what the memory did not hold is left for you.\n\nHow we work with it: it is the source every webinar, email and post is written from. When the story changes, change it here first.' },
      { slug: 'engagements', label: 'Engagements', blurb: 'Live advisory work, by client and by ROOTS phase.', help: 'What it is: meant to be the live advisory work with clients — which client, which ROOTS phase they are in, what is open.\n\nWhere it comes from: my first sketch. Right now it only shows open Big Tribe Builders tasks, which is not the same thing.\n\nHow we would use it: once the first 1:1 clients and bootcamp seats are sold, each becomes a line here. Until then it can stay or go.' },
      { slug: 'roots', label: 'ROOTS', blurb: 'The five-pillar method, and where each client sits in it.', help: 'What it is: your five-pillar method — Root the Architecture, Orchestrate the Experience, Optimize the Offer, Tribe-Build the Audience, Systemize the Intelligence — one line each with what the pillar covers.\n\nWhere it comes from: your own ROOTS method, as recorded in the BTB team memory and the BTB website work.\n\nHow we would use it: as the reference the Roadmap and the Playbook point to, and later as the column where each client\'s engagement sits (which pillar they are in).' },
      { slug: 'pipeline', label: 'Pipeline', blurb: 'Calls booked, proposals out, and who to chase.', help: 'What it is: meant to be the sales pipeline — calls booked, proposals out, who to chase.\n\nWhere it comes from: my first sketch. Right now it shows open tasks, not a pipeline.\n\nHow we would use it: the webinars will produce leads; each becomes a line here with a stage. If you prefer to keep that in the CRM, this tab can go.' },
      { slug: 'assets', label: 'Assets', blurb: 'Decks, blueprints, playbooks and the reusable library.', help: 'What it is: meant to be the reusable library — decks, blueprints, playbooks, templates.\n\nWhere it comes from: my first sketch. Nothing feeds it yet.\n\nHow we would use it: a line per asset with a link. Or remove it.' },
    ],
  },
  {
    slug: 'quinb-academy',
    label: 'QuinB Academy',
    group: 'Ventures',
    icon: 'academy',
    accent: 'red',
    blurb: "A host's home base — resources, live meetups, and the peer room of outstanding hosts.",
    tabs: [
      { slug: 'pulse', label: 'Pulse', blurb: 'Members, energy and what needs a host right now.' },
      { slug: 'members', label: 'Members', blurb: 'Joins, activations and the ones going quiet.' },
      { slug: 'programme', label: 'Programme', blurb: 'Courses, live meetups and the calendar ahead.' },
      { slug: 'team', label: 'Team', blurb: 'Hosts, moderators and who owns which space.' },
      { slug: 'revenue', label: 'Revenue', blurb: 'Subscriptions, churn and the money picture.' },
    ],
  },
  {
    slug: 'giulia-may',
    label: 'Giulia May',
    group: 'Ventures',
    icon: 'star',
    accent: 'green',
    blurb: 'The authority hub — the book, the speaking, the public record of who you are.',
    tabs: [
      { slug: 'book', label: 'The Book', blurb: 'Fifteen chapters, and where each one stands.' },
      { slug: 'speaking', label: 'Speaking', blurb: 'Podcasts, stages and inbound invitations.' },
      { slug: 'site', label: 'Website', blurb: 'giuliamay.com — what is live and what is queued.' },
      { slug: 'list', label: 'Audience', blurb: 'Newsletter, subscribers and the free resources.' },
    ],
  },

  // -------------------------------------------------------------------- Work
  {
    slug: 'clients',
    label: 'CRM',
    group: 'Work',
    icon: 'users',
    accent: 'orange',
    blurb: '',
    // One list, no sub-zones. Status is a column here, not a tab — splitting
    // the clients across five tabs hid the ones she was looking for.
    tabs: [
      { slug: 'all', label: 'All clients', blurb: '' },
      { slug: 'emails', label: 'Emails', blurb: 'Every address you have, and where it came from.' },
    ],
  },
  {
    slug: 'upwork',
    label: 'Upwork',
    group: 'Work',
    icon: 'briefcase',
    accent: 'violet',
    blurb: 'Inbound work — every conversation, who became a client, and what they paid.',
    // Three tabs, not five. Contracts and financials are not places you go:
    // they are two columns on the client you are already looking at, and
    // offers are proposals that were answered.
    tabs: [
      { slug: 'messages', label: 'Messages', blurb: 'Every conversation, newest first.' },
      { slug: 'clients', label: 'Clients', blurb: 'Who signed, and what they paid.' },
      { slug: 'proposals', label: 'Proposals', blurb: 'Sent, and what came of them.' },
    ],
  },
  {
    slug: 'apps',
    label: 'Applications',
    group: 'Work',
    icon: 'rocket',
    accent: 'red',
    blurb: 'Everything you and the team have shipped, and whether it is still up.',
    tabs: [
      { slug: 'live', label: 'Live', blurb: 'What is deployed right now, and its health.' },
      { slug: 'building', label: 'Building', blurb: 'In flight — branches, worktrees and open gates.' },
      { slug: 'archived', label: 'Archived', blurb: 'Done with, kept for the record.' },
      { slug: 'workers', label: 'Workers', blurb: 'Who is building what, and what is waiting on you.' },
    ],
  },
  {
    slug: 'content',
    label: 'Content & Social',
    group: 'Work',
    icon: 'megaphone',
    accent: 'green',
    blurb: 'One pipeline, every platform — written in your voice, not a generic one.',
    tabs: [
      { slug: 'today', label: 'Today', blurb: 'What goes out today, and what needs approving.' },
      { slug: 'pipeline', label: 'Pipeline', blurb: 'Idea to draft to scheduled, across all channels.' },
      { slug: 'channels', label: 'Channels', blurb: 'LinkedIn, email, YouTube — reach and cadence.' },
      { slug: 'campaigns', label: 'Campaigns', blurb: 'Multi-post arcs tied to a launch or a theme.' },
      { slug: 'voice', label: 'Voice', blurb: 'The rules every draft is checked against.' },
    ],
  },

  // ------------------------------------------------------------ Intelligence
  {
    slug: 'brain',
    label: 'The Brain',
    group: 'Intelligence',
    icon: 'brain',
    accent: 'orange',
    blurb: 'Your own intelligence — voice, method, books and sources — wired to everything else.',
    tabs: [
      { slug: 'voice', label: 'Voice', blurb: 'How you sound, in rules a machine can actually apply.' },
      { slug: 'method', label: 'Method', blurb: 'ROOTS and the frameworks you work from.' },
      { slug: 'library', label: 'Library', blurb: 'Books, transcripts and the raw material.' },
      { slug: 'sources', label: 'Sources', blurb: 'Connected servers and what each one can reach.' },
      { slug: 'prompts', label: 'Prompts', blurb: 'Saved moves you run again and again.' },
    ],
  },

  // -------------------------------------------------------------------- Life
  {
    slug: 'studying',
    label: 'Studying',
    group: 'Life',
    icon: 'book',
    accent: 'violet',
    blurb: 'SPI Academy and everything else you are actively learning.',
    tabs: [
      { slug: 'next', label: 'Next up', blurb: 'The next lesson, and the plan for this week.' },
      { slug: 'courses', label: 'Courses', blurb: 'Every course, and how far through you are.' },
      { slug: 'notes', label: 'Notes', blurb: 'What you took from it, in your words.' },
      { slug: 'apply', label: 'Apply', blurb: 'Lessons turned into actual work.' },
    ],
  },
  {
    slug: 'fitness',
    label: 'Fitness',
    group: 'Life',
    icon: 'heart',
    accent: 'red',
    blurb: 'The non-negotiable one. Sports area of the Goal Navigator.',
    tabs: [
      { slug: 'week', label: 'This week', blurb: 'Planned, done and missed.' },
      { slug: 'plan', label: 'Plan', blurb: 'The routine you are actually following.' },
      { slug: 'trend', label: 'Trend', blurb: 'Consistency over weeks, not days.' },
    ],
  },
  {
    slug: 'accountancy',
    label: 'Accountancy',
    group: 'Life',
    icon: 'coins',
    accent: 'green',
    blurb: 'Invoices out, money in, and nothing missed at quarter end.',
    tabs: [
      { slug: 'overview', label: 'Overview', blurb: 'Where the money stands this month.' },
      { slug: 'invoices', label: 'Invoices', blurb: 'Sent, paid and overdue.' },
      { slug: 'expenses', label: 'Expenses', blurb: 'Subscriptions and what they cost you a year.' },
      { slug: 'vat', label: 'VAT & filings', blurb: 'Deadlines that carry a fine.' },
    ],
  },
];

export const DOMAIN_BY_SLUG = new Map(DOMAINS.map((d) => [d.slug, d]));

export function domainsInGroup(group: DomainGroup): Domain[] {
  return DOMAINS.filter((d) => d.group === group);
}

/** The tab to land on when a domain is opened with no tab named. */
export function defaultTab(domain: Domain): Tab {
  return domain.tabs[0];
}

export function findTab(domain: Domain, slug: string | undefined): Tab {
  if (!slug) return defaultTab(domain);
  return domain.tabs.find((t) => t.slug === slug) ?? defaultTab(domain);
}

/**
 * What she has renamed or recoloured, from the database.
 *
 * The rail and the tabs stay in this file: that is the architecture, and it
 * is code. Only these three are hers to change from the interface, so a
 * rename never needs a deploy.
 */
export type DomainOverride = {
  slug: string;
  name: string | null;
  icon: string | null;
  accent: string | null;
  /** Which collection it sits in, when she has moved it out of its original. */
  groupName?: string | null;
  /** Its place inside that collection. Null means "wherever the code puts it". */
  sortOrder?: number | null;
};

/** The order of the collections themselves. */
export type CollectionOrder = { name: string; sortOrder: number };

/** One collection and the spaces in it, in the order they should be drawn. */
export type NavSection = { group: string; domains: Domain[] };

/**
 * The rail as it should actually be drawn.
 *
 * nav.ts says what exists; this applies what she has moved. Anything without
 * a stored place keeps the order it has in the code, so a half-finished
 * reorder never scrambles the rest.
 */
export function resolveNav(
  overrides: Record<string, DomainOverride> = {},
  collections: CollectionOrder[] = [],
): NavSection[] {
  const codeIndex = new Map(DOMAINS.map((d, i) => [d.slug, i]));
  const collectionAt = new Map(collections.map((c) => [c.name, c.sortOrder]));

  const sections = new Map<string, Domain[]>();
  // Every collection the code knows keeps its heading even when emptied, so a
  // space can always be moved back into one.
  for (const g of GROUP_ORDER) sections.set(g, []);

  for (const base of DOMAINS) {
    const o = overrides[base.slug];
    const group = o?.groupName && sections.has(o.groupName) ? o.groupName : base.group;
    sections.get(group)!.push(withOverride(base, o));
  }

  const place = (d: Domain) => overrides[d.slug]?.sortOrder ?? (codeIndex.get(d.slug)! + 1000);

  return [...sections.entries()]
    .map(([group, domains]) => ({
      group,
      domains: domains.sort((a, b) => place(a) - place(b) || a.label.localeCompare(b.label)),
    }))
    .filter((s) => s.domains.length > 0)
    .sort((a, b) => {
      const ai = collectionAt.get(a.group) ?? (GROUP_ORDER.indexOf(a.group as DomainGroup) + 1000);
      const bi = collectionAt.get(b.group) ?? (GROUP_ORDER.indexOf(b.group as DomainGroup) + 1000);
      return ai - bi;
    });
}

const ICON_NAMES = new Set<string>([
  'home', 'tribe', 'academy', 'star', 'users', 'briefcase',
  'rocket', 'megaphone', 'brain', 'book', 'heart', 'coins', 'grid', 'settings',
]);
const ACCENTS = new Set<string>(['violet', 'red', 'green', 'orange']);

/** Every icon she can pick from, in the order the picker shows them. */
export const ICON_CHOICES = [...ICON_NAMES] as IconName[];
export const ACCENT_CHOICES = [...ACCENTS] as Accent[];

/**
 * A stored value that is not one of ours is ignored rather than rendered.
 * A typo in the database should not be able to blank an icon or break a class.
 */
export function withOverride(d: Domain, o?: DomainOverride | null): Domain {
  if (!o) return d;
  return {
    ...d,
    label: o.name?.trim() ? o.name.trim() : d.label,
    icon: o.icon && ICON_NAMES.has(o.icon) ? (o.icon as IconName) : d.icon,
    accent: o.accent && ACCENTS.has(o.accent) ? (o.accent as Accent) : d.accent,
  };
}

export function overrideMap(rows: DomainOverride[]): Record<string, DomainOverride> {
  return Object.fromEntries(rows.map((r) => [r.slug, r]));
}

export function domainHref(domain: Domain, tab?: string): string {
  const t = tab ?? defaultTab(domain).slug;
  return `/d/${domain.slug}/${t}`;
}
