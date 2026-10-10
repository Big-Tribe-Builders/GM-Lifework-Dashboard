import {
  getTasks, getApps, getBrainSources, getVoiceRules,
  getContent, getCourses, getGoals, getSignals,
  getCompanies, getContacts, getClientApps, getCrmEmails,
  getUpworkLeads, getUpworkInvoices, getUpworkJobs, getCodeProjects,
  getBtbPlan, getBtbExperiments, getBtbPlaybook, getPulseDismissed,
  getYearGoals, getQuarterGoals, getActionPoints,
  getMailLists, getMailListMembers, getMailTemplates, getMailSenders, getMailCampaigns, getMailSteps, getMailSends, getMailSuppressions,
  getBook, getChapters, getQuinbMembers, getQuinbPosts, getQuinbYears, getQuinbMonths, getQuinbWeeks, getQuinbPostTypes,
} from '@/lib/data';
import { missingSupabaseEnv } from '@/lib/supabase';
import { readClientTasks } from '@/lib/notion';
import type {
  Task, AppLink, BrainSource, VoiceRule,
  ContentItem, Course, GoalPeriod, Signal,
} from '@/lib/types';
import type { Company, Contact, ClientApp, CrmEmail } from '@/lib/crm';
import type { UpworkLead, UpworkInvoice, UpworkJob } from '@/lib/upwork';
import type { CodeProject } from '@/lib/projects';
import type { PlanItem, Experiment, PlaybookEntry } from '@/lib/btb';
import type { YearGoal, QuarterGoal, ActionPoint } from '@/lib/goals';
import type { MailList, MailListMember, MailTemplate, MailSender, MailCampaign, MailStep, MailSend, MailSuppression } from '@/lib/mail';
import { BOOK_ID, type Book, type Chapter, type QuinbMember } from '@/lib/book';
import type { QuinbPost, QuinbYear, QuinbMonth, QuinbWeek, QuinbPostType } from '@/lib/quinb';

/**
 * Every domain page reads the same bundle.
 *
 * One round trip's worth of reads, in parallel, which keeps the view
 * functions pure: they receive data, they return JSX, they never fetch.
 *
 * The CRM (companies, contacts, apps) lives in Supabase and is read like
 * everything else. `clientTasks` is the exception: open client work still
 * lives in Notion's Daily Tasks, so it is read per request and not stored.
 */
export type Bundle = {
  tasks: Task[];
  apps: AppLink[];
  brainSources: BrainSource[];
  voiceRules: VoiceRule[];
  content: ContentItem[];
  courses: Course[];
  goals: GoalPeriod[];
  signals: Signal[];
  source: 'supabase' | 'seed';
  error: string | null;

  /** The CRM, from Supabase. */
  companies: Company[];
  contacts: Contact[];
  clientApps: ClientApp[];
  /** The email list, from Supabase. */
  crmEmails: CrmEmail[];
  /** False when Supabase is not configured, so the zone can say so. */
  crmConnected: boolean;
  /** Public env vars this build could not see. Empty when both are present. */
  missingEnv: string[];

  /** Upwork, imported from the freelancer account. Read-only here. */
  upworkLeads: UpworkLead[];
  upworkInvoices: UpworkInvoice[];
  upworkJobs: UpworkJob[];

  /** Open client work, read live from Notion's Daily Tasks. Not stored. */
  clientTasks: Task[];

  /** The code projects: one per Claude Code session. */
  codeProjects: CodeProject[];

  /** Big Tribe Builders' plan. */
  btbPlan: PlanItem[];
  btbExperiments: Experiment[];
  btbPlaybook: PlaybookEntry[];
  /** Pulse lines she ticked off, by key. */
  pulseDismissed: string[];

  /** The Goal Navigator. */
  goalYears: YearGoal[];
  goalQuarters: QuarterGoal[];
  goalActions: ActionPoint[];

  /** Mailing. */
  mailLists: MailList[];
  mailListMembers: MailListMember[];
  mailTemplates: MailTemplate[];
  mailSenders: MailSender[];
  mailCampaigns: MailCampaign[];
  mailSteps: MailStep[];
  mailSends: MailSend[];
  mailSuppressions: MailSuppression[];

  /** The book, and the QuinB Academy members. */
  book: Book | null;
  chapters: Chapter[];
  quinbMembers: QuinbMember[];
  /** QuinB Community: the content plan (years, months, weeks, daily post types) and the posts. */
  quinbYears: QuinbYear[];
  quinbMonths: QuinbMonth[];
  quinbWeeks: QuinbWeek[];
  quinbPostTypes: QuinbPostType[];
  quinbPosts: QuinbPost[];
};

