'use client'

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Script from 'next/script';
import {
  ArrowLeft, ArrowRight, Info, Ruler, X, Users, Calendar, MapPin, Truck,
  Package, User, Mail, Phone, CheckCircle2, CreditCard, Plus, Minus, Trash2, Search, Check
} from 'lucide-react';
import { addParticipant, getCoBuySessionByToken } from '@/lib/cobuyService';
import Header from '@/app/components/Header';
import { CoBuySessionWithDetails, Product, ProductConfig, SavedDesignScreenshot, CoBuySelectedItem, CoBuyDeliveryMethod, CoBuyDeliveryInfo, CoBuyCustomField } from '@/types/types';
import { generateCoBuyOrderId } from '@/lib/orderIdUtils';
import CoBuyDesignViewer from '@/app/components/cobuy/CoBuyDesignViewer';
import CoBuyClosedScreen from '@/app/components/cobuy/CoBuyClosedScreen';
import TossPaymentWidget from '@/app/components/toss/TossPaymentWidget';
import { createClient } from '@/lib/supabase-client';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { formatKstDateOnly } from '@/lib/kst';

type DesignWithProduct = SavedDesignScreenshot & { product?: Product };

type Step =
  | 'welcome'
  | 'size-quantity'
  | 'personal-info'
  | 'delivery-method'
  | 'delivery-address'
  | 'custom-fields'
  | 'review'
  | 'payment'
  | 'complete';

const formatDate = (dateString?: string | null) =>
  dateString ? formatKstDateOnly(dateString) : '-';

const formatPrice = (price?: number | null) => {
  if (price === null || price === undefined) return '-';
  return `₩${price.toLocaleString('ko-KR')}`;
};

