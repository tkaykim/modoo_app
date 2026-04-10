import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { createHmac } from 'crypto';
import { sendGmailEmail } from '@/lib/gmail';

function verifyDesignToken(token: string, orderId: string, orderItemId: string): boolean {
  try {
    const decoded = JSON.parse(Buffer.from(token, 'base64url').toString());
    if (decoded.o !== orderId || decoded.oi !== orderItemId) return false;
    if (decoded.exp < Date.now()) return false;

    const secret = process.env.SUPABASE_SERVICE_ROLE_KEY || 'fallback-secret';
    const payload = `design|${decoded.oi}|${decoded.o}|${decoded.exp}`;
    const expectedSig = createHmac('sha256', secret).update(payload).digest('base64url');
    return expectedSig === decoded.sig;
  } catch {
    return false;
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string; itemId: string }> }
) {
  try {
    const { orderId, itemId } = await params;
    const body = await request.json().catch(() => ({}));
    const token = body?.token;
    const revisionNote = body?.note;

    if (!revisionNote || typeof revisionNote !== 'string' || revisionNote.trim().length === 0) {
      return NextResponse.json({ error: '수정 요청 내용을 입력해주세요.' }, { status: 400 });
    }

    const supabase = await createClient();
    let authorized = false;

    if (token && verifyDesignToken(token, orderId, itemId)) {
      authorized = true;
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: order } = await supabase
          .from('orders')
          .select('id')
          .eq('id', orderId)
          .eq('user_id', user.id)
          .single();
        if (order) authorized = true;
      }
    }

    if (!authorized) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
    }

    const { data: orderItem, error: itemError } = await supabase
      .from('order_items')
      .select('id, design_status, product_title, design_title, order_id')
      .eq('id', itemId)
      .eq('order_id', orderId)
      .single();

    if (itemError || !orderItem) {
      return NextResponse.json({ error: '주문 항목을 찾을 수 없습니다.' }, { status: 404 });
    }

    if (orderItem.design_status !== 'design_shared') {
      return NextResponse.json({ error: '현재 상태에서는 수정 요청을 할 수 없습니다.' }, { status: 400 });
    }

    const { error: updateError } = await supabase
      .from('order_items')
      .update({
        design_status: 'revision_requested',
        design_revision_note: revisionNote.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', itemId);

    if (updateError) {
      return NextResponse.json({ error: '상태 업데이트에 실패했습니다.' }, { status: 500 });
    }

    // Notify admin
    const { data: order } = await supabase
      .from('orders')
      .select('customer_name, customer_email')
      .eq('id', orderId)
      .single();

    const customerName = order?.customer_name || '고객';
    const itemLabel = orderItem.design_title || orderItem.product_title;
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminUrl = `https://admin.modoogoods.com/orders/${orderId}`;

    if (adminEmail) {
      sendGmailEmail({
        to: [{ email: adminEmail, name: '모두의 유니폼 관리자' }],
        subject: `[수정 요청] ${customerName} - ${itemLabel} (${orderId})`,
        text: `${customerName}님이 ${itemLabel}의 시안에 대해 수정을 요청했습니다.\n주문번호: ${orderId}\n\n수정 요청 내용:\n${revisionNote.trim()}\n\n확인: ${adminUrl}`,
        html: `
          <div style="font-family:'Apple SD Gothic Neo','Malgun Gothic',sans-serif;max-width:600px;margin:0 auto;background:#ffffff;">
            <div style="text-align:center;padding:24px 0;background:#f0f5ff;">
              <img src="https://modoouniform.com/icons/modoo_logo.png" alt="모두의 유니폼" style="height:48px;" />
            </div>
            <div style="height:3px;background:#0052cc;"></div>
            <div style="padding:32px 28px;">
              <div style="text-align:center;margin-bottom:24px;">
                <div style="display:inline-block;background:#0052cc;color:#fff;padding:8px 20px;border-radius:20px;font-size:14px;font-weight:600;">수정 요청</div>
              </div>
              <p style="font-size:16px;color:#222;line-height:1.7;margin:0 0 20px;">
                <strong>${customerName}</strong>님이 <strong>${itemLabel}</strong>의 시안에 대해 수정을 요청했습니다.
              </p>
              <div style="background:#f8f9fa;border-radius:8px;padding:14px 16px;margin:16px 0;">
                <table style="width:100%;border-collapse:collapse;font-size:13px;">
                  <tr><td style="color:#888;padding:3px 0;width:80px;">주문번호</td><td style="font-weight:600;">${orderId}</td></tr>
                  <tr><td style="color:#888;padding:3px 0;">상품</td><td>${itemLabel}</td></tr>
                </table>
              </div>
              <div style="background:#e8f0fe;border-left:3px solid #0052cc;padding:16px;border-radius:0 8px 8px 0;margin:20px 0;">
                <p style="margin:0 0 4px;font-size:12px;color:#003d99;font-weight:600;">고객 수정 요청 내용</p>
                <p style="margin:0;font-size:15px;color:#1a1a1a;line-height:1.6;white-space:pre-wrap;">${revisionNote.trim()}</p>
              </div>
              <div style="text-align:center;margin:28px 0;">
                <a href="${adminUrl}" style="display:inline-block;padding:14px 32px;background-color:#0052cc;color:#ffffff;border-radius:10px;font-weight:bold;font-size:14px;text-decoration:none;">관리자 페이지에서 확인</a>
              </div>
            </div>
          </div>
        `,
      }).catch((err) => console.error('Admin revision notification failed:', err));
    }

    return NextResponse.json({ success: true, design_status: 'revision_requested' });
  } catch (error) {
    console.error('Error requesting revision:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
