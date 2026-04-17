'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Header from '@/app/components/Header';
import { Search, Package, AlertCircle } from 'lucide-react';
import { formatKstDateOnly } from '@/lib/kst';

interface OrderItemData {
  id: string;
  product_id: string;
  product_title: string;
  quantity: number;
  price_per_item: number;
  design_title: string | null;
  thumbnail_url: string | null;
  item_options: {
    variants?: Array<{
      size_id: string;
      size_name: string;
      color_id: string;
      color_name: string;
      quantity: number;
    }>;
  } | null;
}

interface OrderData {
  id: string;
  customer_name: string;
  customer_email: string;
  shipping_method: 'domestic' | 'international' | 'pickup';
  delivery_fee: number;
  total_amount: number;
  payment_status: string;
  order_status: string;
  coupon_discount: number;
  created_at: string;
  order_items: OrderItemData[];
}

const orderStatusMap: Record<string, { label: string; color: string }> = {
  payment_pending: { label: '결제대기', color: 'bg-amber-100 text-amber-700' },
  payment_completed: { label: '결제완료', color: 'bg-blue-100 text-blue-700' },
  in_production: { label: '제작중', color: 'bg-yellow-100 text-yellow-700' },
  shipping: { label: '배송중', color: 'bg-indigo-100 text-indigo-700' },
  delivered: { label: '배송완료', color: 'bg-green-100 text-green-700' },
  cancelled: { label: '취소', color: 'bg-red-100 text-red-600' },
};

const progressSteps = [
  { key: 'payment_pending', label: '결제대기' },
  { key: 'payment_completed', label: '결제완료' },
  { key: 'in_production', label: '제작중' },
  { key: 'shipping', label: '배송중' },
  { key: 'delivered', label: '배송완료' },
];

