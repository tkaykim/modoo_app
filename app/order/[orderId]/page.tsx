'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase-client';
import { useAuthStore } from '@/store/useAuthStore';
import { ChevronLeft, Package, Phone, X, XCircle, MessageSquare, Send } from 'lucide-react';
import Link from 'next/link';
import { OrderItem } from '@/types/types';
import DesignChatSection from '@/app/components/DesignChatSection';

interface OrderDetail {
  id: string;
  user_id: string | null;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  shipping_method: 'domestic' | 'international' | 'pickup';
  country_code: string | null;
  state: string | null;
  city: string | null;
  postal_code: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  delivery_fee: number;
  total_amount: number;
  payment_method: string | null;
  payment_status: string;
  order_status: string;
  created_at: string;
  updated_at: string;
  order_items: OrderItem[];
}

const orderStatusMap: Record<string, { label: string; color: string }> = {
  payment_pending: { label: '결제대기', color: 'text-amber-700' },
  payment_completed: { label: '결제완료', color: 'text-blue-700' },
  in_production: { label: '제작중', color: 'text-yellow-700' },
  shipping: { label: '배송중', color: 'text-indigo-700' },
  delivered: { label: '배송완료', color: 'text-green-700' },
  cancelled: { label: '취소', color: 'text-red-600' },
  partially_cancelled: { label: '부분취소', color: 'text-red-600' },
};

const progressSteps = [
  { key: 'payment_pending', label: '결제대기' },
  { key: 'payment_completed', label: '결제완료' },
  { key: 'in_production', label: '제작중' },
  { key: 'shipping', label: '배송중' },
  { key: 'delivered', label: '배송완료' },
];

function getProgressStep(orderStatus: string): number {
  const idx = progressSteps.findIndex(s => s.key === orderStatus);
  return idx >= 0 ? idx + 1 : 0;
}

