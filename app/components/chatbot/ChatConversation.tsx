'use client';

/**
 * ChatConversation — 챗봇 대화 플로우의 단일 소스 오브 트루스.
 *
 * 플로팅 위젯(ChatWindow)과 전체화면 페이지(/chat)가 동일하게 이 컴포넌트를 쓴다.
 * 과거엔 /chat이 별도 핸들러 사본을 가지고 있어 새 플로우(위치/방식/추천)가 누락되고
 * 동작이 어긋났다. 이제 로직은 여기 한 곳에만 있고, variant로 외곽 chrome만 분기한다.
 *
 *  - variant='floating'  : 우하단 떠 있는 패널 (ChatWindow가 isOpen일 때 렌더)
 *  - variant='fullscreen': /chat 전용 전체화면 (마운트 시 initializeChat)
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { X, ArrowLeft, Home } from 'lucide-react';
import { useChatStore } from '@/store/useChatStore';
import {
  QuickReply,
  InquiryStep,
  ClothingType,
  QuantityOption,
  DesignType,
  ColorCount,
  PrintLocation,
  PrintMethodChoice,
  Priority,
} from '@/lib/chatbot/types';
import {
  STEP_MESSAGES,
  CATEGORY_MAPPING,
  CLOTHING_TYPES,
  QUANTITY_OPTIONS,
  DESIGN_TYPES,
  COLOR_COUNTS,
  FULL_COLOR_DESIGN_TYPES,
} from '@/lib/chatbot/config';
import { FAQ_ITEMS } from '@/lib/chatbot/faq';
import { fetchProductsForRecommendation } from '@/lib/chatbot/productSearch';
import {
  computeMethodQuotes,
  buildRecommendation,
  recommendPrintMethodHeuristic,
} from '@/lib/chatbot/recommend';
import MessageList from './MessageList';

type Variant = 'floating' | 'fullscreen';

interface ChatConversationProps {
  variant: Variant;
}

export default function ChatConversation({ variant }: ChatConversationProps) {
  const router = useRouter();
  const {
    messages,
    isTyping,
    inquiryFlow,
    initializeChat,
    openChat,
    closeChat,
    addMessage,
    setInputValue,
    setIsTyping,
    setInquiryStep,
    goBackStep,
    updateInquiryData,
    setInquiryId,
    setIsSubmitting,
    resetInquiryFlow,
  } = useChatStore();

  const isFullscreen = variant === 'fullscreen';

  // 전체화면 진입 시 환영 메시지 초기화 (플로팅은 런처의 openChat이 담당하므로 불필요)
  useEffect(() => {
    if (isFullscreen && messages.length === 0) {
      initializeChat();
    }
  }, [isFullscreen, messages.length, initializeChat]);

  const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

  // 이전 단계로 돌아갈 수 있는 질문 스텝
  const BACKABLE_STEPS: InquiryStep[] = [
    'clothing_type', 'quantity', 'design_type', 'color_count',
    'print_location', 'print_method', 'needed_date', 'priorities',
  ];

  // Add bot message for a step
  const addBotMessage = (step: InquiryStep, extraContent?: string, products?: unknown[]) => {
    const stepConfig = STEP_MESSAGES[step];
    const content = extraContent ? `${extraContent}\n\n${stepConfig.content}` : stepConfig.content;

    let contentType:
      | 'products'
      | 'inquiry_step'
      | 'date_picker'
      | 'priority_selector'
      | 'contact_form'
      | 'location_selector' = 'inquiry_step';
    if (products) {
      contentType = 'products';
    } else if (step === 'needed_date') {
      contentType = 'date_picker';
    } else if (step === 'priorities') {
      contentType = 'priority_selector';
    } else if (step === 'contact_info') {
      contentType = 'contact_form';
    } else if (step === 'print_location') {
      contentType = 'location_selector';
    }

    addMessage({
      sender: 'bot',
      content,
      contentType,
      metadata: {
        inquiryStep: step,
        quickReplies: stepConfig.quickReplies,
        products: products as never,
      },
    });
  };

  // ── 메뉴/FAQ 헬퍼 ──────────────────────────────
  const faqMenuReplies: QuickReply[] = [
    ...FAQ_ITEMS.map((f) => ({ label: f.question, action: f.question, type: 'message' as const })),
    { label: '제작 상담받기', action: '제작상담', type: 'message' as const, icon: 'palette' },
  ];

  const showFaqMenu = (extra?: string) => {
    setInquiryStep('faq');
    addMessage({
      sender: 'bot',
      content: extra ? `${extra}\n\n${STEP_MESSAGES.faq.content}` : STEP_MESSAGES.faq.content,
      contentType: 'inquiry_step',
      metadata: { inquiryStep: 'faq', quickReplies: faqMenuReplies },
    });
  };

  const showFaqAnswer = (item: (typeof FAQ_ITEMS)[number]) => {
    const followup: QuickReply[] = [
      ...(item.toConsult
        ? [{ label: '제작 상담받기', action: '제작상담', type: 'message' as const, icon: 'palette' }]
        : []),
      { label: '다른 질문', action: '다른질문', type: 'message' as const, icon: 'message-circle' },
      { label: '상담원 연결', action: '상담원연결', type: 'message' as const, icon: 'headset' },
    ];
    addMessage({
      sender: 'bot',
      content: item.answer,
      contentType: 'inquiry_step',
      metadata: { inquiryStep: 'faq', quickReplies: followup },
    });
  };

  const startConsult = () => {
    setInquiryStep('clothing_type');
    addBotMessage('clothing_type', '제작 상담을 시작할게요.');
  };

  // 이전 단계 질문을 다시 보여줌 (back navigation)
  const reAskStep = async (step: InquiryStep) => {
    const prefix = '이전 단계로 돌아왔어요.';
    if (step === 'print_method') {
      const { inquiryData } = inquiryFlow;
      const input = {
        designType: inquiryData.designType,
        colorCount: inquiryData.colorCount,
        quantity: inquiryData.quantity,
        locations: inquiryData.printLocations,
      };
      let methodQuotes;
      let recommended: PrintMethodChoice;
      try {
        methodQuotes = await computeMethodQuotes(input);
        recommended = methodQuotes.find((q) => q.cheapest)?.method ?? recommendPrintMethodHeuristic(input);
      } catch {
        methodQuotes = undefined;
        recommended = recommendPrintMethodHeuristic(input);
      }
      addMessage({
        sender: 'bot',
        content: `${prefix}\n\n${STEP_MESSAGES.print_method.content}`,
        contentType: 'print_method',
        metadata: { inquiryStep: 'print_method', recommendedMethod: recommended, methodQuotes },
      });
      return;
    }
    if (step === 'menu') {
      addBotMessage('menu');
      return;
    }
    addBotMessage(step, prefix);
  };

  const handleBack = async () => {
    if (isTyping) return;
    const target = goBackStep();
    if (!target) return;
    setIsTyping(true);
    await delay(200);
    await reAskStep(target);
    setIsTyping(false);
  };

  const startConsultAgent = () => {
    updateInquiryData({ consultRequested: true });
    setInquiryStep('contact_info');
    addBotMessage('contact_info', '담당자와 바로 연결해 드릴게요! 연락처를 남겨주시면 빠르게 연락드릴게요.');
  };

  // Fetch recommended products based on inquiry data
  const fetchRecommendations = async () => {
    const { inquiryData } = inquiryFlow;
    const category = inquiryData.clothingType ? CATEGORY_MAPPING[inquiryData.clothingType] : undefined;
    try {
      return await fetchProductsForRecommendation({ category, limit: 3 });
    } catch (error) {
      console.error('Error fetching recommendations:', error);
      return [];
    }
  };

  // Handle user response based on current step
  const handleStepResponse = async (text: string) => {
    // 전역 액션 (어느 단계에서나 동작)
    if (text === 'reset' || text === '새 문의하기') {
      handleReset();
      return;
    }
    if (text === '제작상담') {
      startConsult();
      return;
    }
    if (text === '기타문의' || text === '다른질문') {
      showFaqMenu();
      return;
    }
    if (text === '상담원연결') {
      startConsultAgent();
      return;
    }

    const { currentStep } = inquiryFlow;

    switch (currentStep) {
      case 'menu':
        addBotMessage('menu', '아래에서 골라주세요!');
        break;

      case 'faq': {
        const item = FAQ_ITEMS.find((f) => f.question === text);
        if (item) showFaqAnswer(item);
        else showFaqMenu('아래에서 골라주세요!');
        break;
      }

      case 'clothing_type':
        if (CLOTHING_TYPES.includes(text as ClothingType)) {
          updateInquiryData({ clothingType: text as ClothingType });
          setInquiryStep('quantity');
          addBotMessage('quantity', `${text} 좋은 선택이세요!`);
        } else {
          addBotMessage('clothing_type', '아래 옵션 중에서 선택해주세요.');
        }
        break;

      case 'quantity':
        if (QUANTITY_OPTIONS.includes(text as QuantityOption)) {
          updateInquiryData({ quantity: text as QuantityOption });
          setInquiryStep('design_type');
          const ack = text === '100벌 이상' || text === '50~100벌'
            ? '대량이면 장당 단가가 확 좋아져요!'
            : '소량도 얼마든지 가능해요!';
          addBotMessage('design_type', ack);
        } else {
          addBotMessage('quantity', '아래 옵션 중에서 선택해주세요.');
        }
        break;

      case 'design_type':
        if (DESIGN_TYPES.includes(text as DesignType)) {
          const designType = text as DesignType;
          updateInquiryData({ designType });
          if (FULL_COLOR_DESIGN_TYPES.includes(designType)) {
            setInquiryStep('print_location');
            addBotMessage('print_location', '풀컬러 디자인이군요! 색상 질문은 건너뛸게요.');
          } else if (designType === '디자인 없음') {
            setInquiryStep('print_location');
            addBotMessage('print_location', '디자인 제작도 저희가 도와드릴 수 있어요! 우선 인쇄할 위치를 알려주세요.');
          } else {
            setInquiryStep('color_count');
            addBotMessage('color_count');
          }
        } else {
          addBotMessage('design_type', '아래 옵션 중에서 선택해주세요.');
        }
        break;

      case 'color_count':
        if (COLOR_COUNTS.includes(text as ColorCount)) {
          updateInquiryData({ colorCount: text as ColorCount });
          setInquiryStep('print_location');
          addBotMessage('print_location', `${text} 확인했어요!`);
        } else {
          addBotMessage('color_count', '아래 옵션 중에서 선택해주세요.');
        }
        break;

      default:
        // print_location / print_method / needed_date / priorities / recommendation / contact_info
        // 은 전용 버블 콜백에서 처리.
        break;
    }
  };

  const handleQuickReplyClick = (reply: QuickReply) => {
    if (reply.type === 'navigate') {
      router.push(reply.action);
      if (variant === 'floating') closeChat();
    } else {
      setInputValue(reply.action);
      setTimeout(() => {
        handleSendFromQuickReply(reply.action);
      }, 100);
    }
  };

  const handleSendFromQuickReply = async (text: string) => {
    if (isTyping) return;

    addMessage({ sender: 'user', content: text, contentType: 'text' });
    setInputValue('');
    setIsTyping(true);

    await delay(500);

    try {
      await handleStepResponse(text);
    } catch (error) {
      console.error('Error processing message:', error);
      addMessage({
        sender: 'bot',
        content: '죄송해요, 오류가 발생했어요. 다시 시도해 주세요.',
        contentType: 'text',
      });
    } finally {
      setIsTyping(false);
    }
  };

  const handleProductClick = (productId: string) => {
    router.push(`/editor/${productId}`);
    if (variant === 'floating') closeChat();
  };

  const handleReset = () => {
    setIsTyping(false);
    resetInquiryFlow();
    if (variant === 'floating') {
      closeChat();
      setTimeout(() => openChat(), 100);
    } else {
      setTimeout(() => initializeChat(), 100);
    }
  };

  // Print location multi-select submitted → 실가격 로드 후 인쇄방식 피커
  const handleLocationSubmit = async (locations: PrintLocation[]) => {
    if (isTyping) return;

    setIsTyping(true);
    await delay(300);

    const { inquiryData } = inquiryFlow;
    updateInquiryData({ printLocations: locations });

    const input = {
      designType: inquiryData.designType,
      colorCount: inquiryData.colorCount,
      quantity: inquiryData.quantity,
      locations,
    };

    let methodQuotes;
    let recommended: PrintMethodChoice;
    try {
      methodQuotes = await computeMethodQuotes(input);
      recommended = methodQuotes.find((q) => q.cheapest)?.method ?? recommendPrintMethodHeuristic(input);
    } catch {
      methodQuotes = undefined;
      recommended = recommendPrintMethodHeuristic(input);
    }
    updateInquiryData({ recommendedPrintMethod: recommended });

    setInquiryStep('print_method');
    addMessage({
      sender: 'bot',
      content: `인쇄 위치: ${locations.join(', ')}\n\n${STEP_MESSAGES.print_method.content}`,
      contentType: 'print_method',
      metadata: {
        inquiryStep: 'print_method',
        recommendedMethod: recommended,
        methodQuotes,
      },
    });

    setIsTyping(false);
  };

  // Print method selected
  const handleMethodSelect = async (method: PrintMethodChoice) => {
    if (isTyping) return;

    addMessage({ sender: 'user', content: method, contentType: 'text' });
    setIsTyping(true);
    await delay(400);

    updateInquiryData({ printMethod: method });
    setInquiryStep('needed_date');
    addBotMessage('needed_date', `${method} 좋아요!`);

    setIsTyping(false);
  };

  // Date submitted → priorities
  const handleDateSubmit = async (date: string | null, flexible: boolean) => {
    if (isTyping) return;

    setIsTyping(true);
    await delay(300);

    updateInquiryData({ neededDate: date, neededDateFlexible: flexible });
    setInquiryStep('priorities');
    const dateDisplay = flexible ? '크게 상관 없음' : date;
    addBotMessage('priorities', `날짜: ${dateDisplay}`);

    setIsTyping(false);
  };

  // Priorities submitted → 실가격 추천 카드
  const handlePrioritiesSubmit = async (priorities: Priority[]) => {
    if (isTyping) return;

    setIsTyping(true);
    await delay(400);

    const { inquiryData } = inquiryFlow;
    updateInquiryData({ priorities });

    let recommendation;
    try {
      recommendation = await buildRecommendation({
        designType: inquiryData.designType,
        colorCount: inquiryData.colorCount,
        quantity: inquiryData.quantity,
        locations: inquiryData.printLocations,
        priorities,
        chosenMethod: inquiryData.printMethod,
      });
    } catch {
      recommendation = {
        method: inquiryData.printMethod ?? recommendPrintMethodHeuristic({ designType: inquiryData.designType, colorCount: inquiryData.colorCount, quantity: inquiryData.quantity }),
        methodReason: '조건에 맞춰 추천드린 방식이에요.',
        unitPrice: null,
        totalPrice: null,
        quantity: 0,
        disclaimer: '정확한 단가는 담당자가 안내드려요.',
      };
    }

    updateInquiryData({
      estimatedPriceMin: recommendation.unitPrice,
      estimatedPriceMax: recommendation.unitPrice,
    });

    const products = await fetchRecommendations();
    updateInquiryData({ recommendedProductIds: products.map((p) => p.id) });

    setInquiryStep('recommendation');
    addMessage({
      sender: 'bot',
      content: STEP_MESSAGES.recommendation.content,
      contentType: 'recommendation_card',
      metadata: { inquiryStep: 'recommendation', recommendation, products },
    });

    setIsTyping(false);
  };

  const handleRecommendationContinue = async () => {
    if (isTyping) return;
    setIsTyping(true);
    await delay(300);
    setInquiryStep('contact_info');
    addBotMessage('contact_info');
    setIsTyping(false);
  };

  const handleConsult = async () => {
    if (isTyping) return;
    setIsTyping(true);
    await delay(300);
    updateInquiryData({ consultRequested: true });
    setInquiryStep('contact_info');
    addBotMessage('contact_info', '담당자와 바로 연결해 드릴게요! 연락처를 남겨주시면 빠르게 연락드릴게요.');
    setIsTyping(false);
  };

  // Contact form submitted → submit inquiry
  const handleContactSubmit = async (name: string, email: string, phone: string) => {
    if (isTyping || inquiryFlow.isSubmitting) return;

    setIsTyping(true);
    const contactEmail = email || undefined;
    updateInquiryData({ contactName: name, contactEmail, contactPhone: phone });

    addMessage({ sender: 'bot', content: `${name}님, 문의를 접수 중입니다...`, contentType: 'text' });

    try {
      setIsSubmitting(true);
      const { inquiryData } = inquiryFlow;

      const response = await fetch('/api/chatbot/inquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clothingType: inquiryData.clothingType ?? '미지정',
          quantity: inquiryData.quantity ?? '1~20벌',
          priorities: inquiryData.priorities ?? [],
          designType: inquiryData.designType || null,
          colorCount: inquiryData.colorCount || null,
          printLocations: inquiryData.printLocations || null,
          printMethod: inquiryData.printMethod || null,
          recommendedPrintMethod: inquiryData.recommendedPrintMethod || null,
          estimatedPriceMin: inquiryData.estimatedPriceMin ?? null,
          estimatedPriceMax: inquiryData.estimatedPriceMax ?? null,
          recommendedProductIds: inquiryData.recommendedProductIds || null,
          neededDate: inquiryData.neededDate || null,
          neededDateFlexible: inquiryData.neededDateFlexible ?? false,
          contactName: name,
          contactEmail: contactEmail || null,
          contactPhone: phone,
          consultRequested: inquiryData.consultRequested ?? false,
        }),
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to submit inquiry');
      }

      setInquiryId(result.inquiry.id);
      setInquiryStep('completed');
      addBotMessage('completed', '문의가 접수되었습니다! 담당자가 빠르게 연락드릴게요.');
    } catch (error) {
      console.error('Error submitting inquiry:', error);
      addMessage({
        sender: 'bot',
        content: '죄송합니다. 문의 접수 중 오류가 발생했어요. 다시 시도해주세요.',
        contentType: 'text',
        metadata: {
          quickReplies: [{ label: '새 문의하기', action: 'reset', type: 'message' }],
        },
      });
    } finally {
      setIsSubmitting(false);
      setIsTyping(false);
    }
  };

  // ── 공통 본문 (메시지 리스트 + 이전 단계) ──────────────
  const body = (
    <>
      <div className="flex-1 min-h-0">
        <MessageList
          messages={messages}
          isTyping={isTyping}
          onQuickReplyClick={handleQuickReplyClick}
          onProductClick={handleProductClick}
          onDateSubmit={handleDateSubmit}
          onPrioritiesSubmit={handlePrioritiesSubmit}
          onContactSubmit={handleContactSubmit}
          onLocationSubmit={handleLocationSubmit}
          onMethodSelect={handleMethodSelect}
          onRecommendationContinue={handleRecommendationContinue}
          onConsult={handleConsult}
          designType={inquiryFlow.inquiryData.designType}
          colorCount={inquiryFlow.inquiryData.colorCount}
          isSubmitting={inquiryFlow.isSubmitting}
        />
      </div>

      {BACKABLE_STEPS.includes(inquiryFlow.currentStep) && inquiryFlow.history.length > 0 && (
        <div className="shrink-0 border-t border-gray-100 px-3 py-2 bg-white">
          <button
            onClick={handleBack}
            disabled={isTyping}
            className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-[#3B55A5] transition-colors disabled:opacity-40"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            이전 단계
          </button>
        </div>
      )}
    </>
  );

  if (isFullscreen) {
    return (
      <div className="h-dvh bg-gray-50 flex flex-col overflow-hidden">
        <div className="shrink-0 flex items-center justify-between px-4 py-3 bg-[#3B55A5] text-white shadow-md safe-area-top">
          <button
            onClick={() => router.push('/home')}
            className="p-2 hover:bg-[#2D4280] rounded-full transition-colors"
            aria-label="홈으로"
          >
            <Home className="w-6 h-6" />
          </button>
          <div className="text-center">
            <h1 className="font-semibold text-lg">모두의 유니폼</h1>
            <p className="text-xs text-blue-200">맞춤 상품 추천</p>
          </div>
          <button
            onClick={handleReset}
            className="px-3 py-1.5 text-xs font-medium bg-white/20 hover:bg-white/30 text-white rounded-full transition-all"
          >
            처음으로
          </button>
        </div>
        {body}
      </div>
    );
  }

  // floating
  return (
    <div className="fixed bottom-24 right-4 md:bottom-8 md:right-24 z-[9998] w-[calc(100vw-2rem)] max-w-[380px] h-[70vh] md:h-[500px] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-gray-200">
      <div className="flex items-center justify-between px-4 py-3 bg-[#3B55A5] text-white">
        <div>
          <h3 className="font-semibold">모두의 유니폼</h3>
          <p className="text-xs text-blue-200">맞춤 상품 추천</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleReset}
            className="px-3 py-1.5 text-xs font-medium bg-white/20 hover:bg-white/30 text-white rounded-full transition-all"
          >
            처음으로
          </button>
          <button
            onClick={closeChat}
            className="p-1 hover:bg-[#2D4280] rounded-full transition-colors"
            aria-label="채팅 닫기"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
      {body}
    </div>
  );
}
