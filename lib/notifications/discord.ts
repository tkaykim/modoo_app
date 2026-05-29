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
  // 챗봇이 수집·계산한 rich 데이터 (리드 품질 판단용)
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

// 크기별 디자인 개수 → "작은 2 · 중간 1" (0인 항목 생략)
function formatPrintSizes(sizes?: Record<string, number> | null): string {
  if (!sizes) return '미입력';
  const parts: string[] = [];
  if (sizes['10x10'] > 0) parts.push(`작은 ${sizes['10x10']}`);
  if (sizes.A4 > 0) parts.push(`중간 ${sizes.A4}`);
  if (sizes.A3 > 0) parts.push(`큰 ${sizes.A3}`);
  return parts.length ? parts.join(' · ') : '미입력';
}

function formatEstPrice(min?: number | null, max?: number | null): string {
  if (min == null) return '담당자 안내';
  if (max == null || min === max) return `장당 약 ${won(min)}`;
  return `장당 약 ${won(min)}~${won(max)}`;
}

export async function sendDiscordNotification(inquiry: ChatbotInquiryNotification): Promise<boolean> {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;

  if (!webhookUrl) {
    console.warn('DISCORD_WEBHOOK_URL is not configured');
    return false;
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: inquiry.consult_requested ? '🔥 **상담원 연결 요청** — 우선 응대 필요' : undefined,
        embeds: [{
          title: inquiry.consult_requested ? '🔥 상담원 연결 요청 (챗봇 문의)' : '🆕 새로운 챗봇 문의',
          color: inquiry.consult_requested ? 0xE8590C : 0x3B55A5,
          fields: [
            { name: '의류 종류', value: inquiry.clothing_type, inline: true },
            { name: '수량', value: `${inquiry.quantity}벌`, inline: true },
            { name: '선호', value: inquiry.priorities.join(' → ') || '미입력', inline: true },
            { name: '디자인', value: inquiry.design_type || '미입력', inline: true },
            { name: '색상', value: inquiry.color_count || '미입력', inline: true },
            { name: '인쇄 크기/개수', value: formatPrintSizes(inquiry.print_sizes), inline: true },
            { name: '선택 인쇄방식', value: inquiry.print_method || '미정', inline: true },
            { name: '추천 인쇄방식', value: inquiry.recommended_print_method || '미정', inline: true },
            { name: '예상 인쇄비', value: formatEstPrice(inquiry.estimated_price_min, inquiry.estimated_price_max), inline: true },
            { name: '필요 날짜', value: inquiry.needed_date_flexible ? '상관없음 (제작일정에 따름)' : (inquiry.needed_date || '미지정'), inline: true },
            { name: '담당자', value: inquiry.contact_name, inline: true },
            { name: '연락처', value: inquiry.contact_phone, inline: true },
            { name: '이메일', value: inquiry.contact_email || '미입력', inline: true },
          ],
          footer: {
            text: `문의 ID: ${inquiry.id}`
          },
          timestamp: inquiry.created_at,
        }]
      })
    });

    if (!response.ok) {
      console.error('Discord notification failed:', await response.text());
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error sending Discord notification:', error);
    return false;
  }
}
