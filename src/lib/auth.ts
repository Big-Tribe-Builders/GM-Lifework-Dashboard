import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

/**
 * Who is signed in.
 *
 * The session lives in cookies, read and refreshed by a Supabase client made
 * per request. This is separate from getSupabase() in lib/supabase.ts, which
 * reads data as the anonymous role and never carries a session.
 *
 * The gate is a switch: LIFEWORK_AUTH=on. Off, the app is open as before, so
 * the first login can be created before anyone is locked out.
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const authEnabled = process.env.LIFEWORK_AUTH === 'on' && Boolean(url && anonKey);

/** A request-scoped client that reads and writes the session cookies. */
export async function authClient() {
  if (!url || !anonKey) return null;
  const store = await cookies();
  return createServerClient(url, anonKey, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list: { name: string; value: string; options?: Record<string, unknown> }[]) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch { /* a server component cannot set cookies; the proxy refreshes them */ }
      },
    },
  });
}

export type Me = { id: string; email: string | null };

export async function currentUser(): Promise<Me | null> {
  const db = await authClient();
  if (!db) return null;
  const { data } = await db.auth.getUser();
  return data.user ? { id: data.user.id, email: data.user.email ?? null } : null;
}

/**
 * The admin client, for inviting and listing users. Needs the service role
 * key, which never reaches the browser. Null when the key is not set, and
 * the page says which name it looked for.
 */
export const ADMIN_ENV = 'SUPABASE_SERVICE_ROLE_KEY';
export function adminClient() {
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
}
