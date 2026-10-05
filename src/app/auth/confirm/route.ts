import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import type { EmailOtpType } from '@supabase/supabase-js';

/**
 * Where the invitation link lands.
 *
 * The token is verified here and the session cookies are written straight
 * onto the redirect response — not through the request cookie store, which
 * a redirect returned from a route handler does not reliably carry. Two link
 * shapes arrive: token_hash + type from our email template, or ?code= from
 * Supabase's stock template. A failure goes to /login with the reason.
 */
export async function GET(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const q = req.nextUrl.searchParams;
  const to = req.nextUrl.clone();
  to.search = '';

  const fail = (why: string) => {
    to.pathname = '/login';
    to.searchParams.set('note', why);
    return NextResponse.redirect(to);
  };
  if (!url || !anonKey) return fail('env');

  to.pathname = '/auth/set-password';
  const res = NextResponse.redirect(to);

  const db = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (list: { name: string; value: string; options?: Record<string, unknown> }[]) => {
        for (const { name, value, options } of list) res.cookies.set(name, value, options);
      },
    },
  });

  const token = q.get('token_hash');
  const type = q.get('type') as EmailOtpType | null;
  const code = q.get('code');

  let error: { message: string } | null = null;
  if (token && type) ({ error } = await db.auth.verifyOtp({ token_hash: token, type }));
  else if (code) ({ error } = await db.auth.exchangeCodeForSession(code));
  else return fail('nolink');

  if (error) {
    console.error('[auth/confirm]', error.message);
    return fail('verify');
  }
  return res;
}
