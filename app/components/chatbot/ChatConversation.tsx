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

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { X, ArrowLeft, Home } from 'lucide-react';
import { useChatStore } from '@/store/useChatStore';
import { useAuthStore } from '@/store/useAuthStore';
import { trackChatbotStep } from '@/lib/gtm-events';
import {
  QuickReply,
  InquiryStep,
  ClothingType,
  DesignType,
  ColorCount,
  DesignSizeCounts,
  PrintMethodChoice,
  Priority,
} from '@/lib/chatbot/types';
import {
  STEP_MESSAGES,
  CATEGORY_MAPPING,
  CLOTHING_TYPES,
  DESIGN_TYPES,
  COLOR_COUNTS,
  FULL_COLOR_DESIGN_TYPES,
} from '@/lib/chatbot/config';
import { FAQ_ITEMS, fetchChatbotFaqs, type FaqItem } from '@/lib/chatbot/faq';
import { recommendProducts } from '@/lib/chatbot/productSearch';
import {
  computeMethodQuotes,
  buildRecommendation,
  recommendPrintMethodHeuristic,
} from '@/lib/chatbot/recommend';
import MessageList from './MessageList';

type Variant = 'floating' | 'fullscreen';

// 인쇄방식 단계 안내문 (실제 추천 방식을 언급). 줄바꿈으로 가독성 확보.
function printMethodPrompt(recommended: PrintMethodChoice): string {
  return `답변 주신 내용을 토대로\n가장 적합한 '${recommended}' 방식을 추천드려요!\n\n변경을 원하시면 선택 후 다음을 눌러주세요.`;
}

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

  // 챗봇 FAQ는 faqs 테이블(show_in_chatbot=true)에서 로드 (단일 출처). 로딩 전/실패 시 FAQ_ITEMS 폴백.
  const [chatbotFaqs, setChatbotFaqs] = useState<FaqItem[]>(FAQ_ITEMS);
  useEffect(() => {
    fetchChatbotFaqs().then(setChatbotFaqs).catch(() => {});
  }, []);

  // 챗봇 진입(상담창 열림) — 퍼널 1단계. 마운트 1회.
  useEffect(() => {
    trackChatbotStep('open');
  }, []);

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
      | 'design_size_input'
      | 'quantity_input' = 'inquiry_step';
    if (products) {
      contentType = 'products';
    } else if (step === 'quantity') {
      contentType = 'quantity_input';
    } else if (step === 'needed_date') {
      contentType = 'date_picker';
    } else if (step === 'priorities') {
      contentType = 'priority_selector';
    } else if (step === 'contact_info') {
      contentType = 'contact_form';
    } else if (step === 'print_location') {
      contentType = 'design_size_input';
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
    ...chatbotFaqs.map((f) => ({ label: f.question, action: f.question, type: 'message' as const })),
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

  const showFaqAnswer = (item: FaqItem) => {
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
    trackChatbotStep('start');
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
        quantityExact: inquiryData.quantityExact,
        designSizes: inquiryData.designSizes,
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
        content: `${prefix}\n\n${printMethodPrompt(recommended)}`,
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

  // Fetch recommended products: 카테고리 + 선호 방향 기반 랭킹 + 로테이션
  // (priorities는 setState 직후 closure가 stale일 수 있어 인자로 받음)
  const fetchRecommendations = async (preference?: Priority) => {
    const { inquiryData } = inquiryFlow;
    const category = inquiryData.clothingType ? CATEGORY_MAPPING[inquiryData.clothingType] : undefined;
    try {
      return await recommendProducts({ category, preference, limit: 3 });
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
        const item = chatbotFaqs.find((f) => f.question === text);
        if (item) showFaqAnswer(item);
        else showFaqMenu('아래에서 골라주세요!');
        break;
      }

      case 'clothing_type':
        if (CLOTHING_TYPES.includes(text as ClothingType)) {
          trackChatbotStep('clothing', { clothing: text });
          updateInquiryData({ clothingType: text as ClothingType });
          setInquiryStep('quantity');
          addBotMessage('quantity', `${text} 좋은 선택이세요!`);
        } else {
          addBotMessage('clothing_type', '아래 옵션 중에서 선택해주세요.');
        }
        break;

      case 'quantity':
        // 수량은 QuantityInputBubble(handleQuantitySubmit)에서 처리
        break;

      case 'design_type':
        if (DESIGN_TYPES.includes(text as DesignType)) {
          const designType = text as DesignType;
          trackChatbotStep('design_type', { design: designType });
          updateInquiryData({ designType });
          if (FULL_COLOR_DESIGN_TYPES.includes(designType)) {
            setInquiryStep('print_location');
            addBotMessage('print_location', '다양한 색상 디자인이군요! 색상 질문은 건너뛸게요.');
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
          trackChatbotStep('color', { color: text });
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
    trackChatbotStep('product_click');
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

  // 수량 직접 입력 → design_type
  const handleQuantitySubmit = async (qty: number) => {
    if (isTyping) return;
    trackChatbotStep('quantity');
    addMessage({ sender: 'user', content: `${qty}벌 정도`, contentType: 'text' });
    setIsTyping(true);
    await delay(400);
    updateInquiryData({ quantityExact: qty });
    setInquiryStep('design_type');
    const ack = qty >= 50 ? '대량이면 장당 단가가 확 좋아져요!' : '소량도 얼마든지 가능해요!';
    addBotMessage('design_type', ack);
    setIsTyping(false);
  };

  // 크기별 디자인 개수 입력됨 → 실가격 로드 후 인쇄방식 피커
  const handleDesignSizeSubmit = async (counts: DesignSizeCounts) => {
    if (isTyping) return;
    trackChatbotStep('size');

    const summary = [
      counts['10x10'] > 0 ? `작은 ${counts['10x10']}개` : '',
      counts.A4 > 0 ? `중간 ${counts.A4}개` : '',
      counts.A3 > 0 ? `큰 ${counts.A3}개` : '',
    ].filter(Boolean).join(', ');
    addMessage({ sender: 'user', content: `디자인: ${summary}`, contentType: 'text' });

    setIsTyping(true);
    await delay(300);

    const { inquiryData } = inquiryFlow;
    updateInquiryData({ designSizes: counts });

    const input = {
      designType: inquiryData.designType,
      colorCount: inquiryData.colorCount,
      quantity: inquiryData.quantity,
      quantityExact: inquiryData.quantityExact,
      designSizes: counts,
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
      content: printMethodPrompt(recommended),
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
    trackChatbotStep('method', { method });

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
    trackChatbotStep('date');

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
    trackChatbotStep('priority', { priority: priorities[0] || '' });

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
        quantityExact: inquiryData.quantityExact,
        designSizes: inquiryData.designSizes,
        priorities,
        chosenMethod: inquiryData.printMethod,
      });
    } catch {
      recommendation = {
        method: inquiryData.printMethod ?? recommendPrintMethodHeuristic({ designType: inquiryData.designType, colorCount: inquiryData.colorCount, quantity: inquiryData.quantity, quantityExact: inquiryData.quantityExact }),
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

    const products = await fetchRecommendations(priorities[0]);
    updateInquiryData({ recommendedProductIds: products.map((p) => p.id) });

    trackChatbotStep('recommendation', { method: recommendation.method });
    setInquiryStep('recommendation');
    addMessage({
      sender: 'bot',
      content: STEP_MESSAGES.recommendation.content,
      contentType: 'recommendation_card',
      metadata: { inquiryStep: 'recommendation', recommendation, products },
    });

    setIsTyping(false);
  };

  const handleConsult = async (productId?: string) => {
    if (isTyping) return;
    trackChatbotStep('consult_click');
    setIsTyping(true);
    await delay(300);
    // 선택한 제품이 있으면 문의에 함께 연결 (상담 원활)
    updateInquiryData({ consultRequested: true, ...(productId ? { selectedProductId: productId } : {}) });
    setInquiryStep('contact_info');
    addBotMessage(
      'contact_info',
      productId
        ? '선택하신 제품으로 상담 도와드릴게요! 연락처를 남겨주시면 빠르게 연락드릴게요.'
        : '담당자와 바로 연결해 드릴게요! 연락처를 남겨주시면 빠르게 연락드릴게요.',
    );
    setIsTyping(false);
  };

  // Contact form submitted → submit inquiry
  const handleContactSubmit = async (name: string, email: string, phone: string, fileUrls: string[] = []) => {
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
          quantity: inquiryData.quantity ?? null,
          quantityExact: inquiryData.quantityExact ?? null,
          priorities: inquiryData.priorities ?? [],
          designType: inquiryData.designType || null,
          colorCount: inquiryData.colorCount || null,
          designSizes: inquiryData.designSizes || null,
          printMethod: inquiryData.printMethod || null,
          recommendedPrintMethod: inquiryData.recommendedPrintMethod || null,
          estimatedPriceMin: inquiryData.estimatedPriceMin ?? null,
          estimatedPriceMax: inquiryData.estimatedPriceMax ?? null,
          recommendedProductIds: inquiryData.selectedProductId
            ? [inquiryData.selectedProductId]
            : (inquiryData.recommendedProductIds || null),
          neededDate: inquiryData.neededDate || null,
          neededDateFlexible: inquiryData.neededDateFlexible ?? false,
          contactName: name,
          contactEmail: contactEmail || null,
          contactPhone: phone,
          fileUrls: fileUrls ?? [],
          consultRequested: inquiryData.consultRequested ?? false,
          userId: useAuthStore.getState().user?.id ?? null,
        }),
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to submit inquiry');
      }

      trackChatbotStep('submitted');
      setInquiryId(result.inquiry.id);
      setInquiryStep('completed');

      const topProductId = inquiryData.recommendedProductIds?.[0];
      const loggedIn = !!useAuthStore.getState().user?.id;
      // 완료 CTA: (있으면) 추천상품 디자인 시작 + 내 문의 보기 + 새 문의
      const completedReplies: QuickReply[] = [
        ...(topProductId
          ? [{ label: '추천 상품으로 디자인 시작하기', action: `/editor/${topProductId}`, type: 'navigate' as const, icon: 'palette' }]
          : []),
        {
          label: loggedIn ? '내 문의 보기' : '문의 내역 조회',
          action: loggedIn ? '/inquiries?tab=my' : '/inquiries',
          type: 'navigate' as const,
          icon: 'message-circle',
        },
        { label: '새 문의하기', action: 'reset', type: 'message' as const, icon: 'rotate-ccw' },
      ];
      addMessage({
        sender: 'bot',
        content:
          '상담 신청이 접수되었어요! 담당자가 문의 게시판을 통해 답변드릴 예정이에요.\n'
          + `입력하신 이메일로 접수 확인 메일도 보내드렸어요.${loggedIn ? '' : '\n(문의 내역은 남겨주신 전화번호로 조회하실 수 있어요.)'}`
          + (topProductId ? '\n\n기다리는 동안 추천 상품에 직접 디자인을 올려보실 수 있어요.' : ''),
        contentType: 'inquiry_step',
        metadata: { inquiryStep: 'completed', quickReplies: completedReplies },
      });
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
          onDesignSizeSubmit={handleDesignSizeSubmit}
          onQuantitySubmit={handleQuantitySubmit}
          onMethodSelect={handleMethodSelect}
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
        <div
          className="shrink-0 grid grid-cols-3 items-center px-3 py-4 bg-[#3B55A5] text-white shadow-md"
          style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top, 0px))' }}
        >
          <div className="flex justify-start">
            <button
              onClick={() => router.push('/home')}
              className="p-2 hover:bg-[#2D4280] rounded-full transition-colors"
              aria-label="홈으로"
            >
              <Home className="w-6 h-6" />
            </button>
          </div>
          <div className="text-center leading-tight">
            <h1 className="font-semibold text-lg">모두의 유니폼</h1>
            <p className="text-xs text-blue-200 mt-0.5">맞춤 상품 추천</p>
          </div>
          <div className="flex justify-end">
            <button
              onClick={handleReset}
              className="px-3 py-1.5 text-xs font-medium bg-white/20 hover:bg-white/30 text-white rounded-full transition-all"
            >
              처음으로
            </button>
          </div>
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
