'use server';

import { revalidatePath } from 'next/cache';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabase } from '@/lib/supabase';
import { chatToken, noteChatError, noteChatsRead, type Token } from '@/lib/mighty-oauth';
import { sendPrivate, inboxPage, threadPage } from '@/lib/mighty-graphql';
import { readThread, later, DB_STEP, type ChatLine } from '@/lib/followups';
import { followupsDb, FOLLOWUPS_NEED_ADMIN } from '@/lib/followups-db';

/**
 * Private messages in QuinB, for Follow-ups: sending, and reading her
 * conversations for answers. Each one runs with her own QuinB connection and
 * starts with chatToken(), which refuses without a signed-in user. Nothing is
 * sent by itself: Send is her click, with the text she sees. The follow-up
 * log is read and written with the service role only (lib/followups-db.ts).
 */
type Result = { error: string | null };
const touched = () => revalidatePath('/d/quinb-community', 'layout');
const dbError = (msg: string) => (/does not exist|could not find|schema cache|column/i.test(msg) ? DB_STEP : msg);

/** Her list of conversations is read 25 at a time, up to this many pages (500 conversations). */
const INBOX_PAGES = 20;
/** Conversations read message by message in one refresh; the rest on the next. */
const THREADS = 40;

type MemberRow = {
  id: string; name: string; mighty_id: string | null; mighty_gid: string | null;
  dm_conversation_id: string | null; dm_conversation_url: string | null;
  last_dm_from_member_at: string | null; last_dm_from_me_at: string | null;
};
type OpenRow = { id: string; member_id: string; written_at: string };
const MEMBER_COLS = 'id, name, mighty_id, mighty_gid, dm_conversation_id, dm_conversation_url, last_dm_from_member_at, last_dm_from_me_at';

// -------------------------------------------------------------------- send

/** "Send in QuinB": one private message to one member, logged as a follow-up when QuinB sent it. */
export async function sendInQuinb(memberId: string, text: string): Promise<Result & { sent?: boolean }> {
  const body = text.trim();
  if (!body) return { error: 'Write the message first.' };
  const t = await chatToken();
  if ('error' in t) return { error: t.error };
  const db = getSupabase();
  if (!db) return { error: 'Supabase is not configured.' };
  const log = followupsDb();
  if (!log) return { error: `${FOLLOWUPS_NEED_ADMIN} Nothing was sent.` };
  const { data, error } = await db.from('quinb_members').select('id, name, mighty_gid, dm_conversation_id').eq('id', memberId).maybeSingle();
  if (error) return { error: dbError(error.message) };
  const m = data as { id: string; name: string; mighty_gid: string | null; dm_conversation_id: string | null } | null;
  if (!m) return { error: 'This member is no longer in the list. Nothing was sent.' };
  if (!m.mighty_gid) return { error: `${m.name} has no QuinB id here yet: click Refresh from QuinB first. Nothing was sent.` };

  const r = await sendPrivate(t.token, m.mighty_gid, body);
  if ('error' in r) {
    if (r.refused) await noteChatError(r.error);
    return { error: `${r.error} Nothing was logged.` };
  }
  if ('skipped' in r) return { error: `Not sent: ${r.skipped}. Nothing was logged.` };

  const at = r.sent.at ?? new Date().toISOString();
  const conversationId = r.sent.conversationId ?? m.dm_conversation_id;
  const { error: logErr } = await log.from('quinb_followups').insert({ member_id: m.id, written_at: at, via: 'sent', message: body, conversation_id: conversationId });
  const { error: memberErr } = await db.from('quinb_members')
    .update({ last_dm_from_me_at: at, dm_conversation_id: conversationId, updated_at: new Date().toISOString() }).eq('id', m.id);
  touched();
  const failed = logErr ?? memberErr;
  if (failed) return { error: `Sent in QuinB, but it could not be logged here: ${dbError(failed.message)}`, sent: true };
  return { error: null, sent: true };
}

// -------------------------------------------------------------------- read

/**
 * One conversation: the last private message from the member and from her,
 * its link when QuinB gives one, and an answer to each open follow-up.
 */
async function readOne(db: SupabaseClient, log: SupabaseClient, t: Token & { meGid: string }, m: MemberRow, conversationId: string, open: OpenRow[]):
  Promise<{ error: string } | { answered: number; changed: boolean }> {
  const r = await threadPage(t.token, conversationId);
  if ('error' in r) return r;
  const lines: ChatLine[] = r.messages
    .filter((x) => x.actorType !== 'SYSTEM' && x.member)
    .map((x) => ({ at: x.createdAt, mine: x.member!.id === t.meGid, text: x.textText ?? '' }));
  const facts = readThread(lines, open.map((f) => ({ id: f.id, writtenAt: f.written_at })));

  const patch: Record<string, string> = {};
  const theirs = later(m.last_dm_from_member_at, facts.lastTheirs);
  const mine = later(m.last_dm_from_me_at, facts.lastMine);
  if (theirs && theirs !== m.last_dm_from_member_at) patch.last_dm_from_member_at = theirs;
  if (mine && mine !== m.last_dm_from_me_at) patch.last_dm_from_me_at = mine;
  if (m.dm_conversation_id !== conversationId) patch.dm_conversation_id = conversationId;
  if (r.link && r.link !== m.dm_conversation_url) patch.dm_conversation_url = r.link;
  if (Object.keys(patch).length) {
    const { error } = await db.from('quinb_members').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', m.id);
    if (error) return { error: dbError(error.message) };
  }
  for (const a of facts.answers) {
    const { error } = await log.from('quinb_followups')
      .update({ answered_at: a.at, answered_how: 'chat', answer_start: a.start, updated_at: new Date().toISOString() })
      .eq('id', a.id).is('answered_at', null);
    if (error) return { error: dbError(error.message) };
  }
  return { answered: facts.answers.length, changed: Object.keys(patch).length > 0 || facts.answers.length > 0 };
}

