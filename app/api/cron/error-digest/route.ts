import { NextRequest, NextResponse } from 'next/server';
import { sendGmailEmail } from '@/lib/gmail';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// Gmail relay for the daily error digest. Diagnosis happens on the always-on
// orchestrator worker (Claude Max OAuth, no API billing). The worker POSTs
// the pre-built {subject, text, html} payload here and we forward it via
// Gmail SMTP, reusing the existing GMAIL_USER / GMAIL_APP_PASSWORD secrets
// without exposing them to the worker.
//
// Auth: shared CRON_SECRET via `Authorization: Bearer <secret>`.
const RECIPIENT = process.env.ERROR_REPORT_TO || 'modoo.contact@gmail.com';

function checkAuth(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // unset → open (dev only)
  const header = req.headers.get('authorization') ?? '';
  if (header === `Bearer ${secret}`) return true;
  const url = new URL(req.url);
  return url.searchParams.get('secret') === secret;
}

export async function POST(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ ok: false, reason: 'unauthorized' }, { status: 401 });
  }
  let raw: unknown = null;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ ok: false, reason: 'invalid_json' }, { status: 400 });
  }
  if (!raw || typeof raw !== 'object') {
    return NextResponse.json({ ok: false, reason: 'invalid_body' }, { status: 400 });
  }
  const body = raw as { subject?: unknown; text?: unknown; html?: unknown };
  const subject = typeof body.subject === 'string' ? body.subject : null;
  const text = typeof body.text === 'string' ? body.text : null;
  const html = typeof body.html === 'string' ? body.html : null;
  if (!subject || !text || !html) {
    return NextResponse.json({ ok: false, reason: 'invalid_body' }, { status: 400 });
  }
  try {
    const ok = await sendGmailEmail({
      to: [{ email: RECIPIENT }],
      subject: subject.slice(0, 200),
      text: text.slice(0, 100_000),
      html: html.slice(0, 500_000),
    });
    return NextResponse.json({ ok, emailed: ok });
  } catch (err) {
    console.error('[cron/error-digest] relay failed:', err);
    return NextResponse.json(
      { ok: false, reason: 'internal', error: String(err).slice(0, 500) },
      { status: 500 },
    );
  }
}

// GET kept as a 410 to make it obvious that the LLM-based cron path is gone.
export function GET() {
  return NextResponse.json(
    {
      ok: false,
      reason: 'gone',
      message:
        'Daily digest is now produced by the orchestrator worker (Claude Max OAuth). This endpoint only accepts POST for Gmail relay.',
    },
    { status: 410 },
  );
}
