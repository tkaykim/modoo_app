'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Script from 'next/script';
import { Package, MapPin, Search, Loader2, ShieldCheck, CheckCircle2, CreditCard, Building2, Clock, Minus, Plus } from 'lucide-react';
import TossPaymentWidget from '@/app/components/toss/TossPaymentWidget';
import { CustomOrderData } from '@/types/types';

type ShippingMethod = 'domestic' | 'pickup';

interface DomesticAddress {
  roadAddress: string;
  jibunAddress: string;
  detailAddress: string;
  postalCode: string;
  state: string;
  city: string;
}

interface VariantQty {
  sizeId: string;
  sizeName: string;
  quantity: number;
}

type ItemQuantities = Record<string, VariantQty[]>;

export default function CustomOrderPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  const [orderData, setOrderData] = useState<CustomOrderData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [alreadyPaid, setAlreadyPaid] = useState(false);

  // Customer info
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');

  // Shipping
  const [shippingMethod, setShippingMethod] = useState<ShippingMethod>('domestic');
  const [domesticAddress, setDomesticAddress] = useState<DomesticAddress>({
    roadAddress: '',
    jibunAddress: '',
    detailAddress: '',
    postalCode: '',
    state: '',
    city: '',
  });

  const [showPayment, setShowPayment] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'bank_transfer'>('card');
  const [bankTransferLoading, setBankTransferLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [itemQuantities, setItemQuantities] = useState<ItemQuantities>({});

  const ceFields = orderData?.customer_editable_fields;
  const isQtyEditable = !!ceFields?.quantities;

  const handleVariantQty = useCallback((itemId: string, sizeId: string, delta: number) => {
    setItemQuantities(prev => {
      const variants = prev[itemId] || [];
      return {
        ...prev,
        [itemId]: variants.map(v => v.sizeId === sizeId ? { ...v, quantity: Math.max(0, v.quantity + delta) } : v),
      };
    });
  }, []);

  const handleVariantQtyInput = useCallback((itemId: string, sizeId: string, value: string) => {
    const q = parseInt(value, 10);
    if (isNaN(q) || q < 0) return;
    setItemQuantities(prev => {
      const variants = prev[itemId] || [];
      return {
        ...prev,
        [itemId]: variants.map(v => v.sizeId === sizeId ? { ...v, quantity: q } : v),
      };
    });
  }, []);

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        const res = await fetch(`/api/order/custom/${token}`);
        const data = await res.json();

        if (!res.ok) {
          if (data.data?.alreadyPaid) {
            setAlreadyPaid(true);
          } else {
            setError(data.error || '주문을 찾을 수 없습니다.');
          }
          return;
        }

        const od: CustomOrderData = data.data;
        setOrderData(od);

        const cef = od.customer_editable_fields;
        const namePlaceholder = cef?.customerName && od.customer_name === '고객 입력 대기';
        const emailPlaceholder = cef?.customerEmail && od.customer_email === 'pending@placeholder.com';

        setCustomerName(namePlaceholder ? '' : (od.customer_name || ''));
        setCustomerEmail(emailPlaceholder ? '' : (od.customer_email || ''));
        setCustomerPhone((od.customer_phone || '').replace(/[^0-9]/g, ''));

        if (od.shipping_method) {
          setShippingMethod(od.shipping_method === 'pickup' ? 'pickup' : 'domestic');
        }

        if (od.address_line_1) {
          setDomesticAddress({
            roadAddress: od.address_line_1,
            jibunAddress: '',
            detailAddress: od.address_line_2 || '',
            postalCode: od.postal_code || '',
            state: od.state || '',
            city: od.city || '',
          });
        }

        if (cef?.quantities && od.order_items) {
          const qtyMap: ItemQuantities = {};
          for (const item of od.order_items) {
            const opts = (item.item_options || {}) as { variants?: Array<{ size_id?: string; size_name?: string; quantity?: number }> };
            qtyMap[item.id] = (opts.variants || []).map(v => ({
              sizeId: v.size_id || '',
              sizeName: v.size_name || v.size_id || '',
              quantity: v.quantity || 0,
            }));
          }
          setItemQuantities(qtyMap);
        }
      } catch {
        setError('주문 정보를 불러올 수 없습니다.');
      } finally {
        setIsLoading(false);
      }
    };

    if (token) fetchOrder();
  }, [token]);

  const itemsSubtotal = useMemo(() => {
    if (!orderData?.order_items) return 0;
    if (isQtyEditable) {
      return orderData.order_items.reduce((sum, item) => {
        const variants = itemQuantities[item.id] || [];
        const qty = variants.reduce((s, v) => s + v.quantity, 0);
        return sum + qty * item.price_per_item;
      }, 0);
    }
    return orderData.order_items.reduce((sum, item) => sum + item.quantity * item.price_per_item, 0);
  }, [orderData, itemQuantities, isQtyEditable]);

  const totalAmount = useMemo(() => {
    if (!orderData) return 0;
    if (isQtyEditable) {
      const coupon = orderData.coupon_discount || 0;
      const discount = orderData.admin_discount || 0;
      const surcharge = orderData.admin_surcharge || 0;
      return Math.max(0, itemsSubtotal - coupon - discount + surcharge);
    }
    return orderData.total_amount ?? 0;
  }, [orderData, itemsSubtotal, isQtyEditable]);

  const totalQuantity = useMemo(() => {
    if (!isQtyEditable) return 0;
    return Object.values(itemQuantities).reduce(
      (sum, variants) => sum + variants.reduce((s, v) => s + v.quantity, 0), 0
    );
  }, [itemQuantities, isQtyEditable]);

  const hasAdjustments = useMemo(() => {
    if (!orderData) return false;
    return (orderData.coupon_discount > 0 || orderData.admin_discount > 0 || orderData.admin_surcharge > 0);
  }, [orderData]);

  const handleAddressSearch = () => {
    if (typeof window !== 'undefined' && (window as any).daum?.Postcode) {
      new (window as any).daum.Postcode({
        oncomplete: (data: any) => {
          setDomesticAddress({
            roadAddress: data.roadAddress || data.address,
            jibunAddress: data.jibunAddress || '',
            detailAddress: '',
            postalCode: data.zonecode,
            state: data.sido || '',
            city: data.sigungu || '',
          });
        },
      }).open();
    }
  };

  const validateForm = () => {
    if (!customerName.trim()) {
      setFormError('이름을 입력해주세요.');
      return false;
    }
    if (!customerEmail.trim()) {
      setFormError('이메일을 입력해주세요.');
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(customerEmail)) {
      setFormError('올바른 이메일 형식을 입력해주세요.');
      return false;
    }
    if (isQtyEditable && totalQuantity <= 0) {
      setFormError('최소 하나 이상의 수량을 선택해주세요.');
      return false;
    }
    if (shippingMethod === 'domestic' && !domesticAddress.roadAddress) {
      setFormError('배송 주소를 입력해주세요.');
      return false;
    }
    setFormError(null);
    return true;
  };

  const handleProceedToPayment = async () => {
    if (!validateForm()) return;

    try {
      const putBody: Record<string, unknown> = {
        customerName: customerName.trim(),
        customerEmail: customerEmail.trim(),
        customerPhone: customerPhone.trim() || null,
        shippingMethod,
        ...(shippingMethod === 'domestic' && {
          postalCode: domesticAddress.postalCode,
          state: domesticAddress.state,
          city: domesticAddress.city,
          addressLine1: domesticAddress.roadAddress,
          addressLine2: domesticAddress.detailAddress || null,
        }),
      };

      if (isQtyEditable && orderData) {
        putBody.items = orderData.order_items.map(item => ({
          id: item.id,
          variants: (itemQuantities[item.id] || []).map(v => ({
            sizeCode: v.sizeId,
            quantity: v.quantity,
          })),
        }));
      }

      const res = await fetch(`/api/order/custom/${token}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(putBody),
      });

      if (!res.ok) {
        const data = await res.json();
        setFormError(data.error || '정보 저장에 실패했습니다.');
        return;
      }
    } catch {
      setFormError('정보 저장 중 오류가 발생했습니다.');
      return;
    }

    setShowPayment(true);
  };

  const handleBankTransferOrder = async () => {
    setBankTransferLoading(true);
    try {
      const res = await fetch(`/api/order/custom/${token}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmBankTransfer: true }),
      });

      if (!res.ok) {
        const data = await res.json();
        setFormError(data.error || '주문 처리에 실패했습니다.');
        return;
      }

      router.push(`/payment/complete?orderId=${orderData?.id}&method=bank_transfer`);
    } catch {
      setFormError('주문 처리 중 오류가 발생했습니다.');
    } finally {
      setBankTransferLoading(false);
    }
  };

  const successUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/order/custom/${token}/success?token=${token}`
    : '';
  const failUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/order/custom/${token}?paymentFailed=true`
    : '';

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">주문 정보를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (alreadyPaid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md mx-auto px-6">
          <CheckCircle2 className="w-20 h-20 mx-auto mb-6 text-green-600" />
          <h2 className="text-2xl font-bold mb-2">이미 결제 완료된 주문입니다</h2>
          <p className="text-gray-600">이 주문은 이미 결제가 완료되었습니다.</p>
        </div>
      </div>
    );
  }

  if (error || !orderData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md mx-auto px-6">
          <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">주문을 찾을 수 없습니다</h2>
          <p className="text-gray-600">{error || '유효하지 않은 링크입니다.'}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Script src="//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js" strategy="afterInteractive" />

      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b sticky top-0 z-10">
          <div className="max-w-lg mx-auto px-4 py-4">
            <h1 className="text-lg font-bold text-center">맞춤 주문 결제</h1>
          </div>
        </div>

        <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
          {/* Order Items */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="p-4 border-b">
              <h2 className="font-semibold text-gray-900">주문 상품</h2>
            </div>
            <div className="divide-y">
              {orderData.order_items.map((item, idx) => {
                const variants = itemQuantities[item.id] || [];
                const itemQty = isQtyEditable
                  ? variants.reduce((s, v) => s + v.quantity, 0)
                  : item.quantity;
                const itemSub = item.price_per_item * itemQty;

                return (
                  <div key={item.id || idx} className="p-4">
                    <div className="flex gap-4">
                      {item.design_preview_url ? (
                        <div className="w-20 h-20 bg-gray-100 rounded-lg overflow-hidden shrink-0">
                          <img src={item.design_preview_url} alt={item.product_title} className="w-full h-full object-contain" />
                        </div>
                      ) : (
                        <div className="w-20 h-20 bg-gray-100 rounded-lg flex items-center justify-center shrink-0">
                          <Package className="w-6 h-6 text-gray-300" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 text-sm">{item.product_title}</p>
                        <p className="text-sm text-gray-500 mt-1">
                          {item.price_per_item.toLocaleString()}원{isQtyEditable ? '/개' : ` × ${item.quantity}개`}
                        </p>
                        <p className="text-sm font-medium text-gray-800 mt-0.5">
                          {isQtyEditable && itemQty > 0 ? `${itemQty}개 = ` : ''}{itemSub.toLocaleString()}원
                        </p>
                      </div>
                    </div>

                    {isQtyEditable && variants.length > 0 && (
                      <div className="mt-3 space-y-2 pl-1">
                        <p className="text-xs font-medium text-gray-500 mb-1">사이즈별 수량 선택</p>
                        {variants.map(v => (
                          <div key={v.sizeId} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                            <span className="text-sm text-gray-700 font-medium">{v.sizeName}</span>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleVariantQty(item.id, v.sizeId, -1)}
                                disabled={v.quantity <= 0}
                                className="p-1.5 rounded bg-white border border-gray-200 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <input
                                type="number"
                                min="0"
                                value={v.quantity}
                                onChange={(e) => handleVariantQtyInput(item.id, v.sizeId, e.target.value)}
                                className="w-14 text-center p-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                              <button
                                type="button"
                                onClick={() => handleVariantQty(item.id, v.sizeId, 1)}
                                className="p-1.5 rounded bg-white border border-gray-200 hover:bg-gray-100"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Price Summary */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="p-4 border-b">
              <h2 className="font-semibold text-gray-900">결제 금액</h2>
            </div>
            <div className="p-4 space-y-2">
              <div className="flex justify-between text-sm text-gray-600">
                <span>상품 금액</span>
                <span>{itemsSubtotal.toLocaleString()}원</span>
              </div>
              {orderData.delivery_fee > 0 && (
                <div className="flex justify-between text-sm text-gray-600">
                  <span>배송비</span>
                  <span>+{orderData.delivery_fee.toLocaleString()}원</span>
                </div>
              )}
              {orderData.coupon_discount > 0 && (
                <div className="flex justify-between text-sm text-green-600">
                  <span>쿠폰 할인</span>
                  <span>-{orderData.coupon_discount.toLocaleString()}원</span>
                </div>
              )}
              {orderData.admin_discount > 0 && (
                <div className="flex justify-between text-sm text-orange-600">
                  <span>할인</span>
                  <span>-{orderData.admin_discount.toLocaleString()}원</span>
                </div>
              )}
              {orderData.admin_surcharge > 0 && (
                <div className="flex justify-between text-sm text-purple-600">
                  <span>추가 금액</span>
                  <span>+{orderData.admin_surcharge.toLocaleString()}원</span>
                </div>
              )}
              {(() => {
                const computedTotal = itemsSubtotal
                  + (orderData.delivery_fee ?? 0)
                  - (orderData.coupon_discount ?? 0)
                  - (orderData.admin_discount ?? 0)
                  + (orderData.admin_surcharge ?? 0);
                const diff = totalAmount - computedTotal;
                if (diff === 0) return null;
                return (
                  <div className={`flex justify-between text-sm ${diff > 0 ? 'text-indigo-600' : 'text-green-600'}`}>
                    <span>작업비용</span>
                    <span>{diff > 0 ? '+' : ''}{diff.toLocaleString()}원</span>
                  </div>
                );
              })()}
              {orderData.pricing_note && (
                <p className="text-xs text-gray-400 mt-1">{orderData.pricing_note}</p>
              )}
              <div className="border-t my-2" />
              <div className="flex justify-between font-bold text-lg">
                <span>총 결제 금액</span>
                <span className="text-blue-600">{totalAmount.toLocaleString()}원</span>
              </div>
            </div>
          </div>

          {!showPayment ? (
            <>
              {/* Customer Info */}
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <div className="p-4 border-b">
                  <h2 className="font-semibold text-gray-900">고객 정보</h2>
                </div>
                <div className="p-4 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      이름 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="이름을 입력해주세요"
                      className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      이메일 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      placeholder="email@example.com"
                      className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">전화번호</label>
                    <input
                      type="tel"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value.replace(/[^0-9]/g, ''))}
                      placeholder="01012345678"
                      className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Shipping Info */}
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <div className="p-4 border-b">
                  <h2 className="font-semibold text-gray-900">배송 정보</h2>
                </div>
                <div className="p-4 space-y-4">
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="shipping" value="domestic" checked={shippingMethod === 'domestic'} onChange={() => setShippingMethod('domestic')} className="w-4 h-4 text-blue-600" />
                      <span className="text-sm text-gray-700">국내 배송</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="shipping" value="pickup" checked={shippingMethod === 'pickup'} onChange={() => setShippingMethod('pickup')} className="w-4 h-4 text-blue-600" />
                      <span className="text-sm text-gray-700">직접 수령</span>
                    </label>
                  </div>

                  {shippingMethod === 'domestic' && (
                    <div className="space-y-3">
                      <button
                        type="button"
                        onClick={handleAddressSearch}
                        className="w-full p-3 border border-gray-300 rounded-lg bg-white text-left flex items-center gap-2 hover:border-blue-500 transition-colors"
                      >
                        <Search className="w-4 h-4 text-gray-400" />
                        {domesticAddress.roadAddress ? (
                          <span className="text-gray-900">{domesticAddress.roadAddress}</span>
                        ) : (
                          <span className="text-gray-400">주소 검색</span>
                        )}
                      </button>

                      {domesticAddress.roadAddress && (
                        <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                          <div className="flex items-start gap-2">
                            <MapPin className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                            <div>
                              <p className="text-sm font-medium text-gray-900">
                                [{domesticAddress.postalCode}] {domesticAddress.roadAddress}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      <input
                        type="text"
                        value={domesticAddress.detailAddress}
                        onChange={(e) => setDomesticAddress(prev => ({ ...prev, detailAddress: e.target.value }))}
                        placeholder="상세 주소 입력"
                        className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  )}
                </div>
              </div>

              {formError && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {formError}
                </div>
              )}

              {/* Proceed to Payment Button */}
              <button
                onClick={handleProceedToPayment}
                disabled={isQtyEditable && totalQuantity <= 0}
                className="w-full py-4 bg-black text-white rounded-xl font-medium text-lg hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isQtyEditable && totalQuantity <= 0 ? '수량을 선택해주세요' : '결제하기'}
              </button>

              <div className="flex items-center justify-center gap-2 text-gray-400 text-xs pb-4">
                <ShieldCheck className="w-4 h-4" />
                <span>안전한 결제 환경이 제공됩니다</span>
              </div>
            </>
          ) : (
            <>
              {/* Payment Method Selection */}
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <div className="p-4 border-b">
                  <h2 className="font-semibold text-gray-900">결제 수단</h2>
                </div>
                <div className="p-4 grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('card')}
                    className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-colors ${paymentMethod === 'card' ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}
                  >
                    <CreditCard className={`w-6 h-6 ${paymentMethod === 'card' ? 'text-blue-600' : 'text-gray-400'}`} />
                    <span className={`text-sm font-medium ${paymentMethod === 'card' ? 'text-blue-600' : 'text-gray-600'}`}>카드결제</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('bank_transfer')}
                    className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-colors ${paymentMethod === 'bank_transfer' ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}
                  >
                    <Building2 className={`w-6 h-6 ${paymentMethod === 'bank_transfer' ? 'text-blue-600' : 'text-gray-400'}`} />
                    <span className={`text-sm font-medium ${paymentMethod === 'bank_transfer' ? 'text-blue-600' : 'text-gray-600'}`}>직접 계좌이체</span>
                  </button>
                </div>
              </div>

              {paymentMethod === 'card' ? (
                <div className="bg-white rounded-xl shadow-sm overflow-hidden p-4">
                  <TossPaymentWidget
                    amount={totalAmount}
                    orderId={orderData.id}
                    orderName={orderData.order_name}
                    customerEmail={customerEmail}
                    customerName={customerName}
                    customerMobilePhone={customerPhone.replace(/[^0-9]/g, '') || undefined}
                    successUrl={successUrl}
                    failUrl={failUrl}
                  />
                </div>
              ) : (
                <>
                  <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                    <div className="p-4 border-b">
                      <h2 className="font-semibold text-gray-900">입금 계좌 안내</h2>
                    </div>
                    <div className="p-4 space-y-3">
                      <div className="bg-gray-50 rounded-lg p-4">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm text-gray-600">은행</span>
                          <span className="text-sm font-medium text-gray-900">우리은행</span>
                        </div>
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm text-gray-600">계좌번호</span>
                          <span className="text-sm font-bold text-gray-900">1005-904-144208</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">예금주</span>
                          <span className="text-sm font-medium text-gray-900">김현준(피스코프)</span>
                        </div>
                      </div>
                      <div className="flex justify-between items-center px-1">
                        <span className="text-sm text-gray-600">입금 금액</span>
                        <span className="text-base font-bold text-blue-600">{totalAmount.toLocaleString()}원</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2">
                    <Clock className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                    <p className="text-xs text-amber-800">
                      위 계좌로 입금해 주시면 관리자가 확인 후 구매가 확정됩니다. 입금이 확인되지 않으면 주문이 취소될 수 있습니다.
                    </p>
                  </div>

                  <button
                    onClick={handleBankTransferOrder}
                    disabled={bankTransferLoading}
                    className="w-full py-4 bg-black text-white rounded-xl font-medium text-lg hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    {bankTransferLoading ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        처리 중...
                      </span>
                    ) : '주문하기'}
                  </button>
                </>
              )}

              <button
                onClick={() => setShowPayment(false)}
                className="w-full py-3 border border-gray-300 rounded-xl font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                정보 수정하기
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}
