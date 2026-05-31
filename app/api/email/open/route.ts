import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 1x1 투명 GIF
const PIXEL = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64',
);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// 이메일 열람 추적 픽셀. 메일 클라이언트가 이미지를 로드하면 'open' 이벤트를 기록한다.
export async function GET(req: NextRequest) {
  const m = req.nextUrl.searchParams.get('m');
  if (m && UUID_RE.test(m)) {
    try {
      const sb = createAdminClient();
      await sb.from('email_events').insert({
        message_id: m,
        event_type: 'open',
        user_agent: req.headers.get('user-agent'),
        ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      });
    } catch {
      // 추적 실패가 메일 표시를 막으면 안 됨 — 조용히 무시
    }
  }
  return new NextResponse(PIXEL, {
    status: 200,
    headers: {
      'Content-Type': 'image/gif',
      'Content-Length': String(PIXEL.length),
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
      Pragma: 'no-cache',
      Expires: '0',
    },
  });
}