function OrderLookupContent() {
  const searchParams = useSearchParams();
  const [orderId, setOrderId] = useState(searchParams.get('orderId') || '');
  const [email, setEmail] = useState('');
  const [order, setOrder] = useState<OrderData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderId.trim() || !email.trim()) {
      setError('주문번호와 이메일을 입력해주세요.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setOrder(null);

    try {
      const response = await fetch('/api/order/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: orderId.trim(), email: email.trim() }),
      });

      const data = await response.json();

      if (!data.success) {
        setError(data.error || '주문을 찾을 수 없습니다.');
        return;
      }

      setOrder(data.order);
    } catch {
      setError('주문 조회 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const currentStep = order
    ? progressSteps.findIndex(s => s.key === order.order_status) + 1
    : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="sticky top-0 bg-white z-50 border-b border-gray-200">
        <Header back={true} />
      </div>

      <div className="max-w-lg mx-auto p-4">
        {/* Lookup Form */}
        <div className="bg-white rounded-lg p-4 mb-4">
          <h1 className="text-lg font-semibold text-black mb-1">주문 조회</h1>
          <p className="text-xs text-gray-500 mb-4">주문번호와 이메일로 주문 상태를 확인하세요.</p>

          <form onSubmit={handleLookup} className="space-y-3">
            <div>
              <label className="block text-sm text-gray-700 mb-1">주문번호</label>
              <input
                type="text"
                value={orderId}
                onChange={(e) => setOrderId(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-black text-sm focus:outline-none focus:ring-2 focus:ring-[#3B55A5]"
                placeholder="ORD-XXXXXXXX-XXXXXX"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">이메일</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-black text-sm focus:outline-none focus:ring-2 focus:ring-[#3B55A5]"
                placeholder="주문 시 입력한 이메일"
              />
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 bg-[#3B55A5] text-white rounded-lg font-medium hover:bg-[#2D4280] transition disabled:bg-gray-400 flex items-center justify-center gap-2 text-sm"
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  조회하기
                </>
              )}
            </button>
          </form>

          {error && (
            <div className="mt-3 p-3 bg-red-50 rounded-lg flex items-center gap-2 text-sm text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}
        </div>

        {/* Order Details */}
        {order && (
          <div className="space-y-3">
            {/* Order Status */}
            <div className="bg-white rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-black">주문 상태</h2>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${orderStatusMap[order.order_status]?.color || 'bg-gray-100 text-gray-700'}`}>
                  {orderStatusMap[order.order_status]?.label || order.order_status}
                </span>
              </div>

              {/* Progress Bar */}
              {order.order_status !== 'cancelled' && (
                <div className="flex items-center gap-1">
                  {progressSteps.map((step, idx) => (
                    <div key={step.key} className="flex-1 flex flex-col items-center">
                      <div className={`w-full h-1.5 rounded-full ${idx < currentStep ? 'bg-[#3B55A5]' : 'bg-gray-200'}`} />
                      <span className={`text-[10px] mt-1 ${idx < currentStep ? 'text-[#3B55A5] font-medium' : 'text-gray-400'}`}>
                        {step.label}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-3 text-xs text-gray-500">
                주문번호: {order.id}
              </div>
              <div className="text-xs text-gray-500">
                주문일: {formatKstDateOnly(order.created_at)}
              </div>
            </div>

            {/* Order Items */}
            <div className="bg-white rounded-lg p-4">
              <h2 className="text-sm font-semibold text-black mb-3">주문 상품</h2>
              <div className="space-y-3">
                {order.order_items.map((item) => (
                  <div key={item.id} className="flex gap-3 pb-3 border-b border-gray-100 last:border-0">
                    <div className="w-16 h-16 bg-gray-100 rounded-lg shrink-0 overflow-hidden">
                      {item.thumbnail_url ? (
                        <img src={item.thumbnail_url} alt={item.product_title} className="w-full h-full object-contain" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="w-6 h-6 text-gray-400" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium text-black truncate">
                        {item.design_title || item.product_title}
                      </h3>
                      {item.item_options?.variants && (
                        <div className="mt-1 space-y-0.5">
                          {item.item_options.variants.map((v, idx) => (
                            <p key={idx} className="text-xs text-gray-500">
                              {v.color_name} / {v.size_name} - {v.quantity}개
                            </p>
                          ))}
                        </div>
                      )}
                      <div className="flex justify-between items-center mt-1">
                        <span className="text-xs text-gray-600">총 {item.quantity}개</span>
                        <span className="text-sm font-medium text-black">
                          {(item.price_per_item * item.quantity).toLocaleString('ko-KR')}원
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Payment Summary */}
            <div className="bg-white rounded-lg p-4">
              <h2 className="text-sm font-semibold text-black mb-3">결제 정보</h2>
              <div className="space-y-2 text-sm">
                {(() => {
                  const itemsSubtotal = order.order_items.reduce(
                    (sum, item) => sum + item.price_per_item * item.quantity, 0
                  );
                  const computedTotal = itemsSubtotal
                    + (order.delivery_fee ?? 0)
                    - (order.coupon_discount ?? 0);
                  const workCost = order.total_amount - computedTotal;
                  return (
                    <>
                      <div className="flex justify-between">
                        <span className="text-gray-600">상품 금액</span>
                        <span className="text-black">{itemsSubtotal.toLocaleString('ko-KR')}원</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">배송비</span>
                        <span className="text-black">{order.delivery_fee.toLocaleString('ko-KR')}원</span>
                      </div>
                      {order.coupon_discount > 0 && (
                        <div className="flex justify-between">
                          <span className="text-blue-600">쿠폰 할인</span>
                          <span className="text-blue-600">-{order.coupon_discount.toLocaleString('ko-KR')}원</span>
                        </div>
                      )}
                      {workCost !== 0 && (
                        <div className={`flex justify-between ${workCost > 0 ? 'text-indigo-600' : 'text-green-600'}`}>
                          <span>작업비용</span>
                          <span>{workCost > 0 ? '+' : ''}{workCost.toLocaleString('ko-KR')}원</span>
                        </div>
                      )}
                    </>
                  );
                })()}
                <div className="h-px bg-gray-200 my-2"></div>
                <div className="flex justify-between font-semibold">
                  <span className="text-black">총 결제금액</span>
                  <span className="text-black">{order.total_amount.toLocaleString('ko-KR')}원</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function OrderLookupPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-gray-200 border-t-[#3B55A5] rounded-full animate-spin"></div>
      </div>
    }>
      <OrderLookupContent />
    </Suspense>
  );
}