export default function CoBuySharePage() {
  const params = useParams();
  const rawShareToken = params.shareToken;
  const shareToken = Array.isArray(rawShareToken) ? rawShareToken[0] : (rawShareToken as string);

  // Session state
  const [session, setSession] = useState<CoBuySessionWithDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Step navigation
  const [currentStep, setCurrentStep] = useState<Step>('welcome');
  const [isAnimating, setIsAnimating] = useState(false);
  const [slideDirection, setSlideDirection] = useState<'left' | 'right'>('right');

  // Form state
  const [selectedItems, setSelectedItems] = useState<CoBuySelectedItem[]>([{ size: '', quantity: 1 }]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [deliveryMethod, setDeliveryMethod] = useState<CoBuyDeliveryMethod | null>(null);
  const [deliveryInfo, setDeliveryInfo] = useState<CoBuyDeliveryInfo | null>(null);
  const [fieldResponses, setFieldResponses] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [participantId, setParticipantId] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);

  // UI state
  const [isSizingChartOpen, setIsSizingChartOpen] = useState(false);
  const [isPostcodeScriptLoaded, setIsPostcodeScriptLoaded] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // Fetch session data
  useEffect(() => {
    if (!shareToken) return;

    const fetchSession = async () => {
      setIsLoading(true);
      setFetchError(null);

      const data = await getCoBuySessionByToken(shareToken);
      if (!data) {
        setFetchError('공동구매 정보를 찾을 수 없습니다.');
        setSession(null);
      } else {
        setSession(data);
        // Set default delivery method
        if (!data.delivery_settings?.enabled) {
          setDeliveryMethod('pickup');
        }
      }

      setIsLoading(false);
    };

    fetchSession();
  }, [shareToken]);

  // Real-time subscription
  useEffect(() => {
    if (!session?.id) return;

    const supabase = createClient();

    const channel = supabase
      .channel(`cobuy-session-${session.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'cobuy_sessions',
          filter: `id=eq.${session.id}`,
        },
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          setSession((prev) => {
            if (!prev) return prev;
            const newData = payload.new as Record<string, unknown>;
            return {
              ...prev,
              ...newData,
              saved_design_screenshot: prev.saved_design_screenshot,
              participants: prev.participants,
            };
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session?.id]);

  // Check Daum Postcode script
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).daum?.Postcode) {
      setIsPostcodeScriptLoaded(true);
    }
  }, []);

  // Derived state
  const design = session?.saved_design_screenshot as DesignWithProduct | undefined;
  const product = design?.product;
  const deliverySettings = useMemo(() => session?.delivery_settings || null, [session]);
  const customFields = useMemo(() => (session?.custom_fields || []).filter(f => !f.fixed), [session]);
  const sizeOptions = useMemo(() => {
    if (product?.size_options?.length) return product.size_options;
    // Image-only mode without product: get sizes from custom_fields
    const sizeField = session?.custom_fields?.find(
      (f: CoBuyCustomField) => f.id === 'size' && f.type === 'dropdown'
    );
    if (sizeField?.options?.length) {
      return sizeField.options.map((opt: string) => ({ label: opt }));
    }
    return [];
  }, [product, session?.custom_fields]);
  const currentTotalQuantity = session?.current_total_quantity ?? 0;

  const productConfig: ProductConfig | null = useMemo(() => {
    if (!product?.configuration) return null;
    return {
      productId: product.id,
      sides: product.configuration,
    };
  }, [product]);

  const productColor = useMemo(() => {
    const colorSelections = design?.color_selections as { productColor?: string } | null;
    return colorSelections?.productColor || '#FFFFFF';
  }, [design]);

  // Calculate total quantity
  const getTotalQuantity = () => {
    return selectedItems.reduce((sum, item) => sum + item.quantity, 0);
  };

  const currentPrice = design?.price_per_item ?? 0;
  const deliveryFee = deliveryMethod === 'delivery' ? (deliverySettings?.deliveryFee || 0) : 0;
  const isSurveyMode = session?.payment_mode === 'survey';

  const getItemPrice = (size: string) => {
    if (session?.size_prices && session.size_prices[size] != null) {
      return session.size_prices[size];
    }
    return currentPrice;
  };

  const calcItemsTotal = () => {
    if (session?.size_prices && sizeOptions.length > 0) {
      return selectedItems.reduce((sum, item) => sum + getItemPrice(item.size) * item.quantity, 0);
    }
    return currentPrice * getTotalQuantity();
  };

  const totalAmount = Math.round(calcItemsTotal()) + deliveryFee;

  // Closed reason check
  const closedReason = useMemo(() => {
    if (!session) return null;
    if (session.status === 'cancelled') return 'cancelled' as const;
    if (session.status !== 'gathering') return 'closed' as const;

    const now = new Date();
    const endDate = new Date(session.end_date);
    if (now > endDate) return 'expired' as const;

    if (session.max_participants !== null &&
      session.current_participant_count >= session.max_participants) {
      return 'full' as const;
    }

    return null;
  }, [session]);

  // Build step list dynamically
  const getSteps = (): Step[] => {
    const steps: Step[] = ['welcome'];
    if (sizeOptions.length > 0) {
      steps.push('size-quantity');
    }
    steps.push('personal-info');

    if (deliverySettings?.enabled) {
      steps.push('delivery-method');
      if (deliveryMethod === 'delivery') {
        steps.push('delivery-address');
      }
    }

    if (customFields.length > 0) {
      steps.push('custom-fields');
    }

    steps.push('review');
    steps.push(isSurveyMode ? 'complete' : 'payment');
    return steps;
  };

  const steps = getSteps();
  const currentStepIndex = steps.indexOf(currentStep);
  const progress = ((currentStepIndex + 1) / steps.length) * 100;

  // Navigation handlers
  const handleNext = () => {
    // Validate current step
    if (!validateCurrentStep()) return;

    const nextIndex = currentStepIndex + 1;
    if (nextIndex < steps.length) {
      setSlideDirection('right');
      setIsAnimating(true);
      setTimeout(() => {
        setCurrentStep(steps[nextIndex]);
        setIsAnimating(false);
      }, 150);
    }
  };

  const handleBack = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setSlideDirection('left');
      setIsAnimating(true);
      setTimeout(() => {
        setCurrentStep(steps[prevIndex]);
        setIsAnimating(false);
      }, 150);
    }
  };

  // Validation
  const validateCurrentStep = (): boolean => {
    const newErrors: Record<string, string> = {};

    switch (currentStep) {
      case 'size-quantity':
        selectedItems.forEach((item, index) => {
          if (!item.size) newErrors[`item-${index}-size`] = '사이즈를 선택해주세요';
        });
        break;

      case 'personal-info':
        if (!name.trim()) newErrors.name = '이름을 입력해주세요';
        if (!email.trim()) {
          newErrors.email = '이메일을 입력해주세요';
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          newErrors.email = '올바른 이메일 형식이 아닙니다';
        }
        if (!phone.trim()) {
          newErrors.phone = '전화번호를 입력해주세요';
        }
        break;

      case 'delivery-method':
        if (!deliveryMethod) newErrors.deliveryMethod = '수령 방법을 선택해주세요';
        break;

      case 'delivery-address':
        if (!deliveryInfo?.recipientName?.trim()) newErrors.recipientName = '수령인 이름을 입력해주세요';
        if (!deliveryInfo?.phone?.trim()) newErrors.deliveryPhone = '연락처를 입력해주세요';
        if (!deliveryInfo?.address?.trim()) newErrors.address = '주소를 입력해주세요';
        if (!deliveryInfo?.addressDetail?.trim()) newErrors.addressDetail = '상세 주소를 입력해주세요';
        break;

      case 'custom-fields':
        customFields.forEach(field => {
          if (field.required && (!fieldResponses[field.id] || !fieldResponses[field.id].trim())) {
            newErrors[field.id] = `${field.label}을(를) 입력해주세요`;
          }
        });
        break;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Item handlers
  const handleItemSizeChange = (index: number, size: string) => {
    const newItems = [...selectedItems];
    newItems[index] = { ...newItems[index], size };
    setSelectedItems(newItems);
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[`item-${index}-size`];
      return newErrors;
    });
  };

  const handleItemQuantityChange = (index: number, quantity: number) => {
    const newItems = [...selectedItems];
    newItems[index] = { ...newItems[index], quantity: Math.max(1, quantity) };
    setSelectedItems(newItems);
  };

  const addItem = () => {
    setSelectedItems([...selectedItems, { size: '', quantity: 1 }]);
  };

  const removeItem = (index: number) => {
    if (selectedItems.length <= 1) return;
    setSelectedItems(selectedItems.filter((_, i) => i !== index));
  };

  // Address search
  const handleAddressSearch = () => {
    if (!(window as any).daum?.Postcode) {
      alert('주소 검색 기능을 불러오는 중입니다. 잠시 후 다시 시도해주세요.');
      return;
    }

    new (window as any).daum.Postcode({
      oncomplete: function(data: any) {
        setDeliveryInfo(prev => ({
          recipientName: prev?.recipientName || '',
          phone: prev?.phone || '',
          address: data.roadAddress || data.jibunAddress,
          addressDetail: prev?.addressDetail || '',
          postalCode: data.zonecode,
          memo: prev?.memo || '',
        }));
        setErrors(prev => {
          const newErrors = { ...prev };
          delete newErrors.address;
          delete newErrors.postalCode;
          return newErrors;
        });
      }
    }).open();
  };

  // Submit handler
  const handleSubmit = async () => {
    if (!session) return;

    setIsSubmitting(true);
    setSubmitError(null);

    const participant = await addParticipant({
      sessionId: session.id,
      name,
      email,
      phone,
      fieldResponses,
      selectedSize: selectedItems[0]?.size || '',
      selectedItems,
      deliveryMethod,
      deliveryInfo,
      deliveryFee,
      paymentMode: session.payment_mode,
      estimatedAmount: isSurveyMode ? totalAmount : undefined,
    });

    if (!participant) {
      setSubmitError('참여 정보를 저장하지 못했습니다. 다시 시도해주세요.');
      setIsSubmitting(false);
      return;
    }

    // Notify participant joined
    fetch('/api/cobuy/notify/participant-joined', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: session.id,
        participantId: participant.id,
      }),
    }).catch((error) => console.error('Failed to notify participant joined:', error));

    if (isSurveyMode) {
      setParticipantId(participant.id);
      setIsSubmitting(false);

      setSlideDirection('right');
      setIsAnimating(true);
      setTimeout(() => {
        setCurrentStep('complete');
        setIsAnimating(false);
      }, 150);
      return;
    }

    const generatedOrderId = generateCoBuyOrderId();

    // Store payment context
    try {
      sessionStorage.setItem('pendingCoBuyPayment', JSON.stringify({
        participantId: participant.id,
        sessionId: session.id,
        shareToken,
        orderId: generatedOrderId,
        amount: totalAmount,
      }));
    } catch (error) {
      console.error('Failed to persist CoBuy payment context:', error);
    }

    setParticipantId(participant.id);
    setOrderId(generatedOrderId);
    setIsSubmitting(false);

    // Move to payment step
    setSlideDirection('right');
    setIsAnimating(true);
    setTimeout(() => {
      setCurrentStep('payment');
      setIsAnimating(false);
    }, 150);
  };

  // Render loading/error states
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-[#3B55A5] border-r-transparent mb-4" />
          <p className="text-gray-500">공동구매 정보를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
            <X className="w-8 h-8 text-gray-400" />
          </div>
          <p className="text-gray-600">{fetchError}</p>
        </div>
      </div>
    );
  }

  const cobuyImages = session?.cobuy_image_urls;
  const isImageOnly = !!cobuyImages?.length;

  if (!session || !design || (!productConfig && !isImageOnly)) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <p className="text-gray-500">공동구매 정보를 찾을 수 없습니다.</p>
      </div>
    );
  }

  if (closedReason) {
    return (
      <CoBuyClosedScreen
        reason={closedReason}
        title={session.title}
        endDate={session.end_date}
        maxParticipants={session.max_participants ?? undefined}
        currentCount={session.current_participant_count}
      />
    );
  }

  // Animation class
  const animationClass = isAnimating
    ? slideDirection === 'right' ? 'opacity-0 translate-x-4' : 'opacity-0 -translate-x-4'
    : 'opacity-100 translate-x-0';

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col">
      {/* Daum Postcode Script */}
      {!isPostcodeScriptLoaded && (
        <Script
          src="//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js"
          strategy="lazyOnload"
          onLoad={() => setIsPostcodeScriptLoaded(true)}
        />
      )}

      {/* Header */}
      <header className="shrink-0 border-b border-gray-200 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center justify-between px-4 py-3 md:px-6 md:py-4">
          <div className="flex items-center gap-3 md:gap-4">
            <div>
              <h1 className="text-base md:text-lg font-bold text-gray-900 line-clamp-1">{session.title}</h1>
              {currentStep !== 'welcome' && currentStep !== 'payment' && currentStep !== 'complete' && (
                <p className="text-xs md:text-sm text-gray-500">
                  {currentStep === 'size-quantity' && '사이즈 및 수량'}
                  {currentStep === 'personal-info' && '참여자 정보'}
                  {currentStep === 'delivery-method' && '수령 방법'}
                  {currentStep === 'delivery-address' && '배송 정보'}
                  {currentStep === 'custom-fields' && '추가 정보'}
                  {currentStep === 'review' && (isSurveyMode ? '참여 확인' : '주문 확인')}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        {currentStep !== 'welcome' && (
          <div className="px-4 pb-3 md:px-6 md:pb-4">
            <div className="h-1 md:h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-[10px] md:text-xs text-gray-500 mt-1.5 md:mt-2">
              {currentStepIndex + 1} / {steps.length}
            </p>
          </div>
        )}
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto">
        <div className={`transition-all duration-150 ease-out ${animationClass}`}>
          {/* Welcome Step */}
          {currentStep === 'welcome' && (
            <div className="max-w-lg mx-auto py-6 px-4 md:py-8 md:px-6">
              {/* Session Info */}
              <div className="text-center mb-6">
                <div className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-gradient-to-br from-[#4A66B5] to-[#3B55A5] flex items-center justify-center mx-auto mb-4 shadow-lg shadow-[#3B55A5]/25">
                  <Users className="w-7 h-7 md:w-8 md:h-8 text-white" />
                </div>
                <p className="text-xs md:text-sm text-[#3B55A5] font-medium mb-2">공동구매 참여</p>
                <h1 className="text-xl md:text-2xl font-bold text-gray-900 mb-2">{session.title}</h1>
                {session.description && (
                  <p className="text-sm md:text-base text-gray-600">{session.description}</p>
                )}
              </div>

              {/* Design Preview */}
              <div className="bg-gray-100 rounded-2xl overflow-hidden mb-6">
                {isImageOnly && cobuyImages ? (
                  <div className="relative">
                    <img
                      src={cobuyImages[currentImageIndex]}
                      alt={`${session.title} ${currentImageIndex + 1}`}
                      className="w-full h-auto object-contain"
                    />
                    {cobuyImages.length > 1 && (
                      <>
                        <button
                          type="button"
                          onClick={() => setCurrentImageIndex((prev) => (prev - 1 + cobuyImages.length) % cobuyImages.length)}
                          className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/40 rounded-full flex items-center justify-center text-white hover:bg-black/60 transition-colors"
                        >
                          <ArrowLeft className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setCurrentImageIndex((prev) => (prev + 1) % cobuyImages.length)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/40 rounded-full flex items-center justify-center text-white hover:bg-black/60 transition-colors"
                        >
                          <ArrowRight className="w-4 h-4" />
                        </button>
                        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                          {cobuyImages.map((_, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => setCurrentImageIndex(idx)}
                              className={`w-2 h-2 rounded-full transition-colors ${
                                idx === currentImageIndex ? 'bg-white' : 'bg-white/50'
                              }`}
                            />
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                ) : productConfig ? (
                  <CoBuyDesignViewer
                    config={productConfig}
                    canvasState={design.canvas_state as Record<string, string>}
                    productColor={productColor}
                  />
                ) : null}
                {product?.sizing_chart_image && (
                  <div className="p-3 bg-white border-t border-gray-200">
                    <button
                      type="button"
                      onClick={() => setIsSizingChartOpen(true)}
                      className="flex items-center justify-center gap-2 w-full py-2 px-4 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors text-sm font-medium"
                    >
                      <Ruler className="w-4 h-4" />
                      사이즈 정보 보기
                    </button>
                  </div>
                )}
              </div>

              {/* Session Details */}
              <div className="bg-gray-50 rounded-xl p-4 mb-6 space-y-3">
                <div className="flex items-center gap-3 text-sm">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-600">마감일: {formatDate(session.end_date)}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Users className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-600">
                    현재 {session.current_participant_count}명 참여
                    {session.max_participants && ` / 최대 ${session.max_participants}명`}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Package className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-600">현재 {currentTotalQuantity}벌 주문</span>
                </div>
              </div>

              {/* Base Price */}
              <div className="text-center mb-6">
                <p className="text-sm text-gray-500 mb-1">단가</p>
                <p className="text-2xl md:text-3xl font-bold text-gray-900">
                  {formatPrice(currentPrice)}
                </p>
              </div>

              {/* Start Button */}
              <button
                onClick={handleNext}
                className="w-full py-3 md:py-4 bg-gradient-to-r from-[#3B55A5] to-[#2D4280] text-white rounded-2xl font-semibold hover:from-[#2D4280] hover:to-[#243366] transition-all shadow-lg shadow-[#3B55A5]/25 flex items-center justify-center gap-2 text-sm md:text-base"
              >
                <span>참여하기</span>
                <ArrowRight className="w-4 h-4 md:w-5 md:h-5" />
              </button>
            </div>
          )}

          {/* Size & Quantity Step */}
          {currentStep === 'size-quantity' && (
            <div className="max-w-lg mx-auto py-6 px-4 md:py-8 md:px-6">
              <div className="mb-6">
                <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-[#3B55A5]/20 flex items-center justify-center mb-3">
                  <Ruler className="w-5 h-5 md:w-6 md:h-6 text-[#3B55A5]" />
                </div>
                <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-2">사이즈와 수량을 선택해주세요</h2>
                <p className="text-sm md:text-base text-gray-600">
                  여러 사이즈를 구매하려면 &apos;추가&apos; 버튼을 눌러주세요
                </p>
              </div>

              <div className="space-y-3 mb-6">
                {selectedItems.map((item, index) => (
                  <div key={index} className="flex items-start gap-2 p-3 bg-gray-50 rounded-xl">
                    {/* Size dropdown */}
                    <div className="flex-1">
                      <select
                        value={item.size}
                        onChange={(e) => handleItemSizeChange(index, e.target.value)}
                        className={`w-full px-3 py-2.5 border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm md:text-base ${
                          errors[`item-${index}-size`] ? 'border-red-500' : 'border-gray-200'
                        }`}
                      >
                        <option value="">사이즈 선택</option>
                        {sizeOptions.map((size, idx) => {
                          // Handle both old string format and new object format
                          const sizeLabel = typeof size === 'string' ? size : size.label;
                          return (
                            <option key={idx} value={sizeLabel}>{sizeLabel}</option>
                          );
                        })}
                      </select>
                      {errors[`item-${index}-size`] && (
                        <p className="text-red-500 text-xs mt-1">{errors[`item-${index}-size`]}</p>
                      )}
                    </div>

                    {/* Quantity controls */}
                    <div className="flex items-center border-2 border-gray-200 rounded-xl">
                      <button
                        type="button"
                        onClick={() => handleItemQuantityChange(index, item.quantity - 1)}
                        className="px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-l-xl transition-colors"
                        disabled={item.quantity <= 1}
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="px-3 py-2 min-w-10 text-center font-medium text-sm md:text-base">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleItemQuantityChange(index, item.quantity + 1)}
                        className="px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-r-xl transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Remove button */}
                    {selectedItems.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeItem(index)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                ))}

                <button
                  type="button"
                  onClick={addItem}
                  className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-600 hover:bg-gray-50 hover:border-gray-400 transition-all flex items-center justify-center gap-2 text-sm md:text-base"
                >
                  <Plus className="w-4 h-4" />
                  다른 사이즈 추가
                </button>
              </div>

              {/* Order Summary */}
              {getTotalQuantity() > 0 && (
                <div className="bg-[#3B55A5]/10 rounded-xl p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-700">총 수량</span>
                    <span className="font-bold text-[#3B55A5]">{getTotalQuantity()}벌</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-700">단가</span>
                    <span className="font-medium text-[#3B55A5]">{formatPrice(currentPrice)}</span>
                  </div>
                  <div className="flex justify-between text-sm pt-2 border-t border-blue-200">
                    <span className="text-gray-700 font-medium">예상 금액</span>
                    <span className="font-bold text-[#3B55A5] text-lg">{formatPrice(currentPrice * getTotalQuantity())}</span>
                  </div>

                </div>
              )}
            </div>
          )}

          {/* Personal Info Step */}
          {currentStep === 'personal-info' && (
            <div className="max-w-lg mx-auto py-6 px-4 md:py-8 md:px-6">
              <div className="mb-6">
                <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-green-100 flex items-center justify-center mb-3">
                  <User className="w-5 h-5 md:w-6 md:h-6 text-green-600" />
                </div>
                <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-2">참여자 정보를 입력해주세요</h2>
                <p className="text-sm md:text-base text-gray-600">
                  주문 확인 및 안내를 위해 필요합니다
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1.5">
                    이름 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      setErrors(prev => { const n = { ...prev }; delete n.name; return n; });
                    }}
                    className={`w-full px-3 py-3 border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 text-sm md:text-base ${
                      errors.name ? 'border-red-500' : 'border-gray-200'
                    }`}
                    placeholder="이름을 입력하세요"
                  />
                  {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
                </div>

                <div>
                  <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1.5">
                    이메일 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setErrors(prev => { const n = { ...prev }; delete n.email; return n; });
                    }}
                    className={`w-full px-3 py-3 border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 text-sm md:text-base ${
                      errors.email ? 'border-red-500' : 'border-gray-200'
                    }`}
                    placeholder="example@email.com"
                  />
                  {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
                </div>

                <div>
                  <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1.5">
                    전화번호 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => {
                      setPhone(e.target.value.replace(/[^0-9]/g, ''));
                      setErrors(prev => { const n = { ...prev }; delete n.phone; return n; });
                    }}
                    className={`w-full px-3 py-3 border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 text-sm md:text-base ${
                      errors.phone ? 'border-red-500' : 'border-gray-200'
                    }`}
                    placeholder="01012345678"
                  />
                  {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone}</p>}
                </div>
              </div>
            </div>
          )}

          {/* Delivery Method Step */}
          {currentStep === 'delivery-method' && (
            <div className="max-w-lg mx-auto py-6 px-4 md:py-8 md:px-6">
              <div className="mb-6">
                <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-purple-100 flex items-center justify-center mb-3">
                  <Truck className="w-5 h-5 md:w-6 md:h-6 text-purple-600" />
                </div>
                <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-2">수령 방법을 선택해주세요</h2>
                <p className="text-sm md:text-base text-gray-600">
                  직접 수령 또는 배송 중 선택할 수 있어요
                </p>
              </div>

              <div className="space-y-3">
                {/* Pickup Option */}
                <button
                  type="button"
                  onClick={() => {
                    setDeliveryMethod('pickup');
                    setErrors(prev => { const n = { ...prev }; delete n.deliveryMethod; return n; });
                  }}
                  className={`w-full p-4 md:p-5 rounded-2xl border-2 text-left transition-all ${
                    deliveryMethod === 'pickup'
                      ? 'border-[#3B55A5] bg-[#3B55A5]/10 ring-4 ring-[#3B55A5]/10'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <div className="flex items-start gap-3 md:gap-4">
                    <div className={`w-9 h-9 md:w-10 md:h-10 rounded-xl flex items-center justify-center ${
                      deliveryMethod === 'pickup' ? 'bg-[#3B55A5] text-white' : 'bg-gray-100 text-gray-500'
                    }`}>
                      <MapPin className="w-4 h-4 md:w-5 md:h-5" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900 text-sm md:text-base">직접 수령</span>
                        {deliveryMethod === 'pickup' && <Check className="w-4 h-4 md:w-5 md:h-5 text-[#3B55A5]" />}
                      </div>
                      <p className="text-xs md:text-sm text-gray-600 mt-1">무료</p>
                      {deliverySettings?.pickupLocation && (
                        <p className="text-xs text-gray-500 mt-1">{deliverySettings.pickupLocation}</p>
                      )}
                    </div>
                  </div>
                </button>

                {/* Delivery Option */}
                <button
                  type="button"
                  onClick={() => {
                    setDeliveryMethod('delivery');
                    setErrors(prev => { const n = { ...prev }; delete n.deliveryMethod; return n; });
                  }}
                  className={`w-full p-4 md:p-5 rounded-2xl border-2 text-left transition-all ${
                    deliveryMethod === 'delivery'
                      ? 'border-[#3B55A5] bg-[#3B55A5]/10 ring-4 ring-[#3B55A5]/10'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <div className="flex items-start gap-3 md:gap-4">
                    <div className={`w-9 h-9 md:w-10 md:h-10 rounded-xl flex items-center justify-center ${
                      deliveryMethod === 'delivery' ? 'bg-[#3B55A5] text-white' : 'bg-gray-100 text-gray-500'
                    }`}>
                      <Truck className="w-4 h-4 md:w-5 md:h-5" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900 text-sm md:text-base">배송</span>
                        {deliveryMethod === 'delivery' && <Check className="w-4 h-4 md:w-5 md:h-5 text-[#3B55A5]" />}
                      </div>
                      <p className="text-xs md:text-sm text-gray-600 mt-1">
                        {(deliverySettings?.deliveryFee || 0) > 0
                          ? `+${formatPrice(deliverySettings?.deliveryFee)}`
                          : '무료 배송'}
                      </p>
                    </div>
                  </div>
                </button>
              </div>

              {errors.deliveryMethod && (
                <p className="text-red-500 text-xs mt-2">{errors.deliveryMethod}</p>
              )}
            </div>
          )}

          {/* Delivery Address Step */}
          {currentStep === 'delivery-address' && (
            <div className="max-w-lg mx-auto py-6 px-4 md:py-8 md:px-6">
              <div className="mb-6">
                <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-indigo-100 flex items-center justify-center mb-3">
                  <MapPin className="w-5 h-5 md:w-6 md:h-6 text-indigo-600" />
                </div>
                <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-2">배송 정보를 입력해주세요</h2>
                <p className="text-sm md:text-base text-gray-600">
                  정확한 배송을 위해 필요합니다
                </p>
              </div>

              <div className="space-y-4">
                {/* Recipient Name */}
                <div>
                  <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1.5">
                    수령인 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={deliveryInfo?.recipientName || ''}
                    onChange={(e) => {
                      setDeliveryInfo(prev => ({ ...prev!, recipientName: e.target.value }));
                      setErrors(prev => { const n = { ...prev }; delete n.recipientName; return n; });
                    }}
                    className={`w-full px-3 py-3 border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm md:text-base ${
                      errors.recipientName ? 'border-red-500' : 'border-gray-200'
                    }`}
                    placeholder="수령인 이름"
                  />
                  {errors.recipientName && <p className="text-red-500 text-xs mt-1">{errors.recipientName}</p>}
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1.5">
                    연락처 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    value={deliveryInfo?.phone || ''}
                    onChange={(e) => {
                      setDeliveryInfo(prev => ({ ...prev!, phone: e.target.value.replace(/[^0-9]/g, '') }));
                      setErrors(prev => { const n = { ...prev }; delete n.deliveryPhone; return n; });
                    }}
                    className={`w-full px-3 py-3 border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm md:text-base ${
                      errors.deliveryPhone ? 'border-red-500' : 'border-gray-200'
                    }`}
                    placeholder="01012345678"
                  />
                  {errors.deliveryPhone && <p className="text-red-500 text-xs mt-1">{errors.deliveryPhone}</p>}
                </div>

                {/* Address Search */}
                <div>
                  <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1.5">
                    주소 <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={deliveryInfo?.postalCode || ''}
                      readOnly
                      className="w-24 md:w-28 px-3 py-3 border-2 border-gray-200 rounded-xl bg-gray-50 text-sm"
                      placeholder="우편번호"
                    />
                    <button
                      type="button"
                      onClick={handleAddressSearch}
                      className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition font-medium flex items-center justify-center gap-2 text-sm md:text-base"
                    >
                      <Search className="w-4 h-4" />
                      주소 검색
                    </button>
                  </div>
                  {errors.address && !deliveryInfo?.address && (
                    <p className="text-red-500 text-xs mt-1">{errors.address}</p>
                  )}
                </div>

                {/* Address Fields (shown after search) */}
                {deliveryInfo?.address && (
                  <>
                    <input
                      type="text"
                      value={deliveryInfo.address}
                      readOnly
                      className="w-full px-3 py-3 border-2 border-gray-200 rounded-xl bg-gray-50 text-sm md:text-base"
                    />

                    <div>
                      <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1.5">
                        상세 주소 <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={deliveryInfo?.addressDetail || ''}
                        onChange={(e) => {
                          setDeliveryInfo(prev => ({ ...prev!, addressDetail: e.target.value }));
                          setErrors(prev => { const n = { ...prev }; delete n.addressDetail; return n; });
                        }}
                        className={`w-full px-3 py-3 border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm md:text-base ${
                          errors.addressDetail ? 'border-red-500' : 'border-gray-200'
                        }`}
                        placeholder="아파트 동/호수, 건물명 등"
                      />
                      {errors.addressDetail && <p className="text-red-500 text-xs mt-1">{errors.addressDetail}</p>}
                    </div>
                  </>
                )}

                {/* Memo */}
                <div>
                  <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1.5">
                    배송 요청사항 <span className="text-gray-400">(선택)</span>
                  </label>
                  <input
                    type="text"
                    value={deliveryInfo?.memo || ''}
                    onChange={(e) => setDeliveryInfo(prev => ({ ...prev!, memo: e.target.value }))}
                    className="w-full px-3 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm md:text-base"
                    placeholder="예: 문 앞에 놓아주세요"
                    maxLength={100}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Custom Fields Step */}
          {currentStep === 'custom-fields' && (
            <div className="max-w-lg mx-auto py-6 px-4 md:py-8 md:px-6">
              <div className="mb-6">
                <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-orange-100 flex items-center justify-center mb-3">
                  <Info className="w-5 h-5 md:w-6 md:h-6 text-orange-600" />
                </div>
                <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-2">추가 정보를 입력해주세요</h2>
                <p className="text-sm md:text-base text-gray-600">
                  주최자가 요청한 정보입니다
                </p>
              </div>

              <div className="space-y-4">
                {customFields.map((field) => (
                  <div key={field.id}>
                    <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1.5">
                      {field.label} {field.required && <span className="text-red-500">*</span>}
                    </label>

                    {field.type === 'dropdown' && field.options ? (
                      <select
                        value={fieldResponses[field.id] || ''}
                        onChange={(e) => {
                          setFieldResponses(prev => ({ ...prev, [field.id]: e.target.value }));
                          setErrors(prev => { const n = { ...prev }; delete n[field.id]; return n; });
                        }}
                        className={`w-full px-3 py-3 border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm md:text-base ${
                          errors[field.id] ? 'border-red-500' : 'border-gray-200'
                        }`}
                      >
                        <option value="">선택해주세요</option>
                        {field.options.map((option, idx) => (
                          <option key={idx} value={option}>{option}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type={field.type === 'email' ? 'email' : field.type === 'phone' ? 'tel' : 'text'}
                        value={fieldResponses[field.id] || ''}
                        onChange={(e) => {
                          const value = field.type === 'phone' ? e.target.value.replace(/[^0-9]/g, '') : e.target.value;
                          setFieldResponses(prev => ({ ...prev, [field.id]: value }));
                          setErrors(prev => { const n = { ...prev }; delete n[field.id]; return n; });
                        }}
                        className={`w-full px-3 py-3 border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm md:text-base ${
                          errors[field.id] ? 'border-red-500' : 'border-gray-200'
                        }`}
                        placeholder={`${field.label}을(를) 입력하세요`}
                      />
                    )}

                    {errors[field.id] && (
                      <p className="text-red-500 text-xs mt-1">{errors[field.id]}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Review Step */}
          {currentStep === 'review' && (
            <div className="max-w-lg mx-auto py-6 px-4 md:py-8 md:px-6">
              <div className="mb-6">
                <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-amber-100 flex items-center justify-center mb-3">
                  <CheckCircle2 className="w-5 h-5 md:w-6 md:h-6 text-amber-600" />
                </div>
                <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-2">
                  {isSurveyMode ? '참여 내용을 확인해주세요' : '주문 내용을 확인해주세요'}
                </h2>
                <p className="text-sm md:text-base text-gray-600">
                  {isSurveyMode ? '참여 전 마지막 확인 단계입니다' : '결제 전 마지막 확인 단계입니다'}
                </p>
              </div>

              <div className="bg-gray-50 rounded-2xl p-4 md:p-5 space-y-4">
                {/* Order Items */}
                <div className="pb-4 border-b border-gray-200">
                  <p className="text-[10px] md:text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">주문 상품</p>
                  {sizeOptions.length > 0 ? (
                    selectedItems.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-sm md:text-base mb-1">
                        <span className="text-gray-700">{item.size} × {item.quantity}벌</span>
                        <span className="font-medium">{formatPrice(getItemPrice(item.size) * item.quantity)}</span>
                      </div>
                    ))
                  ) : (
                    <div className="flex justify-between text-sm md:text-base mb-1">
                      <span className="text-gray-700">{getTotalQuantity()}개</span>
                      <span className="font-medium">{formatPrice(currentPrice * getTotalQuantity())}</span>
                    </div>
                  )}
                </div>

                {/* Participant Info */}
                <div className="pb-4 border-b border-gray-200">
                  <p className="text-[10px] md:text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">참여자 정보</p>
                  <div className="space-y-1 text-sm md:text-base">
                    <p className="text-gray-700">{name}</p>
                    <p className="text-gray-700">{email}</p>
                    {phone && <p className="text-gray-700">{phone}</p>}
                  </div>
                </div>

                {/* Delivery Info */}
                <div className="pb-4 border-b border-gray-200">
                  <p className="text-[10px] md:text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">수령 방법</p>
                  {deliveryMethod === 'pickup' ? (
                    <div className="flex items-center gap-2 text-sm md:text-base">
                      <MapPin className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-700">직접 수령</span>
                    </div>
                  ) : (
                    <div className="space-y-1 text-sm md:text-base">
                      <div className="flex items-center gap-2">
                        <Truck className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-700">배송</span>
                      </div>
                      {deliveryInfo && (
                        <div className="text-gray-600 text-xs md:text-sm ml-6">
                          <p>{deliveryInfo.recipientName} / {deliveryInfo.phone}</p>
                          <p>{deliveryInfo.address} {deliveryInfo.addressDetail}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Custom Field Responses */}
                {customFields.length > 0 && Object.keys(fieldResponses).length > 0 && (
                  <div className="pb-4 border-b border-gray-200">
                    <p className="text-[10px] md:text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">추가 정보</p>
                    <div className="space-y-1 text-sm md:text-base">
                      {customFields.map(field => (
                        fieldResponses[field.id] && (
                          <div key={field.id} className="flex justify-between">
                            <span className="text-gray-500">{field.label}</span>
                            <span className="text-gray-700">{fieldResponses[field.id]}</span>
                          </div>
                        )
                      ))}
                    </div>
                  </div>
                )}

                {/* Total */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">상품 금액</span>
                    <span>{formatPrice(calcItemsTotal())}</span>
                  </div>
                  {deliveryFee > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">배송비</span>
                      <span>+{formatPrice(deliveryFee)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-lg font-bold pt-2 border-t border-gray-200">
                    <span>{isSurveyMode ? '예상 결제 금액' : '총 결제 금액'}</span>
                    <span className="text-[#3B55A5]">{formatPrice(totalAmount)}</span>
                  </div>
                  {isSurveyMode && (
                    <p className="text-xs text-gray-500 mt-1">
                      실제 결제는 대표자가 일괄 진행합니다
                    </p>
                  )}
                </div>
              </div>

              {submitError && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl">
                  <p className="text-red-600 text-sm">{submitError}</p>
                </div>
              )}
            </div>
          )}

          {/* Complete Step (survey mode) */}
          {currentStep === 'complete' && participantId && (
            <div className="max-w-lg mx-auto py-6 px-4 md:py-8 md:px-6">
              <div className="text-center mb-6">
                <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-8 h-8 md:w-10 md:h-10 text-emerald-600" />
                </div>
                <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-2">참여가 완료되었습니다!</h2>
                <p className="text-sm md:text-base text-gray-600">
                  공동구매 참여 정보가 저장되었습니다
                </p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
                <p className="text-blue-800 text-sm font-medium mb-1">예상 결제 금액</p>
                <p className="text-2xl font-bold text-blue-900">{formatPrice(totalAmount)}</p>
                <p className="text-blue-600 text-xs mt-1">
                  실제 결제는 대표자가 모집 완료 후 일괄 진행합니다
                </p>
              </div>

              <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">이름</span>
                  <span className="text-gray-900">{name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">이메일</span>
                  <span className="text-gray-900">{email}</span>
                </div>
                {sizeOptions.length > 0 && selectedItems.map((item, idx) => (
                  <div key={idx} className="flex justify-between">
                    <span className="text-gray-500">{item.size}</span>
                    <span className="text-gray-900">{item.quantity}벌</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Payment Step */}
          {currentStep === 'payment' && participantId && orderId && (
            <div className="max-w-lg mx-auto py-6 px-4 md:py-8 md:px-6">
              <div className="mb-6">
                <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-emerald-100 flex items-center justify-center mb-3">
                  <CreditCard className="w-5 h-5 md:w-6 md:h-6 text-emerald-600" />
                </div>
                <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-2">결제를 진행해주세요</h2>
                <p className="text-sm md:text-base text-gray-600">
                  안전한 결제를 위해 토스페이먼츠를 사용합니다
                </p>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6">
                <div className="flex items-center gap-2 text-green-700">
                  <CheckCircle2 className="w-5 h-5" />
                  <span className="font-medium">참여 정보가 저장되었습니다</span>
                </div>
                <p className="text-green-600 text-sm mt-1">결제를 완료하면 공동구매 참여가 확정됩니다.</p>
              </div>

              <TossPaymentWidget
                amount={totalAmount}
                orderId={orderId}
                orderName={deliveryFee > 0
                  ? `${session.title} 공동구매 (${getTotalQuantity()}벌, 배송)`
                  : `${session.title} 공동구매 (${getTotalQuantity()}벌)`}
                customerEmail={email}
                customerName={name}
                customerMobilePhone={phone}
                successUrl={typeof window !== 'undefined'
                  ? `${window.location.origin}/cobuy/${shareToken}/success?${new URLSearchParams({
                    participantId,
                    sessionId: session.id,
                  }).toString()}`
                  : `/cobuy/${shareToken}/success`}
                failUrl={typeof window !== 'undefined'
                  ? `${window.location.origin}/cobuy/${shareToken}/fail?${new URLSearchParams({
                    participantId,
                    sessionId: session.id,
                  }).toString()}`
                  : `/cobuy/${shareToken}/fail`}
                onBeforePaymentRequest={() => {
                  sessionStorage.setItem('pendingCoBuyPayment', JSON.stringify({
                    participantId,
                    sessionId: session.id,
                    shareToken,
                    orderId,
                    amount: totalAmount,
                  }));
                }}
                onError={(error) => {
                  console.error('Toss payment error:', error);
                }}
              />
            </div>
          )}
        </div>
      </main>

      {/* Footer Navigation */}
      {currentStep !== 'welcome' && currentStep !== 'payment' && currentStep !== 'complete' && (
        <footer className="shrink-0 border-t border-gray-200 bg-white p-3 md:p-4 safe-area-inset-bottom">
          <div className="max-w-lg mx-auto flex gap-2 md:gap-3">
            <button
              onClick={handleBack}
              className="py-3 md:py-4 px-5 md:px-6 border-2 border-gray-200 rounded-2xl font-semibold hover:bg-gray-50 transition-colors flex items-center justify-center gap-1.5 md:gap-2 text-sm md:text-base text-gray-700"
            >
              <ArrowLeft className="w-4 h-4 md:w-5 md:h-5" />
              <span>이전</span>
            </button>

            {currentStep !== 'review' ? (
              <button
                onClick={handleNext}
                className="flex-1 py-3 md:py-4 bg-gradient-to-r from-[#3B55A5] to-[#2D4280] text-white rounded-2xl font-semibold hover:from-[#2D4280] hover:to-[#243366] transition-all shadow-lg shadow-[#3B55A5]/25 flex items-center justify-center gap-1.5 md:gap-2 text-sm md:text-base"
              >
                <span>다음</span>
                <ArrowRight className="w-4 h-4 md:w-5 md:h-5" />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="flex-1 py-3 md:py-4 bg-gradient-to-r from-emerald-500 to-green-600 text-white rounded-2xl font-semibold hover:from-emerald-600 hover:to-green-700 transition-all shadow-lg shadow-green-500/25 flex items-center justify-center gap-1.5 md:gap-2 text-sm md:text-base disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 md:w-5 md:h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>처리 중...</span>
                  </>
                ) : (
                  <>
                    {isSurveyMode ? (
                      <CheckCircle2 className="w-4 h-4 md:w-5 md:h-5" />
                    ) : (
                      <CreditCard className="w-4 h-4 md:w-5 md:h-5" />
                    )}
                    <span>{isSurveyMode ? '참여하기' : '결제하기'}</span>
                  </>
                )}
              </button>
            )}
          </div>
        </footer>
      )}

      {/* Sizing Chart Modal */}
      {isSizingChartOpen && product?.sizing_chart_image && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
          onClick={() => setIsSizingChartOpen(false)}
        >
          <div
            className="relative max-w-2xl w-full max-h-[90vh] bg-white rounded-lg shadow-xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">사이즈 정보</h3>
              <button
                type="button"
                onClick={() => setIsSizingChartOpen(false)}
                className="p-1 rounded-full text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-auto max-h-[calc(90vh-60px)]">
              <img
                src={product.sizing_chart_image}
                alt="사이즈 정보"
                className="w-full h-auto"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
