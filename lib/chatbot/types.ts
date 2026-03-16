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
  | 'date_picker'        // Interactive date picker input
  | 'priority_selector'  // Interactive priority multi-select
  | 'contact_form';      // Interactive contact info form

// Quick reply button
export interface QuickReply {
  label: string;
  action: string;
  type: 'message' | 'navigate';
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
  };
}

// =========================
// Inquiry Flow Types
// =========================

// Inquiry flow steps
export type InquiryStep =
  | 'welcome'
  | 'clothing_type'    // Q1
  | 'quantity'         // Q2
  | 'priorities'       // Q3
  | 'needed_date'      // Q4
  | 'contact_info'     // Q5
  | 'recommendation'   // Q6
  | 'completed';

// Clothing type options
export type ClothingType = '티셔츠' | '후드티' | '맨투맨' | '후드집업' | '자켓';

// Quantity options
export type QuantityOption = '1~20벌' | '21~50벌' | '50벌 이상';

// Priority options
export type Priority = '빠른 제작' | '퀄리티' | '가격' | '자세한 상담';

// User data collected during inquiry flow
export interface InquiryData {
  clothingType?: ClothingType;
  quantity?: QuantityOption;
  priorities?: Priority[];  // Ordered array of 3
  neededDate?: string | null;  // ISO date string or null for flexible
  neededDateFlexible?: boolean;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
}

// Inquiry flow state
export interface InquiryFlowState {
  currentStep: InquiryStep;
  inquiryData: InquiryData;
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
  created_at: string;
  updated_at: string;
}
