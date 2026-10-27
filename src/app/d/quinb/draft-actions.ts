'use server';

import { getSupabase } from '@/lib/supabase';
import type { QuinbMember } from '@/lib/book';
import { mightyReady } from '@/lib/mighty';
import { signedIn } from '@/lib/mighty-oauth';
import { followupsDb, followupOf, FOLLOWUP_COLS, FOLLOWUPS_NEED_ADMIN } from '@/lib/followups-db';
import { draftRequest, VOICE_EXAMPLES, type VoiceExample } from '@/lib/draft-prompt';
import { draftMessage } from '@/lib/draft';
import { todayBrussels } from '@/lib/followups';
import { keptConversations } from '@/components/QuinbLive';

/**
 * Draft with Claude: a draft for the message box, from the member's facts,
 * what was written before, and up to ten of Giulia's own recent comments in
 * QuinB (the ones Conversations already reads, from its cache) as examples
 * of her voice. Refuses without a signed-in user. Never sends.
 */
export async function draftWithClaude(memberId: string): Promise<{ error: string | null; draft?: string; note?: string }> {
  const gate = await signedIn();
  if (!gate.ok) return { error: gate.why };
  const db = getSupabase();
  if (!db) return { error: 'Supabase is not configured.' };
  const log = followupsDb();
  if (!log) return { error: FOLLOWUPS_NEED_ADMIN };
  const [mem, fu] = await Promise.all([
    db.from('quinb_members_api').select('*').eq('id', memberId).maybeSingle(),
    log.from('quinb_followups').select(FOLLOWUP_COLS).eq('member_id', memberId),
  ]);
  const err = mem.error ?? fu.error;
  if (err) return { error: err.message };
  const member = mem.data as QuinbMember | null;
  if (!member) return { error: 'This member is no longer in the list.' };

  let examples: VoiceExample[] = [];
  let note: string | undefined;
  if (!mightyReady().ok) {
    note = 'Drafted without examples of your comments: the QuinB key for Conversations is not set.';
  } else {
    try {
      const read = await keptConversations();
      examples = read.threads
        .flatMap((t) => t.comments)
        .filter((n) => n.mine && n.text.trim())
        .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
        .slice(0, VOICE_EXAMPLES)
        .map((n) => ({ text: n.text, at: n.at }));
      if (!examples.length) note = 'Drafted without examples of your comments: none of yours in the last 30 days.';
    } catch (e) {
      note = `Drafted without examples of your comments: ${e instanceof Error ? e.message : 'Conversations could not be read.'}`;
    }
  }

  const r = await draftMessage(draftRequest(member, (fu.data ?? []).map(followupOf), examples, todayBrussels()));
  if ('error' in r) return { error: r.error };
  return { error: null, draft: r.text, note };
}
