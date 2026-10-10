'use server';

import { revalidatePath } from 'next/cache';
import { getSupabase } from '@/lib/supabase';
import { EMAIL_RE } from '@/lib/mail';
import { BANNER_BUCKET, POST_STATUSES, AUDIENCES, POST_KINDS } from '@/lib/quinb';
import { answer } from '@/lib/mighty';

/** Writes for the QuinB Community member list. */
type Result = { error: string | null };
const touched = () => revalidatePath('/d/quinb-community', 'layout');

const DATE = /^(19|20)\d{2}-\d{2}-\d{2}$/;

function patchFor(field: string, value: string): { patch?: Record<string, unknown>; error?: string } {
  const v = value.trim();
  switch (field) {
    case 'name': return v ? { patch: { name: v } } : { error: 'A name is needed.' };
    case 'email': return !v || EMAIL_RE.test(v) ? { patch: { email: v || null } } : { error: 'That is not an email address.' };
    case 'memberSince': return !v || DATE.test(v) ? { patch: { member_since: v || null } } : { error: 'Dates are written 2026-10-09.' };
    case 'lastLogin': return !v || DATE.test(v) ? { patch: { last_login: v || null } } : { error: 'Dates are written 2026-10-09.' };
    case 'interactions': return !v ? { patch: { interactions: null } } : Number.isFinite(Number(v)) && Number(v) >= 0 && Number(v) < 1e9 ? { patch: { interactions: Math.round(Number(v)) } } : { error: 'A number, please.' };
    case 'notes': return { patch: { notes: v || null } };
    default: return { error: `Unknown field: ${field}` };
  }
}

export async function addMember(input: Record<string, string>): Promise<Result> {
  const db = getSupabase();
  if (!db) return { error: 'Supabase is not configured.' };
  const row: Record<string, unknown> = {};
  for (const k of ['name', 'email', 'memberSince', 'lastLogin', 'interactions']) {
    if (k !== 'name' && !input[k]?.trim()) continue;
    const r = patchFor(k, input[k] ?? '');
    if (r.error) return { error: r.error };
    Object.assign(row, r.patch);
  }
  const { error } = await db.from('quinb_members').insert(row);
  if (error) return { error: error.message };
  touched();
  return { error: null };
}

