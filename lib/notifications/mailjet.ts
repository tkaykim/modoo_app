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

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #3B55A5; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background-color: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px; }
        .field { margin-bottom: 15px; }
        .label { font-weight: bold; color: #3B55A5; }
        .value { margin-top: 5px; }
        .footer { margin-top: 20px; font-size: 12px; color: #666; text-align: center; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2 style="margin: 0;">🆕 새로운 챗봇 문의</h2>
        </div>
        <div class="content">
          ${consultBanner}
          <div class="field"><div class="label">의류 종류</div><div class="value">${inquiry.clothing_type}</div></div>
          <div class="field"><div class="label">수량</div><div class="value">${inquiry.quantity}벌</div></div>
          <div class="field"><div class="label">선호 방향</div><div class="value">${inquiry.priorities.join(' → ') || '미입력'}</div></div>
          <div class="field"><div class="label">디자인 종류</div><div class="value">${inquiry.design_type || '미입력'}</div></div>
          <div class="field"><div class="label">색상</div><div class="value">${inquiry.color_count || '미입력'}</div></div>
          <div class="field"><div class="label">인쇄 크기/개수</div><div class="value">${formatPrintSizes(inquiry.print_sizes)}</div></div>
          <div class="field"><div class="label">선택 인쇄방식</div><div class="value">${inquiry.print_method || '미정'}</div></div>
          <div class="field"><div class="label">추천 인쇄방식</div><div class="value">${inquiry.recommended_print_method || '미정'}</div></div>
          <div class="field"><div class="label">예상 인쇄비</div><div class="value">${formatEstPrice(inquiry.estimated_price_min, inquiry.estimated_price_max)}</div></div>
          <div class="field"><div class="label">필요 날짜</div><div class="value">${neededDateDisplay}</div></div>
          <div class="field"><div class="label">담당자</div><div class="value">${inquiry.contact_name}</div></div>
          <div class="field"><div class="label">이메일</div><div class="value">${inquiry.contact_email || '미입력'}</div></div>
          <div class="field"><div class="label">연락처</div><div class="value">${inquiry.contact_phone}</div></div>
          <div class="footer">
            <p>문의 ID: ${inquiry.id}</p>
            <p>접수 시간: ${createdAt}</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `새로운 챗봇 문의가 접수되었습니다.${inquiry.consult_requested ? '\n[🔥 상담원 연결 요청 — 우선 응대 필요]' : ''}

의류 종류: ${inquiry.clothing_type}
수량: ${inquiry.quantity}벌
선호 방향: ${inquiry.priorities.join(' → ') || '미입력'}
디자인 종류: ${inquiry.design_type || '미입력'}
색상: ${inquiry.color_count || '미입력'}
인쇄 크기/개수: ${formatPrintSizes(inquiry.print_sizes)}
선택 인쇄방식: ${inquiry.print_method || '미정'}
추천 인쇄방식: ${inquiry.recommended_print_method || '미정'}
예상 인쇄비: ${formatEstPrice(inquiry.estimated_price_min, inquiry.estimated_price_max)}
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
