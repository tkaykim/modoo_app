import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { sendGmailEmail } from '@/lib/gmail';
import { formatKstDateOnly } from '@/lib/kst';

interface ParticipantJoinedBody {
  sessionId: string;
  participantId: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as ParticipantJoinedBody;
    const { sessionId, participantId } = body;

    if (!sessionId || !participantId) {
      return NextResponse.json(
        { success: false, error: '필수 정보가 누락되었습니다.' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const { data: session, error: sessionError } = await supabase
      .from('cobuy_sessions')
      .select('id, title, share_token, end_date, user_id')
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      return NextResponse.json(
        { success: false, error: '공동구매 정보를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const { data: creatorProfile } = await supabase
      .from('profiles')
      .select('email, name')
      .eq('id', session.user_id)
      .single();

    if (!creatorProfile?.email) {
      return NextResponse.json(
        { success: false, error: '주최자 정보를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const { data: participant, error: participantError } = await supabase
      .from('cobuy_participants')
      .select('id, name, email, selected_size')
      .eq('id', participantId)
      .single();

    if (participantError || !participant) {
      return NextResponse.json(
        { success: false, error: '참여자 정보를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const shareLink = `${process.env.NEXT_PUBLIC_SITE_URL || ''}/cobuy/${session.share_token}`;
    const subject = `[공동구매] 새 참여자 등록 - ${session.title}`;
    const text = [
      `새로운 참여자가 등록되었습니다.`,
      `이름: ${participant.name}`,
      `이메일: ${participant.email}`,
      `사이즈: ${participant.selected_size}`,
      `마감일: ${formatKstDateOnly(session.end_date)}`,
      `공유 링크: ${shareLink}`,
    ].join('\n');
    const html = `
      <h2>새로운 참여자가 등록되었습니다</h2>
      <p><strong>공동구매:</strong> ${session.title}</p>
      <ul>
        <li>이름: ${participant.name}</li>
        <li>이메일: ${participant.email}</li>
        <li>사이즈: ${participant.selected_size}</li>
        <li>마감일: ${formatKstDateOnly(session.end_date)}</li>
      </ul>
      <p>공유 링크: <a href="${shareLink}">${shareLink}</a></p>
    `;

    const sent = await sendGmailEmail({
      to: [{ email: creatorProfile.email, name: creatorProfile.name || undefined }],
      subject,
      text,
      html,
    });

    if (!sent) {
      return NextResponse.json(
        { success: false, error: '메일 발송에 실패했습니다.' },
        { status: 500 }
      );
    }

    await supabase.from('cobuy_notifications').insert({
      cobuy_session_id: session.id,
      participant_id: participant.id,
      notification_type: 'participant_joined',
      recipient_email: creatorProfile.email,
      metadata: {
        participant_name: participant.name,
        participant_email: participant.email,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Participant joined notification error:', error);
    return NextResponse.json(
      { success: false, error: '알림 발송 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
