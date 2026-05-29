import {
  QuickReply,
  InquiryStep,
  ClothingType,
  QuantityOption,
  DesignType,
  ColorCount,
  PrintLocation,
  PrintMethodChoice,
} from './types';
import { CATEGORIES } from '@/lib/categories';

// 의류 라벨(한글) → 상품 category 키 매핑. lib/categories.ts(스토어프론트 정식 출처)에서
// 생성해 드리프트 방지. (예: 맨투맨→sweater, 후드집업→zipup)
export const CATEGORY_MAPPING: Record<string, string> = Object.fromEntries(
  CATEGORIES.map((c) => [c.name, c.key])
);

// Step messages configuration
export const STEP_MESSAGES: Record<InquiryStep, { content: string; quickReplies?: QuickReply[] }> = {
  welcome: {
    content: '안녕하세요! 모두의 유니폼입니다.',
  },
  menu: {
    content: '안녕하세요! 모두의 유니폼입니다.\n무엇을 도와드릴까요?',
    quickReplies: [
      { label: '제작 상담받기', action: '제작상담', type: 'message', icon: 'palette' },
      { label: '기타 문의', action: '기타문의', type: 'message', icon: 'message-circle' },
    ]
  },
  faq: {
    content: '궁금하신 점을 골라주세요! (제작 견적은 "제작 상담받기"에서 바로 안내드려요)',
  },
  clothing_type: {
    content: '어떤 종류의 의류를 만드시나요?',
    quickReplies: [
      { label: '티셔츠', action: '티셔츠', type: 'message' },
      { label: '후드티', action: '후드티', type: 'message' },
      { label: '맨투맨', action: '맨투맨', type: 'message' },
      { label: '후드집업', action: '후드집업', type: 'message' },
      { label: '자켓', action: '자켓', type: 'message' },
    ]
  },
  quantity: {
    content: '몇 벌 정도 생각하세요?\n대략적인 수량을 입력해 주세요.\n\n수량에 따라 추천 인쇄방식과 단가가 달라져요.',
  },
  design_type: {
    content: '옷에는 어떤 디자인을 넣고 싶으신가요?',
    quickReplies: [
      { label: '사진·실사, 그래픽 (다양한 색상)', action: '사진·그래픽', type: 'message' },
      { label: '로고·심볼·텍스트 (간단한 색상)', action: '로고·텍스트', type: 'message' },
    ]
  },
  color_count: {
    content: '로고/텍스트에 색상이 몇 가지 들어가나요?\n(실크 나염은 색마다 비용이 달라져요)',
    quickReplies: [
      { label: '1색', action: '1색', type: 'message' },
      { label: '2색', action: '2색', type: 'message' },
      { label: '3색', action: '3색', type: 'message' },
      { label: '4색 이상', action: '4색 이상', type: 'message' },
      { label: '그라데이션 포함', action: '그라데이션', type: 'message' },
    ]
  },
  // 단계 ID는 print_location이지만, 인쇄할 디자인을 "크기별 개수"로 입력받는다.
  print_location: {
    content: '인쇄할 로고(또는 이미지)는 총 몇 개인가요?\n크기별로 입력해 주세요.',
  },
  print_method: {
    content: '인쇄방식을 선택해주세요. 고객님 조건에 맞는 방식엔 추천 표시를 해 두었어요. 선택 후 다음을 눌러주세요.',
  },
  needed_date: {
    content: '언제까지 받아보셔야 하나요?',
  },
  priorities: {
    content: '다음 중 더 선호하시는 방향은?',
  },
  recommendation: {
    content: '고객님 조건을 정리하면, 이렇게 추천드려요.',
  },
  contact_info: {
    content: '견적서·시안 전달과 상담을 위해 연락처를 남겨주세요. 담당자가 빠르게 연락드릴게요!',
  },
  completed: {
    content: '접수 완료됐어요! 담당자가 곧 연락드릴게요.\n더 궁금한 점이 있으신가요?',
    quickReplies: [
      { label: '기타 문의', action: '기타문의', type: 'message', icon: 'message-circle' },
      { label: '상담원 연결', action: '상담원연결', type: 'message', icon: 'headset' },
      { label: '새 문의하기', action: 'reset', type: 'message', icon: 'rotate-ccw' },
    ]
  }
};

// Valid options for each step
export const CLOTHING_TYPES: ClothingType[] = ['티셔츠', '후드티', '맨투맨', '후드집업', '자켓'];
export const QUANTITY_OPTIONS: QuantityOption[] = ['1~20벌', '21~50벌', '50~100벌', '100벌 이상'];
export const DESIGN_TYPES: DesignType[] = ['사진·그래픽', '로고·텍스트'];
export const COLOR_COUNTS: ColorCount[] = ['1색', '2색', '3색', '4색 이상', '그라데이션'];
export const PRINT_LOCATIONS: PrintLocation[] = ['앞/가슴', '등판', '좌측 소매', '우측 소매', '기타'];
export const PRINT_METHOD_CHOICES: PrintMethodChoice[] = ['실크 나염', 'DTF 전사', 'DTG 전사', '자수'];

// Design types that skip the color_count step (continuous-tone → 자동 풀컬러)
export const FULL_COLOR_DESIGN_TYPES: DesignType[] = ['사진·그래픽'];
