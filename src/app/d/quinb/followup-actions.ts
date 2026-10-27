'use server';

import { revalidatePath } from 'next/cache';
import { getSupabase } from '@/lib/supabase';
import { readRoster, type GqlMember } from '@/lib/mighty-graphql';
import { readMemberLinks } from '@/lib/mighty';
import { brusselsDay, addDay, todayBrussels, PAUSE_DAYS, DB_STEP } from '@/lib/followups';
import { followupsDb, FOLLOWUPS_NEED_ADMIN } from '@/lib/followups-db';

/**
 * Writes for QuinB Community › Follow-ups. Like the rest of the app these
 * work without sign-in; sending, reading chats, connecting and drafting
 * (later) check for a signed-in user.
 */
type Result = { error: string | null };
const touched = () => revalidatePath('/d/quinb-community', 'layout');

const missingStep = (msg: string) => /does not exist|could not find|schema cache|column/i.test(msg);
const dbError = (msg: string) => (missingStep(msg) ? DB_STEP : msg);

// --------------------------------------------------------- refresh from QuinB

export type RefreshNote = { member: string; field: string; here: string; quinb: string };
export type RefreshResult = { error: string | null; summary?: string; notes?: RefreshNote[] };

type Existing = {
  id: string; name: string; email: string | null; member_since: string | null; mighty_id: string | null;
  profile_url: string | null; left_quinb_at: string | null;
};

const clean = (s: string | null | undefined) => (s ?? '').trim() || null;

/**
 * Reads the whole roster from QuinB and writes it into quinb_members:
 *   always   Mighty id, last visit, role, member type, membership, plans, bio,
 *            picture, profile link, when it was seen;
 *   if empty name, email, member since (her own values are never overwritten;
 *            a difference is listed in the result);
 *   new      added; gone from QuinB: never deleted, marked as no longer in QuinB.
 * Matched by Mighty id, then email (any case), then exact name.
 */
export async function refreshFromQuinb(): Promise<RefreshResult> {
  const db = getSupabase();
  if (!db) return { error: 'Supabase is not configured.' };
  const { data: rows, error: readErr } = await db.from('quinb_members').select('id, name, email, member_since, mighty_id, profile_url, left_quinb_at');
  if (readErr) return { error: dbError(readErr.message) };

  const record = async (r: { read?: number; added?: number; updated?: number; gone?: number; error?: string | null; notes?: RefreshNote[] }) => {
    await db.from('quinb_refresh_runs').insert({ read: r.read ?? 0, added: r.added ?? 0, updated: r.updated ?? 0, gone: r.gone ?? 0, error: r.error ?? null, notes: r.notes ?? [] });
  };

  const roster = await readRoster();
  if ('error' in roster) { await record({ error: roster.error }); touched(); return { error: roster.error }; }
  if (!roster.members.length) {
    const error = 'Mighty Networks sent an empty member list, so nothing was changed. The key may not be allowed to read members (host:read:network_members).';
    await record({ error }); touched(); return { error };
  }
  const complete = roster.members.length >= roster.total;
  const links = await readMemberLinks();
  const linkOf = (rid: string) => (links instanceof Map ? links.get(rid) ?? null : null);

  const existing = (rows ?? []) as Existing[];
  const byMighty = new Map(existing.filter((r) => r.mighty_id).map((r) => [r.mighty_id!, r]));
  const byEmail = new Map<string, Existing>();
  for (const r of existing) if (r.email && !byEmail.has(r.email.toLowerCase())) byEmail.set(r.email.toLowerCase(), r);
  const used = new Set<string>();
  const now = new Date().toISOString();
  const notes: RefreshNote[] = [];
  const updates: Record<string, unknown>[] = [];
  const inserts: Record<string, unknown>[] = [];

  for (const n of roster.members as GqlMember[]) {
    const rid = String(n.resourceId);
    const email = clean(n.email);
    const name = clean(n.name) ?? clean([n.firstName, n.lastName].filter(Boolean).join(' '));
    const free = (r: Existing | undefined) => (r && !used.has(r.id) && (!r.mighty_id || r.mighty_id === rid) ? r : undefined);
    let row = free(byMighty.get(rid));
    if (!row && email) row = free(byEmail.get(email.toLowerCase()));
    if (!row && name) {
      const same = existing.filter((r) => r.name === name && !used.has(r.id) && !r.mighty_id);
      if (same.length === 1) row = same[0];
    }
    const joined = n.joinedAt ? brusselsDay(n.joinedAt) : null;
    const always = {
      mighty_id: rid, mighty_gid: n.id, first_name: clean(n.firstName), role: n.networkRole ?? null, member_type: n.memberType ?? null,
      membership_status: n.membership?.status ?? null, plans: (n.membership?.accessPathPlans?.nodes ?? []).map((p) => p.name).filter((x): x is string => !!x),
      bio: clean(n.shortBio), avatar_url: clean(n.avatarUrl), last_active_at: n.lastActiveAt ?? null,
      last_login: n.lastActiveAt ? brusselsDay(n.lastActiveAt) : null, seen_at: now, left_quinb_at: null, updated_at: now,
    };
    if (row) {
      used.add(row.id);
      const label = row.name;
      if (name && row.name.trim() !== name) notes.push({ member: label, field: 'Name', here: row.name, quinb: name });
      if (email && row.email && row.email.toLowerCase() !== email.toLowerCase()) notes.push({ member: label, field: 'Email', here: row.email, quinb: email });
      if (joined && row.member_since && row.member_since !== joined) notes.push({ member: label, field: 'Member since', here: row.member_since, quinb: joined });
      // Every row has the same keys, so the bulk write leaves no column empty by accident.
      updates.push({
        id: row.id, name: row.name, email: row.email ?? email, member_since: row.member_since ?? joined,
        profile_url: linkOf(rid) ?? row.profile_url, ...always,
      });
    } else {
      inserts.push({ name: name ?? `Member ${rid}`, email, member_since: joined, profile_url: linkOf(rid), ...always });
    }
  }

  for (let i = 0; i < updates.length; i += 200) {
    const { error } = await db.from('quinb_members').upsert(updates.slice(i, i + 200), { onConflict: 'id' });
    if (error) { const e = dbError(error.message); await record({ read: roster.members.length, error: e, notes }); touched(); return { error: e }; }
  }
  if (inserts.length) {
    const { error } = await db.from('quinb_members').insert(inserts);
    if (error) { const e = dbError(error.message); await record({ read: roster.members.length, updated: updates.length, error: e, notes }); touched(); return { error: e }; }
  }
  // Gone: only from a complete read; a cut-off read cannot tell who left.
  const goneIds = complete ? existing.filter((r) => !used.has(r.id) && !r.left_quinb_at).map((r) => r.id) : [];
  if (goneIds.length) {
    const { error } = await db.from('quinb_members').update({ left_quinb_at: now, updated_at: now }).in('id', goneIds);
    if (error) { const e = dbError(error.message); await record({ read: roster.members.length, added: inserts.length, updated: updates.length, error: e, notes }); touched(); return { error: e }; }
  }
  if (!complete) notes.push({ member: '—', field: 'Read', here: `${roster.members.length} read`, quinb: `${roster.total} in QuinB; nobody was marked as gone` });
  if (!(links instanceof Map)) notes.push({ member: '—', field: 'Profile links', here: 'not read', quinb: links.error });

  const summary = `${roster.members.length} read: ${inserts.length} new, ${updates.length} updated, ${goneIds.length} gone`;
  await record({ read: roster.members.length, added: inserts.length, updated: updates.length, gone: goneIds.length, notes });
  touched();
  return { error: null, summary, notes };
}

