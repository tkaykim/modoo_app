import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { sendGmailEmail } from '@/lib/gmail';
import { classifyNoise } from './noise-classifier';

// ===========================================================================
// Error email notifier with dedup + cooldown.
// - Cooldown: payment errors 1min, others 5min.
// - Daily cap: 5 emails per dedup_key per day (KST).
// - Occurrence count keeps incrementing even when emails are suppressed,
//   so the next email reports total impact ("X times since last email").
// ===========================================================================

const RECIPIENT = process.env.ERROR_REPORT_TO || 'modoo.contact@gmail.com';
const COOLDOWN_PAYMENT_SEC = 60;
const COOLDOWN_NORMAL_SEC = 300;
const DAILY_CAP = 5;

export interface ErrorReport {
  message: string;
  stack?: string;
  url?: string;
  userAgent?: string;
  userId?: string | null;
  context?: Record<string, unknown>;
  source?: 'client' | 'server' | 'api' | 'global';
}

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

function normalizeStackTop(stack?: string): string {
  if (!stack) return '';
  // Take the first non-empty line and strip column/line numbers + query strings
  // so the same call site collapses across users / page loads.
  const firstLine = stack.split('\n').map((l) => l.trim()).find((l) => l.length > 0) ?? '';
  return firstLine
    .replace(/\?[^):\s]*/g, '') // strip query strings inside URLs
    .replace(/:\d+:\d+\)?$/g, '') // strip trailing :line:col
    .replace(/:\d+\)?$/g, '') // strip trailing :line
    .slice(0, 200);
}

function buildDedupKey(message: string, url?: string, stack?: string): string {
  // Hash by message + path (ignore query string) + normalized stack top so the
  // same bug across users collapses to one key, even when utm/fbclid changes.
  let pathOnly = '';
  try {
    pathOnly = url ? new URL(url, 'https://x').pathname : '';
  } catch {
    pathOnly = url ?? '';
  }
  const stackTop = normalizeStackTop(stack);
  return createHash('sha256')
    .update(`${message}::${pathOnly}::${stackTop}`)
    .digest('hex')
    .slice(0, 32);
}