export async function loadAll(): Promise<Bundle> {
  const [
    tasks, apps, brainSources, voiceRules,
    content, courses, goals, signals,
    companies, contacts, clientApps, clientTasks,
    upworkLeads, upworkInvoices, upworkJobs, codeProjects, crmEmails, btbPlan, btbExperiments, btbPlaybook, pulseDismissed,
    goalYears, goalQuarters, goalActions,
    mailLists, mailListMembers, mailTemplates, mailSenders, mailCampaigns, mailSteps, mailSends, mailSuppressions,
    book, chapters, quinbMembers, quinbPosts, quinbYears, quinbMonths, quinbWeeks, quinbPostTypes,
  ] = await Promise.all([
    getTasks(), getApps(), getBrainSources(), getVoiceRules(),
    getContent(), getCourses(), getGoals(), getSignals(),
    getCompanies(), getContacts(), getClientApps(), readClientTasks(),
    getUpworkLeads(), getUpworkInvoices(), getUpworkJobs(), getCodeProjects(), getCrmEmails(),
    getBtbPlan(), getBtbExperiments(), getBtbPlaybook(), getPulseDismissed(),
    getYearGoals(), getQuarterGoals(), getActionPoints(),
    getMailLists(), getMailListMembers(), getMailTemplates(), getMailSenders(), getMailCampaigns(), getMailSteps(), getMailSends(), getMailSuppressions(),
    getBook(), getChapters(), getQuinbMembers(), getQuinbPosts(), getQuinbYears(), getQuinbMonths(), getQuinbWeeks(), getQuinbPostTypes(),
  ]);

  // Every read that failed, each message once, so one missing table cannot hide another.
  const failedReads = [
    tasks, apps, brainSources, voiceRules, content, courses, goals, signals,
    companies, contacts, clientApps, crmEmails, codeProjects, upworkJobs, btbPlan, btbExperiments, btbPlaybook, pulseDismissed,
    goalYears, goalQuarters, goalActions,
    mailLists, mailListMembers, mailTemplates, mailSenders, mailCampaigns, mailSteps, mailSends, mailSuppressions,
    book, chapters, quinbMembers, quinbPosts, quinbYears, quinbMonths, quinbWeeks, quinbPostTypes,
  ];
  const errors = [...new Set(failedReads.map((r) => r.error).filter((e): e is string => !!e))];

  return {
    tasks: tasks.rows,
    apps: apps.rows,
    brainSources: brainSources.rows,
    voiceRules: voiceRules.rows,
    content: content.rows,
    courses: courses.rows,
    goals: goals.rows,
    signals: signals.rows,
    source: tasks.source,
    error: errors.length ? errors.join('\n') : null,

    companies: companies.rows,
    contacts: contacts.rows,
    clientApps: clientApps.rows,
    crmEmails: crmEmails.rows,
    // Connected means there is real data behind the zone — from Supabase, or
    // from the local fixture while the database is still being set up.
    crmConnected: companies.source === 'supabase' || companies.rows.length > 0,
    clientTasks: clientTasks.rows,
    missingEnv: missingSupabaseEnv,

    upworkLeads: upworkLeads.rows,
    upworkInvoices: upworkInvoices.rows,
    upworkJobs: upworkJobs.rows,
    codeProjects: codeProjects.rows,
    btbPlan: btbPlan.rows,
    btbExperiments: btbExperiments.rows,
    btbPlaybook: btbPlaybook.rows,
    pulseDismissed: pulseDismissed.rows.map((r) => r.key),
    goalYears: goalYears.rows,
    goalQuarters: goalQuarters.rows,
    goalActions: goalActions.rows,
    mailLists: mailLists.rows,
    mailListMembers: mailListMembers.rows,
    mailTemplates: mailTemplates.rows,
    mailSenders: mailSenders.rows,
    mailCampaigns: mailCampaigns.rows,
    mailSteps: mailSteps.rows,
    mailSends: mailSends.rows,
    mailSuppressions: mailSuppressions.rows,
    book: book.rows.find((b) => b.id === BOOK_ID) ?? null,
    chapters: chapters.rows,
    quinbMembers: quinbMembers.rows,
    quinbYears: quinbYears.rows,
    quinbMonths: quinbMonths.rows,
    quinbWeeks: quinbWeeks.rows,
    quinbPostTypes: quinbPostTypes.rows,
    quinbPosts: quinbPosts.rows,
  };
}
