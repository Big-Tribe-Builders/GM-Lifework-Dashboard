/**
 * The read layer.
 *
 * Reads go through the `*_api` views rather than the tables. The views rename
 * columns to the camelCase the TypeScript types already use, so no row ever
 * needs mapping in application code, and they carry `security_invoker` so the
 * RLS policies on the underlying tables still apply.
 *
 * Every page reads through here, never from the seed or from Supabase
 * directly. One place to change when a source goes live, and the UI never
 * learns where a row came from.
 */
import { readTable, isSupabaseConfigured, missingSupabaseEnv } from '@/lib/supabase';
import type {
  Client, Task, AppLink, BrainSource, VoiceRule,
  ContentItem, Course, GoalPeriod, Signal,
} from '@/lib/types';
import type { Company, Contact, ClientApp, CrmEmail } from '@/lib/crm';
import type { DomainOverride, CollectionOrder } from '@/lib/nav';
import type { ViewGroup } from '@/lib/palette';
import type { UpworkLead, UpworkInvoice, UpworkJob } from '@/lib/upwork';
import type { ColumnSetting } from '@/lib/grid';
import type { CodeProject } from '@/lib/projects';
import type { PlanItem, Experiment, PlaybookEntry } from '@/lib/btb';
import type { YearGoal, QuarterGoal, ActionPoint } from '@/lib/goals';
import type { Book, Chapter, QuinbMember } from '@/lib/book';
import type { QuinbPost, QuinbYear, QuinbMonth, QuinbWeek, QuinbPostType } from '@/lib/quinb';
import type { MailList, MailListMember, MailTemplate, MailSender, MailCampaign, MailStep, MailSend, MailSuppression } from '@/lib/mail';
import { localRows } from '@/lib/data/local';

import { APPS } from '@/lib/seed/apps';
import { BRAIN_SOURCES, VOICE_RULES } from '@/lib/seed/brain';
import { TASKS, CONTENT, COURSES, GOALS, SIGNALS } from '@/lib/seed/work';

export { isSupabaseConfigured, missingSupabaseEnv };

export const getTasks = () => readTable<Task>('tasks_api', TASKS);
export const getApps = () => readTable<AppLink>('app_links_api', APPS);
export const getBrainSources = () => readTable<BrainSource>('brain_sources_api', BRAIN_SOURCES);
export const getVoiceRules = () => readTable<VoiceRule>('voice_rules_api', VOICE_RULES);
export const getContent = () => readTable<ContentItem>('content_items_api', CONTENT);
export const getCourses = () => readTable<Course>('courses_api', COURSES);
export const getGoals = () => readTable<GoalPeriod>('goal_periods_api', GOALS);
export const getSignals = () => readTable<Signal>('signals_api', SIGNALS);

// The CRM. Supabase is where these are worked; Notion keeps the copy, pushed
// from here by scripts/notion-push.mjs. There is no seed: an empty client list
// is the honest answer before the import has been run.
//
// Falls back to data/clients.local.json when Supabase is not configured, so
// the CRM can be run and judged before the database exists. That file is
// gitignored: real client rows belong on her machine and in Supabase, not in
// the repository.
export const getCompanies = () =>
  readTable<Company>('client_companies_api', localRows<Company>('companies') ?? []);
export const getContacts = () =>
  readTable<Contact>('client_contacts_api', localRows<Contact>('contacts') ?? []);
export const getCrmEmails = () =>
  readTable<CrmEmail>('crm_emails_api', localRows<CrmEmail>('crmEmails') ?? []);
export const getClientApps = () =>
  readTable<ClientApp>('client_apps_api', localRows<ClientApp>('clientApps') ?? []);

// Upwork. Imported from the freelancer account, read-only here — the zone
// never calls Upwork at render time. No seed: an empty list is the honest
// answer before the import has been run.
// What she has renamed or recoloured. No seed: an empty list means every
// domain still looks the way nav.ts defines it, which is the honest default.
export const getDomainSettings = () =>
  readTable<DomainOverride>('domain_settings_api', localRows<DomainOverride>('domainSettings') ?? []);

