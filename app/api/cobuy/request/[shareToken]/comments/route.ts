import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { createAdminClient } from '@/lib/supabase-admin';
import { sendMailjetEmail } from '@/lib/mailjet';

export const runtime = 'nodejs';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ shareToken: string }> }
) {
  try {
    const { shareToken } = await params;
    const supabase = await createClient();

    // Get the request by share token
    const { data: request, error: reqError } = await supabase
      .from('cobuy_requests')
      .select('id')
      .eq('share_token', shareToken)
      .single();

    if (reqError || !request) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    const { data: comments, error } = await supabase
      .from('cobuy_request_comments')
      .select('*')
      .eq('request_id', request.id)
      .order('created_at', { ascending: true });

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch comments' }, { status: 500 });
    }

    return NextResponse.json(comments || []);
  } catch (error) {
    console.error('Error fetching comments:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ shareToken: string }> }
) {
  try {
    const { shareToken } = await params;
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    // Get the request by share token
    const { data: request, error: reqError } = await supabase
      .from('cobuy_requests')
      .select('id, user_id, status, title, guest_name')
      .eq('share_token', shareToken)
      .single();

    if (reqError || !request) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    const body = await req.json();
    const { content } = body;

    if (!content?.trim()) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    // Check if user is authenticated (optional)
    const { data: { user } } = await supabase.auth.getUser();

    // Insert comment (use admin client to bypass RLS for anonymous users)
    const { data: comment, error: commentError } = await adminSupabase
      .from('cobuy_request_comments')
      .insert({
        request_id: request.id,
        user_id: user?.id || null,
        content: content.trim(),
        is_admin: false,
      })
      .select()
      .single();

    if (commentError) {
      console.error('Error creating comment:', commentError);
      return NextResponse.json({ error: 'Failed to create comment' }, { status: 500 });
    }

    // Auto-update status to 'feedback' if current status is 'design_shared'
    if (request.status === 'design_shared') {
      await adminSupabase
        .from('cobuy_requests')
        .update({ status: 'feedback', updated_at: new Date().toISOString() })
        .eq('id', request.id);

      // Notify admin about feedback
      const adminEmail = process.env.ADMIN_EMAIL;
      if (adminEmail) {
        const customerName = request.guest_name || '고객';
        const baseUrl = 'https://modoouniform.com';
        const logoUrl = `${baseUrl}/icons/modoo_logo.png`;
        const adminLink = `${baseUrl}/admin/cobuy/requests/${request.id}`;

        sendMailjetEmail({
          to: [{ email: adminEmail, name: '모두의 유니폼 관리자' }],
          subject: `[모두의 유니폼] ${customerName}님이 수정 요청을 보냈습니다`,
          textPart: `${customerName}님이 "${request.title}" 디자인에 수정 요청을 보냈습니다.\n\n내용: ${content.trim()}\n\n확인하기: ${adminLink}`,
          htmlPart: `
            <div style="font-family: 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
              <div style="text-align: center; padding: 24px 0; background: #f8f9fc;">
                <img src="${logoUrl}" alt="모두의 유니폼" style="height: 48px;" />
              </div>
              <div style="height: 3px; background: #3B55A5;"></div>
              <div style="padding: 32px 28px;">
                <p style="font-size: 17px; color: #222; line-height: 1.7; margin: 0 0 16px 0;">
                  <strong>${customerName}</strong>님이 <strong>"${request.title}"</strong> 디자인에 수정 요청을 보냈습니다.
                </p>
                <div style="background: #f8f9fc; border-radius: 8px; padding: 16px; margin: 0 0 24px 0;">
                  <p style="font-size: 13px; color: #666; margin: 0;">${content.trim()}</p>
                </div>
                <div style="text-align: center; margin: 28px 0;">
                  <a href="${adminLink}" style="display: inline-block; padding: 14px 32px; background-color: #3B55A5; color: #ffffff; border-radius: 10px; font-weight: bold; font-size: 14px; text-decoration: none;">관리자 페이지에서 확인하기</a>
                </div>
              </div>
              <div style="border-top: 1px solid #e5e7eb; padding: 20px 28px; background: #f8f9fc;">
                <p style="margin: 0; font-size: 12px; color: #888;">MODOO UNIFORM | 모두의 유니폼</p>
              </div>
            </div>
          `,
          customId: `cobuy-feedback-${request.id}`,
        }).catch(() => {}); // fire-and-forget
      }
    }

    return NextResponse.json(comment);
  } catch (error) {
    console.error('Error creating comment:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