export async function updateMember(id: string, field: string, value: string): Promise<Result> {
  const db = getSupabase();
  if (!db) return { error: 'Supabase is not configured.' };
  const r = patchFor(field, value);
  if (r.error) return { error: r.error };
  const { error } = await db.from('quinb_members').update({ ...r.patch, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) return { error: error.message };
  touched();
  return { error: null };
}

export async function removeMember(id: string): Promise<Result> {
  const db = getSupabase();
  if (!db) return { error: 'Supabase is not configured.' };
  const { error } = await db.from('quinb_members').delete().eq('id', id);
  if (error) return { error: error.message };
  touched();
  return { error: null };
}

// ------------------------------------------------------------- content

const bannerPrefix = () => `${process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''}/storage/v1/object/public/${BANNER_BUCKET}/`;

function postPatch(field: string, value: string): { patch?: Record<string, unknown>; error?: string } {
  const v = field === 'body' ? value : value.trim();
  switch (field) {
    case 'title': return v ? { patch: { title: v } } : { error: 'A title is needed.' };
    case 'body': return { patch: { body: v } };
    case 'space': return { patch: { space: v || null } };
    case 'plannedFor': return !v || DATE.test(v) ? { patch: { planned_for: v || null } } : { error: 'Dates are written 2026-10-09.' };
    case 'status': return (POST_STATUSES as string[]).includes(v) ? { patch: { status: v } } : { error: 'Not a valid status.' };
    case 'postTypeId': return { patch: { post_type_id: v || null } };
    case 'postedUrl': return !v || /^https:\/\/\S+$/.test(v) ? { patch: { posted_url: v || null } } : { error: 'A link starts with https://' };
    case 'bannerUrl': return !v || v.startsWith(bannerPrefix()) ? { patch: { banner_url: v || null } } : { error: 'Banners are uploaded here, not linked.' };
    default: return { error: `Unknown field: ${field}` };
  }
}

export async function addPost(input: Record<string, string>): Promise<Result> {
  const db = getSupabase();
  if (!db) return { error: 'Supabase is not configured.' };
  const row: Record<string, unknown> = {};
  for (const k of ['title', 'space', 'plannedFor', 'postTypeId', 'status']) {
    if (k !== 'title' && !input[k]?.trim()) continue;
    const r = postPatch(k, input[k] ?? '');
    if (r.error) return { error: r.error };
    Object.assign(row, r.patch);
  }
  const { error } = await db.from('quinb_posts').insert(row);
  if (error) return { error: error.message };
  touched();
  return { error: null };
}

export async function updatePost(id: string, field: string, value: string): Promise<Result> {
  const db = getSupabase();
  if (!db) return { error: 'Supabase is not configured.' };
  const r = postPatch(field, value);
  if (r.error) return { error: r.error };
  const { error } = await db.from('quinb_posts').update({ ...r.patch, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) return { error: error.message };
  touched();
  return { error: null };
}

export async function removePost(id: string): Promise<Result> {
  const db = getSupabase();
  if (!db) return { error: 'Supabase is not configured.' };
  const { error } = await db.from('quinb_posts').delete().eq('id', id);
  if (error) return { error: error.message };
  touched();
  return { error: null };
}

// ---------------------------------------------------------------- plan

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const httpsOrEmpty = (v: string) => !v || /^https:\/\/\S+$/.test(v);

/** Saves one field of a year, month or week. The row is created on the first save. */
export async function savePlan(level: 'year' | 'month' | 'week', key: string, field: string, value: string): Promise<Result> {
  const db = getSupabase();
  if (!db) return { error: 'Supabase is not configured.' };
  const v = value.trim() || null;
  const at = new Date().toISOString();
  if (level === 'year') {
    const year = Number(key);
    if (!Number.isInteger(year) || year < 2000 || year > 2100) return { error: 'Not a year.' };
    const cols: Record<string, string> = { theme: 'theme', audience: 'audience', focus: 'focus', goal: 'goal', notes: 'notes' };
    if (!(field in cols)) return { error: `Unknown field: ${field}` };
    if (field === 'audience' && v && !(AUDIENCES as readonly string[]).includes(v)) return { error: 'External or Community.' };
    const { error } = await db.from('quinb_years').upsert({ year, [cols[field]]: v, updated_at: at }, { onConflict: 'year' });
    if (error) return { error: error.message };
  } else if (level === 'month') {
    if (!MONTH_RE.test(key)) return { error: 'Not a month.' };
    const cols: Record<string, string> = { theme: 'theme', focus: 'focus', goal: 'goal', note: 'note', notebooklmUrl: 'notebooklm_url' };
    if (!(field in cols)) return { error: `Unknown field: ${field}` };
    if (field === 'notebooklmUrl' && !httpsOrEmpty(v ?? '')) return { error: 'A link starts with https://' };
    const { error } = await db.from('quinb_months').upsert({ month: key, [cols[field]]: v, updated_at: at }, { onConflict: 'month' });
    if (error) return { error: error.message };
  } else {
    if (!DATE.test(key) || new Date(`${key}T00:00:00Z`).getUTCDay() !== 1) return { error: 'A week starts on a Monday.' };
    const cols: Record<string, string> = { theme: 'theme', plan: 'plan' };
    if (!(field in cols)) return { error: `Unknown field: ${field}` };
    const { error } = await db.from('quinb_weeks').upsert({ monday: key, [cols[field]]: v, updated_at: at }, { onConflict: 'monday' });
    if (error) return { error: error.message };
  }
  touched();
  return { error: null };
}

// ------------------------------------------------------- daily post types

function typePatch(field: string, value: string): { patch?: Record<string, unknown>; error?: string } {
  const keepLines = ['purpose', 'prompt', 'example'].includes(field);
  const v = keepLines ? value : value.trim();
  switch (field) {
    case 'weekday': { const n = Number(v); return Number.isInteger(n) && n >= 1 && n <= 7 ? { patch: { weekday: n } } : { error: 'Pick a day.' }; }
    case 'title': return v ? { patch: { title: v } } : { error: 'A title is needed.' };
    case 'kind': return !v || (POST_KINDS as readonly string[]).includes(v) ? { patch: { kind: v || null } } : { error: 'Article, Question or Quick Post.' };
    case 'hour': return { patch: { hour: v || null } };
    case 'space': return { patch: { space: v || null } };
    case 'postedBy': return { patch: { posted_by: v || null } };
    case 'purpose': case 'prompt': case 'example': return { patch: { [field]: v } };
    case 'bannerUrl': return !v || v.startsWith(bannerPrefix()) ? { patch: { banner_url: v || null } } : { error: 'Banners are uploaded here, not linked.' };
    default: return { error: `Unknown field: ${field}` };
  }
}

export async function addPostType(input: Record<string, string>): Promise<Result> {
  const db = getSupabase();
  if (!db) return { error: 'Supabase is not configured.' };
  const row: Record<string, unknown> = {};
  for (const k of ['weekday', 'title', 'kind', 'hour', 'space', 'postedBy']) {
    if (!['weekday', 'title'].includes(k) && !input[k]?.trim()) continue;
    const r = typePatch(k, input[k] ?? '');
    if (r.error) return { error: r.error };
    Object.assign(row, r.patch);
  }
  const { error } = await db.from('quinb_post_types').insert(row);
  if (error) return { error: error.code === '23505' ? 'That day already has a post type.' : error.message };
  touched();
  return { error: null };
}

export async function updatePostType(id: string, field: string, value: string): Promise<Result> {
  const db = getSupabase();
  if (!db) return { error: 'Supabase is not configured.' };
  const r = typePatch(field, value);
  if (r.error) return { error: r.error };
  const { error } = await db.from('quinb_post_types').update({ ...r.patch, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) return { error: error.code === '23505' ? 'That day already has a post type.' : error.message };
  touched();
  return { error: null };
}

export async function removePostType(id: string): Promise<Result> {
  const db = getSupabase();
  if (!db) return { error: 'Supabase is not configured.' };
  const { error } = await db.from('quinb_post_types').delete().eq('id', id);
  if (error) return { error: error.message };
  touched();
  return { error: null };
}

// ------------------------------------------------------------ the network

/** Her answer in the community: a comment on the post, or a reply to one comment. */
export async function answerInQuinb(postId: number, replyToId: number | null, text: string): Promise<Result> {
  const v = text.trim();
  if (!v) return { error: 'Write something first.' };
  if (v.length > 10_000) return { error: 'That is longer than a comment can be.' };
  if (!Number.isInteger(postId) || postId <= 0 || (replyToId != null && (!Number.isInteger(replyToId) || replyToId <= 0))) return { error: 'Unknown post or comment.' };
  const r = await answer(postId, v, replyToId);
  if (r.error) return r;
  touched();
  return { error: null };
}
