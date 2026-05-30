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
  productName?: string | null;       // 선택한 제품명
  estimatedPayUnit?: number | null;  // 제품+인쇄 합산 장당
  estimatedPayTotal?: number | null; // 제품+인쇄 합산 총액
  createdAt: string;
  formalInquiryId?: string | null; // 정식 문의 ID — 해당 문의 직접 링크용
}

const SITE_URL = 'https://modoouniform.com';
const LOGO_URL = 'https://modoouniform.com/icons/modoo_logo.png';

const won = (n: number) => `${n.toLocaleString('ko-KR')}원`;

function estPrice(min?: number | null, max?: number | null): string {
  if (min == null) return '담당자가 안내드려요';
  if (max == null || min === max) return `장당 약 ${won(min)}`;
  return `장당 약 ${won(min)}~${won(max)}`;
}

/**
 * 상담 연락 요청 고객에게 보내는 "문의 접수 확인" 메일.
 * 정식 문의로 등록되었음을 알리고, 해당 문의 페이지(또는 전화번호 조회)로 안내한다.
 */
export async function sendCustomerInquiryConfirmation(
  data: CustomerInquiryConfirmation,
): Promise<boolean> {
  if (!data.contactEmail) return false;

  const createdAt = formatKstDateLong(data.createdAt);
  const inquiryUrl = data.formalInquiryId
    ? `${SITE_URL}/inquiries/${data.formalInquiryId}`
    : `${SITE_URL}/inquiries`;

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:'Apple SD Gothic Neo','Malgun Gothic',Arial,sans-serif;">
  <div style="max-width:600px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">

    <!-- 헤더: 로고 -->
    <div style="background:#3B55A5;padding:24px 32px;text-align:center;">
      <img src="${LOGO_URL}" alt="모두의 유니폼" style="height:36px;display:inline-block;" />
    </div>

    <!-- 본문 -->
    <div style="padding:32px;">
      <h2 style="margin:0 0 8px;font-size:22px;color:#1a1a1a;">상담 신청이 접수되었어요!</h2>
      <p style="margin:0 0 24px;font-size:15px;color:#555;line-height:1.7;">
        <b>${data.contactName}</b>님, 모두의 유니폼에 상담을 신청해 주셔서 감사합니다.<br/>
        담당자가 확인 후 빠르게 답변드릴게요.
      </p>

      <!-- 상담 요약 카드 -->
      <div style="background:#f8f9ff;border:1px solid #dce3f7;border-radius:10px;padding:20px;margin-bottom:24px;">
        <p style="margin:0 0 12px;font-size:13px;font-weight:700;color:#3B55A5;text-transform:uppercase;letter-spacing:0.05em;">상담 요약</p>
        <table style="width:100%;border-collapse:collapse;font-size:14px;color:#333;">
          <tr>
            <td style="padding:6px 0;width:120px;color:#888;">의류 종류</td>
            <td style="padding:6px 0;font-weight:600;">${data.clothingType} · ${data.quantity}벌</td>
          </tr>
          ${data.designType ? `<tr>
            <td style="padding:6px 0;color:#888;">디자인</td>
            <td style="padding:6px 0;font-weight:600;">${data.designType}${data.colorCount ? ` · ${data.colorCount}` : ''}</td>
          </tr>` : ''}
          ${data.productName ? `<tr>
            <td style="padding:6px 0;color:#888;">선택 제품</td>
            <td style="padding:6px 0;font-weight:600;">${data.productName}</td>
          </tr>` : ''}
          <tr>
            <td style="padding:6px 0;color:#888;">추천 인쇄방식</td>
            <td style="padding:6px 0;font-weight:600;">${data.recommendedPrintMethod || data.printMethod || '담당자 안내'}</td>
          </tr>
          ${data.estimatedPayUnit != null && data.estimatedPayTotal != null ? `<tr>
            <td style="padding:6px 0;color:#888;">예상 결제 금액<br><span style="font-size:11px;color:#aaa;">제품+인쇄</span></td>
            <td style="padding:6px 0;font-weight:700;color:#3B55A5;">${data.quantity}벌 약 ${won(data.estimatedPayTotal)}<br><span style="font-weight:500;color:#888;">장당 약 ${won(data.estimatedPayUnit)}</span></td>
          </tr>
          <tr><td colspan="2" style="padding:2px 0 6px;color:#aaa;font-size:11px;">* 실제 디자인에 따라 소폭 변동될 수 있습니다.</td></tr>` : `<tr>
            <td style="padding:6px 0;color:#888;">예상 인쇄비</td>
            <td style="padding:6px 0;font-weight:600;">${estPrice(data.estimatedPriceMin, data.estimatedPriceMax)}</td>
          </tr>`}
        </table>
      </div>

      <!-- CTA 버튼 -->
      <div style="text-align:center;margin-bottom:24px;">
        <a href="${inquiryUrl}"
           style="display:inline-block;background:#3B55A5;color:#fff;text-decoration:none;
                  padding:14px 36px;border-radius:8px;font-size:15px;font-weight:700;
                  letter-spacing:0.02em;">
          내 문의 확인하기 →
        </a>
      </div>

      <!-- 조회 안내 -->
      <div style="background:#fffbf0;border:1px solid #fde68a;border-radius:8px;padding:14px 16px;margin-bottom:24px;">
        <p style="margin:0;font-size:13px;color:#92400e;line-height:1.6;">
          💡 <b>문의 내역 조회 방법</b><br/>
          로그인하셨다면 '<a href="${SITE_URL}/inquiries?tab=my" style="color:#3B55A5;font-weight:600;">내 문의</a>'에서 바로 확인하실 수 있어요.<br/>
          비로그인 시에는 문의 게시판에서 <b>전화번호</b>를 입력하면 조회됩니다.
        </p>
      </div>

      <p style="font-size:12px;color:#aaa;margin:0;">접수 시간: ${createdAt}</p>
    </div>

    <!-- 푸터 -->
    <div style="background:#f8f8f8;padding:16px 32px;text-align:center;border-top:1px solid #eee;">
      <p style="margin:0;font-size:12px;color:#aaa;line-height:1.8;">
        모두의 유니폼 · <a href="${SITE_URL}" style="color:#3B55A5;text-decoration:none;">modoouniform.com</a><br/>
        궁금한 점은 문의 게시판을 이용해 주세요.
      </p>
    </div>

  </div>
</body>
</html>`;

  const text = `${data.contactName}님, 상담 신청이 접수되었습니다.

[상담 요약]
- 의류: ${data.clothingType} / ${data.quantity}벌${data.productName ? `\n- 선택 제품: ${data.productName}` : ''}
- 추천 인쇄방식: ${data.recommendedPrintMethod || data.printMethod || '담당자 안내'}
${data.estimatedPayUnit != null && data.estimatedPayTotal != null
  ? `- 예상 결제 금액(제품+인쇄): ${data.quantity}벌 약 ${won(data.estimatedPayTotal)} · 장당 약 ${won(data.estimatedPayUnit)}\n  * 실제 디자인에 따라 소폭 변동될 수 있습니다.`
  : `- 예상 인쇄비: ${estPrice(data.estimatedPriceMin, data.estimatedPriceMax)}`}

문의 확인: ${inquiryUrl}
(로그인 시 '내 문의'에서, 비로그인 시 전화번호로 조회 가능)

접수 시간: ${createdAt}
모두의 유니폼 · ${SITE_URL}`;

  return sendGmailEmail({
    to: [{ email: data.contactEmail, name: data.contactName }],
    subject: '[모두의 유니폼] 상담 신청이 접수되었습니다',
    text,
    html,
  });
}
