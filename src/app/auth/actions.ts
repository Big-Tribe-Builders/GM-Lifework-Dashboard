'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { authClient, adminClient, ADMIN_ENV } from '@/lib/auth';

type Result = { error: string | null };

export async function signIn(email: string, password: string): Promise<Result> {
  const db = await authClient();
  if (!db) return { error: 'Supabase is not configured.' };
  const { error } = await db.auth.signInWithPassword({ email: email.trim(), password });
  if (error) return { error: 'That email and password do not match.' };
  redirect('/');
}

export async function signOut(): Promise<void> {
  const db = await authClient();
  if (db) await db.auth.signOut();
  redirect('/login');
}

/** Called from the page the invite link lands on, once the token is verified. */
export async function setPassword(password: string): Promise<Result> {
  if (password.length < 8) return { error: 'Use at least 8 characters.' };
  const db = await authClient();
  if (!db) return { error: 'Supabase is not configured.' };
  const { error } = await db.auth.updateUser({ password });
  if (error) return { error: error.message };
  redirect('/');
}

/** Send an invitation. The link in the mail comes back to /auth/confirm here. */
export async function inviteUser(email: string): Promise<Result> {
  const admin = adminClient();
  if (!admin) return { error: `${ADMIN_ENV} is not set in Vercel, so invitations cannot be sent from here.` };
  const e = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return { error: 'That is not an email address.' };
  const h = await headers();
  const origin = `${h.get('x-forwarded-proto') ?? 'https'}://${h.get('host')}`;
  const { error } = await admin.auth.admin.inviteUserByEmail(e, { redirectTo: `${origin}/auth/confirm` });
  if (error) return { error: error.message };
  revalidatePath('/settings');
  return { error: null };
}

export async function removeUser(id: string): Promise<Result> {
  const admin = adminClient();
  if (!admin) return { error: `${ADMIN_ENV} is not set in Vercel.` };
  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) return { error: error.message };
  revalidatePath('/settings');
  return { error: null };
}
