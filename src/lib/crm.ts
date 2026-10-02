/**
 * The client database.
 *
 * Supabase is where the CRM is worked; Notion keeps the copy, pushed from
 * here. Fields marked `notion` in the migration round-trip; the rest exist
 * only here because Notion has no column for them — most importantly the
 * contacts, which Notion holds as one free-text name per client.
 */

export type ClientStatus = 'active' | 'contact' | 'sleeping' | 'done' | 'archived';

export type ClientPhase =
  | 'consultancy' | 'architecture' | 'branding' | 'welcome' | 'onboarding'
  | 'content' | 'landing_page' | 'events' | 'payment_plans' | 'bucket';

export type ClientPriority = 'high' | 'normal' | 'low' | 'later';
export type ClientSource = 'upwork' | 'direct' | 'referral' | 'community' | 'unknown';

export type Company = {
  id: string;
  name: string;
  legalName: string | null;
  status: ClientStatus;
  phase: ClientPhase | null;
  priority: ClientPriority | null;
  source: ClientSource;

  website: string | null;
  communityUrl: string | null;
  communityPlatform: string | null;
  upworkUrl: string | null;
  slackUrl: string | null;
  mcpServer: string | null;

  notes: string | null;
  remarks: string | null;

  hasAutomations: boolean;
  hasContentBot: boolean;
  hasCm: boolean;
  inMighty: boolean;
  inKit: boolean;

  notionUrl: string | null;
  /** True when this row has changed since it was last pushed to Notion. */
  pendingPush: boolean;
  updatedAt: string | null;
};

export type Contact = {
  id: string;
  companyId: string;
  firstName: string;
  lastName: string;
  credentials: string | null;
  role: string | null;
  email: string | null;
  phone: string | null;
  linkedinUrl: string | null;
  upworkUrl: string | null;
  isPrimary: boolean;
  source: ClientSource;
  /** The name was inferred rather than confirmed — the UI asks rather than hides it. */
  needsCheck: boolean;
  notes: string | null;
};

export type ClientApp = {
  id: string;
  companyId: string;
  name: string;
  kind: 'app' | 'bot' | 'automation' | 'landing_page' | 'integration' | 'site';
  state: 'live' | 'building' | 'paused' | 'retired';
  liveUrl: string | null;
  repoUrl: string | null;
  host: string | null;
  description: string | null;
  shippedAt: string | null;
};

// ------------------------------------------------------------------ labels

/** Exactly the options in her Notion status field — emoji, casing, order. */
export const STATUS_LABEL: Record<ClientStatus, string> = {
  active: '🟢 ACTIVE',
  contact: '☎️ CONTACT',
  sleeping: '😴 SLEEPING',
  done: '✅ DONE',
  archived: '📦 ARCHIVE',
};

/** Notion's sort: live work first, history last. */
export const STATUS_ORDER: ClientStatus[] = ['active', 'contact', 'sleeping', 'done', 'archived'];

/** DONE and ARCHIVE start folded so the working three are what you see. */
export const STATUS_OPEN_BY_DEFAULT: Record<ClientStatus, boolean> = {
  active: true, contact: true, sleeping: true, done: false, archived: false,
};

export const PHASE_LABEL: Record<ClientPhase, string> = {
  consultancy: 'Consultancy',
  architecture: 'Architecture',
  branding: 'Branding',
  welcome: 'Welcome',
  onboarding: 'Onboarding',
  content: 'Content',
  landing_page: 'Landing page',
  events: 'Events & experiences',
  payment_plans: 'Payment plans',
  bucket: 'Bucket',
};

// --------------------------------------------------------------- selectors

export const fullName = (c: Contact) =>
  [c.firstName, c.lastName].filter(Boolean).join(' ') + (c.credentials ? `, ${c.credentials}` : '');

export const contactsFor = (rows: Contact[], companyId: string) =>
  rows
    .filter((c) => c.companyId === companyId)
    .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary));

export const primaryContact = (rows: Contact[], companyId: string) =>
  rows.find((c) => c.companyId === companyId && c.isPrimary)
  ?? rows.find((c) => c.companyId === companyId)
  ?? null;

export const appsFor = (rows: ClientApp[], companyId: string) =>
  rows.filter((a) => a.companyId === companyId);

export const byStatus = (rows: Company[], status: ClientStatus) =>
  rows.filter((c) => c.status === status);

/** Companies whose contact list has a name we guessed rather than confirmed. */
export const needsCheck = (rows: Contact[]) => rows.filter((c) => c.needsCheck);

/**
 * Every outbound link a company has, in the order she actually uses them.
 * Returned as a list so the detail page never hard-codes which ones exist.
 */
export function companyLinks(c: Company): { label: string; url: string }[] {
  return [
    ['Community', c.communityUrl],
    ['Upwork', c.upworkUrl],
    ['Website', c.website],
    ['Slack', c.slackUrl],
    ['Notion', c.notionUrl],
  ].filter((x): x is [string, string] => Boolean(x[1]))
   .map(([label, url]) => ({ label, url }));
}

/** The platform a community actually runs on — Mighty Networks, or its own domain. */
export function platformOf(c: Company): string | null {
  if (c.communityPlatform) return c.communityPlatform;
  if (!c.communityUrl) return null;
  try {
    const host = new URL(c.communityUrl).hostname.replace(/^www\./, '');
    return host.endsWith('.mn.co') ? 'Mighty Networks' : host;
  } catch {
    return null;
  }
}

/** Mighty Networks (or whatever platform hosts them) and the Upwork room. */
export function goLinks(c: Company): { label: string; url: string }[] {
  const out: { label: string; url: string }[] = [];
  if (c.communityUrl) out.push({ label: platformOf(c) ?? 'Community', url: c.communityUrl });
  if (c.upworkUrl) out.push({ label: 'Upwork', url: c.upworkUrl });
  return out;
}

// ------------------------------------------------------------- the email list

/** One address in the CRM's email list. The email is the key. */
export type CrmEmail = {
  email: string;
  firstName: string | null;
  lastName: string | null;
  city: string | null;
  state: string | null;
  /** Where it came from: a community, Kit, the website, … her words. */
  source: string | null;
  isClient: boolean;
  inCommunity: boolean;
  notes: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};
