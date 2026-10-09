import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * A local fixture, for running the CRM before Supabase exists.
 *
 * `data/clients.local.json` is gitignored. It holds real client rows, so it
 * belongs on her machine and in Supabase — never in the repository. The file
 * is optional: without it the Clients zone says it is not connected, which is
 * the honest state.
 *
 * Read once per process. This is a dev convenience, not a cache layer.
 */
export type LocalFixture = {
  companies?: unknown[];
  contacts?: unknown[];
  clientApps?: unknown[];
  codeProjects?: unknown[];
  crmEmails?: unknown[];
  btbPlan?: unknown[];
  btbExperiments?: unknown[];
  btbPlaybook?: unknown[];
  goalYears?: unknown[];
  goalQuarters?: unknown[];
  goalActions?: unknown[];
  mailLists?: unknown[];
  mailListMembers?: unknown[];
  mailTemplates?: unknown[];
  mailSenders?: unknown[];
  mailCampaigns?: unknown[];
  mailSteps?: unknown[];
  mailSends?: unknown[];
  mailSuppressions?: unknown[];
  book?: unknown[];
  chapters?: unknown[];
  quinbMembers?: unknown[];
  quinbYears?: unknown[];
  quinbMonths?: unknown[];
  quinbWeeks?: unknown[];
  quinbPostTypes?: unknown[];
  quinbPosts?: unknown[];
};

let cached: LocalFixture | null | undefined;

export function localFixture(): LocalFixture | null {
  if (cached !== undefined) return cached;

  const path = join(process.cwd(), 'data', 'clients.local.json');
  if (!existsSync(path)) {
    cached = null;
    return cached;
  }
  try {
    cached = JSON.parse(readFileSync(path, 'utf8')) as LocalFixture;
  } catch {
    // A malformed fixture must not take the dashboard down.
    cached = null;
  }
  return cached;
}

export function localRows<T>(key: keyof LocalFixture): T[] | null {
  const f = localFixture();
  const rows = f?.[key];
  return Array.isArray(rows) ? (rows as T[]) : null;
}
