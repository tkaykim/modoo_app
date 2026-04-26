import { NextRequest, NextResponse } from 'next/server';
import { sendGmailEmail } from '@/lib/gmail';

interface DraftCreatedBody {
  title: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  estimatedQuantity: number;
  productName: string;
}

export async function POST(request: NextRequest) {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) {
    return NextResponse.json({ error: 'ADMIN_EMAIL not configured' }, { status: 500 });
  }

  let body: DraftCreatedBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { title, contactName, contactEmail, contactPhone, estimatedQuantity, productName } = body;

  if (!contactName || !contactEmail || !title) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const baseUrl = 'https://modoouniform.com';
  const logoUrl = `${baseUrl}/icons/modoo_logo.png`;

  const adminHtml = `
    <div style="font-family: 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
      <!-- Header -->
      <div style="text-align: center; padding: 24px 0; background: #f8f9fc;">
        <img src="${logoUrl}" alt="모두의 유니폼" style="height: 48px;" />
      </div>
      <div style="height: 3px; background: #3B55A5;"></div>

      <!-- Body -->
      <div style="padding: 32px 28px;">
        <p style="font-size: 17px; color: #222; line-height: 1.7; margin: 0 0 8px 0;"><strong>새로운 공동구매 문의가 접수되었습니다.</strong></p>
        <p style="font-size: 13px; color: #888; margin: 0 0 24px 0;">기본 정보가 입력되었습니다. 아직 디자인 작업 중일 수 있습니다.</p>

        <table style="width: 100%; border-collapse: collapse;">
          <tr><td style="padding: 10px 14px; background: #f8f9fc; font-weight: bold; width: 100px; border: 1px solid #e5e7eb; font-size: 13px; color: #555;">이름</td><td style="padding: 10px 14px; border: 1px solid #e5e7eb; font-size: 14px; color: #222;">${contactName}</td></tr>
          <tr><td style="padding: 10px 14px; background: #f8f9fc; font-weight: bold; border: 1px solid #e5e7eb; font-size: 13px; color: #555;">이메일</td><td style="padding: 10px 14px; border: 1px solid #e5e7eb; font-size: 14px; color: #222;">${contactEmail}</td></tr>
          <tr><td style="padding: 10px 14px; background: #f8f9fc; font-weight: bold; border: 1px solid #e5e7eb; font-size: 13px; color: #555;">연락처</td><td style="padding: 10px 14px; border: 1px solid #e5e7eb; font-size: 14px; color: #222;">${contactPhone || '-'}</td></tr>
          <tr><td style="padding: 10px 14px; background: #f8f9fc; font-weight: bold; border: 1px solid #e5e7eb; font-size: 13px; color: #555;">단체명</td><td style="padding: 10px 14px; border: 1px solid #e5e7eb; font-size: 14px; color: #222;">${title}</td></tr>
          <tr><td style="padding: 10px 14px; background: #f8f9fc; font-weight: bold; border: 1px solid #e5e7eb; font-size: 13px; color: #555;">제품</td><td style="padding: 10px 14px; border: 1px solid #e5e7eb; font-size: 14px; color: #222;">${productName}</td></tr>
          <tr><td style="padding: 10px 14px; background: #f8f9fc; font-weight: bold; border: 1px solid #e5e7eb; font-size: 13px; color: #555;">예상 수량</td><td style="padding: 10px 14px; border: 1px solid #e5e7eb; font-size: 14px; color: #222;">${estimatedQuantity}벌</td></tr>
        </table>
      </div>

      <!-- Footer -->
      <div style="border-top: 1px solid #e5e7eb; padding: 24px 28px; background: #f8f9fc;">
        <img src="${logoUrl}" alt="모두의 유니폼" style="height: 32px; margin-bottom: 12px;" />
        <p style="margin: 0 0 2px 0; font-size: 13px; font-weight: bold; color: #333;">MODOO UNIFORM | 모두의 유니폼</p>
        <p style="margin: 0; font-size: 12px; color: #888;">이 메일은 모두의 유니폼에서 자동 발송되었습니다.</p>
      </div>
    </div>
  `;

  const adminText = `새로운 공동구매 문의 접수\n이름: ${contactName}\n이메일: ${contactEmail}\n연락처: ${contactPhone || '-'}\n단체명: ${title}\n제품: ${productName}\n예상 수량: ${estimatedQuantity}벌`;

  const sent = await sendGmailEmail({
    to: [{ email: adminEmail, name: '관리자' }],
    subject: `[공동구매 문의] ${title} - ${contactName}`,
    text: adminText,
    html: adminHtml,
  });

  if (!sent) {
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
