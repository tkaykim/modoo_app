import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { sendGmailEmail } from '@/lib/gmail';
import { formatKstDateOnly } from '@/lib/kst';

interface SessionClosingBody {
  sessionId: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as SessionClosingBody;
    const { sessionId } = body;

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: '필수 정보가 누락되었습니다.' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const { data: session, error: sessionError } = await supabase
      .from('cobuy_sessions')
      .select('id, title, share_token, end_date')
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      return NextResponse.json(
        { success: false, error: '공동구매 정보를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const { data: participants, error: participantsError } = await supabase
      .from('cobuy_participants')
      .select('id, name, email')
      .eq('cobuy_session_id', sessionId);

    if (participantsError) {
      return NextResponse.json(
        { success: false, error: '참여자 정보를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const shareLink = `${process.env.NEXT_PUBLIC_SITE_URL || ''}/cobuy/${session.share_token}`;
    const subject = `[공동구매] 마감 임박 안내 - ${session.title}`;
    const text = [
      `공동구매 마감이 임박했습니다.`,
      `공동구매: ${session.title}`,
      `마감일: ${formatKstDateOnly(session.end_date)}`,
      `공유 링크: ${shareLink}`,
    ].join('\n');
    const html = `
      <h2>공동구매 마감이 임박했습니다</h2>
      <p>공동구매: ${session.title}</p>
      <p>마감일: ${formatKstDateOnly(session.end_date)}</p>
      <p>공유 링크: <a href="${shareLink}">${shareLink}</a></p>
    `;

    for (const participant of participants || []) {
      if (!participant.email) continue;

      const sent = await sendGmailEmail({
        to: [{ email: participant.email, name: participant.name || undefined }],
        subject,
        text,
        html,
      });

      if (sent) {
        await supabase.from('cobuy_notifications').insert({
          cobuy_session_id: session.id,
          participant_id: participant.id,
          notification_type: 'session_closing',
          recipient_email: participant.email,
          metadata: null,
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Session closing notification error:', error);
    return NextResponse.json(
      { success: false, error: '알림 발송 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
