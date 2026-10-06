import {
  getTasks, getApps, getBrainSources, getVoiceRules,
  getContent, getCourses, getGoals, getSignals,
  getCompanies, getContacts, getClientApps, getCrmEmails,
  getUpworkLeads, getUpworkInvoices, getCodeProjects,
  getBtbPlan, getBtbExperiments, getBtbPlaybook, getPulseDismissed,
} from '@/lib/data';
import { missingSupabaseEnv } from '@/lib/supabase';
import { readClientTasks } from '@/lib/notion';
import type {
  Task, AppLink, BrainSource, VoiceRule,
  ContentItem, Course, GoalPeriod, Signal,
} from '@/lib/types';
import type { Company, Contact, ClientApp, CrmEmail } from '@/lib/crm';
import type { UpworkLead, UpworkInvoice } from '@/lib/upwork';
import type { CodeProject } from '@/lib/projects';
import type { PlanItem, Experiment, PlaybookEntry } from '@/lib/btb';

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
};

export async function loadAll(): Promise<Bundle> {
  const [
    tasks, apps, brainSources, voiceRules,
    content, courses, goals, signals,
    companies, contacts, clientApps, clientTasks,
    upworkLeads, upworkInvoices, codeProjects, crmEmails, btbPlan, btbExperiments, btbPlaybook, pulseDismissed,
  ] = await Promise.all([
    getTasks(), getApps(), getBrainSources(), getVoiceRules(),
    getContent(), getCourses(), getGoals(), getSignals(),
    getCompanies(), getContacts(), getClientApps(), readClientTasks(),
    getUpworkLeads(), getUpworkInvoices(), getCodeProjects(), getCrmEmails(),
    getBtbPlan(), getBtbExperiments(), getBtbPlaybook(), getPulseDismissed(),
  ]);

  // If any read fell back, say so once rather than ten times.
  const failed = [tasks, apps, brainSources, voiceRules, content, courses, goals, signals]
    .find((r) => r.error);

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
    error: failed?.error ?? null,

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
    codeProjects: codeProjects.rows,
    btbPlan: btbPlan.rows,
    btbExperiments: btbExperiments.rows,
    btbPlaybook: btbPlaybook.rows,
    pulseDismissed: pulseDismissed.rows.map((r) => r.key),
  };
}
