'use server';

import { revalidatePath } from 'next/cache';
import { getSupabase } from '@/lib/supabase';

/**
 * Writes for the BTB plan. One allowlist per table: the grid can only touch
 * the columns it shows, and nothing from the browser names a column.
 */
type Result = { error: string | null };
const touched = () => revalidatePath('/d/big-tribe-builders', 'layout');

const TABLES = {
  btb_plan: {
    text: { track: 'track', title: 'title', owner: 'owner', notes: 'notes', quarter: 'quarter' },
    date: { startDate: 'start_date', endDate: 'end_date' },
    number: { progress: 'progress', sortOrder: 'sort_order' },
    status: ['todo', 'doing', 'done', 'parked'],
  },
  btb_experiments: {
    text: { title: 'title', hypothesis: 'hypothesis', channel: 'channel', owner: 'owner', result: 'result', learning: 'learning' },
    date: { startDate: 'start_date', endDate: 'end_date' },
    number: { sortOrder: 'sort_order' },
    status: ['idea', 'running', 'done', 'dropped'],
  },
  btb_playbook: {
    text: { framework: 'framework', step: 'step', question: 'question', answer: 'answer' },
    date: {},
    number: { sortOrder: 'sort_order' },
    status: [] as string[],
  },
} as const;
export type BtbTable = keyof typeof TABLES;

export async function updateBtb(table: BtbTable, id: string, field: string, value: string): Promise<Result> {
  const spec = TABLES[table];
  if (!spec) return { error: `Unknown table: ${table}` };
  const db = getSupabase();
  if (!db) return { error: 'Supabase is not configured.' };

  let patch: Record<string, unknown> | null = null;
  const v = value.trim();
  if (field in spec.text) {
    const col = spec.text[field as keyof typeof spec.text];
    if (field === 'title' && !v) return { error: 'A title is needed.' };
    patch = { [col]: v || null };
  } else if (field in spec.date) {
    const col = spec.date[field as keyof typeof spec.date];
    if (v && !/^\d{4}-\d{2}-\d{2}$/.test(v)) return { error: 'Dates are written 2026-11-30.' };
    patch = { [col]: v || null };
  } else if (field in spec.number) {
    const col = spec.number[field as keyof typeof spec.number];
    const n = Number(v);
    if (!v || !Number.isFinite(n)) return { error: 'A number, please.' };
    patch = { [col]: field === 'progress' ? Math.min(100, Math.max(0, Math.round(n))) : Math.round(n) };
  } else if (field === 'status' && (spec.status as readonly string[]).includes(v)) {
    patch = { status: v };
  }
  if (!patch) return { error: `Unknown field: ${field}` };

  const { error } = await db.from(table).update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) return { error: error.message };
  touched();
  return { error: null };
}

export async function addBtb(table: BtbTable, input: Record<string, string>): Promise<Result> {
  const spec = TABLES[table];
  if (!spec) return { error: `Unknown table: ${table}` };
  const db = getSupabase();
  if (!db) return { error: 'Supabase is not configured.' };
  const row: Record<string, unknown> = {};
  for (const [k, col] of Object.entries(spec.text)) if (input[k]?.trim()) row[col] = input[k].trim();
  if (table !== 'btb_playbook' && !row.title) return { error: 'A title is needed.' };
  if (table === 'btb_playbook' && !(row.framework && row.step && row.question)) return { error: 'Framework, step and question are needed.' };
  const { error } = await db.from(table).insert(row);
  if (error) return { error: error.message };
  touched();
  return { error: null };
}

export async function removeBtb(table: BtbTable, id: string): Promise<Result> {
  if (!TABLES[table]) return { error: `Unknown table: ${table}` };
  const db = getSupabase();
  if (!db) return { error: 'Supabase is not configured.' };
  const { error } = await db.from(table).delete().eq('id', id);
  if (error) return { error: error.message };
  touched();
  return { error: null };
}
