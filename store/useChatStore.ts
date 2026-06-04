import { create } from 'zustand';
import { ChatMessage, QuickReply, InquiryFlowState, InquiryStep, InquiryData } from '@/lib/chatbot/types';
import { WELCOME_MESSAGE_CONTENT, WELCOME_QUICK_REPLIES } from '@/lib/chatbot/config';

const INITIAL_INQUIRY_STATE: InquiryFlowState = {
  currentStep: 'welcome',
  inquiryData: {},
  history: [],
  inquiryId: undefined,
  isSubmitting: false,
  error: undefined
};

interface ChatState {
  // UI State
  isOpen: boolean;

  // Messages (session-only, not persisted)
  messages: ChatMessage[];

  // Input state
  inputValue: string;
  isTyping: boolean;

  // Inquiry flow state
  inquiryFlow: InquiryFlowState;

  // Actions
  toggleChat: () => void;
  openChat: () => void;
  closeChat: () => void;

  addMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => void;
  setInputValue: (value: string) => void;
  setIsTyping: (typing: boolean) => void;
  clearMessages: () => void;

  addQuickRepliesToLastMessage: (quickReplies: QuickReply[]) => void;

  // Inquiry flow actions
  setInquiryStep: (step: InquiryStep) => void;
  goBackStep: () => InquiryStep | null;
  updateInquiryData: (data: Partial<InquiryData>) => void;
  setInquiryId: (id: string) => void;
  setIsSubmitting: (submitting: boolean) => void;
  setInquiryError: (error: string | undefined) => void;
  resetInquiryFlow: () => void;

  // Initialize chat without opening the floating widget
  initializeChat: () => void;
}

// 첫 화면 = 의류 종류 선택(clothing_type) + 기타 문의 버튼.
// 과거의 'menu'("무엇을 도와드릴까요?") 단계를 흡수해 한 번 더 누르는 단계를 없앴다.
const WELCOME_MESSAGE: ChatMessage = {
  id: 'welcome',
  sender: 'bot',
  content: WELCOME_MESSAGE_CONTENT,
  contentType: 'inquiry_step',
  timestamp: Date.now(),
  metadata: {
    inquiryStep: 'clothing_type',
    quickReplies: WELCOME_QUICK_REPLIES,
  }
};

export const useChatStore = create<ChatState>((set, get) => ({
  // Initial state
  isOpen: false,
  messages: [],
  inputValue: '',
  isTyping: false,
  inquiryFlow: INITIAL_INQUIRY_STATE,

  // UI Actions
  toggleChat: () => set((state) => ({
    isOpen: !state.isOpen
  })),

  openChat: () => {
    const state = get();
    // Add welcome message if first open
    if (state.messages.length === 0) {
      set({
        isOpen: true,
        messages: [{
          ...WELCOME_MESSAGE,
          timestamp: Date.now()
        }],
        inquiryFlow: {
          ...INITIAL_INQUIRY_STATE,
          currentStep: 'clothing_type'
        }
      });
    } else {
      set({ isOpen: true });
    }
  },

  closeChat: () => set({ isOpen: false }),

  addMessage: (message) => set((state) => ({
    messages: [
      ...state.messages,
      {
        ...message,
        id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
        timestamp: Date.now(),
      }
    ]
  })),

  setInputValue: (value) => set({ inputValue: value }),
  setIsTyping: (typing) => set({ isTyping: typing }),
  clearMessages: () => set({ messages: [] }),

  addQuickRepliesToLastMessage: (quickReplies) => set((state) => {
    const messages = [...state.messages];
    const lastBotMessageIndex = messages.findLastIndex(m => m.sender === 'bot');
    if (lastBotMessageIndex !== -1) {
      messages[lastBotMessageIndex] = {
        ...messages[lastBotMessageIndex],
        metadata: {
          ...messages[lastBotMessageIndex].metadata,
          quickReplies
        }
      };
    }
    return { messages };
  }),

  // Inquiry flow actions — advancing pushes the current step onto history
  setInquiryStep: (step) => set((state) => ({
    inquiryFlow: {
      ...state.inquiryFlow,
      currentStep: step,
      history: [...state.inquiryFlow.history, state.inquiryFlow.currentStep]
    }
  })),

  // 이전 단계로: history에서 pop, currentStep 복원. 복원된 step 반환(없으면 null).
  goBackStep: () => {
    const { inquiryFlow } = get();
    if (inquiryFlow.history.length === 0) return null;
    const prev = inquiryFlow.history[inquiryFlow.history.length - 1];
    set({
      inquiryFlow: {
        ...inquiryFlow,
        currentStep: prev,
        history: inquiryFlow.history.slice(0, -1)
      }
    });
    return prev;
  },

  updateInquiryData: (data) => set((state) => ({
    inquiryFlow: {
      ...state.inquiryFlow,
      inquiryData: {
        ...state.inquiryFlow.inquiryData,
        ...data
      }
    }
  })),

  setInquiryId: (id) => set((state) => ({
    inquiryFlow: {
      ...state.inquiryFlow,
      inquiryId: id
    }
  })),

  setIsSubmitting: (submitting) => set((state) => ({
    inquiryFlow: {
      ...state.inquiryFlow,
      isSubmitting: submitting
    }
  })),

  setInquiryError: (error) => set((state) => ({
    inquiryFlow: {
      ...state.inquiryFlow,
      error
    }
  })),

  resetInquiryFlow: () => set({
    inquiryFlow: INITIAL_INQUIRY_STATE,
    messages: []
  }),

  // Initialize chat without opening the floating widget (for dedicated chat page)
  initializeChat: () => {
    const state = get();
    if (state.messages.length === 0) {
      set({
        messages: [{
          ...WELCOME_MESSAGE,
          timestamp: Date.now()
        }],
        inquiryFlow: {
          ...INITIAL_INQUIRY_STATE,
          currentStep: 'clothing_type'
        }
      });
    }
  },
}));