function isPaymentRelated(report: ErrorReport): boolean {
  const haystack = `${report.url ?? ''} ${report.message} ${report.stack ?? ''}`.toLowerCase();
  return /(checkout|payment|toss|order\/|\/api\/orders|결제)/i.test(haystack);
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

function buildEmailHtml(report: ErrorReport, isPayment: boolean, occurrenceCount: number): string {
  const ts = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
  const summary = report.message.slice(0, 200);
  const badge = isPayment
    ? '<span style="background:#e74c3c;color:#fff;padding:3px 10px;border-radius:4px;font-size:12px;font-weight:600;">결제 관련</span>'
    : '<span style="background:#f39c12;color:#fff;padding:3px 10px;border-radius:4px;font-size:12px;font-weight:600;">일반</span>';
  const row = (label: string, value: string) =>
    `<tr><td style="padding:6px 12px;color:#666;width:120px;vertical-align:top;">${label}</td><td style="padding:6px 12px;font-family:monospace;font-size:12px;word-break:break-all;">${escapeHtml(value)}</td></tr>`;

  return `
    <div style="max-width:680px;margin:0 auto;font-family:'Apple SD Gothic Neo','Malgun Gothic',sans-serif;color:#222;">
      <div style="background:#c0392b;padding:20px 24px;">
        <h1 style="color:#fff;margin:0;font-size:20px;">🚨 치명적 오류 발생</h1>
        <p style="color:#fff;margin:6px 0 0;font-size:13px;opacity:0.92;">${badge}&nbsp;&nbsp;${ts} KST</p>
      </div>
      <div style="padding:20px 24px;">
        <div style="background:#fdf2f1;border-left:4px solid #c0392b;padding:12px 16px;margin-bottom:16px;">
          <div style="font-weight:600;font-size:14px;color:#c0392b;margin-bottom:4px;">에러 메시지</div>
          <div style="font-family:monospace;font-size:13px;word-break:break-all;">${escapeHtml(summary)}</div>
        </div>
        ${
          occurrenceCount > 1
            ? `<p style="background:#fff8e1;padding:10px 14px;border-radius:6px;margin:0 0 16px;font-size:13px;">⚠️ 마지막 이메일 이후 <strong>${occurrenceCount}회</strong> 추가 발생했습니다.</p>`
            : ''
        }
        <table style="width:100%;border-collapse:collapse;font-size:13px;border:1px solid #eee;">
          ${row('소스', report.source ?? 'unknown')}
          ${row('URL', report.url ?? '-')}
          ${row('User ID', report.userId ?? '익명')}
          ${row('User Agent', report.userAgent ?? '-')}
        </table>
        ${
          report.stack
            ? `<details style="margin-top:16px;"><summary style="cursor:pointer;font-weight:600;color:#555;">Stack Trace</summary><pre style="background:#1e1e1e;color:#f8f8f2;padding:14px;border-radius:6px;overflow:auto;font-size:11px;line-height:1.5;">${escapeHtml(report.stack.slice(0, 4000))}</pre></details>`
            : ''
        }
        ${
          report.context
            ? `<details style="margin-top:12px;"><summary style="cursor:pointer;font-weight:600;color:#555;">Context</summary><pre style="background:#f5f5f5;padding:12px;border-radius:6px;overflow:auto;font-size:11px;">${escapeHtml(JSON.stringify(report.context, null, 2).slice(0, 4000))}</pre></details>`
            : ''
        }
      </div>
      <div style="background:#f8f9fa;padding:14px 24px;text-align:center;font-size:11px;color:#999;">
        모두의 유니폼 자동 오류 알림 시스템 · dedup_key는 동일 에러 그룹화에 사용됩니다.
      </div>
    </div>
  `;
}

function buildEmailText(report: ErrorReport, isPayment: boolean, occurrenceCount: number): string {
  const ts = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
  return [
    `[모두의유니폼] 🚨 치명적 오류 발생 ${isPayment ? '(결제 관련)' : ''}`,
    `발생시각: ${ts} KST`,
    occurrenceCount > 1 ? `마지막 이메일 이후 ${occurrenceCount}회 추가 발생` : '',
    '',
    `메시지: ${report.message}`,
    `소스: ${report.source ?? 'unknown'}`,
    `URL: ${report.url ?? '-'}`,
    `User ID: ${report.userId ?? '익명'}`,
    `User Agent: ${report.userAgent ?? '-'}`,
    '',
    report.stack ? `--- Stack ---\n${report.stack}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

export async function reportError(report: ErrorReport): Promise<{ emailed: boolean; reason?: string }> {
  // Always swallow internal failures — never let error reporting itself crash callers.
  try {
    if (!report.message) return { emailed: false, reason: 'empty_message' };

    const isPayment = isPaymentRelated(report);
    const noise = classifyNoise(report);
    const dedupKey = buildDedupKey(report.message, report.url, report.stack);
    const supabase = getServiceClient();

    if (!supabase) {
      // No DB: still suppress noise emails to avoid spamming the inbox.
      if (noise.isNoise) {
        return { emailed: false, reason: `noise(${noise.reason})` };
      }
      console.error('[error-mail] Supabase service client unavailable, sending email without dedup');
      const ok = await sendGmailEmail({
        to: [{ email: RECIPIENT }],
        subject: `[모두의유니폼] 🚨 치명적 오류 발생 — ${report.message.slice(0, 80)}`,
        text: buildEmailText(report, isPayment, 1),
        html: buildEmailHtml(report, isPayment, 1),
      });
      return { emailed: ok };
    }

    const todayKst = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
    const cooldownSec = isPayment ? COOLDOWN_PAYMENT_SEC : COOLDOWN_NORMAL_SEC;

    // Atomic claim: the upsert + cooldown/cap decision happens in a single
    // row-locked DB function. This prevents duplicate emails when the SAME
    // error is reported concurrently from multiple capture paths (React error
    // boundary + window.onerror both fire for one thrown error). Without the
    // lock, both calls read "no recent email" and both send → 2 emails per
    // error. With it, only one call wins should_email=true.
    const { data: claim, error: claimErr } = await supabase.rpc('claim_error_report', {
      p_dedup_key: dedupKey,
      p_message: report.message,
      p_stack: report.stack ?? null,
      p_url: report.url ?? null,
      p_user_agent: report.userAgent ?? null,
      p_user_id: report.userId ?? null,
      p_is_payment: isPayment,
      p_is_noise: noise.isNoise,
      p_noise_reason: noise.reason ?? null,
      p_context: report.context ?? null,
      p_cooldown_sec: cooldownSec,
      p_daily_cap: DAILY_CAP,
      p_today_kst: todayKst,
    });

    if (claimErr) {
      console.error('[error-mail] claim_error_report failed:', claimErr);
      return { emailed: false, reason: 'claim_failed' };
    }

    const row = Array.isArray(claim) ? claim[0] : claim;
    const shouldEmail: boolean = !!row?.should_email;
    const occurrenceSinceLast: number = row?.occurrence_since_last ?? 1;

    if (!shouldEmail) {
      return { emailed: false, reason: noise.isNoise ? `noise(${noise.reason})` : 'cooldown_or_cap' };
    }

    const ok = await sendGmailEmail({
      to: [{ email: RECIPIENT }],
      subject: `[모두의유니폼] 🚨 치명적 오류 발생 — ${report.message.slice(0, 80)}`,
      text: buildEmailText(report, isPayment, occurrenceSinceLast),
      html: buildEmailHtml(report, isPayment, occurrenceSinceLast),
    });
    return { emailed: ok };
  } catch (err) {
    console.error('[error-mail] reportError itself failed:', err);
    return { emailed: false, reason: 'internal_failure' };
  }
}
