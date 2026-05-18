import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { sendGmailEmail } from '@/lib/gmail';

// ===========================================================================
// Daily error digest. Runs at 09:00 KST via Vercel cron. For "yesterday"
// (KST 00:00 — 23:59) it:
//   - Counts noise rows by noise_reason (just statistics, no diagnosis)
//   - Picks the top N real bugs by occurrence_count
//   - Asks Claude to diagnose them in ONE batch call (cost ceiling)
//   - Writes diagnosis back to error_logs (diagnosed_at, diagnosis,
//     diagnosis_model) so we never re-diagnose the same fingerprint
//   - Emails the whole thing to ERROR_REPORT_TO
// No PRs, no code changes — diagnosis is suggestion-only.
// ===========================================================================

const RECIPIENT = process.env.ERROR_REPORT_TO || 'modoo.contact@gmail.com';
const TOP_N_REAL_BUGS = 5; // hard cap on Claude call cost
const CLAUDE_MODEL = 'claude-sonnet-4-6';

interface NoiseStat {
  noise_reason: string | null;
  rows: number;
  events: number;
}

interface RealBugRow {
  id: string;
  dedup_key: string;
  message: string;
  stack: string | null;
  url: string | null;
  user_agent: string | null;
  occurrence_count: number;
  emails_sent_today: number;
  first_seen_at: string;
  last_seen_at: string;
  is_payment: boolean;
}

interface Diagnosis {
  dedup_key: string;
  likely_cause: string;
  is_our_code: boolean;
  severity: 'critical' | 'high' | 'medium' | 'low';
  suggested_fix: string;
  file_hints: string[];
}

function getServiceClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

function kstYesterdayRangeIso(): { startIso: string; endIso: string; label: string } {
  // KST = UTC+9. "Yesterday in KST" means UTC range [yesterdayKstStart, todayKstStart).
  const nowKstMs = Date.now() + 9 * 3600 * 1000;
  const todayKst = new Date(nowKstMs);
  todayKst.setUTCHours(0, 0, 0, 0); // 00:00 KST today, expressed as UTC midnight on KST date
  const todayKstStartUtcMs = todayKst.getTime() - 9 * 3600 * 1000;
  const yesterdayKstStartUtcMs = todayKstStartUtcMs - 24 * 3600 * 1000;
  const startIso = new Date(yesterdayKstStartUtcMs).toISOString();
  const endIso = new Date(todayKstStartUtcMs).toISOString();
  const labelDate = new Date(yesterdayKstStartUtcMs + 9 * 3600 * 1000).toISOString().slice(0, 10);
  return { startIso, endIso, label: labelDate };
}

async function fetchNoiseStats(
  supabase: SupabaseClient,
  startIso: string,
  endIso: string,
): Promise<NoiseStat[]> {
  const { data, error } = await supabase
    .from('error_logs')
    .select('noise_reason, occurrence_count, emails_sent_today')
    .eq('is_noise', true)
    .gte('last_seen_at', startIso)
    .lt('last_seen_at', endIso);
  if (error || !data) return [];
  const buckets = new Map<string, { rows: number; events: number }>();
  for (const r of data) {
    const key = r.noise_reason ?? 'unclassified';
    const b = buckets.get(key) ?? { rows: 0, events: 0 };
    b.rows += 1;
    b.events += (r.occurrence_count ?? 0) + (r.emails_sent_today ?? 0) + 1;
    buckets.set(key, b);
  }
  return [...buckets.entries()]
    .map(([noise_reason, v]) => ({ noise_reason, rows: v.rows, events: v.events }))
    .sort((a, b) => b.events - a.events);
}

async function fetchUndiagnosedRealBugs(
  supabase: SupabaseClient,
  startIso: string,
  endIso: string,
): Promise<RealBugRow[]> {
  const { data, error } = await supabase
    .from('error_logs')
    .select(
      'id, dedup_key, message, stack, url, user_agent, occurrence_count, emails_sent_today, first_seen_at, last_seen_at, is_payment',
    )
    .eq('is_noise', false)
    .is('diagnosed_at', null)
    .gte('last_seen_at', startIso)
    .lt('last_seen_at', endIso)
    .order('occurrence_count', { ascending: false })
    .order('emails_sent_today', { ascending: false })
    .limit(TOP_N_REAL_BUGS);
  if (error || !data) return [];
  return data as RealBugRow[];
}

