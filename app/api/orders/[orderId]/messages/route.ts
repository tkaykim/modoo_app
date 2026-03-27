import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { createAdminClient } from '@/lib/supabase-admin';
import { sendGmailEmail } from '@/lib/gmail';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> },
) {
  try {
    const { orderId } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const { data: order } = await supabase
      .from('orders')
      .select('id, user_id')
      .eq('id', orderId)
      .eq('user_id', user.id)
      .single();

    if (!order) {
      return NextResponse.json({ error: '주문을 찾을 수 없습니다.' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const orderItemId = searchParams.get('orderItemId');

    if (!orderItemId) {
      return NextResponse.json({ error: 'orderItemId가 필요합니다.' }, { status: 400 });
    }

    const adminClient = createAdminClient();

    const { data, error } = await adminClient
      .from('editor_chat_messages')
      .select('*, sender:profiles!editor_chat_messages_sender_id_fkey(name, role, email)')
      .eq('order_item_id', orderItemId)
      .order('created_at', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const sanitized = (data || []).map((msg) => {
      const sender = msg.sender as { name: string | null; role: string; email: string } | null;
      return {
        ...msg,
        sender: sender
          ? { name: sender.name, role: sender.role }
          : null,
      };
    });

    return NextResponse.json({ data: sanitized });
  } catch (error) {
    const message = error instanceof Error ? error.message : '메시지 조회에 실패했습니다.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> },
) {
  try {
    const { orderId } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const { data: order } = await supabase
      .from('orders')
      .select('id, user_id')
      .eq('id', orderId)
      .eq('user_id', user.id)
      .single();

    if (!order) {
      return NextResponse.json({ error: '주문을 찾을 수 없습니다.' }, { status: 404 });
    }

    const payload = await request.json().catch(() => null);
    const orderItemId = payload?.orderItemId;
    const content = payload?.content;
    const attachmentUrls = payload?.attachmentUrls || [];

    if (!orderItemId || typeof orderItemId !== 'string') {
      return NextResponse.json({ error: 'orderItemId가 필요합니다.' }, { status: 400 });
    }
    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return NextResponse.json({ error: '메시지 내용이 필요합니다.' }, { status: 400 });
    }

    const adminClient = createAdminClient();

    const { data: orderItem } = await adminClient
      .from('order_items')
      .select('id, order_id')
      .eq('id', orderItemId)
      .eq('order_id', orderId)
      .single();

    if (!orderItem) {
      return NextResponse.json({ error: '주문 항목을 찾을 수 없습니다.' }, { status: 404 });
    }

    const { data, error } = await adminClient
      .from('editor_chat_messages')
      .insert({
        order_item_id: orderItemId,
        sender_id: user.id,
        content: content.trim(),
        attachment_urls: attachmentUrls,
      })
      .select('*, sender:profiles!editor_chat_messages_sender_id_fkey(name, role, email)')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    sendAdminNotification(adminClient, orderId, orderItemId, content.trim(), user.id).catch(console.error);

    const sanitizedSender = data.sender as { name: string | null; role: string; email: string } | null;
    return NextResponse.json({
      data: {
        ...data,
        sender: sanitizedSender
          ? { name: sanitizedSender.name, role: sanitizedSender.role }
          : null,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '메시지 전송에 실패했습니다.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function sendAdminNotification(
  adminClient: ReturnType<typeof createAdminClient>,
  orderId: string,
  orderItemId: string,
  messageContent: string,
  userId: string,
) {
  try {
    const { data: orderItem } = await adminClient
      .from('order_items')
      .select('product_title, design_title')
      .eq('id', orderItemId)
      .single();

    const { data: profile } = await adminClient
      .from('profiles')
      .select('name, email')
      .eq('id', userId)
      .single();

    const customerName = profile?.name || '고객';
    const designInfo = orderItem?.design_title ? ` (디자인: ${orderItem.design_title})` : '';
    const adminUrl = 'https://admin.modoogoods.com';
    const adminEmail = process.env.ADMIN_EMAIL;

    if (adminEmail) {
      await sendGmailEmail({
        to: [{ email: adminEmail }],
        subject: `[모두의 유니폼] ${customerName}님이 디자인 관련 메시지를 보냈습니다`,
        text: `${customerName}님이 주문 ${orderId}의 ${orderItem?.product_title || '상품'}${designInfo}에 대해 메시지를 남겼습니다.\n\n"${messageContent}"\n\n관리자 페이지에서 확인해주세요: ${adminUrl}/orders/${orderId}`,
        html: `
          <div style="font-family: 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #3B55A5; padding: 24px; text-align: center; border-radius: 12px 12px 0 0;">
              <h1 style="color: #fff; margin: 0; font-size: 18px; font-weight: 600;">고객 디자인 메시지</h1>
            </div>
            <div style="background: #fff; padding: 24px; border: 1px solid #e5e7eb; border-top: none;">
              <div style="background: #f8f9fa; border-radius: 8px; padding: 14px; margin-bottom: 16px;">
                <p style="margin: 0 0 4px; color: #666; font-size: 12px;">
                  <strong style="color: #333;">${customerName}</strong> · 고객 · 주문번호 ${orderId}
                </p>
                <p style="margin: 0; color: #888; font-size: 12px;">
                  ${orderItem?.product_title || '상품'}${designInfo}
                </p>
              </div>
              <div style="background: #f0f4ff; border-left: 3px solid #3B55A5; padding: 16px; border-radius: 0 8px 8px 0; margin-bottom: 24px;">
                <p style="margin: 0; color: #1a1a1a; font-size: 15px; line-height: 1.6; white-space: pre-wrap;">${messageContent}</p>
              </div>
              <a href="${adminUrl}/orders/${orderId}" style="display: block; background: #3B55A5; color: #fff; text-decoration: none; padding: 14px 24px; border-radius: 8px; font-size: 14px; font-weight: 600; text-align: center;">관리자 페이지에서 답변하기</a>
            </div>
            <div style="padding: 16px 24px; text-align: center; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px; background: #fafafa;">
              <p style="margin: 0; font-size: 11px; color: #999;">모두의 유니폼</p>
            </div>
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
          embeds: [
            {
              title: '💬 디자인 관련 고객 메시지',
              color: 0x2563eb,
              fields: [
                { name: '고객', value: customerName, inline: true },
                { name: '주문번호', value: orderId, inline: true },
                { name: '상품', value: `${orderItem?.product_title || '상품'}${designInfo}`, inline: false },
                { name: '메시지', value: messageContent.length > 200 ? messageContent.slice(0, 200) + '...' : messageContent, inline: false },
              ],
              timestamp: new Date().toISOString(),
            },
          ],
        }),
      }).catch(console.error);
    }
  } catch (error) {
    console.error('Failed to send admin notification:', error);
  }
}
