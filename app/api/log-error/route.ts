import { NextRequest, NextResponse } from 'next/server';
import { reportError, type ErrorReport } from '@/lib/notifications/error-mail';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Lightweight per-IP in-memory throttle (best-effort; serverless instances are
// reused often enough for hot paths to benefit). Hard dedup is done in DB.
const ipBuckets = new Map<string, { count: number; resetAt: number }>();
const IP_WINDOW_MS = 60_000;
const IP_MAX_PER_WINDOW = 30;

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const b = ipBuckets.get(ip);
  if (!b || b.resetAt < now) {
    ipBuckets.set(ip, { count: 1, resetAt: now + IP_WINDOW_MS });
    return false;
  }
  if (b.count >= IP_MAX_PER_WINDOW) return true;
  b.count += 1;
  return false;
}

export async function POST(req: NextRequest) {
  try {
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      'unknown';
    if (rateLimited(ip)) {
      return NextResponse.json({ ok: false, reason: 'rate_limited' }, { status: 429 });
    }

    const body = (await req.json().catch(() => null)) as Partial<ErrorReport> | null;
    if (!body || typeof body.message !== 'string' || !body.message.trim()) {
      return NextResponse.json({ ok: false, reason: 'invalid_body' }, { status: 400 });
    }

    const report: ErrorReport = {
      message: body.message.slice(0, 2000),
      stack: typeof body.stack === 'string' ? body.stack.slice(0, 8000) : undefined,
      url: typeof body.url === 'string' ? body.url.slice(0, 2000) : undefined,
      userAgent:
        typeof body.userAgent === 'string'
          ? body.userAgent.slice(0, 500)
          : req.headers.get('user-agent') || undefined,
      userId: typeof body.userId === 'string' ? body.userId : null,
      context: typeof body.context === 'object' && body.context !== null ? body.context : undefined,
      source: body.source === 'server' || body.source === 'api' || body.source === 'global' ? body.source : 'client',
    };

    const result = await reportError(report);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    // Never let this endpoint crash — error reporting must not cause more errors.
    console.error('[/api/log-error] handler failed:', err);
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
