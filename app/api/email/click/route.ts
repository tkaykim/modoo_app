import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// 오픈 리다이렉트 방지: 우리 자산으로만 리다이렉트 허용.
const ALLOWED_HOSTS = new Set([
  'modoouniform.com',
  'www.modoouniform.com',
  'pf.kakao.com',
]);
const FALLBACK = 'https://modoouniform.com';

function safeDest(u: string | null): string {
  if (!u) return FALLBACK;
  try {
    const parsed = new URL(u);
    if ((parsed.protocol === 'https:' || parsed.protocol === 'http:') && ALLOWED_HOSTS.has(parsed.hostname)) {
      return parsed.toString();
    }
  } catch {
    // 무시
  }
  return FALLBACK;
}

// 이메일 링크 클릭 추적. 'click' 이벤트를 기록한 뒤 실제 목적지로 302 리다이렉트.
export async function GET(req: NextRequest) {
  const m = req.nextUrl.searchParams.get('m');
  const dest = safeDest(req.nextUrl.searchParams.get('u'));

  if (m && UUID_RE.test(m)) {
    try {
      const sb = createAdminClient();
      await sb.from('email_events').insert({
        message_id: m,
        event_type: 'click',
        url: dest,
        user_agent: req.headers.get('user-agent'),
        ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      });
    } catch {
      // 추적 실패가 이동을 막으면 안 됨
    }
  }
  return NextResponse.redirect(dest, 302);
}
