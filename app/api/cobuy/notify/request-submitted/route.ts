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
  submitterPhone?: string;
  contactPreference: 'phone' | 'email';
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

  const {
    title, productName, receiveByDate, deliveryAddress,
    submitterEmail, submitterName, submitterPhone,
    contactPreference, shareToken, estimatedQuantity,
  } = body;

  if (!submitterEmail || !title) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const baseUrl = 'https://modoouniform.com';
  const requestLink = `${baseUrl}/cobuy/request/${shareToken}`;
  const formattedDate = receiveByDate ? new Date(receiveByDate).toLocaleDateString('ko-KR') : '-';
  const pricing = getPricingInfo(estimatedQuantity);
  const logoUrl = `${baseUrl}/icons/modoo_logo.png`;

  // Determine call schedule based on current time
  const now = new Date();
  const hour = now.getHours();
  const callSchedule = hour < 15
    ? '오늘 ~ 다음날'
    : '내일 ~ 모레';

  // ── Admin email (same for both preferences) ──
  const adminHtml = `
    <div style="font-family: 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #3B55A5; border-bottom: 2px solid #3B55A5; padding-bottom: 10px;">새로운 공동구매 요청</h2>
      <table style="width: 100%; border-collapse: collapse; margin-top: 16px;">
        <tr><td style="padding: 8px 12px; background: #f5f5f5; font-weight: bold; width: 120px; border: 1px solid #ddd;">요청자</td><td style="padding: 8px 12px; border: 1px solid #ddd;">${submitterName} (${submitterEmail}${submitterPhone ? `, ${submitterPhone}` : ''})</td></tr>
        <tr><td style="padding: 8px 12px; background: #f5f5f5; font-weight: bold; border: 1px solid #ddd;">단체명</td><td style="padding: 8px 12px; border: 1px solid #ddd;">${title}</td></tr>
        <tr><td style="padding: 8px 12px; background: #f5f5f5; font-weight: bold; border: 1px solid #ddd;">제품</td><td style="padding: 8px 12px; border: 1px solid #ddd;">${productName}</td></tr>
        <tr><td style="padding: 8px 12px; background: #f5f5f5; font-weight: bold; border: 1px solid #ddd;">연락 선호</td><td style="padding: 8px 12px; border: 1px solid #ddd;">${contactPreference === 'phone' ? '전화' : '이메일'}</td></tr>
        <tr><td style="padding: 8px 12px; background: #f5f5f5; font-weight: bold; border: 1px solid #ddd;">수령 희망일</td><td style="padding: 8px 12px; border: 1px solid #ddd;">${formattedDate}</td></tr>
        <tr><td style="padding: 8px 12px; background: #f5f5f5; font-weight: bold; border: 1px solid #ddd;">배송 주소</td><td style="padding: 8px 12px; border: 1px solid #ddd;">${deliveryAddress || '-'}</td></tr>
      </table>
      <p style="margin-top: 16px;"><a href="${requestLink}" style="color: #3B55A5;">요청 상세 보기</a></p>
      <p style="margin-top: 20px; color: #888; font-size: 12px;">이 메일은 모두의 유니폼에서 자동 발송되었습니다.</p>
    </div>
  `;

  const adminText = `새로운 공동구매 요청\n요청자: ${submitterName} (${submitterEmail}${submitterPhone ? `, ${submitterPhone}` : ''})\n단체명: ${title}\n제품: ${productName}\n연락 선호: ${contactPreference === 'phone' ? '전화' : '이메일'}\n수령 희망일: ${formattedDate}\n배송 주소: ${deliveryAddress || '-'}\n링크: ${requestLink}`;

  // ── Submitter email: different content based on contact preference ──
  const fontStyle = `font-family: 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif;`;

  const headerHtml = `
      <div style="text-align: center; padding: 24px 0; background: #f8f9fc;">
        <img src="${logoUrl}" alt="모두의 유니폼" style="height: 48px;" />
      </div>
      <div style="height: 3px; background: #3B55A5;"></div>`;

  const footerHtml = `
      <div style="border-top: 1px solid #e5e7eb; padding: 24px 28px; background: #f8f9fc;">
        <img src="${logoUrl}" alt="모두의 유니폼" style="height: 32px; margin-bottom: 12px;" />
        <p style="margin: 0 0 2px 0; font-size: 13px; font-weight: bold; color: #333;">MODOO UNIFORM | 모두의 유니폼</p>
        <p style="margin: 0 0 2px 0; font-size: 12px; color: #888;">서울특별시 마포구 성지3길 55, 4층</p>
        <p style="margin: 0; font-size: 12px; color: #888;">T. 010-8140-0621 | W. <a href="https://www.modoouniform.com" style="color: #3B55A5; text-decoration: none;">www.modoouniform.com</a></p>
      </div>`;

  const contactButtonsHtml = `
      <div style="margin: 24px 0 0 0;">
        <p style="font-size: 14px; color: #555; margin: 0 0 12px 0;">궁금한게 있으신가요?</p>
        <div>
          <a href="tel:01081400621" style="display: inline-block; padding: 10px 20px; background: #ffffff; color: #333; border: 1.5px solid #ddd; border-radius: 8px; font-size: 13px; font-weight: bold; text-decoration: none; margin-right: 8px;">전화문의하기</a>
          <a href="http://pf.kakao.com/_xjSdYG/chat" target="_blank" rel="noopener noreferrer" style="display: inline-block; padding: 10px 20px; background: #FEE500; color: #191919; border-radius: 8px; font-size: 13px; font-weight: bold; text-decoration: none;">카톡 문의하기</a>
        </div>
      </div>`;

  let submitterHtml: string;
  let submitterText: string;
  let submitterSubject: string;

  const pricingHtml = pricing ? `
        <div style="margin: 24px 0; padding: 16px; background: #f0f4ff; border-radius: 8px; border: 1px solid #d0d9f0;">
          <h3 style="margin: 0 0 12px 0; font-size: 15px; color: #3B55A5;">예상 견적</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 6px 0; color: #555;">예상 수량</td><td style="padding: 6px 0; text-align: right; font-weight: bold;">${estimatedQuantity}벌</td></tr>
            <tr><td style="padding: 6px 0; color: #555;">벌당 단가</td><td style="padding: 6px 0; text-align: right; font-weight: bold;"><span style="text-decoration: line-through; color: #999;">${pricing.unitPrice.toLocaleString('ko-KR')}원</span> <span style="color: #e53e3e;">${pricing.discountedUnitPrice.toLocaleString('ko-KR')}원</span> ${pricing.note || ''}</td></tr>
            <tr style="border-top: 1px solid #c0c9e0;"><td style="padding: 8px 0; color: #333; font-weight: bold;">합계</td><td style="padding: 8px 0; text-align: right; font-weight: bold; font-size: 16px; color: #3B55A5;">${pricing.discountedTotalPrice.toLocaleString('ko-KR')}원</td></tr>
          </table>
          <p style="margin: 8px 0 0 0; font-size: 11px; color: #888;">* 실제 금액은 디자인 확정 후 변동될 수 있습니다.</p>
        </div>` : '';

  const pricingText = pricing
    ? `\n예상 견적:\n  예상 수량: ${estimatedQuantity}벌\n  벌당 단가: ${pricing.unitPrice.toLocaleString('ko-KR')}원 → ${pricing.discountedUnitPrice.toLocaleString('ko-KR')}원 ${pricing.note || ''}\n  합계: ${pricing.discountedTotalPrice.toLocaleString('ko-KR')}원\n  * 실제 금액은 디자인 확정 후 변동될 수 있습니다.`
    : '';

  if (contactPreference === 'phone') {
    // ── Phone preference: confirmation page-style email ──
    submitterSubject = `[모두의 유니폼] 공동구매 요청이 접수되었습니다`;

    submitterHtml = `
    <div style="${fontStyle} max-width: 600px; margin: 0 auto; background: #ffffff;">
      ${headerHtml}
      <div style="padding: 32px 28px;">
        <p style="font-size: 15px; color: #444; line-height: 1.8; margin: 0 0 24px 0;">
          요청하신 디자인, 견적 등 상세 내용을<br/>전문 담당자가 확인 후 <strong>전화로 연락드릴 예정</strong>입니다.
        </p>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
          <tr><td style="padding: 10px 0; color: #888; font-size: 13px; width: 80px; vertical-align: top;">단체명</td><td style="padding: 10px 0; font-size: 14px; color: #222;">${title}</td></tr>
          <tr><td style="padding: 10px 0; color: #888; font-size: 13px; vertical-align: top;">이름</td><td style="padding: 10px 0; font-size: 14px; color: #222;">${submitterName}</td></tr>
          <tr><td style="padding: 10px 0; color: #888; font-size: 13px; vertical-align: top;">연락처</td><td style="padding: 10px 0; font-size: 14px; color: #222;">${submitterPhone || '-'}</td></tr>
        </table>

        <div style="padding: 16px; background: #f0f4ff; border-radius: 8px; border: 1px solid #d0d9f0; margin-bottom: 24px;">
          <p style="margin: 0 0 8px 0; font-size: 14px; font-weight: bold; color: #3B55A5;">전화드릴 예정 날짜</p>
          <p style="margin: 0 0 4px 0; font-size: 13px; color: #555;">오후 3시가 지나지 않은 경우 : 오늘 ~ 다음날</p>
          <p style="margin: 0; font-size: 13px; color: #555;">오후 3시가 지난 경우 : 내일 ~ 모레</p>
          <p style="margin: 8px 0 0 0; font-size: 13px; color: #3B55A5; font-weight: bold;">→ 예상: ${callSchedule}</p>
        </div>

        ${pricingHtml}

        ${contactButtonsHtml}
      </div>
      ${footerHtml}
    </div>`;

    submitterText = `요청이 접수되었습니다\n\n요청하신 디자인, 견적 등 상세 내용을 전문 담당자가 확인 후 전화로 연락드릴 예정입니다.\n\n단체명: ${title}\n이름: ${submitterName}\n연락처: ${submitterPhone || '-'}\n\n전화드릴 예정: ${callSchedule}${pricingText}\n\n궁금한게 있으신가요?\n전화문의: 010-8140-0621\n카톡 문의: http://pf.kakao.com/_xjSdYG/chat\n\n모두의 유니폼\n서울특별시 마포구 성지3길 55, 4층`;

  } else {
    // ── Email preference: detailed email with pricing + coupon ──
    submitterSubject = `[모두의 유니폼] 공동구매 요청이 접수되었습니다`;

    submitterHtml = `
    <div style="${fontStyle} max-width: 600px; margin: 0 auto; background: #ffffff;">
      ${headerHtml}
      <div style="padding: 32px 28px;">
        <p style="font-size: 15px; color: #444; line-height: 1.8; margin: 0 0 24px 0;">
          요청하신 디자인, 견적 등 상세 내용을<br/>전문 담당자가 확인 후 <strong>이메일로 연락드릴 예정</strong>입니다.
        </p>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
          <tr><td style="padding: 10px 0; color: #888; font-size: 13px; width: 100px; vertical-align: top;">단체명</td><td style="padding: 10px 0; font-size: 14px; color: #222;">${title}</td></tr>
          <tr><td style="padding: 10px 0; color: #888; font-size: 13px; vertical-align: top;">이름</td><td style="padding: 10px 0; font-size: 14px; color: #222;">${submitterName}</td></tr>
          <tr><td style="padding: 10px 0; color: #888; font-size: 13px; vertical-align: top;">이메일 주소</td><td style="padding: 10px 0; font-size: 14px; color: #222;">${submitterEmail}</td></tr>
        </table>

        <p style="font-size: 13px; color: #888; margin: 0 0 4px 0;">담당자 : 김현준 대리</p>

        ${pricingHtml}

        ${contactButtonsHtml}

        ${deliveryAddress ? `
        <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #eee;">
          <p style="font-size: 13px; color: #888; margin: 0 0 4px 0;">모두의 유니폼</p>
          <p style="font-size: 13px; color: #555; margin: 0;">${deliveryAddress}</p>
        </div>` : ''}

        <div style="margin-top: 24px; padding: 16px; background: #FFFBEB; border-radius: 8px; border: 1px solid #FDE68A;">
          <p style="margin: 0; font-size: 14px; font-weight: bold; color: #92400E;">할인 쿠폰 : modoogwajam</p>
        </div>
      </div>
      ${footerHtml}
    </div>`;

    submitterText = `공동구매 요청이 접수되었습니다\n\n요청하신 디자인, 견적 등 상세 내용을 전문 담당자가 확인 후 이메일로 연락드릴 예정입니다.\n\n단체명: ${title}\n이름: ${submitterName}\n이메일 주소: ${submitterEmail}\n\n담당자: 김현준 대리${pricingText}\n\n궁금한게 있으신가요?\n전화문의: 010-8140-0621\n카톡 문의: http://pf.kakao.com/_xjSdYG/chat\n${deliveryAddress ? `\n모두의 유니폼\n${deliveryAddress}` : ''}\n\n할인 쿠폰: modoogwajam`;
  }

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
      subject: submitterSubject,
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
