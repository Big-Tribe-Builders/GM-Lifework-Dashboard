import { NextResponse, type NextRequest } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { authClient } from '@/lib/auth';

/**
 * Where the invitation link lands.
 *
 * Supabase sends a one-time token; verifying it signs the person in, and
 * then they choose a password. A bad or used link goes to /login with a note.
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token_hash');
  const type = req.nextUrl.searchParams.get('type') as EmailOtpType | null;
  const to = req.nextUrl.clone();
  to.search = '';

  const db = await authClient();
  if (db && token && type) {
    const { error } = await db.auth.verifyOtp({ token_hash: token, type });
    if (!error) {
      to.pathname = type === 'invite' || type === 'recovery' ? '/auth/set-password' : '/';
      return NextResponse.redirect(to);
    }
  }
  to.pathname = '/login';
  to.searchParams.set('note', 'link');
  return NextResponse.redirect(to);
}
