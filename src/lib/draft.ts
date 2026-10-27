import { signedIn } from '@/lib/mighty-oauth';
import { DRAFT_SYSTEM } from '@/lib/draft-prompt';

/**
 * Draft with Claude (Follow-ups): the Anthropic Messages API, called here on
 * the server with fetch. A draft only ever lands in the message box: Giulia
 * edits it, and Claude never sends anything.
 *
 * Server-only. Key: ANTHROPIC_API_KEY.
 */
export const ANTHROPIC_ENV = 'ANTHROPIC_API_KEY';
/** The model that drafts: a current Sonnet. */
export const DRAFT_MODEL = 'claude-sonnet-5-5';

export const DRAFT_KEY_HELP = `${ANTHROPIC_ENV} is not set, so Draft with Claude stays locked. Create a key in the Claude Console (platform.claude.com) under API keys, then in Vercel › Settings › Environment Variables add it as ${ANTHROPIC_ENV} and redeploy.`;

const apiKey = () => (process.env[ANTHROPIC_ENV] ?? '').trim();

/** Whether Draft with Claude works, and what stands in the way. */
export async function draftStatus(): Promise<{ ready: boolean; blockers: string[] }> {
  const gate = await signedIn();
  const blockers = [!gate.ok ? gate.why : null, !apiKey() ? DRAFT_KEY_HELP : null].filter((x): x is string => !!x);
  return { ready: !blockers.length, blockers };
}

type ApiReply = {
  content?: { type: string; text?: string }[];
  stop_reason?: string | null;
  stop_details?: { category?: string | null; explanation?: string | null } | null;
  error?: { type?: string; message?: string };
};

/**
 * One draft. Thinking stays on at low effort (a short message from the facts
 * given). Should the model decline, Anthropic's server-side fallback retries
 * on the model it recommends for that kind of decline.
 */
export async function draftMessage(request: string): Promise<{ text: string } | { error: string }> {
  const key = apiKey();
  if (!key) return { error: DRAFT_KEY_HELP };
  let res: Response;
  try {
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2026-10-21',
        'anthropic-beta': 'server-side-fallback-2026-07-01',
      },
      body: JSON.stringify({
        model: DRAFT_MODEL,
        max_tokens: 8000,
        output_config: { effort: 'low' },
        fallbacks: 'default',
        system: DRAFT_SYSTEM,
        messages: [{ role: 'user', content: request }],
      }),
      cache: 'no-store',
      signal: AbortSignal.timeout(90_000),
    });
  } catch (err) {
    return { error: `Claude could not be reached: ${err instanceof Error ? err.message : 'no answer'}.` };
  }
  const raw = await res.text();
  let j: ApiReply | null = null;
  try { j = JSON.parse(raw); } catch { /* shown as it came */ }
  if (!res.ok) {
    const words = j?.error?.message ?? (raw.trim().slice(0, 300) || res.statusText);
    const hint = res.status === 401 ? ` Anthropic does not take the ${ANTHROPIC_ENV} in Vercel; check it.`
      : res.status === 429 ? ' Too many drafts at once; try again in a minute.'
      : res.status >= 500 ? ' Anthropic is busy right now; try again shortly.' : '';
    return { error: `Claude (${res.status}): ${words}.${hint}` };
  }
  if (j?.stop_reason === 'refusal') {
    return { error: `Claude declined to draft this one${j.stop_details?.category ? ` (${j.stop_details.category})` : ''}. Write it yourself, or try again.` };
  }
  const text = (j?.content ?? []).filter((b) => b.type === 'text').map((b) => b.text ?? '').join('').trim();
  if (j?.stop_reason === 'max_tokens' || !text) return { error: 'Claude did not finish a draft. Try again.' };
  return { text };
}
