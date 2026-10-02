'use server';

import { revalidatePath } from 'next/cache';
import { getSupabase } from '@/lib/supabase';
import type { ClientStatus } from '@/lib/crm';
import { STATUS_ORDER } from '@/lib/crm';

/**
 * The writes the client zone makes: move, archive, delete, create.
 *
 * All go through the same publishable key the reads use. What that key may
 * touch is decided in the database, not here.
 */

type Result = { error: string | null };

function touched(): void {
  revalidatePath('/d/clients', 'layout');
}

export async function setStatus(id: string, status: ClientStatus): Promise<Result> {
  if (!STATUS_ORDER.includes(status)) return { error: `Unknown status: ${status}` };
  const db = getSupabase();
  if (!db) return { error: 'Supabase is not configured.' };
  const { error } = await db.from('client_companies').update({ status }).eq('id', id);
  if (error) return { error: error.message };
  touched();
  return { error: null };
}

/**
 * The fields the table edits in place, and the column each one is.
 *
 * An allowlist rather than a generic patch: what the table can write is the
 * same short list it can show, and nothing arriving from the browser picks
 * its own column.
 */
const COMPANY_FIELDS = {
  name: 'name',
  communityUrl: 'community_url',
  notionUrl: 'notion_url',
  upworkUrl: 'upwork_url',
  website: 'website',
} as const;

export type CompanyField = keyof typeof COMPANY_FIELDS;

/** A link typed without its scheme would not open; give it the one it means. */
function asUrl(v: string): string | null {
  const t = v.trim();
  if (!t) return null;
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(t) ? t : `https://${t}`;
}

export async function updateCompanyField(id: string, field: CompanyField, value: string): Promise<Result> {
  const column = COMPANY_FIELDS[field];
  if (!column) return { error: `Unknown field: ${field}` };
  const db = getSupabase();
  if (!db) return { error: 'Supabase is not configured.' };

  let next: string | null;
  if (field === 'name') {
    next = value.trim();
    if (!next) return { error: 'A client needs a name.' };
  } else {
    next = asUrl(value);
  }

  const { error } = await db.from('client_companies').update({ [column]: next }).eq('id', id);
  if (error) return { error: error.message };
  touched();
  return { error: null };
}

/**
 * The main contact, typed as one name.
 *
 * Stored as first and last, split at the last space, so what she typed is
 * what the table shows back: the two halves join with the same space.
 * A client with no contact yet gets one, marked primary.
 */
export async function setPrimaryContactName(companyId: string, full: string): Promise<Result> {
  const name = full.trim().replace(/\s+/g, ' ');
  const db = getSupabase();
  if (!db) return { error: 'Supabase is not configured.' };

  const cut = name.lastIndexOf(' ');
  const first = cut < 0 ? name : name.slice(0, cut);
  const last = cut < 0 ? '' : name.slice(cut + 1);

  const { data: existing, error: e0 } = await db
    .from('client_contacts')
    .select('id, is_primary')
    .eq('company_id', companyId)
    .order('is_primary', { ascending: false })
    .limit(1);
  if (e0) return { error: e0.message };
  const current = existing?.[0] as { id: string } | undefined;

  if (!name) {
    return { error: current ? 'A contact needs a name. Remove them from the client page instead.' : null };
  }

  if (current) {
    const { error } = await db
      .from('client_contacts')
      .update({ first_name: first, last_name: last, is_primary: true, needs_check: false })
      .eq('id', current.id);
    if (error) return { error: error.message };
  } else {
    const { error } = await db.from('client_contacts').insert({
      company_id: companyId,
      first_name: first,
      last_name: last,
      is_primary: true,
      source: 'direct',
      needs_check: false,
    });
    if (error) return { error: error.message };
  }
  touched();
  return { error: null };
}

export async function archiveClient(id: string): Promise<Result> {
  return setStatus(id, 'archived');
}

export async function deleteClient(id: string): Promise<Result> {
  const db = getSupabase();
  if (!db) return { error: 'Supabase is not configured.' };
  // Contacts and apps cascade from the company row.
  const { error } = await db.from('client_companies').delete().eq('id', id);
  if (error) return { error: error.message };
  touched();
  return { error: null };
}

export type NewClient = {
  name: string;
  firstName: string;
  lastName: string;
  status: ClientStatus;
  email: string;
  website: string;
  communityUrl: string;
  upworkUrl: string;
  notes: string;
};

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'client';
}

