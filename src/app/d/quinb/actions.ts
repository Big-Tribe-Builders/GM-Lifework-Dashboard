'use server';

import { revalidatePath } from 'next/cache';
import { getSupabase } from '@/lib/supabase';
import { EMAIL_RE } from '@/lib/mail';

/** Writes for the QuinB Academy member list. */
type Result = { error: string | null };
const touched = () => revalidatePath('/d/quinb-academy', 'layout');

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
