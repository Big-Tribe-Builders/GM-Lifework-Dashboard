import { NextResponse, type NextRequest } from 'next/server';
import { tickAll } from '@/lib/mail-send';

/**
 * The daily tick (vercel.json → 06:00 UTC). Resend takes emails up to 30 days
 * ahead; anything planned further out waits here and is handed over once it
 * comes inside that window. Vercel sends `Authorization: Bearer <CRON_SECRET>`
 * when CRON_SECRET is set in the project; without it the route refuses.
 */
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: 'CRON_SECRET is not set.' }, { status: 503 });
  if (req.headers.get('authorization') !== `Bearer ${secret}`) return new NextResponse('unauthorized', { status: 401 });
  const r = await tickAll(req.nextUrl.origin);
  return NextResponse.json(r);
}
