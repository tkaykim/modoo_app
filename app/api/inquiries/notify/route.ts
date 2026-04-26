import { NextResponse } from 'next/server';
import { sendGmailEmail } from '@/lib/gmail';

export const runtime = 'nodejs';

interface NotifyBody {
  title: string;
  groupName: string;
  managerName: string;
  phone: string;
  kakaoId?: string;
  desiredDate?: string;
  expectedQty?: number;
  content?: string;
  fabricColor?: string;
  fileCount: number;
  productNames: string[];
}

export async function POST(req: Request) {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) {
    return NextResponse.json({ error: 'ADMIN_EMAIL not configured' }, { status: 500 });
  }

  let body: NotifyBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const {
    title,
    groupName,
    managerName,
    phone,
    kakaoId,
    desiredDate,
    expectedQty,
    content,
    fabricColor,
    fileCount,
    productNames,
  } = body;

  const html = `
    <div style="font-family: 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #3B55A5; border-bottom: 2px solid #3B55A5; padding-bottom: 10px;">새로운 문의가 등록되었습니다</h2>
      <table style="width: 100%; border-collapse: collapse; margin-top: 16px;">
        <tr><td style="padding: 8px 12px; background: #f5f5f5; font-weight: bold; width: 120px; border: 1px solid #ddd;">제목</td><td style="padding: 8px 12px; border: 1px solid #ddd;">${title}</td></tr>
        <tr><td style="padding: 8px 12px; background: #f5f5f5; font-weight: bold; border: 1px solid #ddd;">단체명</td><td style="padding: 8px 12px; border: 1px solid #ddd;">${groupName}</td></tr>
        <tr><td style="padding: 8px 12px; background: #f5f5f5; font-weight: bold; border: 1px solid #ddd;">담당자명</td><td style="padding: 8px 12px; border: 1px solid #ddd;">${managerName}</td></tr>
        <tr><td style="padding: 8px 12px; background: #f5f5f5; font-weight: bold; border: 1px solid #ddd;">연락처</td><td style="padding: 8px 12px; border: 1px solid #ddd;">${phone}</td></tr>
        ${kakaoId ? `<tr><td style="padding: 8px 12px; background: #f5f5f5; font-weight: bold; border: 1px solid #ddd;">카카오톡 ID</td><td style="padding: 8px 12px; border: 1px solid #ddd;">${kakaoId}</td></tr>` : ''}
        ${desiredDate ? `<tr><td style="padding: 8px 12px; background: #f5f5f5; font-weight: bold; border: 1px solid #ddd;">착용희망날짜</td><td style="padding: 8px 12px; border: 1px solid #ddd;">${desiredDate}</td></tr>` : ''}
        ${expectedQty ? `<tr><td style="padding: 8px 12px; background: #f5f5f5; font-weight: bold; border: 1px solid #ddd;">예상수량</td><td style="padding: 8px 12px; border: 1px solid #ddd;">${expectedQty}개</td></tr>` : ''}
        ${fabricColor ? `<tr><td style="padding: 8px 12px; background: #f5f5f5; font-weight: bold; border: 1px solid #ddd;">원단 색상</td><td style="padding: 8px 12px; border: 1px solid #ddd;">${fabricColor}</td></tr>` : ''}
        ${productNames.length > 0 ? `<tr><td style="padding: 8px 12px; background: #f5f5f5; font-weight: bold; border: 1px solid #ddd;">선택 제품</td><td style="padding: 8px 12px; border: 1px solid #ddd;">${productNames.join(', ')}</td></tr>` : ''}
        ${fileCount > 0 ? `<tr><td style="padding: 8px 12px; background: #f5f5f5; font-weight: bold; border: 1px solid #ddd;">첨부파일</td><td style="padding: 8px 12px; border: 1px solid #ddd;">${fileCount}개</td></tr>` : ''}
      </table>
      ${content ? `<div style="margin-top: 16px; padding: 12px; background: #fafafa; border: 1px solid #ddd; border-radius: 4px;"><strong>추가 내용:</strong><br/><span style="white-space: pre-wrap;">${content}</span></div>` : ''}
      <p style="margin-top: 20px; color: #888; font-size: 12px;">이 메일은 모두의 유니폼 문의 게시판에서 자동 발송되었습니다.</p>
    </div>
  `;

  const text = `새로운 문의: ${title}\n담당자: ${managerName} (${groupName})\n연락처: ${phone}\n${content ? `내용: ${content}` : ''}`;

  const success = await sendGmailEmail({
    to: [{ email: adminEmail, name: '관리자' }],
    subject: `[모두의 유니폼] 새 문의: ${title}`,
    text,
    html,
  });

  if (!success) {
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
