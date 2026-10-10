'use server';

import { revalidatePath } from 'next/cache';
import { getSupabase } from '@/lib/supabase';
import { JOB_STATUSES, JOB_FITS, JOB_PLATFORMS, JOB_WORK_TYPES, COVER_LETTER_MAX } from '@/lib/upwork';

/**
 * Writes for Upwork › Proposals, the job pipeline. One allowlist: a field
 * that is not here is never written. Nothing here talks to Upwork itself;
 * sending a proposal stays a separate, deliberate step.
 */
type Result = { error: string | null };
const touched = () => revalidatePath('/d/upwork', 'layout');

const DATE = /^(19|20)\d{2}-\d{2}-\d{2}$/;

/** Upwork's id for a job, from its link (…/jobs/~02<id>), so a later scan finds the job again. */
const jobIdOf = (url: string) => /~02(\d{6,})/.exec(url)?.[1] ?? null;
const TEXT: Record<string, string> = {
  title: 'title', jobId: 'job_id', description: 'description', client: 'client', country: 'country', clientSpend: 'client_spend',
  budget: 'budget', proposalsAtScan: 'proposals_at_scan', whyItFits: 'why_it_fits', nextAction: 'next_action', notes: 'notes',
};
const DATES: Record<string, string> = { postedOn: 'posted_on', foundOn: 'found_on', nextActionDate: 'next_action_date', sentOn: 'sent_on', lastActivity: 'last_activity' };

function patchFor(field: string, value: string): { patch?: Record<string, unknown>; error?: string } {
  const keepLines = ['description', 'whyItFits', 'notes', 'proposal'].includes(field);
  const v = keepLines ? value : value.trim();
  if (field === 'title') return v ? { patch: { title: v } } : { error: 'A job title is needed.' };
  if (field === 'proposal') return v.length <= COVER_LETTER_MAX * 2 ? { patch: { proposal: v } } : { error: 'That is far longer than Upwork takes.' };
  if (field in TEXT) return { patch: { [TEXT[field]]: v.trim() ? v : null } };
  if (field === 'foundOn' && !v) return { error: 'A job keeps the date it was found.' };
  if (field in DATES) return !v || DATE.test(v) ? { patch: { [DATES[field]]: v || null } } : { error: 'Dates are written 2026-10-10.' };
  switch (field) {
    case 'url': {
      if (v && !/^https:\/\/\S+$/.test(v)) return { error: 'A link starts with https://' };
      // A new link carries the job's id; a link without one (or none) leaves the id as it was.
      const id = v ? jobIdOf(v) : null;
      return { patch: id ? { url: v, job_id: id } : { url: v || null } };
    }
    case 'status': return (JOB_STATUSES as string[]).includes(v) ? { patch: { status: v } } : { error: 'Not one of the statuses.' };
    case 'fit': return !v || (JOB_FITS as string[]).includes(v) ? { patch: { fit: v || null } } : { error: 'Strong, Possible or Skip.' };
    case 'platform': return !v || (JOB_PLATFORMS as readonly string[]).includes(v) ? { patch: { platform: v || null } } : { error: 'Mighty Networks, Circle, Skool or Other.' };
    case 'workType': {
      const list = v ? v.split('|').map((x) => x.trim()).filter(Boolean) : [];
      return list.every((x) => (JOB_WORK_TYPES as readonly string[]).includes(x)) ? { patch: { work_type: [...new Set(list)] } } : { error: 'Not one of the work types.' };
    }
    case 'clientRating': {
      if (!v) return { patch: { client_rating: null } };
      const n = Number(v.replace(',', '.'));
      return Number.isFinite(n) && n >= 0 && n <= 5 ? { patch: { client_rating: n } } : { error: 'A rating from 0 to 5.' };
    }
    case 'connectsSpent': {
      if (!v) return { patch: { connects_spent: null } };
      const n = Number(v);
      return Number.isInteger(n) && n >= 0 && n < 1000 ? { patch: { connects_spent: n } } : { error: 'A whole number of Connects.' };
    }
    case 'paymentVerified': return { patch: { payment_verified: v === '' ? null : v === 'true' } };
    default: return { error: `Unknown field: ${field}` };
  }
}

export async function addJob(input: Record<string, string>): Promise<Result> {
  const db = getSupabase();
  if (!db) return { error: 'Supabase is not configured.' };
  const row: Record<string, unknown> = {};
  for (const k of ['title', 'url', 'status', 'fit', 'platform']) {
    if (k !== 'title' && !input[k]?.trim()) continue;
    const r = patchFor(k, input[k] ?? '');
    if (r.error) return { error: r.error };
    Object.assign(row, r.patch);
  }
  const { error } = await db.from('upwork_jobs').insert(row);
  if (error) return { error: error.code === '23505' ? 'That job is already in the pipeline.' : error.message };
  touched();
  return { error: null };
}

export async function updateJob(id: string, field: string, value: string): Promise<Result> {
  const db = getSupabase();
  if (!db) return { error: 'Supabase is not configured.' };
  const r = patchFor(field, value);
  if (r.error) return { error: r.error };
  const { error } = await db.from('upwork_jobs').update({ ...r.patch, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) return { error: error.code === '23505' ? 'Another job already has that Upwork id.' : error.message };
  touched();
  return { error: null };
}

export async function removeJob(id: string): Promise<Result> {
  const db = getSupabase();
  if (!db) return { error: 'Supabase is not configured.' };
  const { error } = await db.from('upwork_jobs').delete().eq('id', id);
  if (error) return { error: error.message };
  touched();
  return { error: null };
}
