import { NextResponse } from 'next/server';
import { createClient as createAuthedClient } from '@/lib/supabase';
import { createAdminClient } from '@/lib/supabase-admin';
import { activeProvider } from '@/lib/aiDesigner/imageGen';

export const runtime = 'nodejs';

/**
 * AI 디자이너 위저드 세션.
 * POST   — 새 세션 생성 (비로그인 허용; 로그인 상태면 user_id 귀속)
 * PATCH  — 세션 갱신 (id 필요. 소유자 검증: user_id가 있으면 본인만)
 * GET    — 세션 조회 + AI 제공자 활성 여부 (?id=)
 */

const MAX_JSON = 200 * 1024;

function pickSessionFields(body: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  if (body.product_id !== undefined) out.product_id = body.product_id;
  if (body.product_color !== undefined) out.product_color = body.product_color;
  if (body.source_images !== undefined) out.source_images = body.source_images;
  if (body.placements !== undefined) out.placements = body.placements;
  if (body.draft_images !== undefined) out.draft_images = body.draft_images;
  if (body.size_quantities !== undefined) out.size_quantities = body.size_quantities;
  // 과잠 빌더 상태(부위 색·슬롯·명단) — 객체만 허용
  if (body.builder_state !== undefined && (body.builder_state === null || typeof body.builder_state === 'object')) {
    out.builder_state = body.builder_state;
  }
  if (typeof body.customer_note === 'string') out.customer_note = body.customer_note.slice(0, 2000);
  if (typeof body.status === 'string' && ['draft', 'drafted'].includes(body.status)) out.status = body.status;
  return out;
}

async function currentUserId(): Promise<string | null> {
  try {
    const authed = await createAuthedClient();
    const { data: { user } } = await authed.auth.getUser();
    return user?.id ?? null;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const raw = await req.text();
  if (raw.length > MAX_JSON) return NextResponse.json({ error: '요청이 너무 큽니다.' }, { status: 413 });
  const body = raw ? JSON.parse(raw) : {};
  const admin = createAdminClient();
  const userId = await currentUserId();
  const { data, error } = await admin
    .from('ai_designer_requests')
    .insert({ ...pickSessionFields(body), user_id: userId })
    .select('id')
    .single();
  if (error) {
    console.error('[ai-designer/session] insert failed', error);
    return NextResponse.json({ error: '세션 생성에 실패했습니다.' }, { status: 500 });
  }
  return NextResponse.json({ id: data.id, aiEnabled: activeProvider() !== 'none' });
}

export async function PATCH(req: Request) {
  const raw = await req.text();
  if (raw.length > MAX_JSON) return NextResponse.json({ error: '요청이 너무 큽니다.' }, { status: 413 });
  const body = raw ? JSON.parse(raw) : {};
  const id = typeof body?.id === 'string' ? body.id : null;
  if (!id) return NextResponse.json({ error: 'id가 필요합니다.' }, { status: 400 });

  const admin = createAdminClient();
  const { data: session } = await admin
    .from('ai_designer_requests')
    .select('id, user_id, status')
    .eq('id', id)
    .single();
  if (!session) return NextResponse.json({ error: '세션을 찾을 수 없습니다.' }, { status: 404 });
  if (session.status === 'ordered') {
    return NextResponse.json({ error: '이미 주문된 세션입니다.' }, { status: 409 });
  }
  const userId = await currentUserId();
  if (session.user_id && session.user_id !== userId) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
  }

  const update = pickSessionFields(body);
  // 익명으로 시작한 세션이 로그인 후 이어지면 귀속
  if (!session.user_id && userId) update.user_id = userId;
  update.updated_at = new Date().toISOString();

  const { error } = await admin.from('ai_designer_requests').update(update).eq('id', id);
  if (error) {
    console.error('[ai-designer/session] update failed', error);
    return NextResponse.json({ error: '세션 저장에 실패했습니다.' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  if (!id) return NextResponse.json({ aiEnabled: activeProvider() !== 'none' });
  const admin = createAdminClient();
  const { data: session } = await admin
    .from('ai_designer_requests')
    .select('*')
    .eq('id', id)
    .single();
  if (!session) return NextResponse.json({ error: '세션을 찾을 수 없습니다.' }, { status: 404 });
  const userId = await currentUserId();
  if (session.user_id && session.user_id !== userId) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
  }
  return NextResponse.json({ session, aiEnabled: activeProvider() !== 'none' });
}