// ------------------------------------------------------------ follow-ups

// The follow-up log holds private messages: written with the service role only (lib/followups-db.ts).

/** "I wrote in QuinB": a follow-up she wrote there herself, with the text from the box when there is one. */
export async function logWrittenByHand(memberId: string, message: string, note: string): Promise<Result> {
  const db = followupsDb();
  if (!db) return { error: FOLLOWUPS_NEED_ADMIN };
  const { error } = await db.from('quinb_followups').insert({ member_id: memberId, via: 'by_hand', message: message.trim() || null, note: note.trim() || null });
  if (error) return { error: dbError(error.message) };
  touched();
  return { error: null };
}

/** "Answered", set by hand; again to take it back. */
export async function setAnswered(followupId: string, answered: boolean): Promise<Result> {
  const db = followupsDb();
  if (!db) return { error: FOLLOWUPS_NEED_ADMIN };
  const patch = answered ? { answered_at: new Date().toISOString(), answered_how: 'by_hand' } : { answered_at: null, answered_how: null, answer_start: null };
  const { error } = await db.from('quinb_followups').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', followupId);
  if (error) return { error: dbError(error.message) };
  touched();
  return { error: null };
}

/** Pause PAUSE_DAYS days, or end the pause (undo). */
export async function setPaused(memberId: string, paused: boolean): Promise<Result> {
  const db = getSupabase();
  if (!db) return { error: 'Supabase is not configured.' };
  const until = paused ? addDay(todayBrussels(), PAUSE_DAYS) : null;
  const { error } = await db.from('quinb_members').update({ paused_until: until, updated_at: new Date().toISOString() }).eq('id', memberId);
  if (error) return { error: dbError(error.message) };
  touched();
  return { error: null };
}

/** Leave out of follow-ups, or take back in (undo). */
export async function setLeftOut(memberId: string, off: boolean): Promise<Result> {
  const db = getSupabase();
  if (!db) return { error: 'Supabase is not configured.' };
  const { error } = await db.from('quinb_members').update({ followup_off: off, updated_at: new Date().toISOString() }).eq('id', memberId);
  if (error) return { error: dbError(error.message) };
  touched();
  return { error: null };
}
