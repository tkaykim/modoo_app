// Message sender types
export type MessageSender = 'user' | 'bot';

// Message content types for rich responses
export type MessageContentType =
  | 'text'
  | 'products'
  | 'pricing'
  | 'navigation'
  | 'quick_replies'
  | 'login_prompt'
  | 'inquiry_step'
  | 'date_picker'         // Interactive date picker input
  | 'priority_selector'   // Interactive priority multi-select
  | 'contact_form'        // Interactive contact info form
  | 'location_selector'   // Print location multi-select
  | 'print_method'        // Print method picker with recommendation + guide
  | 'recommendation_card'; // Final recommendation + estimated price card

// Quick reply button
export interface QuickReply {
  label: string;
  action: string;
  type: 'message' | 'navigate';
  icon?: string; // lucide icon name (kebab) — 대화 버튼에 이모지 대신 아이콘
}

// Lightweight product for chat display
export interface ProductPreview {
  id: string;
  title: string;
  base_price: number;
  thumbnail_image_link: string[] | null;
  category: string | null;
}

// Pricing data structure
export interface PricingData {
  method: string;
  methodKorean: string;
  sizes: {
    size: string;
    price: string;
    note?: string;
  }[];
}

// Single chat message
export interface ChatMessage {
  id: string;
  sender: MessageSender;
  content: string;
  contentType: MessageContentType;
  timestamp: number;
  metadata?: {
    products?: ProductPreview[];
    pricingData?: PricingData;
    navigationRoute?: string;
    quickReplies?: QuickReply[];
    inquiryStep?: InquiryStep;  // For rendering step-specific UI
    recommendedMethod?: PrintMethodChoice;  // For print_method picker default highlight
    methodQuotes?: MethodQuoteLite[];        // For print_method picker per-method 실가격 칩
    recommendation?: RecommendationResult;   // For recommendation_card display
  };
}

// 인쇄방식 피커에 표시할 방식별 실가격 요약 (고객앱 단가 기반)
export interface MethodQuoteLite {
  method: PrintMethodChoice;
  unit: number | null;        // 1벌당 (장당)
  total: number | null;       // 총 인쇄비
  eligible: boolean;          // 디자인 제약상 가능 여부
  cheapest: boolean;          // 이 수량 최저가
  thresholdNote?: string | null; // "15벌 이상 유리" (bulk만)
}

// Recommendation + estimate result attached to a recommendation_card message
export interface RecommendationResult {
  method: PrintMethodChoice;
  methodReason: string;
  unitPrice: number | null;   // 1벌당 예상 인쇄비 (null = 미설정/담당자 안내)
  totalPrice: number | null;  // 총 예상 인쇄비
  quantity: number;           // 견적 기준 수량 (구간 대표값)
  savingsNote?: string | null; // "DTF보다 N원 절약" 등
  disclaimer?: string;
}

// =========================
// Inquiry Flow Types
// =========================

// Inquiry flow steps
export type InquiryStep =
  | 'welcome'
  | 'menu'             // 최상위 분기: 제작상담 / 기타문의
  | 'faq'              // 기타문의 FAQ
  | 'clothing_type'    // Q1 의류 종류
  | 'quantity'         // Q2 수량
  | 'design_type'      // Q3 디자인 종류
  | 'color_count'      // Q4 색상 수 (로고·텍스트일 때만)
  | 'print_location'   // Q5 인쇄 위치 (복수)
  | 'print_method'     // Q6 인쇄방식 (추천 뱃지)
  | 'needed_date'      // Q7 필요 날짜
  | 'priorities'       // Q8 우선순위
  | 'recommendation'   // Q9 추천 + 예상견적 카드
  | 'contact_info'     // Q10 연락처
  | 'completed';

// Clothing type options
export type ClothingType = '티셔츠' | '후드티' | '맨투맨' | '후드집업' | '자켓';

// Quantity options (4 tiers — 대량 나염 단가 구간을 살리기 위해 세분)
export type QuantityOption = '1~20벌' | '21~50벌' | '50~100벌' | '100벌 이상';

// Priority options
export type Priority = '빠른 제작' | '퀄리티' | '가격' | '자세한 상담';

// Design type — drives print method recommendation
export type DesignType = '사진·실사' | '일러스트·풀그래픽' | '로고·텍스트' | '디자인 없음';

// Color count (로고·텍스트일 때만). 그라데이션은 디지털 인쇄 필요 신호.
export type ColorCount = '1색' | '2색' | '3색' | '4색 이상' | '그라데이션';

// Print location (복수 선택)
export type PrintLocation = '앞/가슴' | '등판' | '좌측 소매' | '우측 소매' | '기타';

// Print method choice (customer-facing labels)
export type PrintMethodChoice = '실크 나염' | 'DTF 전사' | 'DTG 전사' | '자수';

// User data collected during inquiry flow
export interface InquiryData {
  clothingType?: ClothingType;
  quantity?: QuantityOption;
  designType?: DesignType;
  colorCount?: ColorCount;        // undefined when 사진/풀그래픽 (auto 풀컬러)
  printLocations?: PrintLocation[];
  printMethod?: PrintMethodChoice;
  priorities?: Priority[];  // Ordered array of up to 3
  neededDate?: string | null;  // ISO date string or null for flexible
  neededDateFlexible?: boolean;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  consultRequested?: boolean;     // "상담원과 통화할래요" 선택 시
  // Recommendation snapshot (what the customer was shown)
  recommendedPrintMethod?: PrintMethodChoice;
  estimatedPriceMin?: number | null;
  estimatedPriceMax?: number | null;
  recommendedProductIds?: string[];
}

// Inquiry flow state
export interface InquiryFlowState {
  currentStep: InquiryStep;
  inquiryData: InquiryData;
  history: InquiryStep[];  // 이전 단계 네비게이션용 스택
  inquiryId?: string;  // Set after saving to DB
  isSubmitting?: boolean;
  error?: string;
}

// API response for inquiry submission
export interface InquirySubmitResponse {
  success: boolean;
  inquiry?: {
    id: string;
    created_at: string;
  };
  error?: string;
}

// Chatbot inquiry record from database
export interface ChatbotInquiry {
  id: string;
  clothing_type: string;
  quantity: number;
  priorities: string[];
  needed_date: string | null;
  needed_date_flexible: boolean;
  contact_name: string;
  contact_email: string | null;
  contact_phone: string;
  status: 'pending' | 'contacted' | 'completed' | 'cancelled';
  admin_notes: string | null;
  // Design + print details (added for smart chatbot)
  design_type: string | null;
  color_count: string | null;
  print_locations: string[] | null;
  print_method: string | null;
  recommended_print_method: string | null;
  estimated_price_min: number | null;
  estimated_price_max: number | null;
  recommended_product_ids: string[] | null;
  created_at: string;
  updated_at: string;
}
