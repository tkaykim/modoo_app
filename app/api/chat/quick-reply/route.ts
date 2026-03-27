import { NextRequest, NextResponse } from 'next/server';
import { verifyChatReplyToken, buildReplyUrl } from '@/lib/chat-token';
import { createAdminClient } from '@/lib/supabase-admin';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');
  const msg = searchParams.get('msg');

  if (!token || !msg) {
    return new NextResponse('잘못된 요청입니다.', { status: 400 });
  }

  const verified = verifyChatReplyToken(token);
  if (!verified) {
    return new NextResponse(renderHtml('링크가 만료되었거나 유효하지 않습니다.', true), {
      status: 400,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  const { orderItemId, orderId } = verified;
  const adminClient = createAdminClient();

  const { data: orderItem } = await adminClient
    .from('order_items')
    .select('order_id')
    .eq('id', orderItemId)
    .eq('order_id', orderId)
    .single();

  if (!orderItem) {
    return new NextResponse(renderHtml('주문 정보를 찾을 수 없습니다.', true), {
      status: 404,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  const { data: order } = await adminClient
    .from('orders')
    .select('user_id')
    .eq('id', orderId)
    .single();

  const senderId = order?.user_id;
  if (!senderId) {
    return new NextResponse(renderHtml('주문 정보를 확인할 수 없습니다.', true), {
      status: 400,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  await adminClient.from('editor_chat_messages').insert({
    order_item_id: orderItemId,
    sender_id: senderId,
    content: msg,
    attachment_urls: [],
  });

  const replyUrl = buildReplyUrl(orderItemId, orderId);

  return new NextResponse(
    renderHtml(`"${msg}" 메시지가 전송되었습니다.`, false, replyUrl),
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  );
}

function renderHtml(message: string, isError: boolean, replyUrl?: string): string {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>모두의 유니폼</title>
  <style>
    body { font-family: 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f9fafb; }
    .card { background: #fff; border-radius: 16px; padding: 32px; max-width: 400px; width: 90%; text-align: center; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    .icon { font-size: 48px; margin-bottom: 16px; }
    h2 { font-size: 18px; color: #1a1a1a; margin: 0 0 8px; }
    p { font-size: 14px; color: #666; margin: 0 0 20px; }
    .btn { display: inline-block; background: #2563eb; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 600; }
    .btn:hover { background: #1d4ed8; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${isError ? '⚠️' : '✅'}</div>
    <h2>${isError ? '오류' : '전송 완료'}</h2>
    <p>${message}</p>
    ${replyUrl ? `<a href="${replyUrl}" class="btn">대화 전체 보기 / 추가 답변하기</a>` : ''}
  </div>
</body>
</html>`;
}
