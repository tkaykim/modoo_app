/**
 * 기타 문의 FAQ. 정책 수치(샘플비·정확한 제작기간·배송비 등)는 함부로 지어내지 않고
 * "담당자 안내"로 funnel하는 안전 답변. 실제 정책이 확정되면 answer만 교체하면 됨.
 *
 * toConsult: true 면 답변 후 제작 상담 플로우로 자연스럽게 유도.
 *
 * 단일화: 실제 노출은 faqs 테이블(show_in_chatbot=true)에서 fetchChatbotFaqs()로 읽고,
 * 아래 FAQ_ITEMS는 DB 조회 실패/빈 결과 시 폴백으로만 사용.
 */
import { createClient } from '@/lib/supabase-client';

export interface FaqItem {
  id: string;
  question: string; // 버튼 라벨 + 매칭 텍스트
  answer: string;
  toConsult?: boolean;
}

export const FAQ_ITEMS: FaqItem[] = [
  {
    id: 'price',
    question: '가격이 대략 얼마나 나오나요?',
    answer:
      '정확한 단가는 의류·수량·인쇄방식·디자인에 따라 달라져요. 제작 상담을 받으시면 조건에 맞는 예상 견적을 바로 뽑아드릴게요!',
    toConsult: true,
  },
  {
    id: 'sample',
    question: '샘플 제작 되나요?',
    answer:
      '네, 샘플 제작 가능해요! 샘플 비용·소요기간은 제품과 인쇄방식에 따라 달라져서 담당자가 정확히 안내드려요.',
  },
  {
    id: 'leadtime',
    question: '주문하면 얼마나 걸리나요?',
    answer:
      '보통 시안 확정 후 영업일 기준으로 제작돼요. 수량·인쇄방식에 따라 달라지고, 급하시면 급행도 가능하니 담당자가 정확한 일정을 안내드릴게요.',
  },
  {
    id: 'moq',
    question: '최소 수량이 있나요?',
    answer: '소량(1벌)부터도 제작 가능해요! 다만 수량이 많을수록 장당 단가가 유리해져요.',
  },
  {
    id: 'shipping',
    question: '배송은 어떻게 되나요?',
    answer: '전국 배송 가능해요. 배송비·일정은 수량과 지역에 따라 달라져서 담당자가 안내드려요.',
  },
  {
    id: 'payment',
    question: '세금계산서·현금영수증 되나요?',
    answer: '네, 세금계산서·현금영수증 발행 가능해요. 결제 방법은 담당자가 안내드릴게요.',
  },
  {
    id: 'file',
    question: '디자인 파일은 어떤 형식이 필요해요?',
    answer:
      'AI·고해상도 PNG·JPG 등으로 받을 수 있어요. 파일이 없어도 제작 상담에서 시안 제작부터 도와드릴 수 있어요!',
  },
  {
    id: 'nodesign',
    question: '도안이 없는데 제작 가능한가요?',
    answer:
      '물론이에요! 원하시는 느낌만 알려주시면 시안 제작부터 도와드려요. 제작 상담을 받아보시겠어요?',
    toConsult: true,
  },
];

export function getFaqItem(id: string): FaqItem | undefined {
  return FAQ_ITEMS.find((f) => f.id === id);
}

// faqs 테이블에서 챗봇 노출 FAQ를 가져온다 (단일 출처). 실패/빈 결과 시 FAQ_ITEMS 폴백. 모듈 캐시.
let _chatbotFaqsCache: FaqItem[] | null = null;
export async function fetchChatbotFaqs(): Promise<FaqItem[]> {
  if (_chatbotFaqsCache) return _chatbotFaqsCache;
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('faqs')
      .select('id, question, answer, to_consult')
      .eq('is_published', true)
      .eq('show_in_chatbot', true)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false });
    if (error || !data || data.length === 0) return FAQ_ITEMS;
    const items: FaqItem[] = data.map((r: any) => ({
      id: String(r.id),
      question: r.question as string,
      answer: (r.answer as string) ?? '',
      toConsult: Boolean(r.to_consult),
    }));
    _chatbotFaqsCache = items;
    return items;
  } catch {
    return FAQ_ITEMS;
  }
}
