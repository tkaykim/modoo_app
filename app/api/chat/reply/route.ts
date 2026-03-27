import { NextRequest, NextResponse } from 'next/server';
import { verifyChatReplyToken } from '@/lib/chat-token';
import { createAdminClient } from '@/lib/supabase-admin';
import { sendGmailEmail } from '@/lib/gmail';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');

  if (!token) {
    return NextResponse.json({ error: '토큰이 필요합니다.' }, { status: 400 });
  }

  const verified = verifyChatReplyToken(token);
  if (!verified) {
    return NextResponse.json({ error: '링크가 만료되었거나 유효하지 않습니다.' }, { status: 400 });
  }

  const { orderItemId, orderId } = verified;
  const adminClient = createAdminClient();

  const { data: orderItem } = await adminClient
    .from('order_items')
    .select('product_title, design_title, order_id')
    .eq('id', orderItemId)
    .eq('order_id', orderId)
    .single();

  if (!orderItem) {
    return NextResponse.json({ error: '주문 정보를 찾을 수 없습니다.' }, { status: 404 });
  }

  const { data: messages } = await adminClient
    .from('editor_chat_messages')
    .select('id, content, status, attachment_urls, created_at, sender:profiles!editor_chat_messages_sender_id_fkey(name, role)')
    .eq('order_item_id', orderItemId)
    .order('created_at', { ascending: true });

  return NextResponse.json({
    data: {
      orderItemId,
      orderId,
      productTitle: orderItem.product_title,
      designTitle: orderItem.design_title,
      messages: messages || [],
    },
  });
}

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');

  if (!token) {
    return NextResponse.json({ error: '토큰이 필요합니다.' }, { status: 400 });
  }

  const verified = verifyChatReplyToken(token);
  if (!verified) {
    return NextResponse.json({ error: '링크가 만료되었거나 유효하지 않습니다.' }, { status: 400 });
  }

  const { orderItemId, orderId } = verified;
  const adminClient = createAdminClient();

  const payload = await request.json().catch(() => null);
  const content = payload?.content;

  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    return NextResponse.json({ error: '메시지 내용이 필요합니다.' }, { status: 400 });
  }

  const { data: order } = await adminClient
    .from('orders')
    .select('id, user_id, customer_name, customer_email')
    .eq('id', orderId)
    .single();

  if (!order || !order.user_id) {
    return NextResponse.json({ error: '주문 정보를 확인할 수 없습니다.' }, { status: 400 });
  }

  const { data, error } = await adminClient
    .from('editor_chat_messages')
    .insert({
      order_item_id: orderItemId,
      sender_id: order.user_id,
      content: content.trim(),
      attachment_urls: [],
    })
    .select('id, content, status, attachment_urls, created_at, sender:profiles!editor_chat_messages_sender_id_fkey(name, role)')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  sendAdminNotificationFromReply(adminClient, orderId, orderItemId, content.trim(), order).catch(console.error);

  return NextResponse.json({ data });
}

async function sendAdminNotificationFromReply(
  adminClient: ReturnType<typeof createAdminClient>,
  orderId: string,
  orderItemId: string,
  messageContent: string,
  order: { customer_name: string | null; user_id: string },
) {
  try {
    const { data: orderItem } = await adminClient
      .from('order_items')
      .select('product_title, design_title')
      .eq('id', orderItemId)
      .single();

    const customerName = order.customer_name || '고객';
    const designInfo = orderItem?.design_title ? ` (디자인: ${orderItem.design_title})` : '';
    const adminUrl = 'https://admin.modoogoods.com';
    const adminEmail = process.env.ADMIN_EMAIL;

    if (adminEmail) {
      await sendGmailEmail({
        to: [{ email: adminEmail }],
        subject: `[모두의 유니폼] ${customerName}님이 디자인 관련 메시지를 보냈습니다`,
        text: `${customerName}님이 주문 ${orderId}의 ${orderItem?.product_title || '상품'}${designInfo}에 대해 이메일에서 답장했습니다.\n\n"${messageContent}"\n\n관리자 페이지에서 확인해주세요: ${adminUrl}/orders/${orderId}`,
        html: `
          <div style="font-family: 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #1a1a1a; font-size: 18px; margin-bottom: 16px;">고객 디자인 메시지 (이메일 답장)</h2>
            <div style="background: #f8f9fa; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
              <p style="margin: 0 0 8px; color: #666; font-size: 13px;">
                <strong>${customerName}</strong> (고객) · 주문번호 ${orderId}
              </p>
              <p style="margin: 0; color: #333; font-size: 14px;">
                상품: ${orderItem?.product_title || '상품'}${designInfo}
              </p>
            </div>
            <div style="background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
              <p style="margin: 0; color: #1a1a1a; font-size: 14px; white-space: pre-wrap;">${messageContent}</p>
            </div>
            <a href="${adminUrl}/orders/${orderId}" style="display: inline-block; background: #2563eb; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 600;">관리자 페이지에서 확인</a>
          </div>
        `,
      });
    }

    const discordWebhookUrl = process.env.DISCORD_WEBHOOK_URL;
    if (discordWebhookUrl) {
      await fetch(discordWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          embeds: [{
            title: '💬 이메일 답장 - 디자인 메시지',
            color: 0x10b981,
            fields: [
              { name: '고객', value: customerName, inline: true },
              { name: '주문번호', value: orderId, inline: true },
              { name: '상품', value: `${orderItem?.product_title || '상품'}${designInfo}`, inline: false },
              { name: '메시지', value: messageContent.length > 200 ? messageContent.slice(0, 200) + '...' : messageContent, inline: false },
            ],
            timestamp: new Date().toISOString(),
          }],
        }),
      }).catch(console.error);
    }
  } catch (error) {
    console.error('Failed to send admin notification:', error);
  }
}
