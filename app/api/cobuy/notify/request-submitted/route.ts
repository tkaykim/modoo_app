import { NextRequest, NextResponse } from 'next/server';
import { sendMailjetEmail } from '@/lib/mailjet';
import { getPricingInfo } from '@/lib/cobuyPricing';

interface RequestSubmittedBody {
  title: string;
  productName: string;
  receiveByDate: string;
  deliveryAddress: string;
  submitterEmail: string;
  submitterName: string;
  shareToken: string;
  estimatedQuantity: number;
}

export async function POST(request: NextRequest) {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) {
    return NextResponse.json({ error: 'ADMIN_EMAIL not configured' }, { status: 500 });
  }

  let body: RequestSubmittedBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { title, productName, receiveByDate, deliveryAddress, submitterEmail, submitterName, shareToken, estimatedQuantity } = body;

  if (!submitterEmail || !title) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const baseUrl = 'https://modoouniform.com';
  const requestLink = `${baseUrl}/cobuy/request/${shareToken}`;
  const submitterLink = requestLink;
  const formattedDate = receiveByDate ? new Date(receiveByDate).toLocaleDateString('ko-KR') : '-';
  const pricing = getPricingInfo(estimatedQuantity);

  // Email to admin
  const adminHtml = `
    <div style="font-family: 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #3B55A5; border-bottom: 2px solid #3B55A5; padding-bottom: 10px;">새로운 공동구매 요청</h2>
      <table style="width: 100%; border-collapse: collapse; margin-top: 16px;">
        <tr><td style="padding: 8px 12px; background: #f5f5f5; font-weight: bold; width: 120px; border: 1px solid #ddd;">요청자</td><td style="padding: 8px 12px; border: 1px solid #ddd;">${submitterName} (${submitterEmail})</td></tr>
        <tr><td style="padding: 8px 12px; background: #f5f5f5; font-weight: bold; border: 1px solid #ddd;">단체명</td><td style="padding: 8px 12px; border: 1px solid #ddd;">${title}</td></tr>
        <tr><td style="padding: 8px 12px; background: #f5f5f5; font-weight: bold; border: 1px solid #ddd;">제품</td><td style="padding: 8px 12px; border: 1px solid #ddd;">${productName}</td></tr>
        <tr><td style="padding: 8px 12px; background: #f5f5f5; font-weight: bold; border: 1px solid #ddd;">수령 희망일</td><td style="padding: 8px 12px; border: 1px solid #ddd;">${formattedDate}</td></tr>
        <tr><td style="padding: 8px 12px; background: #f5f5f5; font-weight: bold; border: 1px solid #ddd;">배송 주소</td><td style="padding: 8px 12px; border: 1px solid #ddd;">${deliveryAddress || '-'}</td></tr>
      </table>
      <p style="margin-top: 16px;"><a href="${requestLink}" style="color: #3B55A5;">요청 상세 보기</a></p>
      <p style="margin-top: 20px; color: #888; font-size: 12px;">이 메일은 모두의 유니폼에서 자동 발송되었습니다.</p>
    </div>
  `;

  const adminText = `새로운 공동구매 요청\n요청자: ${submitterName} (${submitterEmail})\n단체명: ${title}\n제품: ${productName}\n수령 희망일: ${formattedDate}\n배송 주소: ${deliveryAddress || '-'}\n링크: ${requestLink}`;

  // Email to submitter
  const logoUrl = `${baseUrl}/icons/modoo_logo.png`;

  const pricingHtml = pricing ? `
      <div style="margin: 24px 0; padding: 16px; background: #f0f4ff; border-radius: 8px; border: 1px solid #d0d9f0;">
        <h3 style="margin: 0 0 12px 0; font-size: 15px; color: #3B55A5;">예상 견적</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr><td style="padding: 6px 0; color: #555;">예상 수량</td><td style="padding: 6px 0; text-align: right; font-weight: bold;">${estimatedQuantity}벌</td></tr>
          <tr><td style="padding: 6px 0; color: #555;">벌당 단가</td><td style="padding: 6px 0; text-align: right; font-weight: bold;">${pricing.unitPrice.toLocaleString('ko-KR')}원 ${pricing.note || ''}</td></tr>
          <tr style="border-top: 1px solid #c0c9e0;"><td style="padding: 8px 0; color: #333; font-weight: bold;">합계</td><td style="padding: 8px 0; text-align: right; font-weight: bold; font-size: 16px; color: #3B55A5;">${pricing.totalPrice.toLocaleString('ko-KR')}원</td></tr>
        </table>
        <p style="margin: 8px 0 0 0; font-size: 11px; color: #888;">* 실제 금액은 디자인 확정 후 변동될 수 있습니다.</p>
      </div>` : `
      <div style="margin: 24px 0; padding: 16px; background: #fff5f5; border-radius: 8px; border: 1px solid #f0d0d0;">
        <p style="margin: 0; font-size: 14px; color: #c00;">예상 수량 ${estimatedQuantity}벌은 성수기 제작이 불가한 수량입니다 (최소 20벌 이상). 자세한 사항은 문의해주세요.</p>
      </div>`;

  const submitterHtml = `
    <div style="font-family: 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
      <!-- Header -->
      <div style="text-align: center; padding: 24px 0; background: #f8f9fc;">
        <img src="${logoUrl}" alt="모두의 유니폼" style="height: 48px;" />
      </div>
      <div style="height: 3px; background: #3B55A5;"></div>

      <!-- Body -->
      <div style="padding: 32px 28px;">
        <p style="font-size: 17px; color: #222; line-height: 1.7; margin: 0 0 8px 0;"><strong>안녕하세요,</strong></p>
        <p style="font-size: 17px; color: #222; line-height: 1.7; margin: 0 0 24px 0;"><strong>모두의 유니폼입니다.</strong></p>

        <p style="font-size: 14px; color: #444; line-height: 1.8; margin: 0 0 12px 0;">과잠 공동구매 요청이 정상적으로 접수되었습니다.</p>
        <p style="font-size: 14px; color: #444; line-height: 1.8; margin: 0 0 24px 0;">접수해주신 내용을 확인 후 빠르게 연락드리겠습니다. 아래 <strong>'요청 확인하기'</strong>에서 접수 내용을 확인하실 수 있습니다.</p>

        ${pricingHtml}

        <!-- Buttons -->
        <div style="text-align: center; margin: 28px 0;">
          <a href="${submitterLink}" style="display: block; width: 80%; max-width: 360px; margin: 0 auto 10px auto; padding: 14px 0; background-color: #3B55A5; color: #ffffff; border-radius: 8px; font-weight: bold; font-size: 15px; text-decoration: none; text-align: center;">요청 확인하기</a>
          <a href="http://pf.kakao.com/_xjSdYG/chat" target="_blank" rel="noopener noreferrer" style="display: block; width: 80%; max-width: 360px; margin: 0 auto 10px auto; padding: 14px 0; background-color: #FEE500; color: #191919; border-radius: 8px; font-weight: bold; font-size: 15px; text-decoration: none; text-align: center;">카카오톡 채팅 상담</a>
          <a href="tel:01081400621" style="display: block; width: 80%; max-width: 360px; margin: 0 auto 6px auto; padding: 14px 0; background-color: #ffffff; color: #333; border: 1.5px solid #ddd; border-radius: 8px; font-weight: bold; font-size: 15px; text-decoration: none; text-align: center;">전화 상담 (010-8140-0621)</a>
          <p style="margin: 0; font-size: 12px; color: #999;">모바일에서 클릭 시 바로 전화가 연결됩니다.</p>
        </div>

        <p style="font-size: 14px; color: #444; line-height: 1.8; margin: 24px 0 4px 0;">궁금하신 점이 있으시면 카카오톡 또는 전화로 편하게 문의해주세요.</p>
        <p style="font-size: 14px; color: #444; line-height: 1.8; margin: 0;">감사합니다.</p>
      </div>

      <!-- Footer -->
      <div style="border-top: 1px solid #e5e7eb; padding: 24px 28px; background: #f8f9fc;">
        <img src="${logoUrl}" alt="모두의 유니폼" style="height: 32px; margin-bottom: 12px;" />
        <p style="margin: 0 0 2px 0; font-size: 13px; font-weight: bold; color: #333;">MODOO UNIFORM | 모두의 유니폼</p>
        <p style="margin: 0 0 2px 0; font-size: 12px; color: #888;">대표이사 김현준</p>
        <p style="margin: 0 0 2px 0; font-size: 12px; color: #888;">서울특별시 마포구 성지3길 55, 4층</p>
        <p style="margin: 0; font-size: 12px; color: #888;">T. 010-8140-0621 | W. <a href="https://www.modoouniform.com" style="color: #3B55A5; text-decoration: none;">www.modoouniform.com</a></p>
      </div>
    </div>
  `;

  const pricingText = pricing
    ? `\n예상 견적:\n  예상 수량: ${estimatedQuantity}벌\n  벌당 단가: ${pricing.unitPrice.toLocaleString('ko-KR')}원 ${pricing.note || ''}\n  합계: ${pricing.totalPrice.toLocaleString('ko-KR')}원\n  * 실제 금액은 디자인 확정 후 변동될 수 있습니다.`
    : `\n예상 수량 ${estimatedQuantity}벌은 성수기 제작이 불가한 수량입니다 (최소 20벌 이상). 자세한 사항은 문의해주세요.`;

  const submitterText = `공동구매 요청이 접수되었습니다\n${submitterName}님, 요청이 성공적으로 제출되었습니다.\n단체명: ${title}\n제품: ${productName}\n수령 희망일: ${formattedDate}\n예상 수량: ${estimatedQuantity}벌\n${pricingText}\n\n요청 확인: ${submitterLink}\n\n카카오톡 문의: http://pf.kakao.com/_xjSdYG/chat\n전화 문의: 01081400621`;

  // Send both emails
  const [adminSent, submitterSent] = await Promise.all([
    sendMailjetEmail({
      to: [{ email: adminEmail, name: '관리자' }],
      subject: `[공동구매 요청] ${title}`,
      textPart: adminText,
      htmlPart: adminHtml,
      customId: `cobuy-request-admin-${shareToken}`,
    }),
    sendMailjetEmail({
      to: [{ email: submitterEmail, name: submitterName }],
      subject: `[모두의 유니폼] 공동구매 요청이 접수되었습니다`,
      textPart: submitterText,
      htmlPart: submitterHtml,
      customId: `cobuy-request-submitter-${shareToken}`,
    }),
  ]);

  if (!adminSent && !submitterSent) {
    return NextResponse.json({ error: 'Failed to send emails' }, { status: 500 });
  }

  return NextResponse.json({ success: true, adminSent, submitterSent });
}