async function diagnoseBatch(bugs: RealBugRow[]): Promise<Diagnosis[]> {
  if (bugs.length === 0) return [];
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn('[error-digest] ANTHROPIC_API_KEY missing — skipping diagnosis');
    return [];
  }

  const items = bugs.map((b, idx) => ({
    idx,
    dedup_key: b.dedup_key,
    message: b.message,
    stack: (b.stack ?? '').slice(0, 2000),
    url: b.url,
    user_agent: b.user_agent,
    occurrence_count: (b.occurrence_count ?? 0) + (b.emails_sent_today ?? 0) + 1,
    first_seen_at: b.first_seen_at,
    last_seen_at: b.last_seen_at,
    is_payment_path: b.is_payment,
  }));

  const systemPrompt =
    'You are diagnosing JavaScript errors for modoouniform.com — a Next.js 16 (App Router) Korean t-shirt customization e-commerce app using TypeScript, Fabric.js for canvas, Zustand for state, Supabase for backend, and Toss/bank-transfer for payment. The app runs in modern browsers, mobile Safari/Chrome, and occasionally inside Korean in-app browsers (KakaoTalk, Naver). Respond ONLY with a JSON array, no prose, no markdown fences.';

  const userPrompt = `For each of the following ${items.length} client-side errors, decide if it is most likely caused by our application code (is_our_code=true) or by external factors (browser quirks, user network, third-party scripts, ad/analytics SDKs, in-app browsers, etc.) and produce a diagnosis.

Return a JSON array of objects, in the SAME ORDER as input, each shaped exactly:
{
  "dedup_key": "<echo input dedup_key>",
  "likely_cause": "<1-2 sentence root cause hypothesis in Korean>",
  "is_our_code": <true|false>,
  "severity": "critical" | "high" | "medium" | "low",
  "suggested_fix": "<concrete fix suggestion in Korean, max 3 sentences; if is_our_code=false, say what to monitor/ignore>",
  "file_hints": ["<repo-relative file path or module name guesses, up to 3>"]
}

Severity rubric:
- critical: blocks checkout/payment/order, or affects all users
- high: affects key flows (editor, cart) for a meaningful share of users
- medium: degrades non-critical flow, or affects narrow browser segment
- low: cosmetic / rare / single-user

Input errors:
${JSON.stringify(items, null, 2)}`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 2048,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.error('[error-digest] Anthropic API error', res.status, errText.slice(0, 500));
      return [];
    }
    const json = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
    const text = json.content?.find((c) => c.type === 'text')?.text ?? '';
    // Strip accidental fences just in case
    const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
    const parsed = JSON.parse(cleaned) as Diagnosis[];
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch (err) {
    console.error('[error-digest] diagnosis failed:', err);
    return [];
  }
}

