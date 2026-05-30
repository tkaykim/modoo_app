import { sendGmailEmail } from '@/lib/gmail';
import { formatKstDateLong } from '@/lib/kst';

interface ChatbotInquiryNotification {
  id: string;
  clothing_type: string;
  quantity: number;
  priorities: string[];
  needed_date: string | null;
  needed_date_flexible: boolean;
  contact_name: string;
  contact_email: string | null;
  contact_phone: string;
  created_at: string;
  design_type?: string | null;
  color_count?: string | null;
  print_sizes?: Record<string, number> | null;
  print_method?: string | null;
  recommended_print_method?: string | null;
  estimated_price_min?: number | null;
  estimated_price_max?: number | null;
  product_name?: string | null;       // 선택 제품
  estimated_pay_unit?: number | null;  // 제품+인쇄 합산 장당
  estimated_pay_total?: number | null; // 제품+인쇄 합산 총액
  consult_requested?: boolean;
}

const won = (n: number) => `${n.toLocaleString('ko-KR')}원`;

function formatPrintSizes(sizes?: Record<string, number> | null): string {
  if (!sizes) return '미입력';
  const parts: string[] = [];
  if (sizes['10x10'] > 0) parts.push(`작은 ${sizes['10x10']}개`);
  if (sizes.A4 > 0) parts.push(`중간 ${sizes.A4}개`);
  if (sizes.A3 > 0) parts.push(`큰 ${sizes.A3}개`);
  return parts.length ? parts.join(' · ') : '미입력';
}

function formatEstPrice(min?: number | null, max?: number | null): string {
  if (min == null) return '담당자 안내';
  if (max == null || min === max) return `장당 약 ${won(min)}`;
  return `장당 약 ${won(min)}~${won(max)}`;
}

export async function sendEmailNotification(inquiry: ChatbotInquiryNotification): Promise<boolean> {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) {
    console.warn('ADMIN_EMAIL not configured');
    return false;
  }

  const neededDateDisplay = inquiry.needed_date_flexible
    ? '상관없음 (제작일정에 따름)'
    : (inquiry.needed_date || '미지정');

  const createdAt = formatKstDateLong(inquiry.created_at);
  const consultBanner = inquiry.consult_requested
    ? `<div style="background:#E8590C;color:#fff;padding:10px 16px;border-radius:8px;margin-bottom:14px;font-weight:bold;">🔥 상담원 연결 요청 — 우선 응대가 필요한 문의입니다</div>`
    : '';

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:'Apple SD Gothic Neo','Malgun Gothic',Arial,sans-serif;">
  <div style="max-width:600px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
    <div style="background:#3B55A5;padding:20px 32px;text-align:center;">
      <img src="https://modoouniform.com/icons/modoo_logo.png" alt="모두의 유니폼" style="height:32px;display:inline-block;" />
      <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:13px;">${inquiry.consult_requested ? '🔥 상담원 연결 요청' : '새로운 챗봇 문의'}</p>
    </div>
    <div style="padding:24px 32px;">
      ${inquiry.consult_requested ? `<div style="background:#fff4f0;border:1px solid #f8c4a8;border-radius:8px;padding:12px 16px;margin-bottom:20px;font-size:14px;color:#c0390b;font-weight:600;">🔥 상담원 연결 요청 — 우선 응대가 필요한 문의입니다</div>` : ''}
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <tr style="border-bottom:1px solid #f0f0f0;"><td style="padding:9px 0;color:#888;width:130px;">의류 종류</td><td style="padding:9px 0;font-weight:600;">${inquiry.clothing_type}</td></tr>
        <tr style="border-bottom:1px solid #f0f0f0;"><td style="padding:9px 0;color:#888;">수량</td><td style="padding:9px 0;font-weight:600;">${inquiry.quantity}벌</td></tr>
        <tr style="border-bottom:1px solid #f0f0f0;"><td style="padding:9px 0;color:#888;">선호 방향</td><td style="padding:9px 0;">${inquiry.priorities.join(' → ') || '미입력'}</td></tr>
        <tr style="border-bottom:1px solid #f0f0f0;"><td style="padding:9px 0;color:#888;">디자인 종류</td><td style="padding:9px 0;">${inquiry.design_type || '미입력'}</td></tr>
        <tr style="border-bottom:1px solid #f0f0f0;"><td style="padding:9px 0;color:#888;">색상</td><td style="padding:9px 0;">${inquiry.color_count || '미입력'}</td></tr>
        <tr style="border-bottom:1px solid #f0f0f0;"><td style="padding:9px 0;color:#888;">인쇄 크기/개수</td><td style="padding:9px 0;">${formatPrintSizes(inquiry.print_sizes)}</td></tr>
        <tr style="border-bottom:1px solid #f0f0f0;"><td style="padding:9px 0;color:#888;">선택 인쇄방식</td><td style="padding:9px 0;">${inquiry.print_method || '미정'}</td></tr>
        ${inquiry.product_name ? `<tr style="border-bottom:1px solid #f0f0f0;"><td style="padding:9px 0;color:#888;">선택 제품</td><td style="padding:9px 0;font-weight:600;">${inquiry.product_name}</td></tr>` : ''}
        <tr style="border-bottom:1px solid #f0f0f0;"><td style="padding:9px 0;color:#888;">추천 인쇄방식</td><td style="padding:9px 0;font-weight:600;">${inquiry.recommended_print_method || '미정'}</td></tr>
        <tr style="border-bottom:1px solid #f0f0f0;"><td style="padding:9px 0;color:#888;">예상 인쇄비</td><td style="padding:9px 0;">${formatEstPrice(inquiry.estimated_price_min, inquiry.estimated_price_max)}</td></tr>
        ${inquiry.estimated_pay_unit != null && inquiry.estimated_pay_total != null ? `<tr style="border-bottom:1px solid #f0f0f0;"><td style="padding:9px 0;color:#888;">예상 결제 금액<br><span style="font-size:11px;color:#aaa;">제품+인쇄</span></td><td style="padding:9px 0;font-weight:700;color:#3B55A5;">${inquiry.quantity}벌 약 ${won(inquiry.estimated_pay_total)}<br><span style="font-weight:500;color:#888;">장당 약 ${won(inquiry.estimated_pay_unit)}</span><br><span style="font-size:11px;color:#aaa;">* 예상가이며 상담·디자인 결과 소폭 변동될 수 있습니다.</span></td></tr>` : ''}
        <tr style="border-bottom:1px solid #f0f0f0;"><td style="padding:9px 0;color:#888;">필요 날짜</td><td style="padding:9px 0;">${neededDateDisplay}</td></tr>
        <tr style="border-bottom:1px solid #f0f0f0;"><td style="padding:9px 0;color:#888;">담당자</td><td style="padding:9px 0;font-weight:600;">${inquiry.contact_name}</td></tr>
        <tr style="border-bottom:1px solid #f0f0f0;"><td style="padding:9px 0;color:#888;">연락처</td><td style="padding:9px 0;font-weight:600;">${inquiry.contact_phone}</td></tr>
        <tr><td style="padding:9px 0;color:#888;">이메일</td><td style="padding:9px 0;">${inquiry.contact_email || '미입력'}</td></tr>
      </table>
      <div style="text-align:center;margin-top:24px;">
        <a href="https://modoo-admin.vercel.app/content/chatbot"
           style="display:inline-block;background:#3B55A5;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:700;">
          챗봇 문의 관리에서 보기 →
        </a>
      </div>
    </div>
    <div style="background:#f8f8f8;padding:14px 32px;text-align:center;border-top:1px solid #eee;">
      <p style="margin:0;font-size:12px;color:#aaa;">모두의 유니폼 · 문의 ID: ${inquiry.id}<br/>접수 시간: ${createdAt}</p>
    </div>
  </div>
