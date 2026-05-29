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

// Category mapping for product search
export const CATEGORY_MAPPING: Record<string, string> = {
  '티셔츠': 't-shirts',
  '후드티': 'hoodie',
  '맨투맨': 'sweatshirt',
  '후드집업': 'hoodie-zip',
  '자켓': 'jacket'
};

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
    content: '몇 벌 정도 생각하세요? 수량에 따라 추천 인쇄방식과 단가가 달라져요.',
    quickReplies: [
      { label: '1~20벌', action: '1~20벌', type: 'message' },
      { label: '21~50벌', action: '21~50벌', type: 'message' },
      { label: '50~100벌', action: '50~100벌', type: 'message' },
      { label: '100벌 이상', action: '100벌 이상', type: 'message' },
    ]
  },
  design_type: {
    content: '옷에 넣으실 디자인은 어떤 형태인가요?',
    quickReplies: [
      { label: '사진·실사', action: '사진·실사', type: 'message' },
      { label: '일러스트·풀그래픽', action: '일러스트·풀그래픽', type: 'message' },
      { label: '로고·심볼·텍스트', action: '로고·텍스트', type: 'message' },
      { label: '아직 없어요 (제작 필요)', action: '디자인 없음', type: 'message' },
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
  print_location: {
    content: '어디에 인쇄하실 건가요? 여러 곳 선택할 수 있어요.',
  },
  print_method: {
    content: '인쇄방식을 선택해주세요. 고객님 조건에 맞는 방식엔 추천 표시를 해 두었어요. 선택 후 다음을 눌러주세요.',
  },
  needed_date: {
    content: '언제까지 받아보셔야 하나요?',
  },
  priorities: {
    content: '마지막으로, 가장 중요한 것을 순서대로 골라주세요! (최대 3개)',
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
export const DESIGN_TYPES: DesignType[] = ['사진·실사', '일러스트·풀그래픽', '로고·텍스트', '디자인 없음'];
export const COLOR_COUNTS: ColorCount[] = ['1색', '2색', '3색', '4색 이상', '그라데이션'];
export const PRINT_LOCATIONS: PrintLocation[] = ['앞/가슴', '등판', '좌측 소매', '우측 소매', '기타'];
export const PRINT_METHOD_CHOICES: PrintMethodChoice[] = ['실크 나염', 'DTF 전사', 'DTG 전사', '자수'];

// Design types that skip the color_count step (continuous-tone → 자동 풀컬러)
export const FULL_COLOR_DESIGN_TYPES: DesignType[] = ['사진·실사', '일러스트·풀그래픽'];
