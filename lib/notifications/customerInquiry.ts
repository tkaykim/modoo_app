import { sendGmailEmail } from '@/lib/gmail';
import { formatKstDateLong } from '@/lib/kst';

export interface CustomerInquiryConfirmation {
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  clothingType: string;
  quantity: number;
  designType?: string | null;
  colorCount?: string | null;
  printMethod?: string | null;
  recommendedPrintMethod?: string | null;
  estimatedPriceMin?: number | null;
  estimatedPriceMax?: number | null;
  createdAt: string;
}

const won = (n: number) => `${n.toLocaleString('ko-KR')}원`;

function estPrice(min?: number | null, max?: number | null): string {
  if (min == null) return '담당자가 안내드려요';
  if (max == null || min === max) return `장당 약 ${won(min)}`;
  return `장당 약 ${won(min)}~${won(max)}`;
}

/**
 * 상담 연락 요청 고객에게 보내는 "문의 접수 확인" 메일.
 * 정식 문의로 등록되었음을 알리고, 전화번호로 조회 가능함을 안내한다.
 */
export async function sendCustomerInquiryConfirmation(
  data: CustomerInquiryConfirmation,
): Promise<boolean> {
  if (!data.contactEmail) return false;

  const createdAt = formatKstDateLong(data.createdAt);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://modoo-uniform.com';

  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8" /></head>
    <body style="font-family:'Apple SD Gothic Neo','Malgun Gothic',sans-serif;line-height:1.6;color:#333;">
      <div style="max-width:600px;margin:0 auto;padding:20px;">
        <div style="background:#3B55A5;color:#fff;padding:20px;text-align:center;border-radius:8px 8px 0 0;">
          <h2 style="margin:0;">상담 신청이 접수되었어요</h2>
        </div>
        <div style="background:#f9f9f9;padding:20px;border-radius:0 0 8px 8px;">
          <p>${data.contactName}님, 모두의 유니폼에 상담을 신청해 주셔서 감사합니다.<br/>
          담당자가 확인 후 빠르게 연락드릴게요.</p>
          <div style="background:#fff;border:1px solid #eee;border-radius:8px;padding:16px;margin:16px 0;">
            <p style="margin:0 0 8px;font-weight:bold;color:#3B55A5;">상담 요약</p>
            <p style="margin:4px 0;">의류: ${data.clothingType} / ${data.quantity}벌</p>
            ${data.designType ? `<p style="margin:4px 0;">디자인: ${data.designType}${data.colorCount ? ` · ${data.colorCount}` : ''}</p>` : ''}
            <p style="margin:4px 0;">추천 인쇄방식: ${data.recommendedPrintMethod || data.printMethod || '담당자 안내'}</p>
            <p style="margin:4px 0;">예상 인쇄비: ${estPrice(data.estimatedPriceMin, data.estimatedPriceMax)}</p>
          </div>
          <p style="font-size:13px;color:#666;">
            문의 내역은 <a href="${siteUrl}/inquiries" style="color:#3B55A5;">문의 게시판</a>에서
            남겨주신 <b>전화번호</b>로 조회하실 수 있어요. (로그인 시 '내 문의'에서 바로 확인 가능)
          </p>
          <p style="font-size:12px;color:#999;margin-top:16px;">접수 시간: ${createdAt}</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `${data.contactName}님, 상담 신청이 접수되었습니다.

상담 요약
- 의류: ${data.clothingType} / ${data.quantity}벌
- 추천 인쇄방식: ${data.recommendedPrintMethod || data.printMethod || '담당자 안내'}
- 예상 인쇄비: ${estPrice(data.estimatedPriceMin, data.estimatedPriceMax)}

문의 내역은 ${siteUrl}/inquiries 에서 전화번호로 조회하실 수 있어요.
접수 시간: ${createdAt}`;

  return sendGmailEmail({
    to: [{ email: data.contactEmail, name: data.contactName }],
    subject: '[모두의 유니폼] 상담 신청이 접수되었습니다',
    text,
    html,
  });
}