export const getCollectionOrder = () =>
  readTable<CollectionOrder>('collection_settings_api', []);

// Column renames and glyphs, for every grid at once. Empty until she has
// changed one, and empty again if the table is not there yet — either way
// the grid draws its columns as the code names them.
export const getGridColumns = () =>
  readTable<ColumnSetting>('grid_columns_api', []);

// The colour she gave each group (a list in a gallery, a fold in a table).
// Empty until she picks one, and empty if the table is not there yet.
export const getViewGroups = () =>
  readTable<ViewGroup>('view_groups_api', localRows<ViewGroup>('viewGroups') ?? []);

// The code projects behind Applications: one row per Claude Code
// session, loaded from the session list. No seed; the local fixture serves
// the same purpose it does for clients.
//
// The status (Building | Live | Archived) travels through its own view and is
// merged here, so the original code_projects_api view never needed touching.
// A row the status view does not know is Building — the state every project
// starts in. A failed status read is surfaced, not swallowed: it means the
// 0009 migration has not been run yet.
export const getCodeProjects = async () => {
  const base = await readTable<CodeProject>(
    'code_projects_api', localRows<CodeProject>('codeProjects') ?? []);
  const stage = await readTable<{ sessionId: string; status: CodeProject['status'] }>(
    'code_projects_status_api', []);
  const by = new Map(stage.rows.map((s) => [s.sessionId, s.status]));
  return {
    ...base,
    error: base.error ?? (base.source === 'supabase' ? stage.error : null),
    rows: base.rows.map((p) => ({ ...p, status: by.get(p.sessionId) ?? p.status ?? 'building' })),
  };
};

// Big Tribe Builders' plan. Three tables, no seed.
export const getBtbPlan = () => readTable<PlanItem>('btb_plan_api', localRows<PlanItem>('btbPlan') ?? []);
export const getBtbExperiments = () => readTable<Experiment>('btb_experiments_api', localRows<Experiment>('btbExperiments') ?? []);
export const getBtbPlaybook = () => readTable<PlaybookEntry>('btb_playbook_api', localRows<PlaybookEntry>('btbPlaybook') ?? []);

// The Goal Navigator: three tables, no seed.
export const getYearGoals = () => readTable<YearGoal>('goal_years_api', localRows<YearGoal>('goalYears') ?? []);
export const getQuarterGoals = () => readTable<QuarterGoal>('goal_quarters_api', localRows<QuarterGoal>('goalQuarters') ?? []);
export const getActionPoints = () => readTable<ActionPoint>('goal_actions_api', localRows<ActionPoint>('goalActions') ?? []);

// Mailing: lists over the CRM emails, templates, senders, campaigns, sends. No seed.
export const getMailLists = () => readTable<MailList>('mail_lists_api', localRows<MailList>('mailLists') ?? []);
export const getMailListMembers = () => readTable<MailListMember>('mail_list_members_api', localRows<MailListMember>('mailListMembers') ?? []);
export const getMailTemplates = () => readTable<MailTemplate>('mail_templates_api', localRows<MailTemplate>('mailTemplates') ?? []);
export const getMailSenders = () => readTable<MailSender>('mail_senders_api', localRows<MailSender>('mailSenders') ?? []);
export const getMailCampaigns = () => readTable<MailCampaign>('mail_campaigns_api', localRows<MailCampaign>('mailCampaigns') ?? []);
export const getMailSteps = () => readTable<MailStep>('mail_sequence_steps_api', localRows<MailStep>('mailSteps') ?? []);
export const getMailSends = () => readTable<MailSend>('mail_sends_api', localRows<MailSend>('mailSends') ?? []);
export const getMailSuppressions = () => readTable<MailSuppression>('mail_suppressions_api', localRows<MailSuppression>('mailSuppressions') ?? []);

