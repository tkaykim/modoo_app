import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { createAdminClient } from '@/lib/supabase-admin';
import { sendMailjetEmail } from '@/lib/mailjet';

export const runtime = 'nodejs';

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ shareToken: string }> }
) {
  try {
    const { shareToken } = await params;
    const supabase = await createClient();

    const { data: request, error: reqError } = await supabase
      .from('cobuy_requests')
      .select('id, status, title, guest_name, guest_email')
      .eq('share_token', shareToken)
      .single();

    if (reqError || !request) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    if (request.status !== 'design_shared' && request.status !== 'feedback') {
      return NextResponse.json({ error: '현재 상태에서는 확정할 수 없습니다.' }, { status: 400 });
    }

    const adminSupabase = createAdminClient();
    const { error: updateError } = await adminSupabase
      .from('cobuy_requests')
      .update({ status: 'confirmed', updated_at: new Date().toISOString() })
      .eq('id', request.id);

    if (updateError) {
      return NextResponse.json({ error: 'Failed to confirm' }, { status: 500 });
    }

    // Notify admin
    const adminEmail = process.env.ADMIN_EMAIL;
    if (adminEmail) {
      const customerName = request.guest_name || '고객';
      const baseUrl = 'https://modoouniform.com';
      const logoUrl = `${baseUrl}/icons/modoo_logo.png`;
      const adminLink = `${baseUrl}/admin/cobuy/requests/${request.id}`;

      await sendMailjetEmail({
        to: [{ email: adminEmail, name: '모두의 유니폼 관리자' }],
        subject: `[모두의 유니폼] ${customerName}님이 디자인을 확정했습니다`,
        textPart: `${customerName}님이 "${request.title}" 디자인을 확정했습니다.\n\n확인하기: ${adminLink}`,
        htmlPart: `
          <div style="font-family: 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
            <div style="text-align: center; padding: 24px 0; background: #f8f9fc;">
              <img src="${logoUrl}" alt="모두의 유니폼" style="height: 48px;" />
            </div>
            <div style="height: 3px; background: #3B55A5;"></div>
            <div style="padding: 32px 28px;">
              <p style="font-size: 17px; color: #222; line-height: 1.7; margin: 0 0 24px 0;">
                <strong>${customerName}</strong>님이 <strong>"${request.title}"</strong> 디자인을 확정했습니다.
              </p>
              <div style="text-align: center; margin: 28px 0;">
                <a href="${adminLink}" style="display: inline-block; padding: 14px 32px; background-color: #3B55A5; color: #ffffff; border-radius: 10px; font-weight: bold; font-size: 14px; text-decoration: none;">관리자 페이지에서 확인하기</a>
              </div>
            </div>
            <div style="border-top: 1px solid #e5e7eb; padding: 20px 28px; background: #f8f9fc;">
              <p style="margin: 0; font-size: 12px; color: #888;">MODOO UNIFORM | 모두의 유니폼</p>
            </div>
          </div>
        `,
        customId: `cobuy-confirm-${request.id}`,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error confirming design:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
