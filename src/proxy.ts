import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

/**
 * The gate.
 *
 * With LIFEWORK_AUTH=on, every page needs a signed-in user; without one you
 * land on /login. The login page, the invite landing and the password page
 * stay open, as does the icon. The session cookie is refreshed here on every
 * request, which is the one place that may set cookies.
 */
// /api/mail/ is for Resend's webhook, the unsubscribe link in every email and
// the daily tick: none of them has a signed-in user.
const OPEN = ['/login', '/auth/', '/api/mail/'];

export async function proxy(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (process.env.LIFEWORK_AUTH !== 'on' || !url || !anonKey) return NextResponse.next();

  let res = NextResponse.next({ request: req });
  const db = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (list: { name: string; value: string; options?: Record<string, unknown> }[]) => {
        for (const { name, value } of list) req.cookies.set(name, value);
        res = NextResponse.next({ request: req });
        for (const { name, value, options } of list) res.cookies.set(name, value, options);
      },
    },
  });

  const { data } = await db.auth.getUser();
  const path = req.nextUrl.pathname;
  const open = OPEN.some((p) => path === p || path.startsWith(p));

  if (!data.user && !open) {
    const to = req.nextUrl.clone();
    to.pathname = '/login';
    to.search = '';
    return NextResponse.redirect(to);
  }
  if (data.user && path === '/login') {
    const to = req.nextUrl.clone();
    to.pathname = '/';
    to.search = '';
    return NextResponse.redirect(to);
  }
  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|icon.svg|favicon.ico).*)'],
};