async function persistDiagnoses(
  supabase: SupabaseClient,
  bugs: RealBugRow[],
  diagnoses: Diagnosis[],
): Promise<void> {
  const byKey = new Map(diagnoses.map((d) => [d.dedup_key, d]));
  const nowIso = new Date().toISOString();
  for (const bug of bugs) {
    const d = byKey.get(bug.dedup_key);
    if (!d) continue;
    await supabase
      .from('error_logs')
      .update({
        diagnosed_at: nowIso,
        diagnosis: d,
        diagnosis_model: CLAUDE_MODEL,
        severity: d.severity,
      })
      .eq('id', bug.id);
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

const NOISE_LABELS: Record<string, string> = {
  meta_iab_injected_script: 'Meta(Instagram/FB) 인앱 브라우저 주입 스크립트',
  native_bridge_unavailable: '네이티브 브리지 부재 (인앱 브라우저)',
  iab_browser: '인앱 브라우저 UA',
  browser_extension: '브라우저 확장 프로그램',
  resizeobserver_loop: 'ResizeObserver 루프 경고',
  script_error_opaque: 'cross-origin 스크립트 (opaque)',
  unclassified: '분류되지 않은 노이즈',
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#c0392b',
  high: '#e67e22',
  medium: '#f1c40f',
  low: '#95a5a6',
};

function buildEmailHtml(opts: {
  label: string;
  noise: NoiseStat[];
  bugs: RealBugRow[];
  diagnoses: Diagnosis[];
  hasApiKey: boolean;
}): string {
  const { label, noise, bugs, diagnoses, hasApiKey } = opts;
  const byKey = new Map(diagnoses.map((d) => [d.dedup_key, d]));
  const totalNoiseEvents = noise.reduce((s, n) => s + n.events, 0);
  const totalNoiseRows = noise.reduce((s, n) => s + n.rows, 0);

  const noiseRows = noise.length
    ? noise
        .map(
          (n) => `
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;">${escapeHtml(NOISE_LABELS[n.noise_reason ?? 'unclassified'] ?? n.noise_reason ?? '-')}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right;font-family:monospace;">${n.rows}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right;font-family:monospace;">${n.events}</td>
        </tr>`,
        )
        .join('')
    : `<tr><td colspan="3" style="padding:14px;text-align:center;color:#999;">필터링된 노이즈가 없었습니다.</td></tr>`;

  const bugRows = bugs.length
    ? bugs
        .map((b) => {
          const d = byKey.get(b.dedup_key);
          const sev = d?.severity ?? 'medium';
          const sevColor = SEVERITY_COLORS[sev] ?? '#95a5a6';
          const isOurs = d ? d.is_our_code : null;
          const ourBadge =
            isOurs === true
              ? '<span style="background:#c0392b;color:#fff;padding:2px 8px;border-radius:3px;font-size:11px;">우리 코드</span>'
              : isOurs === false
                ? '<span style="background:#7f8c8d;color:#fff;padding:2px 8px;border-radius:3px;font-size:11px;">외부 원인</span>'
                : '<span style="background:#bdc3c7;color:#fff;padding:2px 8px;border-radius:3px;font-size:11px;">미진단</span>';
          const totalCount = (b.occurrence_count ?? 0) + (b.emails_sent_today ?? 0) + 1;
          return `
          <div style="border:1px solid #e5e5e5;border-radius:8px;padding:14px;margin-bottom:12px;">
            <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;flex-wrap:wrap;">
              <span style="background:${sevColor};color:#fff;padding:3px 10px;border-radius:4px;font-size:11px;font-weight:600;text-transform:uppercase;">${sev}</span>
              ${ourBadge}
              ${b.is_payment ? '<span style="background:#8e44ad;color:#fff;padding:2px 8px;border-radius:3px;font-size:11px;">결제경로</span>' : ''}
              <span style="font-family:monospace;font-size:11px;color:#999;">${totalCount}회 발생</span>
            </div>
            <div style="font-family:monospace;font-size:13px;font-weight:600;margin-bottom:6px;word-break:break-all;">${escapeHtml(b.message.slice(0, 200))}</div>
            <div style="font-size:12px;color:#666;margin-bottom:8px;word-break:break-all;">${escapeHtml(b.url ?? '-')}</div>
            ${
              d
                ? `
              <div style="background:#fafbfc;padding:10px 12px;border-radius:6px;border-left:3px solid ${sevColor};">
                <div style="font-size:12px;color:#666;font-weight:600;margin-bottom:4px;">추정 원인</div>
                <div style="font-size:13px;margin-bottom:8px;">${escapeHtml(d.likely_cause)}</div>
                <div style="font-size:12px;color:#666;font-weight:600;margin-bottom:4px;">제안 조치</div>
                <div style="font-size:13px;margin-bottom:8px;">${escapeHtml(d.suggested_fix)}</div>
                ${
                  d.file_hints && d.file_hints.length
                    ? `<div style="font-size:12px;color:#666;font-weight:600;margin-bottom:4px;">의심 파일</div>
                       <div style="font-family:monospace;font-size:12px;">${d.file_hints.map((f) => escapeHtml(f)).join(', ')}</div>`
                    : ''
                }
              </div>`
                : `<div style="font-size:12px;color:#999;">${hasApiKey ? '진단 응답을 받지 못했습니다.' : 'ANTHROPIC_API_KEY 미설정 — 진단 미수행'}</div>`
            }
          </div>`;
        })
        .join('')
    : `<div style="padding:18px;text-align:center;color:#27ae60;font-size:14px;">🎉 어제 발생한 진짜 버그가 없습니다.</div>`;

  return `
    <div style="max-width:760px;margin:0 auto;font-family:'Apple SD Gothic Neo','Malgun Gothic',sans-serif;color:#222;">
      <div style="background:#2c3e50;padding:22px 24px;">
        <h1 style="color:#fff;margin:0;font-size:20px;">📊 모두유니폼 일일 오류 다이제스트</h1>
        <p style="color:#fff;margin:6px 0 0;font-size:13px;opacity:0.9;">${label} (KST) · 진짜 버그 ${bugs.length}건 · 노이즈 ${totalNoiseRows}건 / 발생 ${totalNoiseEvents}회</p>
      </div>
      <div style="padding:22px 24px;">
        <h2 style="font-size:15px;margin:0 0 12px;color:#34495e;">🛡 필터링된 노이즈 (메일 미발송)</h2>
        <table style="width:100%;border-collapse:collapse;font-size:13px;border:1px solid #eee;margin-bottom:24px;">
          <thead>
            <tr style="background:#f8f9fa;">
              <th style="padding:8px 12px;text-align:left;font-weight:600;color:#666;">사유</th>
              <th style="padding:8px 12px;text-align:right;font-weight:600;color:#666;">fingerprint</th>
              <th style="padding:8px 12px;text-align:right;font-weight:600;color:#666;">총 발생</th>
            </tr>
          </thead>
          <tbody>${noiseRows}</tbody>
        </table>
        <h2 style="font-size:15px;margin:0 0 12px;color:#34495e;">🔍 진짜 버그 진단 (상위 ${TOP_N_REAL_BUGS}건까지)</h2>
        ${bugRows}
      </div>
      <div style="background:#f8f9fa;padding:14px 24px;text-align:center;font-size:11px;color:#999;">
        매일 KST 09:00 자동 발송 · 진단은 ${CLAUDE_MODEL} · 코드 수정은 사람이 확인 후 진행
      </div>
    </div>
  `;
}

export interface DigestResult {
  ran: boolean;
  reason?: string;
  label?: string;
  noiseRows?: number;
  noiseEvents?: number;
  realBugs?: number;
  diagnosed?: number;
  emailed?: boolean;
}

export async function runDailyDigest(): Promise<DigestResult> {
  const supabase = getServiceClient();
  if (!supabase) return { ran: false, reason: 'supabase_unavailable' };

  const { startIso, endIso, label } = kstYesterdayRangeIso();
  const [noise, bugs] = await Promise.all([
    fetchNoiseStats(supabase, startIso, endIso),
    fetchUndiagnosedRealBugs(supabase, startIso, endIso),
  ]);

  const hasApiKey = !!process.env.ANTHROPIC_API_KEY;
  const diagnoses = hasApiKey ? await diagnoseBatch(bugs) : [];
  if (diagnoses.length) await persistDiagnoses(supabase, bugs, diagnoses);

  const noiseEvents = noise.reduce((s, n) => s + n.events, 0);
  const noiseRows = noise.reduce((s, n) => s + n.rows, 0);

  const html = buildEmailHtml({ label, noise, bugs, diagnoses, hasApiKey });
  const subject = `[모두유니폼] 일일 오류 다이제스트 — ${label} · 버그 ${bugs.length}건 / 노이즈 차단 ${noiseRows}건`;
  const text = `모두유니폼 일일 오류 다이제스트 (${label} KST)\n\n진짜 버그: ${bugs.length}건\n노이즈 차단: ${noiseRows} fingerprint / ${noiseEvents} 발생\n\n자세한 내용은 HTML 본문을 확인해주세요.`;
  const emailed = await sendGmailEmail({
    to: [{ email: RECIPIENT }],
    subject,
    text,
    html,
  });

  return {
    ran: true,
    label,
    noiseRows,
    noiseEvents,
    realBugs: bugs.length,
    diagnosed: diagnoses.length,
    emailed,
  };
}