export default function OrderDetailPage() {
  const router = useRouter();
  const params = useParams();
  const orderId = params.orderId as string;
  const { isAuthenticated, user } = useAuthStore();

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showInquiryModal, setShowInquiryModal] = useState(false);
  const [chatItem, setChatItem] = useState<OrderItem | null>(null);

  useEffect(() => {
    const fetchOrder = async () => {
      setIsLoading(true);
      setError(null);

      const supabase = createClient();
      const { data: { user: supabaseUser } } = await supabase.auth.getUser();
      const userId = supabaseUser?.id || user?.id;

      if (!userId) {
        router.replace(`/order/lookup?orderId=${encodeURIComponent(orderId)}`);
        return;
      }

      const { data, error: fetchError } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (*)
        `)
        .eq('id', orderId)
        .eq('user_id', userId)
        .single();

      if (fetchError || !data) {
        router.replace(`/order/lookup?orderId=${encodeURIComponent(orderId)}`);
        return;
      }

      setOrder(data as OrderDetail);
      setIsLoading(false);
    };

    if (orderId) {
      fetchOrder();
    }
  }, [orderId, user?.id, router]);

  const formatPrice = (price: number) => {
    return price.toLocaleString('ko-KR');
  };

  if (!isAuthenticated) {
    router.replace(`/order/lookup?orderId=${encodeURIComponent(orderId)}`);
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]" />
          <p className="text-gray-500 mt-4">주문 조회 페이지로 이동 중...</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]" />
          <p className="text-gray-500 mt-4">주문 정보를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-gray-50 pb-20">
        <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="max-w-4xl mx-auto px-4 py-4">
            <div className="flex items-center">
              <button
                onClick={() => router.back()}
                className="p-2 hover:bg-gray-100 rounded-full transition mr-2"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <h1 className="text-lg font-bold">주문 상세</h1>
            </div>
          </div>
        </header>
        <div className="max-w-4xl mx-auto p-4">
          <div className="text-center py-20">
            <Package className="w-16 h-16 mx-auto mb-4 text-gray-400" />
            <p className="text-red-500 mb-4">{error || '주문을 찾을 수 없습니다.'}</p>
            <div className="space-y-3">
              <button
                onClick={() => router.push(`/order/lookup?orderId=${encodeURIComponent(orderId)}`)}
                className="px-6 py-3 bg-black text-white rounded-lg font-medium hover:bg-gray-800 transition-colors"
              >
                주문번호로 조회하기
              </button>
              <button
                onClick={() => router.push('/home/my-page/orders')}
                className="block mx-auto px-6 py-3 text-gray-600 text-sm hover:text-gray-800 transition-colors"
              >
                주문 내역으로 돌아가기
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const status = order.order_status?.toLowerCase() || 'payment_completed';
  const orderStatus = orderStatusMap[status] || orderStatusMap.payment_completed;
  const isCancelled = status === 'cancelled' || status === 'partially_cancelled';
  const currentStep = getProgressStep(status);
  const itemsSubtotal = order.order_items.reduce(
    (sum, item) => sum + (item.price_per_item ?? 0) * (item.quantity ?? 0), 0
  );
  const workCost = order.total_amount - itemsSubtotal - order.delivery_fee;

  const orderDate = new Date(order.created_at);
  const formattedOrderDate = `${orderDate.getFullYear()}. ${orderDate.getMonth() + 1}. ${orderDate.getDate()} 주문`;

  return (
    <div className="min-h-screen bg-gray-100 pb-20">
      {/* Header */}
      <header className="bg-white sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center">
          <button
            onClick={() => router.back()}
            className="p-1 mr-2"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-base font-bold">주문상세</h1>
        </div>

        {/* Progress Stepper or Cancelled Banner */}
        {isCancelled ? (
          <div className="max-w-4xl mx-auto px-4 pb-4">
            <div className="flex items-center gap-2 bg-red-50 rounded-lg px-4 py-3">
              <XCircle className="w-5 h-5 text-red-500 shrink-0" />
              <span className="text-sm font-bold text-red-600">
                {status === 'cancelled' ? '주문이 취소되었습니다' : '주문이 부분 취소되었습니다'}
              </span>
            </div>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto px-8 pb-4">
            <div className="flex items-center justify-between relative">
              {/* Connector lines */}
              <div className="absolute top-3 left-0 right-0 flex items-center px-4">
                {progressSteps.slice(1).map((_, i) => (
                  <div key={i} className={`flex-1 h-0.5 ${i + 2 <= currentStep ? 'bg-black' : 'bg-gray-300'}`} />
                ))}
              </div>
              {/* Steps */}
              {progressSteps.map((step, i) => (
                <div key={step.key} className="flex flex-col items-center relative z-10">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border-2 ${
                    i + 1 <= currentStep
                      ? 'bg-black border-black text-white'
                      : 'bg-white border-gray-300 text-gray-400'
                  }`}>
                    {i + 1}
                  </div>
                  <span className={`text-xs mt-1 ${i + 1 <= currentStep ? 'text-black font-medium' : 'text-gray-400'}`}>
                    {step.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="border-b border-gray-200" />
      </header>

      {/* Date & Order Number */}
      <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between bg-white">
        <span className="text-sm font-medium text-gray-900">{formattedOrderDate}</span>
        <span className="text-xs text-gray-500">주문번호 {order.id.slice(0, 16)}</span>
      </div>

      <div className="max-w-4xl mx-auto">
        {/* Design Review Banner */}
        {order.order_items.some((item) =>
          item.design_status === 'design_shared' || item.design_status === 'revision_requested'
        ) && (
          <Link
            href={`/order/${orderId}/design-review`}
            className="block bg-purple-50 border border-purple-200 mt-2 mx-4 rounded-xl p-4 hover:bg-purple-100 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center shrink-0">
                <Send className="w-5 h-5 text-purple-600" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-purple-900 text-sm">시안 확인이 필요합니다</p>
                <p className="text-xs text-purple-600 mt-0.5">디자인 시안을 확인하고 확정해주세요</p>
              </div>
              <ChevronLeft className="w-5 h-5 text-purple-400 rotate-180" />
            </div>
          </Link>
        )}

        {/* 결제 정보 */}
        <div className="bg-white mt-2 px-4 py-4">
          <h2 className="text-sm font-bold mb-3">결제 정보</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">상품 가격</span>
              <span>{formatPrice(itemsSubtotal)} 원</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">배송비</span>
              <span>{order.delivery_fee > 0 ? `${formatPrice(order.delivery_fee)} 원` : '0 원'}</span>
            </div>
            {workCost !== 0 && (
              <div className={`flex justify-between ${workCost > 0 ? 'text-indigo-600' : 'text-green-600'}`}>
                <span>작업비용</span>
                <span>{workCost > 0 ? '+' : ''}{formatPrice(workCost)} 원</span>
              </div>
            )}
          </div>
          <div className="border-t border-gray-200 my-3" />
          <div className="space-y-2 text-sm">
            <div className="flex justify-between font-bold">
              <span>총 결제금액</span>
              <span>{formatPrice(order.total_amount)} 원</span>
            </div>
          </div>
        </div>

        {/* Shipping Info */}
        <div className="bg-white mt-2 px-4 py-4">
          <h2 className="text-sm font-bold mb-3">배송지</h2>
          <div className="border border-gray-200 rounded-lg p-4">
            <p className="font-bold text-sm">{order.customer_name}</p>
            {order.shipping_method !== 'pickup' && order.address_line_1 && (
              <p className="text-sm text-gray-700 mt-1">
                {order.postal_code && `(${order.postal_code}) `}
                {order.address_line_1}
                {order.address_line_2 && ` ${order.address_line_2}`}
                {(order.city || order.state) && (
                  <span className="block text-gray-500 text-xs mt-0.5">
                    {[order.city, order.state, order.country_code].filter(Boolean).join(', ')}
                  </span>
                )}
              </p>
            )}
            {order.shipping_method === 'pickup' && (
              <p className="text-sm text-gray-700 mt-1">직접 수령</p>
            )}
            <p className="text-sm text-gray-700 mt-1">{order.customer_phone}</p>
          </div>
        </div>

        {/* Order Items */}
        {order.order_items.map((item) => {
          const variants = item.item_options?.variants || [];
          const totalQuantity = variants.reduce((sum, v) => sum + v.quantity, 0) || item.quantity;

          return (
            <div key={item.id} className="bg-white mt-2 px-4 py-4">
              {/* Status header */}
              <div className="flex items-center gap-2 mb-3">
                <span className={`text-sm font-bold ${orderStatus.color}`}>
                  {orderStatus.label}
                </span>
                {item.design_status && item.design_status !== 'pending' && (
                  <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full ${
                    item.design_status === 'confirmed' ? 'bg-green-100 text-green-700' :
                    item.design_status === 'design_shared' ? 'bg-purple-100 text-purple-700' :
                    item.design_status === 'revision_requested' ? 'bg-amber-100 text-amber-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {item.design_status === 'confirmed' ? '시안확정' :
                     item.design_status === 'design_shared' ? '시안확인 필요' :
                     item.design_status === 'revision_requested' ? '수정요청' :
                     item.design_status}
                  </span>
                )}
              </div>

              {/* Item */}
              <div className="flex gap-3">
                <div className="w-16 h-16 rounded border border-gray-200 bg-gray-50 overflow-hidden shrink-0">
                  {item.thumbnail_url ? (
                    <img
                      src={item.thumbnail_url}
                      alt={item.product_title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">
                      없음
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900 leading-snug line-clamp-2">{item.product_title}</p>
                  {item.design_title && (
                    <p className="text-xs text-gray-500 mt-0.5">디자인: {item.design_title}</p>
                  )}
                  <p className="text-sm text-gray-700 mt-1">
                    {formatPrice(item.price_per_item)}원 · {totalQuantity}개
                  </p>
                </div>
              </div>

              {/* Variants */}
              {variants.length > 0 && (
                <div className="mt-2 ml-19 space-y-1">
                  {variants.map((variant, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-1.5 text-xs text-gray-500"
                    >
                      <div
                        className="w-2.5 h-2.5 rounded-full border border-gray-300"
                        style={{ backgroundColor: variant.color_hex }}
                      />
                      <span>{variant.color_name} / {variant.size_name}</span>
                      <span>x {variant.quantity}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Design Chat Button */}
              <button
                onClick={() => setChatItem(item)}
                className="mt-3 flex items-center gap-1.5 text-xs text-blue-600 font-medium hover:text-blue-700 transition-colors"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                디자인 소통
              </button>
            </div>
          );
        })}

        {/* Action Buttons */}
        <div className="mt-2 px-4 py-3 space-y-2">
          <button
            onClick={() => setShowInquiryModal(true)}
            className="w-full py-3 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-900"
          >
            문의하기
          </button>
        </div>
      </div>

      {/* Design Chat */}
      {chatItem && (
        <DesignChatSection
          orderId={orderId}
          orderItemId={chatItem.id}
          productTitle={chatItem.product_title}
          designTitle={chatItem.design_title || undefined}
          onClose={() => setChatItem(null)}
        />
      )}

      {/* Inquiry Modal */}
      {showInquiryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowInquiryModal(false)}>
          <div className="bg-white rounded-2xl mx-4 w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold">문의하기</h3>
              <button onClick={() => setShowInquiryModal(false)} className="p-1 hover:bg-gray-100 rounded-full transition">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              <a
                href="http://pf.kakao.com/_xjSdYG/chat"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-3 bg-[#FEE500] text-[#191919] rounded-xl font-semibold text-sm hover:brightness-95 transition"
              >
                <img src="/icons/kakaotalk_channel.png" alt="카카오톡" className="w-5 h-5" />
                카카오톡으로 문의하기
              </a>
              <a
                href="tel:01081400621"
                className="flex items-center justify-center gap-2 w-full py-3 bg-white border-2 border-gray-200 text-gray-700 rounded-xl font-semibold text-sm hover:bg-gray-50 transition"
              >
                <Phone className="w-4 h-4" />
                전화로 문의하기
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
