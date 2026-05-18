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
    const nowMs = Date.now();

    // Upsert: increment occurrence_count regardless of whether we send.
    const { data: existing } = await supabase
      .from('error_logs')
      .select('id, last_emailed_at, emails_sent_today, emails_sent_date, occurrence_count')
      .eq('dedup_key', dedupKey)
      .maybeSingle();

    let shouldEmail = !noise.isNoise;
    let suppressReason: string | undefined = noise.isNoise ? `noise(${noise.reason})` : undefined;
    let occurrenceSinceLast = 1;
    const nowIso = new Date().toISOString();

    if (existing) {
      const sameDay = existing.emails_sent_date === todayKst;
      const sentToday = sameDay ? existing.emails_sent_today : 0;
      const lastMs = existing.last_emailed_at ? new Date(existing.last_emailed_at).getTime() : 0;
      const secSinceLast = (nowMs - lastMs) / 1000;
      occurrenceSinceLast = (existing.occurrence_count ?? 0) + 1;

      if (shouldEmail) {
        if (lastMs > 0 && secSinceLast < cooldownSec) {
          shouldEmail = false;
          suppressReason = `cooldown(${Math.round(cooldownSec - secSinceLast)}s)`;
        } else if (sentToday >= DAILY_CAP) {
          shouldEmail = false;
          suppressReason = `daily_cap(${sentToday}/${DAILY_CAP})`;
        }
      }

      await supabase
        .from('error_logs')
        .update({
          message: report.message,
          stack: report.stack,
          url: report.url,
          user_agent: report.userAgent,
          user_id: report.userId ?? null,
          is_payment: isPayment,
          is_noise: noise.isNoise,
          noise_reason: noise.reason ?? null,
          last_seen_at: nowIso,
          occurrence_count: occurrenceSinceLast,
          context: report.context ?? null,
          updated_at: nowIso,
          ...(shouldEmail
            ? {
                last_emailed_at: nowIso,
                emails_sent_today: sameDay ? existing.emails_sent_today + 1 : 1,
                emails_sent_date: todayKst,
                occurrence_count: 0, // reset since-last counter after emailing
              }
            : {}),
        })
        .eq('id', existing.id);
    } else {
      await supabase.from('error_logs').insert({
        dedup_key: dedupKey,
        message: report.message,
        stack: report.stack,
        url: report.url,
        user_agent: report.userAgent,
        user_id: report.userId ?? null,
        is_payment: isPayment,
        is_noise: noise.isNoise,
        noise_reason: noise.reason ?? null,
        first_seen_at: nowIso,
        last_seen_at: nowIso,
        occurrence_count: 0,
        last_emailed_at: shouldEmail ? nowIso : null,
        emails_sent_today: shouldEmail ? 1 : 0,
        emails_sent_date: todayKst,
        context: report.context ?? null,
      });
      occurrenceSinceLast = 1;
    }

    if (!shouldEmail) return { emailed: false, reason: suppressReason };

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
