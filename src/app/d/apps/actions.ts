'use server';

/**
 * Vibe Coding › Refresh (Giulia, 13 Oct 2026): start the routine in Claude
 * Code that brings the project list up to date with her sessions. The
 * routine does the work (it reads her session list and runs
 * sync_code_projects, 0022); this only starts it, and says where to watch it.
 *
 * Two settings in Vercel, both from the routine's API trigger at
 * claude.ai/code/routines:
 *   VIBE_REFRESH_URL     https://api.anthropic.com/v1/claude_code/routines/trig_…/fire
 *   VIBE_REFRESH_TOKEN   the token shown once when it is generated (sk-ant-oat01-…)
 */
type Result = { error: string | null; sessionUrl?: string };

const FIRE_URL = /^https:\/\/api\.anthropic\.com\/v1\/claude_code\/routines\/trig_[A-Za-z0-9]+\/fire$/;

export async function refreshProjects(): Promise<Result> {
  const url = process.env.VIBE_REFRESH_URL?.trim();
  const token = process.env.VIBE_REFRESH_TOKEN?.trim();
  const missing = [url ? null : 'VIBE_REFRESH_URL', token ? null : 'VIBE_REFRESH_TOKEN'].filter(Boolean);
  if (missing.length) return { error: `Refresh is not set up yet: ${missing.join(' and ')} ${missing.length > 1 ? 'are' : 'is'} missing in Vercel.` };
  if (!FIRE_URL.test(url!)) return { error: 'VIBE_REFRESH_URL is not the address of a routine (…/v1/claude_code/routines/trig_…/fire).' };
  try {
    const r = await fetch(url!, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'Refresh started from Vibe Coding.' }),
      cache: 'no-store',
    });
    const body = await r.json().catch(() => null) as { claude_code_session_url?: string; error?: { message?: string } } | null;
    if (r.ok) return { error: null, sessionUrl: body?.claude_code_session_url };
    const why: Record<number, string> = {
      400: 'The routine is paused, or the request was refused.',
      401: 'The token does not match the routine: generate a new one and put it in VIBE_REFRESH_TOKEN.',
      404: 'The routine does not exist any more: check VIBE_REFRESH_URL.',
      429: 'Too many refreshes in the last hour; try again a little later.',
    };
    return { error: why[r.status] ?? `Claude did not start the refresh (${r.status}${body?.error?.message ? `: ${body.error.message}` : ''}).` };
  } catch {
    return { error: 'Could not reach Claude to start the refresh.' };
  }
}