const known = (t: Token): t is Token & { meGid: string } => !!t.meGid;
const NO_ME = 'Who is connected is not known here: click Connect again at the top of Follow-ups.';

/** On opening a member who has not answered yet: their conversation, read again. */
export async function readMemberChat(memberId: string): Promise<Result & { answered?: number }> {
  const t = await chatToken();
  if ('error' in t) return { error: t.error };
  if (!known(t)) return { error: NO_ME };
  const db = getSupabase();
  if (!db) return { error: 'Supabase is not configured.' };
  const log = followupsDb();
  if (!log) return { error: FOLLOWUPS_NEED_ADMIN };
  const [mem, fu] = await Promise.all([
    db.from('quinb_members').select(MEMBER_COLS).eq('id', memberId).maybeSingle(),
    log.from('quinb_followups').select('id, member_id, written_at').eq('member_id', memberId).is('answered_at', null),
  ]);
  const err = mem.error ?? fu.error;
  if (err) return { error: dbError(err.message) };
  const m = mem.data as MemberRow | null;
  if (!m?.dm_conversation_id) return { error: null };
  const r = await readOne(db, log, t, m, m.dm_conversation_id, (fu.data ?? []) as OpenRow[]);
  if ('error' in r) return { error: r.error };
  if (r.changed) touched();
  return { error: null, answered: r.answered };
}

/**
 * On Refresh: her list of private conversations, newest first, down to the
 * last complete read (a day's margin). Every one-to-one conversation with a
 * member that has news since what is stored here is read message by message,
 * the newest first, THREADS at a time.
 */
export async function readChats(): Promise<Result & { summary?: string }> {
  const started = new Date().toISOString();
  const t = await chatToken();
  if ('error' in t) return { error: t.error };
  if (!known(t)) return { error: NO_ME };
  const db = getSupabase();
  if (!db) return { error: 'Supabase is not configured.' };
  const log = followupsDb();
  if (!log) return { error: FOLLOWUPS_NEED_ADMIN };
  const [mem, fu] = await Promise.all([
    db.from('quinb_members').select(MEMBER_COLS).not('mighty_id', 'is', null),
    log.from('quinb_followups').select('id, member_id, written_at').is('answered_at', null),
  ]);
  const err = mem.error ?? fu.error;
  if (err) return { error: dbError(err.message) };
  const byRid = new Map(((mem.data ?? []) as MemberRow[]).map((m) => [m.mighty_id!, m]));
  const openBy = new Map<string, OpenRow[]>();
  for (const f of (fu.data ?? []) as OpenRow[]) openBy.set(f.member_id, [...(openBy.get(f.member_id) ?? []), f]);

  const cutoff = t.chatsReadAt ? Date.parse(t.chatsReadAt) - 86_400_000 : null;
  const found: { id: string; lastChatAt: string; m: MemberRow }[] = [];
  let after: string | null = null;
  let complete = false;
  for (let page = 0; page < INBOX_PAGES; page++) {
    const r = await inboxPage(t.token, after);
    if ('error' in r) {
      if (r.refused) await noteChatError(r.error);
      return { error: r.error };
    }
    for (const c of r.nodes) {
      const others = (c.participants ?? []).filter((p) => p.id !== t.meGid);
      if (c.isGroup || others.length !== 1 || !c.lastChatAt) continue;
      const m = byRid.get(String(others[0].resourceId));
      if (m) found.push({ id: c.id, lastChatAt: c.lastChatAt, m });
    }
    const oldest = r.nodes.at(-1)?.lastChatAt;
    if (!r.next || (cutoff && oldest && Date.parse(oldest) < cutoff)) { complete = true; break; }
    after = r.next;
  }

  const news = found
    .filter(({ lastChatAt, m }) => {
      const stored = later(m.last_dm_from_member_at, m.last_dm_from_me_at);
      return !stored || Date.parse(lastChatAt) > Date.parse(stored);
    })
    .sort((a, b) => Date.parse(b.lastChatAt) - Date.parse(a.lastChatAt));
  const now = news.slice(0, THREADS);
  const rest = news.length - now.length;

  let read = 0, answered = 0, changed = false;
  const errors: string[] = [];
  for (const c of now) {
    const r = await readOne(db, log, t, c.m, c.id, openBy.get(c.m.id) ?? []);
    if ('error' in r) {
      errors.push(`${c.m.name}: ${r.error}`);
      if (errors.length >= 3) break;
      continue;
    }
    read += 1; answered += r.answered; changed ||= r.changed;
  }
  if (complete && !rest && !errors.length) await noteChatsRead(started);
  if (changed) touched();

  const parts = [`Private messages: ${read} ${read === 1 ? 'conversation' : 'conversations'} read, ${answered} ${answered === 1 ? 'answer' : 'answers'} found`];
  if (rest > 0) parts.push(`${rest} more on the next refresh`);
  if (!complete) parts.push(`only the newest ${INBOX_PAGES * 25} conversations were looked at`);
  return { error: errors.length ? errors.join(' · ') : null, summary: parts.join('; ') };
}
