import { NextRequest, NextResponse } from 'next/server';
import { sendMailjetEmail } from '@/lib/mailjet';

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

function getPricingInfo(qty: number): { unitPrice: number; totalPrice: number; note?: string } | null {
  if (qty < 20) return null; // 1~19: 성수기 제작불가
  if (qty <= 30) return { unitPrice: Math.round(1800000 / qty), totalPrice: 1800000, note: '(고정가)' };
  if (qty <= 50) return { unitPrice: 58000, totalPrice: qty * 58000 };
  if (qty <= 70) return { unitPrice: 56000, totalPrice: qty * 56000 };
  return { unitPrice: 53000, totalPrice: qty * 53000 };
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
  const submitterHtml = `
    <div style="font-family: 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #3B55A5; border-bottom: 2px solid #3B55A5; padding-bottom: 10px;">공동구매 요청이 접수되었습니다</h2>
      <p style="margin-top: 16px; color: #333;">${submitterName}님, 공동구매 요청이 성공적으로 제출되었습니다.</p>
      <table style="width: 100%; border-collapse: collapse; margin-top: 16px;">
        <tr><td style="padding: 8px 12px; background: #f5f5f5; font-weight: bold; width: 120px; border: 1px solid #ddd;">단체명</td><td style="padding: 8px 12px; border: 1px solid #ddd;">${title}</td></tr>
        <tr><td style="padding: 8px 12px; background: #f5f5f5; font-weight: bold; border: 1px solid #ddd;">제품</td><td style="padding: 8px 12px; border: 1px solid #ddd;">${productName}</td></tr>
        <tr><td style="padding: 8px 12px; background: #f5f5f5; font-weight: bold; border: 1px solid #ddd;">수령 희망일</td><td style="padding: 8px 12px; border: 1px solid #ddd;">${formattedDate}</td></tr>
        <tr><td style="padding: 8px 12px; background: #f5f5f5; font-weight: bold; border: 1px solid #ddd;">예상 수량</td><td style="padding: 8px 12px; border: 1px solid #ddd;">${estimatedQuantity}벌</td></tr>
      </table>
      ${pricing ? `
      <div style="margin-top: 20px; padding: 16px; background: #f0f4ff; border-radius: 8px; border: 1px solid #d0d9f0;">
        <h3 style="margin: 0 0 12px 0; font-size: 15px; color: #3B55A5;">예상 견적</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr><td style="padding: 6px 0; color: #555;">예상 수량</td><td style="padding: 6px 0; text-align: right; font-weight: bold;">${estimatedQuantity}벌</td></tr>
          <tr><td style="padding: 6px 0; color: #555;">벌당 단가</td><td style="padding: 6px 0; text-align: right; font-weight: bold;">${pricing.unitPrice.toLocaleString('ko-KR')}원 ${pricing.note || ''}</td></tr>
          <tr style="border-top: 1px solid #c0c9e0;"><td style="padding: 8px 0; color: #333; font-weight: bold;">합계</td><td style="padding: 8px 0; text-align: right; font-weight: bold; font-size: 16px; color: #3B55A5;">${pricing.totalPrice.toLocaleString('ko-KR')}원</td></tr>
        </table>
        <p style="margin: 8px 0 0 0; font-size: 11px; color: #888;">* 실제 금액은 디자인 확정 후 변동될 수 있습니다.</p>
      </div>
      ` : `
      <div style="margin-top: 20px; padding: 16px; background: #fff5f5; border-radius: 8px; border: 1px solid #f0d0d0;">
        <p style="margin: 0; font-size: 14px; color: #c00;">예상 수량 ${estimatedQuantity}벌은 성수기 제작이 불가한 수량입니다 (최소 20벌 이상). 자세한 사항은 문의해주세요.</p>
      </div>
      `}
      <p style="margin-top: 16px;">관리자가 디자인을 확인한 후 연락드리겠습니다.</p>
      <p style="margin-top: 8px;"><a href="${submitterLink}" style="color: #3B55A5;">요청 확인하기</a></p>
      <div style="margin-top: 20px; text-align: center;">
        <a href="http://pf.kakao.com/_xjSdYG/chat" target="_blank" rel="noopener noreferrer" style="display: inline-block; width: 100%; max-width: 300px; padding: 12px 0; background-color: #FEE500; color: #191919; border-radius: 8px; font-weight: bold; font-size: 14px; text-decoration: none; text-align: center;">카카오톡으로 문의하기</a>
      </div>
      <div style="margin-top: 8px; text-align: center;">
        <a href="tel:01081400621" style="display: inline-block; width: 100%; max-width: 300px; padding: 12px 0; background-color: #ffffff; color: #333; border: 1px solid #ddd; border-radius: 8px; font-weight: bold; font-size: 14px; text-decoration: none; text-align: center;">전화로 문의하기</a>
      </div>
      <p style="margin-top: 20px; color: #888; font-size: 12px;">이 메일은 모두의 유니폼에서 자동 발송되었습니다.</p>
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
