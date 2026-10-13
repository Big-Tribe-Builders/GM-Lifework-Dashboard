/**
 * A code project: one Claude Code session and the repository behind it.
 *
 * Read from code_projects in Supabase. The session link opens that project's
 * session; the repo link its code; liveUrl is the deployment once one has
 * been read from the host. Everything here is what the session records say,
 * plus what she has told us about hosting.
 */
/** Where a project stands, her call, set from the grid. */
export type ProjectStage = 'building' | 'live' | 'archived';

export const STAGES: { value: ProjectStage; label: string }[] = [
  { value: 'building', label: 'Building' },
  { value: 'live', label: 'Live' },
  { value: 'archived', label: 'Archived' },
];

export type CodeProject = {
  sessionId: string;
  name: string;
  client: string | null;
  repoUrl: string | null;
  repo: string | null;
  branch: string | null;
  host: string | null;
  liveUrl: string | null;
  framework: string | null;
  database: string | null;
  auth: string | null;
  services: string | null;
  sessionState: string | null;
  workState: string | null;
  lastAction: string | null;
  updatedAt: string | null;
  sessionUrl: string;
  status: ProjectStage;
  /** Ticked: she is working on it now (Vibe Coding › Building). */
  workingOn?: boolean;
  /** Her order of priority, 1 first; none yet means after the numbered ones. */
  priority?: number | null;
};

/** The priority order: numbered first (1, 2, 3 …), then the rest by name. */
export const byPriority = (a: CodeProject, b: CodeProject) =>
  (a.priority ?? Number.MAX_SAFE_INTEGER) - (b.priority ?? Number.MAX_SAFE_INTEGER) || a.name.localeCompare(b.name);

/** The sidebar's order: her clients as she groups them there. */
export const byClient = (rows: CodeProject[]) => {
  const map = new Map<string, CodeProject[]>();
  for (const r of rows) {
    const k = r.client ?? 'Other';
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(r);
  }
  for (const list of map.values()) list.sort((a, b) => a.name.localeCompare(b.name));
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
};

export const WORK_LABEL: Record<string, string> = {
  completed: 'Done',
  need_input: 'Needs you',
  review_ready: 'Ready to review',
};