const trim = (v: string) => v.trim() || null;

export async function createClient(input: NewClient): Promise<Result & { id?: string }> {
  const name = input.name.trim();
  if (!name) return { error: 'The community name is required.' };
  if (!STATUS_ORDER.includes(input.status)) return { error: `Unknown status: ${input.status}` };

  const db = getSupabase();
  if (!db) return { error: 'Supabase is not configured.' };

  // Ids are slugs, like the imported rows. If the slug is taken, suffix it
  // rather than fail: two clients really can share a name.
  const base = slug(name);
  const { data: taken } = await db.from('client_companies').select('id').like('id', `${base}%`);
  const ids = new Set((taken ?? []).map((r: { id: string }) => r.id));
  let id = base;
  for (let n = 2; ids.has(id); n++) id = `${base}-${n}`;

  const { error: e1 } = await db.from('client_companies').insert({
    id,
    name,
    status: input.status,
    source: input.upworkUrl.trim() ? 'upwork' : 'direct',
    website: trim(input.website),
    community_url: trim(input.communityUrl),
    upwork_url: trim(input.upworkUrl),
    notes: trim(input.notes),
  });
  if (e1) return { error: e1.message };

  const first = input.firstName.trim();
  if (first) {
    const { error: e2 } = await db.from('client_contacts').insert({
      company_id: id,
      first_name: first,
      last_name: input.lastName.trim(),
      email: trim(input.email),
      is_primary: true,
      source: input.upworkUrl.trim() ? 'upwork' : 'direct',
      needs_check: !input.lastName.trim(),
    });
    if (e2) return { error: e2.message, id };
  }

  touched();
  return { error: null, id };
}

// --------------------------------------------------------------- the email list

/** The text fields the Emails table edits in place, and their columns. */
const EMAIL_FIELDS = {
  firstName: 'first_name',
  lastName: 'last_name',
  city: 'city',
  state: 'state',
  source: 'source',
  notes: 'notes',
} as const;
export type EmailField = keyof typeof EMAIL_FIELDS;

const EMAIL_FLAGS = { isClient: 'is_client', inCommunity: 'in_community' } as const;
export type EmailFlag = keyof typeof EMAIL_FLAGS;

function cleanEmail(v: string): string | null {
  const e = v.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : null;
}

export async function updateEmailField(email: string, field: EmailField, value: string): Promise<Result> {
  const column = EMAIL_FIELDS[field];
  if (!column) return { error: `Unknown field: ${field}` };
  const db = getSupabase();
  if (!db) return { error: 'Supabase is not configured.' };
  const { error } = await db.from('crm_emails')
    .update({ [column]: trim(value), updated_at: new Date().toISOString() })
    .eq('email', email);
  if (error) return { error: error.message };
  touched();
  return { error: null };
}

export async function setEmailFlag(email: string, flag: EmailFlag, on: boolean): Promise<Result> {
  const column = EMAIL_FLAGS[flag];
  if (!column) return { error: `Unknown flag: ${flag}` };
  const db = getSupabase();
  if (!db) return { error: 'Supabase is not configured.' };
  const { error } = await db.from('crm_emails')
    .update({ [column]: on, updated_at: new Date().toISOString() })
    .eq('email', email);
  if (error) return { error: error.message };
  touched();
  return { error: null };
}

export type NewEmail = {
  email: string; firstName: string; lastName: string; city: string; state: string; source: string;
};

export async function createEmail(input: NewEmail): Promise<Result> {
  const email = cleanEmail(input.email);
  if (!email) return { error: 'That is not an email address.' };
  const db = getSupabase();
  if (!db) return { error: 'Supabase is not configured.' };
  const { error } = await db.from('crm_emails').insert({
    email,
    first_name: trim(input.firstName),
    last_name: trim(input.lastName),
    city: trim(input.city),
    state: trim(input.state),
    source: trim(input.source),
  });
  if (error) return { error: error.code === '23505' ? 'That address is already in the list.' : error.message };
  touched();
  return { error: null };
}

export async function deleteEmail(email: string): Promise<Result> {
  const db = getSupabase();
  if (!db) return { error: 'Supabase is not configured.' };
  const { error } = await db.from('crm_emails').delete().eq('email', email);
  if (error) return { error: error.message };
  touched();
  return { error: null };
}
