import { NextResponse, type NextRequest } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { authClient } from '@/lib/auth';

/**
 * Where the invitation link lands.
 *
 * Two shapes arrive here. With the email template pointed at this route
 * (token_hash + type), the token is verified on the click and the person is
 * signed in. Supabase's stock template instead verifies on its own server
 * and comes back with ?code=, which is exchanged for a session the same way.
 * Either way the next stop is the password page. A bad or used link goes to
 * /login with a note.
 */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const to = req.nextUrl.clone();
  to.search = '';

  const db = await authClient();
  if (db) {
    const token = q.get('token_hash');
    const type = q.get('type') as EmailOtpType | null;
    const code = q.get('code');
    let ok = false;
    if (token && type) ok = !(await db.auth.verifyOtp({ token_hash: token, type })).error;
    else if (code) ok = !(await db.auth.exchangeCodeForSession(code)).error;
    if (ok) {
      to.pathname = '/auth/set-password';
      return NextResponse.redirect(to);
    }
  }
  to.pathname = '/login';
  to.searchParams.set('note', 'link');
  return NextResponse.redirect(to);
}
