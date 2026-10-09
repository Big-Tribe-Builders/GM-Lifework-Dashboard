'use server';

import { revalidatePath } from 'next/cache';
import { getSupabase } from '@/lib/supabase';
import { BOOK_ID } from '@/lib/book';

/** Writes for the book: the About row and the chapters. */
type Result = { error: string | null };
const touched = () => revalidatePath('/d/book', 'layout');

const ABOUT_FIELDS = ['title', 'description', 'style'] as const;
export type AboutField = (typeof ABOUT_FIELDS)[number];

export async function saveBook(field: AboutField, value: string): Promise<Result> {
  if (!ABOUT_FIELDS.includes(field)) return { error: `Unknown field: ${field}` };
  const db = getSupabase();
  if (!db) return { error: 'Supabase is not configured.' };
  const { error } = await db.from('book').upsert({ id: BOOK_ID, [field]: value.trim(), updated_at: new Date().toISOString() }, { onConflict: 'id' });
  if (error) return { error: error.message };
  touched();
  return { error: null };
}

const STATUS = ['todo', 'drafting', 'review', 'done'];

export async function addChapter(input: { number: string; title: string }): Promise<Result> {
  const db = getSupabase();
  if (!db) return { error: 'Supabase is not configured.' };
  const title = input.title.trim();
  if (!title) return { error: 'A title is needed.' };
  const n = Number(input.number);
  if (!input.number.trim() || !Number.isFinite(n)) return { error: 'A chapter number, please.' };
  const { error } = await db.from('book_chapters').insert({ number: Math.round(n), title });
  if (error) return { error: error.message };
  touched();
  return { error: null };
}

export async function updateChapter(id: string, field: string, value: string): Promise<Result> {
  const db = getSupabase();
  if (!db) return { error: 'Supabase is not configured.' };
  const v = field === 'body' ? value : value.trim();
  let patch: Record<string, unknown>;
  if (field === 'title') { if (!v) return { error: 'A title is needed.' }; patch = { title: v }; }
  else if (field === 'summary') patch = { summary: v || null };
  else if (field === 'body') patch = { body: v };
  else if (field === 'number') { const n = Number(v); if (!v || !Number.isFinite(n)) return { error: 'A number, please.' }; patch = { number: Math.round(n) }; }
  else if (field === 'status') { if (!STATUS.includes(v)) return { error: 'Not a valid status.' }; patch = { status: v }; }
  else return { error: `Unknown field: ${field}` };
  const { error } = await db.from('book_chapters').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) return { error: error.message };
  touched();
  return { error: null };
}

export async function removeChapter(id: string): Promise<Result> {
  const db = getSupabase();
  if (!db) return { error: 'Supabase is not configured.' };
  const { error } = await db.from('book_chapters').delete().eq('id', id);
  if (error) return { error: error.message };
  touched();
  return { error: null };
}
