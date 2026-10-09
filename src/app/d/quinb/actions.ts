'use server';

import { revalidatePath } from 'next/cache';
import { getSupabase } from '@/lib/supabase';
import { EMAIL_RE } from '@/lib/mail';
import { STRATEGY_ID, BANNER_BUCKET } from '@/lib/quinb';

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

export async function saveStrategy(body: string): Promise<Result> {
  const db = getSupabase();
  if (!db) return { error: 'Supabase is not configured.' };
  const { error } = await db.from('quinb_strategy').upsert({ id: STRATEGY_ID, body, updated_at: new Date().toISOString() }, { onConflict: 'id' });
  if (error) return { error: error.message };
  touched();
  return { error: null };
}

const POST_STATUS = ['idea', 'draft', 'ready', 'posted'];
const bannerPrefix = () => `${process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''}/storage/v1/object/public/${BANNER_BUCKET}/`;

function postPatch(field: string, value: string): { patch?: Record<string, unknown>; error?: string } {
  const v = field === 'body' ? value : value.trim();
  switch (field) {
    case 'title': return v ? { patch: { title: v } } : { error: 'A title is needed.' };
    case 'body': return { patch: { body: v } };
    case 'space': return { patch: { space: v || null } };
    case 'plannedFor': return !v || DATE.test(v) ? { patch: { planned_for: v || null } } : { error: 'Dates are written 2026-10-09.' };
    case 'status': return POST_STATUS.includes(v) ? { patch: { status: v } } : { error: 'Not a valid status.' };
    case 'postedUrl': return !v || /^https:\/\/\S+$/.test(v) ? { patch: { posted_url: v || null } } : { error: 'A link starts with https://' };
    case 'bannerUrl': return !v || v.startsWith(bannerPrefix()) ? { patch: { banner_url: v || null } } : { error: 'Banners are uploaded here, not linked.' };
    default: return { error: `Unknown field: ${field}` };
  }
}

export async function addPost(input: Record<string, string>): Promise<Result> {
  const db = getSupabase();
  if (!db) return { error: 'Supabase is not configured.' };
  const row: Record<string, unknown> = {};
  for (const k of ['title', 'space', 'plannedFor']) {
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
