import { createAdminClient } from '@/lib/supabase-admin';
import { createClient } from '@/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';

interface DeleteParticipantBody {
  participantId: string;
  sessionId: string;
  shareToken?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as DeleteParticipantBody;
    const { participantId, sessionId, shareToken } = body;

    if (!participantId || !sessionId) {
      return NextResponse.json(
        { success: false, error: '필수 정보가 누락되었습니다.' },
        { status: 400 }
      );
    }

    const supabaseAuth = await createClient();
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();

    const supabase = createAdminClient();

    const { data: sessRow, error: sessErr } = await supabase
      .from('cobuy_sessions')
      .select('id, user_id, share_token')
      .eq('id', sessionId)
      .single();

    if (sessErr || !sessRow) {
      return NextResponse.json(
        { success: false, error: '세션을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const shareTokenOk = typeof shareToken === 'string' && shareToken === sessRow.share_token;
    const ownerOk = !authError && user && sessRow.user_id === user.id;

    if (!shareTokenOk && !ownerOk) {
      if (authError || !user) {
        return NextResponse.json({ success: false, error: '로그인이 필요합니다.' }, { status: 401 });
      }
      return NextResponse.json(
        { success: false, error: '세션 소유자만 삭제할 수 있습니다.' },
        { status: 403 }
      );
    }

    const { data: participant, error: participantError } = await supabase
      .from('cobuy_participants')
      .select('id, cobuy_session_id, payment_status')
      .eq('id', participantId)
      .single();

    if (participantError || !participant) {
      return NextResponse.json(
        { success: false, error: '참여자를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    if (participant.cobuy_session_id !== sessionId) {
      return NextResponse.json(
        { success: false, error: '세션 정보가 일치하지 않습니다.' },
        { status: 400 }
      );
    }

    if (participant.payment_status !== 'pending') {
      return NextResponse.json(
        { success: false, error: '결제 상태가 대기 중이 아닙니다.' },
        { status: 400 }
      );
    }

    const { error: deleteError } = await supabase
      .from('cobuy_participants')
      .delete()
      .eq('id', participantId);

    if (deleteError) {
      console.error('Failed to delete CoBuy participant:', deleteError);
      return NextResponse.json(
        { success: false, error: '참여자 삭제에 실패했습니다.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('CoBuy participant delete error:', error);
    return NextResponse.json(
      { success: false, error: '참여자 삭제 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
