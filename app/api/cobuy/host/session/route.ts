import { createAdminClient } from '@/lib/supabase-admin';
import { NextRequest, NextResponse } from 'next/server';

type Action = 'close_gathering' | 'cancel' | 'update_delivery' | 'extend_end_date';

async function resolveSessionIdByShareToken(shareToken: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from('cobuy_sessions')
    .select('id')
    .eq('share_token', shareToken)
    .single();
  return data?.id ?? null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { shareToken, action, deliverySettings, endDate } = body as {
      shareToken?: string;
      action?: Action;
      deliverySettings?: unknown;
      endDate?: string;
    };

    if (!shareToken || !action) {
      return NextResponse.json({ error: '필수 필드가 누락되었습니다.' }, { status: 400 });
    }

    const sessionId = await resolveSessionIdByShareToken(shareToken);
    if (!sessionId) {
      return NextResponse.json({ error: '세션을 찾을 수 없습니다.' }, { status: 404 });
    }

    const admin = createAdminClient();

    const { data: session, error: sErr } = await admin
      .from('cobuy_sessions')
      .select('id, status, end_date')
      .eq('id', sessionId)
      .single();

    if (sErr || !session) {
      return NextResponse.json({ error: '세션을 찾을 수 없습니다.' }, { status: 404 });
    }

    const now = new Date().toISOString();
    const updatePayload: Record<string, unknown> = { updated_at: now };

    if (action === 'close_gathering') {
      if (session.status !== 'gathering') {
        return NextResponse.json({ error: '모집 중인 세션만 마감할 수 있습니다.' }, { status: 400 });
      }
      updatePayload.status = 'gather_complete';
    } else if (action === 'cancel') {
      const blocked = ['order_complete', 'manufacturing', 'manufacture_complete', 'delivering'];
      if (session.status === 'cancelled' || blocked.includes(session.status)) {
        return NextResponse.json({ error: '현재 상태에서는 취소할 수 없습니다.' }, { status: 400 });
      }
      updatePayload.status = 'cancelled';
    } else if (action === 'update_delivery') {
      const blockedStatuses = ['order_complete', 'manufacturing', 'manufacture_complete', 'delivering', 'delivery_complete', 'cancelled'];
      if (blockedStatuses.includes(session.status)) {
        return NextResponse.json({ error: '이 단계에서는 배송 설정을 수정할 수 없습니다.' }, { status: 400 });
      }
      updatePayload.delivery_settings = deliverySettings;
    } else if (action === 'extend_end_date') {
      if (!endDate || typeof endDate !== 'string') {
        return NextResponse.json({ error: '종료일이 필요합니다.' }, { status: 400 });
      }
      const newEnd = new Date(endDate);
      const currentEnd = new Date(session.end_date);
      if (newEnd <= currentEnd) {
        return NextResponse.json({ error: '새 종료일은 현재보다 이후여야 합니다.' }, { status: 400 });
      }
      updatePayload.end_date = newEnd.toISOString();
    } else {
      return NextResponse.json({ error: '지원하지 않는 작업입니다.' }, { status: 400 });
    }

    const { data: updated, error: uErr } = await admin
      .from('cobuy_sessions')
      .update(updatePayload)
      .eq('id', sessionId)
      .select(
        `*, saved_design_screenshot:saved_design_screenshots (
          id, user_id, product_id, title,
          color_selections, canvas_state, preview_url,
          created_at, updated_at, price_per_item,
          image_urls, text_svg_exports, custom_fonts
        )`
      )
      .single();

    if (uErr) {
      return NextResponse.json({ error: uErr.message }, { status: 500 });
    }

    return NextResponse.json({ data: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : '처리에 실패했습니다.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
