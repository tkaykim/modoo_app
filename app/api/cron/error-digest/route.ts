import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
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

// Idempotency: the orchestrator scheduler can re-fire the same digest job many
// times if it fails to advance next_run_at promptly (observed: 14 sends within
// ~5min on 2026-05-28). We dedup per digest "key" so only one email goes out
// per day, regardless of how many times the worker POSTs. We claim the key in a
// log table BEFORE sending; if the send fails we release the claim so a genuine
// retry can still get through.
function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

// Derive a stable per-digest key. The subject embeds the digest date
// ("... — 2026-05-27 · ..."), so dedup on that date. Fallback to today's KST
// date when no date is present, which still enforces one digest per day.
function deriveDigestKey(subject: string): string {
  const m = subject.match(/(\d{4}-\d{2}-\d{2})/);
  if (m) return `digest:${m[1]}`;
  const kst = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
  return `digest:${kst}`;
}

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
  // Idempotency claim: insert the digest key; if it already exists, this is a
  // duplicate re-fire → skip the send. ON CONFLICT DO NOTHING makes concurrent
  // claims race-safe (only one INSERT wins).
  const supabase = getServiceClient();
  const digestKey = deriveDigestKey(subject);
  let claimed = false;
  if (supabase) {
    const { data, error } = await supabase
      .from('digest_relay_log')
      .upsert({ digest_key: digestKey, subject: subject.slice(0, 500) }, {
        onConflict: 'digest_key',
        ignoreDuplicates: true,
      })
      .select('digest_key');
    if (error) {
      // Don't let a logging failure block the digest — fall back to sending.
      console.error('[cron/error-digest] idempotency claim failed, sending anyway:', error);
    } else if (!data || data.length === 0) {
      // Row already existed → already sent for this key today.
      return NextResponse.json({ ok: true, emailed: false, reason: 'duplicate', digestKey });
    } else {
      claimed = true;
    }
  }

  try {
    const ok = await sendGmailEmail({
      to: [{ email: RECIPIENT }],
      subject: subject.slice(0, 200),
      text: text.slice(0, 100_000),
      html: html.slice(0, 500_000),
    });
    // If the send failed, release the claim so a real retry can succeed.
    if (!ok && claimed && supabase) {
      await supabase.from('digest_relay_log').delete().eq('digest_key', digestKey);
    }
    return NextResponse.json({ ok, emailed: ok, digestKey });
  } catch (err) {
    if (claimed && supabase) {
      await supabase.from('digest_relay_log').delete().eq('digest_key', digestKey);
    }
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
