import { NextRequest, NextResponse } from 'next/server';
import { runDailyDigest } from '@/lib/notifications/error-digest';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Vercel cron hits this every day at 09:00 KST (00:00 UTC). Schedule lives in
// vercel.json. Vercel sets `authorization: Bearer <CRON_SECRET>` automatically
// when CRON_SECRET is configured; we also accept a manual ?secret=... for
// ad-hoc invocation.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const header = req.headers.get('authorization') ?? '';
    const url = new URL(req.url);
    const querySecret = url.searchParams.get('secret');
    const ok = header === `Bearer ${secret}` || querySecret === secret;
    if (!ok) {
      return NextResponse.json({ ok: false, reason: 'unauthorized' }, { status: 401 });
    }
  }

  try {
    const result = await runDailyDigest();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error('[cron/error-digest] failed:', err);
    return NextResponse.json(
      { ok: false, reason: 'internal', error: String(err).slice(0, 500) },
      { status: 500 },
    );
  }
}
