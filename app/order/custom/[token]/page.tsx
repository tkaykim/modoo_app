'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Script from 'next/script';
import { Package, MapPin, Search, Loader2, ShieldCheck, CheckCircle2 } from 'lucide-react';
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
  const [formError, setFormError] = useState<string | null>(null);

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

        setOrderData(data.data);
        setCustomerName(data.data.customer_name || '');
        setCustomerEmail(data.data.customer_email || '');
        setCustomerPhone(data.data.customer_phone || '');

        if (data.data.shipping_method) {
          setShippingMethod(data.data.shipping_method === 'pickup' ? 'pickup' : 'domestic');
        }

        if (data.data.address_line_1) {
          setDomesticAddress({
            roadAddress: data.data.address_line_1,
            jibunAddress: '',
            detailAddress: data.data.address_line_2 || '',
            postalCode: data.data.postal_code || '',
            state: data.data.state || '',
            city: data.data.city || '',
          });
        }
      } catch {
        setError('주문 정보를 불러올 수 없습니다.');
      } finally {
        setIsLoading(false);
      }
    };

    if (token) fetchOrder();
  }, [token]);

  const totalAmount = orderData?.total_amount ?? 0;
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
    if (shippingMethod === 'domestic' && !domesticAddress.roadAddress) {
      setFormError('배송 주소를 입력해주세요.');
      return false;
    }
    setFormError(null);
    return true;
  };

  const handleProceedToPayment = async () => {
    if (!validateForm()) return;

    // Save customer info to order before payment
    try {
      const res = await fetch(`/api/order/custom/${token}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
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
        }),
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
          {/* Design Preview */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="p-4 border-b">
              <h2 className="font-semibold text-gray-900">주문 상품</h2>
            </div>
            <div className="p-4">
              <div className="flex gap-4">
                {orderData.design_preview_url ? (
                  <div className="w-24 h-24 bg-gray-100 rounded-lg overflow-hidden shrink-0">
                    <img src={orderData.design_preview_url} alt="디자인 미리보기" className="w-full h-full object-contain" />
                  </div>
                ) : (
                  <div className="w-24 h-24 bg-gray-100 rounded-lg flex items-center justify-center shrink-0">
                    <Package className="w-8 h-8 text-gray-300" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900">{orderData.product_title}</p>
                  {orderData.order_items?.[0] && (
                    <>
                      <p className="text-sm text-gray-500 mt-1">
                        수량: {orderData.order_items[0].quantity}개
                      </p>
                      <p className="text-sm text-gray-500">
                        단가: {orderData.order_items[0].price_per_item.toLocaleString()}원
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Price Summary */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="p-4 border-b">
              <h2 className="font-semibold text-gray-900">결제 금액</h2>
            </div>
            <div className="p-4 space-y-2">
              {hasAdjustments && orderData.original_amount && (
                <div className="flex justify-between text-sm text-gray-600">
                  <span>상품 금액</span>
                  <span>{orderData.original_amount.toLocaleString()}원</span>
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
              {hasAdjustments && <div className="border-t my-2" />}
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
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="010-0000-0000"
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
                className="w-full py-4 bg-black text-white rounded-xl font-medium text-lg hover:opacity-90 transition-opacity"
              >
                결제하기
              </button>

              <div className="flex items-center justify-center gap-2 text-gray-400 text-xs pb-4">
                <ShieldCheck className="w-4 h-4" />
                <span>안전한 결제 환경이 제공됩니다</span>
              </div>
            </>
          ) : (
            <>
              {/* Toss Payment Widget */}
              <div className="bg-white rounded-xl shadow-sm overflow-hidden p-4">
                <TossPaymentWidget
                  amount={totalAmount}
                  orderId={orderData.id}
                  orderName={orderData.product_title}
                  customerEmail={customerEmail}
                  customerName={customerName}
                  customerMobilePhone={customerPhone || undefined}
                  successUrl={successUrl}
                  failUrl={failUrl}
                />
              </div>

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
