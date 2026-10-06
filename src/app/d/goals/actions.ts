'use server';

import { revalidatePath } from 'next/cache';
import { getSupabase } from '@/lib/supabase';
import { VENTURES } from '@/lib/goals';

/** Writes for the Goal Navigator. One allowlist per table. */
type Result = { error: string | null };
const touched = () => revalidatePath('/d/goal-navigator', 'layout');

const STATUS = ['todo', 'doing', 'done', 'parked'];
const TABLES = {
  goal_years: {
    text: { title: 'title', notes: 'notes', venture: 'venture' },
    date: {},
    number: { year: 'year', sortOrder: 'sort_order' },
    ref: {},
    enum: { status: STATUS },
  },
  goal_quarters: {
    text: { title: 'title', notes: 'notes', venture: 'venture', quarter: 'quarter' },
    date: {},
    number: { sortOrder: 'sort_order' },
    ref: { yearGoalId: 'year_goal_id' },
    enum: { status: STATUS },
  },
  goal_actions: {
    text: { title: 'title', notes: 'notes', venture: 'venture', quarter: 'quarter', owner: 'owner' },
    date: { doDate: 'do_date', dueDate: 'due_date' },
    number: { sortOrder: 'sort_order' },
    ref: { quarterGoalId: 'quarter_goal_id' },
    enum: { status: STATUS, priority: ['high', 'normal', 'low'] },
  },
} as const;
export type GoalTable = keyof typeof TABLES;

type Spec = { text: Record<string, string>; date: Record<string, string>; number: Record<string, string>; ref: Record<string, string>; enum: Record<string, readonly string[]> };

export async function updateGoal(table: GoalTable, id: string, field: string, value: string): Promise<Result> {
  const spec = TABLES[table] as unknown as Spec;
  if (!spec) return { error: `Unknown table: ${table}` };
  const db = getSupabase();
  if (!db) return { error: 'Supabase is not configured.' };
  const v = value.trim();
  let patch: Record<string, unknown> | null = null;
  if (field in spec.text) {
    if (field === 'title' && !v) return { error: 'A title is needed.' };
    if (field === 'venture' && !(VENTURES as readonly string[]).includes(v)) return { error: 'Pick one of the three ventures.' };
    if (field === 'quarter' && !/^\d{4}-Q[1-4]$/.test(v)) return { error: 'A quarter is written 2026-Q4.' };
    patch = { [spec.text[field]]: v || null };
  } else if (field in spec.date) {
    if (v && !/^\d{4}-\d{2}-\d{2}$/.test(v)) return { error: 'Dates are written 2026-11-30.' };
    patch = { [spec.date[field]]: v || null };
  } else if (field in spec.number) {
    const n = Number(v);
    if (!v || !Number.isFinite(n)) return { error: 'A number, please.' };
    patch = { [spec.number[field]]: Math.round(n) };
  } else if (field in spec.ref) {
    patch = { [spec.ref[field]]: v || null };
  } else if (field in spec.enum) {
    if (v && !spec.enum[field].includes(v)) return { error: `Not a valid ${field}.` };
    patch = { [field]: v || null };
  }
  if (!patch) return { error: `Unknown field: ${field}` };
  const { error } = await db.from(table).update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) return { error: error.message };
  touched();
  return { error: null };
}

export async function addGoal(table: GoalTable, input: Record<string, string>): Promise<Result> {
  const spec = TABLES[table] as unknown as Spec;
  if (!spec) return { error: `Unknown table: ${table}` };
  const db = getSupabase();
  if (!db) return { error: 'Supabase is not configured.' };
  const row: Record<string, unknown> = {};
  for (const [k, col] of Object.entries(spec.text)) if (input[k]?.trim()) row[col] = input[k].trim();
  for (const [k, col] of Object.entries(spec.number)) if (input[k]?.trim()) row[col] = Number(input[k]);
  for (const [k, col] of Object.entries(spec.ref)) if (input[k]?.trim()) row[col] = input[k].trim();
  for (const [k, col] of Object.entries(spec.date)) if (input[k]?.trim()) row[col] = input[k].trim();
  if (!row.title) return { error: 'A title is needed.' };
  if (!row.venture || !(VENTURES as readonly string[]).includes(row.venture as string)) return { error: 'Pick one of the three ventures.' };
  if (table === 'goal_years' && !row.year) return { error: 'A year is needed.' };
  if (table !== 'goal_years' && !/^\d{4}-Q[1-4]$/.test(String(row.quarter ?? ''))) return { error: 'A quarter is written 2026-Q4.' };
  const { error } = await db.from(table).insert(row);
  if (error) return { error: error.message };
  touched();
  return { error: null };
}

export async function removeGoal(table: GoalTable, id: string): Promise<Result> {
  if (!TABLES[table]) return { error: `Unknown table: ${table}` };
  const db = getSupabase();
  if (!db) return { error: 'Supabase is not configured.' };
  const { error } = await db.from(table).delete().eq('id', id);
  if (error) return { error: error.message };
  touched();
  return { error: null };
}
