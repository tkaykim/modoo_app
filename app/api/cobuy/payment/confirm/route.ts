import { createAdminClient } from '@/lib/supabase-admin';
import { NextRequest, NextResponse } from 'next/server';
import { sendMailjetEmail } from '@/lib/mailjet';
import { formatKstDateOnly } from '@/lib/kst';

const widgetSecretKey = process.env.TOSS_SECRET_KEY;

interface PaymentRequestBody {
  orderId: string;
  amount: number;
  paymentKey: string;
  participantId: string;
  sessionId: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as PaymentRequestBody;
    const { orderId, amount, paymentKey, participantId, sessionId } = body;

    if (!orderId || !amount || !paymentKey || !participantId || !sessionId) {
      return NextResponse.json(
        { success: false, error: '필수 결제 정보가 누락되었습니다.' },
        { status: 400 }
      );
    }

    const tossResponse = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${widgetSecretKey}:`).toString('base64')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        orderId,
        amount,
        paymentKey,
      }),
    });

    const tossData = await tossResponse.json();

    if (!tossResponse.ok) {
      console.error('Toss payment confirmation failed:', tossData);
      return NextResponse.json(
        {
          success: false,
          error: tossData.message || '결제 확인에 실패했습니다.',
          code: tossData.code,
        },
        { status: tossResponse.status }
      );
    }

    const supabase = createAdminClient();

    const { data: participant, error: participantError } = await supabase
      .from('cobuy_participants')
      .select('id, cobuy_session_id, payment_status')
      .eq('id', participantId)
      .single();

    if (participantError || !participant) {
      console.error('CoBuy participant not found:', participantError);
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

    if (participant.payment_status === 'completed') {
      // Fetch full participant data for already completed payments
      const { data: existingParticipant } = await supabase
        .from('cobuy_participants')
        .select('*')
        .eq('id', participantId)
        .single();

      return NextResponse.json({ success: true, participantId, sessionId, participant: existingParticipant });
    }

    const { error: updateError } = await supabase
      .from('cobuy_participants')
      .update({
        payment_status: 'completed',
        payment_key: paymentKey,
        payment_amount: amount,
        paid_at: new Date().toISOString(),
      })
      .eq('id', participantId);

    if (updateError) {
      console.error('Failed to update CoBuy participant payment:', updateError);
      return NextResponse.json(
        { success: false, error: '결제 상태 업데이트에 실패했습니다.' },
        { status: 500 }
      );
    }

    const { data: session, error: sessionFetchError } = await supabase
      .from('cobuy_sessions')
      .select('id, title, end_date, share_token, current_participant_count, current_total_quantity')
      .eq('id', sessionId)
      .single();

    if (!sessionFetchError && session) {
      // Fetch participant's total_quantity for updating session stats
      const { data: participantInfo } = await supabase
        .from('cobuy_participants')
        .select('id, name, email, selected_size, payment_amount, total_quantity')
        .eq('id', participantId)
        .single();

      const participantQuantity = participantInfo?.total_quantity || 0;

      // Update both participant count and total quantity
      const { error: sessionUpdateError } = await supabase
        .from('cobuy_sessions')
        .update({
          current_participant_count: session.current_participant_count + 1,
          current_total_quantity: (session.current_total_quantity || 0) + participantQuantity,
        })
        .eq('id', sessionId);

      if (sessionUpdateError) {
        console.error('Failed to update CoBuy session counts:', sessionUpdateError);
      }

      if (participantInfo?.email) {
        const shareLink = `${process.env.NEXT_PUBLIC_SITE_URL || ''}/cobuy/${session.share_token}`;
        const subject = `[공동구매] 결제가 완료되었습니다 - ${session.title}`;
        const textPart = [
          `${participantInfo.name}님, 공동구매 결제가 완료되었습니다.`,
          `공동구매: ${session.title}`,
          `사이즈: ${participantInfo.selected_size}`,
          `결제 금액: ${(participantInfo.payment_amount || amount).toLocaleString('ko-KR')}원`,
          `마감일: ${formatKstDateOnly(session.end_date)}`,
          `공유 링크: ${shareLink}`,
        ].join('\n');
        const htmlPart = `
          <h2>결제가 완료되었습니다</h2>
          <p>${participantInfo.name}님, 공동구매 결제가 완료되었습니다.</p>
          <ul>
            <li>공동구매: ${session.title}</li>
            <li>사이즈: ${participantInfo.selected_size}</li>
            <li>결제 금액: ${(participantInfo.payment_amount || amount).toLocaleString('ko-KR')}원</li>
            <li>마감일: ${formatKstDateOnly(session.end_date)}</li>
          </ul>
          <p>공유 링크: <a href="${shareLink}">${shareLink}</a></p>
        `;

        const sent = await sendMailjetEmail({
          to: [{ email: participantInfo.email, name: participantInfo.name || undefined }],
          subject,
          textPart,
          htmlPart,
          customId: `cobuy-payment-confirmed-${participantInfo.id}`,
        });

        if (sent) {
          await supabase.from('cobuy_notifications').insert({
            cobuy_session_id: session.id,
            participant_id: participantInfo.id,
            notification_type: 'payment_confirmed',
            recipient_email: participantInfo.email,
            metadata: {
              payment_amount: participantInfo.payment_amount || amount,
            },
          });
        }
      }
    }

    // Fetch updated participant data to return
    const { data: updatedParticipant } = await supabase
      .from('cobuy_participants')
      .select('*')
      .eq('id', participantId)
      .single();

    return NextResponse.json({ success: true, participantId, sessionId, participant: updatedParticipant });
  } catch (error) {
    console.error('CoBuy payment confirmation error:', error);
    return NextResponse.json(
      { success: false, error: '결제 확인 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