// The book and the QuinB members. No seed.
export const getBook = () => readTable<Book>('book_api', localRows<Book>('book') ?? []);
export const getChapters = () => readTable<Chapter>('book_chapters_api', localRows<Chapter>('chapters') ?? []);
export const getQuinbMembers = () => readTable<QuinbMember>('quinb_members_api', localRows<QuinbMember>('quinbMembers') ?? []);
export const getQuinbYears = () => readTable<QuinbYear>('quinb_years_api', localRows<QuinbYear>('quinbYears') ?? []);
export const getQuinbMonths = () => readTable<QuinbMonth>('quinb_months_api', localRows<QuinbMonth>('quinbMonths') ?? []);
export const getQuinbWeeks = () => readTable<QuinbWeek>('quinb_weeks_api', localRows<QuinbWeek>('quinbWeeks') ?? []);
export const getQuinbPostTypes = () => readTable<QuinbPostType>('quinb_post_types_api', localRows<QuinbPostType>('quinbPostTypes') ?? []);
export const getQuinbPosts = () => readTable<QuinbPost>('quinb_posts_api', localRows<QuinbPost>('quinbPosts') ?? []);

// Pulse lines she has ticked off, by key. No seed.
export const getPulseDismissed = () => readTable<{ key: string }>('pulse_dismissed_api', []);

export const getUpworkLeads = () => readTable<UpworkLead>('upwork_leads_api', []);
export const getUpworkInvoices = () => readTable<UpworkInvoice>('upwork_invoices_api', []);
// The job pipeline (Upwork › Proposals). No seed: jobs come from the scan.
export const getUpworkJobs = () => readTable<UpworkJob>('upwork_jobs_api', localRows<UpworkJob>('upworkJobs') ?? []);

// ---------------------------------------------------------------- selectors

// Client selectors operate on rows read live from Notion (src/lib/notion.ts).
// There is no getClients(): client data is never persisted, so there is
// nothing here to read it from.
export const activeClients = (rows: Client[]) => rows.filter((c) => c.status === 'active');
export const pipelineClients = (rows: Client[]) => rows.filter((c) => c.status === 'contact');
export const archivedClients = (rows: Client[]) =>
  rows.filter((c) => c.status === 'done' || c.status === 'sleeping' || c.status === 'archived');

export const openTasks = (rows: Task[]) => rows.filter((t) => t.status !== 'done');

export const tasksForDomain = (rows: Task[], domain: string) =>
  openTasks(rows).filter((t) => t.domain === domain);

export const tasksForClient = (rows: Task[], clientId: string) =>
  openTasks(rows).filter((t) => t.clientId === clientId);

export const appsForDomain = (rows: AppLink[], domain: string) =>
  rows.filter((a) => a.domains.includes(domain));

export const pinnedApps = (rows: AppLink[]) => rows.filter((a) => a.pinned);

/** Anything dated on or before `today`, still open. */
export function dueBy(rows: Task[], today: string): Task[] {
  return openTasks(rows)
    .filter((t) => (t.dueDate && t.dueDate <= today) || (t.doDate && t.doDate <= today))
    .sort((a, b) => (a.dueDate ?? a.doDate ?? '').localeCompare(b.dueDate ?? b.doDate ?? ''));
}

/** Europe/Brussels — her timezone, per the task-capture rules. */
export function today(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Brussels',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

export function greeting(): string {
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Brussels', hour: 'numeric', hour12: false })
      .format(new Date()),
  );
  if (hour < 6) return 'Still up';
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

/** "Fri 19 Sep" — short, unambiguous, no year unless it differs. */
export function shortDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Europe/Brussels',
  }).format(d);
}

export function relativeDay(iso: string | null, base: string): string | null {
  if (!iso) return null;
  if (iso === base) return 'Today';
  const a = new Date(`${iso}T12:00:00Z`).getTime();
  const b = new Date(`${base}T12:00:00Z`).getTime();
  const days = Math.round((a - b) / 86_400_000);
  if (days === 1) return 'Tomorrow';
  if (days === -1) return 'Yesterday';
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days <= 7) return `in ${days}d`;
  return null;
}
