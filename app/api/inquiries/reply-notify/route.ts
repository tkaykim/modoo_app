import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { sendGmailEmail } from '@/lib/gmail';
import { getSiteUrl } from '@/lib/site-url';

export const runtime = 'nodejs';

interface ReplyNotifyBody {
  inquiryId: string;
  replyContent: string;
}

export async function POST(req: Request) {
  let body: ReplyNotifyBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { inquiryId, replyContent } = body;

  if (!inquiryId || !replyContent) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Fetch inquiry with writer's email (회원=프로필 이메일 / 비회원=문의 등록 이메일)
  const { data: inquiry, error } = await supabase
    .from('inquiries')
    .select('title, manager_name, user_id, email, user:profiles!inquiries_user_id_fkey(email, name)')
    .eq('id', inquiryId)
    .single();

  if (error || !inquiry) {
    return NextResponse.json({ error: 'Inquiry not found' }, { status: 404 });
  }

  // 회원이면 프로필 이메일, 비회원이면 문의 작성 시 남긴 이메일로 발송
  const writerEmail = (inquiry.user as any)?.email || inquiry.email || null;
  if (!writerEmail) {
    return NextResponse.json({ ok: true, skipped: true, reason: 'No writer email' });
  }

  const writerName = (inquiry.user as any)?.name || inquiry.manager_name || '고객';
  // 비회원도 열 수 있는 문의 상세(전화번호/비밀번호 확인) 링크
  const inquiryUrl = `${getSiteUrl().origin}/inquiries/${inquiryId}`;

  const html = `
    <div style="font-family: 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #0052CC; border-bottom: 2px solid #0052CC; padding-bottom: 10px;">문의에 답변이 등록되었습니다</h2>
      <table style="width: 100%; border-collapse: collapse; margin-top: 16px;">
        <tr>
          <td style="padding: 8px 12px; background: #f5f5f5; font-weight: bold; width: 120px; border: 1px solid #ddd;">문의 제목</td>
          <td style="padding: 8px 12px; border: 1px solid #ddd;">${inquiry.title}</td>
        </tr>
      </table>
      <div style="margin-top: 16px; padding: 12px; background: #fafafa; border: 1px solid #ddd; border-radius: 4px;">
        <strong>답변 내용:</strong><br/>
        <span style="white-space: pre-wrap;">${replyContent}</span>
      </div>
      <div style="text-align: center; margin-top: 24px;">
        <a href="${inquiryUrl}" style="display: inline-block; padding: 12px 28px; background: #0052CC; color: #fff; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 14px;">문의 상세 보기</a>
      </div>
      <p style="margin-top: 12px; color: #888; font-size: 12px; text-align: center;">비회원이신 경우, 로그인 없이 문의 작성 시 입력하신 <b>전화번호</b> 또는 <b>비밀번호</b>로 확인하실 수 있습니다.</p>
      <p style="margin-top: 20px; color: #888; font-size: 12px;">이 메일은 모두의 유니폼 문의 게시판에서 자동 발송되었습니다.</p>
    </div>
  `;

  const text = `문의 "${inquiry.title}"에 답변이 등록되었습니다.\n\n답변 내용:\n${replyContent}\n\n문의 상세 보기: ${inquiryUrl}\n(비회원은 로그인 없이 작성 시 입력한 전화번호 또는 비밀번호로 확인 가능합니다.)`;

  const success = await sendGmailEmail({
    to: [{ email: writerEmail, name: writerName }],
    subject: `[모두의 유니폼] 문의 답변 알림: ${inquiry.title}`,
    text,
    html,
  });

  if (!success) {
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