</body>
</html>`;

  const text = `새로운 챗봇 문의가 접수되었습니다.${inquiry.consult_requested ? '\n[🔥 상담원 연결 요청 — 우선 응대 필요]' : ''}

의류 종류: ${inquiry.clothing_type}
수량: ${inquiry.quantity}벌
선호 방향: ${inquiry.priorities.join(' → ') || '미입력'}
디자인 종류: ${inquiry.design_type || '미입력'}
색상: ${inquiry.color_count || '미입력'}
인쇄 크기/개수: ${formatPrintSizes(inquiry.print_sizes)}
선택 인쇄방식: ${inquiry.print_method || '미정'}${inquiry.product_name ? `\n선택 제품: ${inquiry.product_name}` : ''}
추천 인쇄방식: ${inquiry.recommended_print_method || '미정'}
예상 인쇄비: ${formatEstPrice(inquiry.estimated_price_min, inquiry.estimated_price_max)}${inquiry.estimated_pay_unit != null && inquiry.estimated_pay_total != null ? `\n예상 결제 금액(제품+인쇄): ${inquiry.quantity}벌 약 ${won(inquiry.estimated_pay_total)} · 장당 약 ${won(inquiry.estimated_pay_unit)}\n  * 예상가이며 상담·디자인 결과 소폭 변동될 수 있습니다.` : ''}
필요 날짜: ${neededDateDisplay}
담당자: ${inquiry.contact_name}
이메일: ${inquiry.contact_email || '미입력'}
연락처: ${inquiry.contact_phone}

문의 ID: ${inquiry.id}
접수 시간: ${createdAt}`;

  return sendGmailEmail({
    to: [{ email: adminEmail, name: 'Admin' }],
    subject: `${inquiry.consult_requested ? '🔥[상담원 연결] ' : ''}[모두의 유니폼] 새로운 챗봇 문의 - ${inquiry.contact_name}`,
    text,
    html,
  });
}
