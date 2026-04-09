import { createAdminClient } from '@/lib/supabase-admin';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { shareToken, participantId, pickupStatus } = body;

    if (!shareToken || !participantId || !pickupStatus) {
      return NextResponse.json({ error: '필수 필드가 누락되었습니다.' }, { status: 400 });
    }

    if (pickupStatus !== 'pending' && pickupStatus !== 'picked_up') {
      return NextResponse.json({ error: '잘못된 수령 상태입니다.' }, { status: 400 });
    }

    const admin = createAdminClient();

    const { data: participant, error: pErr } = await admin
      .from('cobuy_participants')
      .select('id, cobuy_session_id')
      .eq('id', participantId)
      .single();

    if (pErr || !participant) {
      return NextResponse.json({ error: '참여자를 찾을 수 없습니다.' }, { status: 404 });
    }

    const { data: sess } = await admin
      .from('cobuy_sessions')
      .select('id')
      .eq('id', participant.cobuy_session_id)
      .eq('share_token', shareToken)
      .single();

    if (!sess) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
    }

    const { data: updated, error: uErr } = await admin
      .from('cobuy_participants')
      .update({ pickup_status: pickupStatus })
      .eq('id', participantId)
      .select()
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
