import { adminClient, ADMIN_ENV } from '@/lib/auth';
import type { Followup } from '@/lib/followups';

/**
 * The follow-up log holds the texts of private messages and the start of
 * members' answers. The anon key reaches the browser, so the table has no
 * policy for anon and no *_api view: it is read and written here on the
 * server only, with the service role.
 *
 * Server-only.
 */
export const FOLLOWUPS_NEED_ADMIN = `Follow-ups needs ${ADMIN_ENV} set in Vercel. It is not set, so the follow-ups cannot be read or written: they hold the texts of private messages and are kept on the server only.`;

export const followupsDb = adminClient;

export const FOLLOWUP_COLS = 'id, member_id, written_at, via, message, note, conversation_id, conversation_url, answered_at, answered_how, answer_start';

type FollowupRow = {
  id: string; member_id: string; written_at: string; via: Followup['via']; message: string | null; note: string | null;
  conversation_id: string | null; conversation_url: string | null; answered_at: string | null; answered_how: Followup['answeredHow']; answer_start: string | null;
};

export const followupOf = (r: FollowupRow): Followup => ({
  id: r.id, memberId: r.member_id, writtenAt: r.written_at, via: r.via, message: r.message, note: r.note,
  conversationId: r.conversation_id, conversationUrl: r.conversation_url,
  answeredAt: r.answered_at, answeredHow: r.answered_how, answerStart: r.answer_start,
});
