"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/store/useAuthStore";

type Order = {
  id: string;
  payment_method?: string;
  total_amount: number;
  name?: string;
  email?: string;
  phone_num?: string;
  address?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country_code?: string;
  delivery_method?: string;
};

type OrderItem = {
  product_name: string;
  option: string;
  quantity: number;
  total_price: number;
};

/**
 * Purchase Complete Page
 *
 * Displays order confirmation after successful payment.
 */
function PurchaseCompleteContent() {
  const searchParams = useSearchParams();
  const { isAuthenticated } = useAuthStore();
  const [orderId, setOrderId] = useState<string | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [notificationSent, setNotificationSent] = useState(false);
  const [isTestMode, setIsTestMode] = useState(false);

  useEffect(() => {
    const orderIdParam = searchParams.get('orderId');
    const testModeParam = searchParams.get('testMode');
    setOrderId(orderIdParam);
    setIsTestMode(testModeParam === 'true');

    // Fetch order details to check payment method
    if (orderIdParam) {
      const fetchOrder = async () => {
        try {
          // const { getOrderById } = await import('@/lib/orders');
          // const result = await getOrderById(orderIdParam);
          // if (result.success && result.data) {
          //   const orderData = result.data.order;
          //   setOrder(orderData as Order);
          //   setOrderItems(result.data.items || []);
          // }
        } catch (error) {
          console.error('Error fetching order:', error);
        } finally {
          setLoading(false);
        }
      };
      fetchOrder();
    } else {
      setLoading(false);
    }
  }, [searchParams]);

  // Separate effect for sending Discord notification
  // useEffect(() => {
  //   if (order && orderId && orderItems.length > 0 && !notificationSent) {
  //     const items = orderItems.map((item) =>
  //       `- ${item.product_name}${item.option ? ` (${item.option})` : ''} x${item.quantity} - ${formatKRW(item.total_price)}`
  //     ).join('\n') || 'No items';

  //     const message = `🛒 **새로운 주문이 들어왔습니다!**\n\n` +
  //       `**주문번호:** ${orderId}\n` +
  //       `**총 금액:** ${formatKRW(order.total_amount)}\n\n` +
  //       `**고객 정보:**\n` +
  //       `- 이름: ${order.name || 'N/A'}\n` +
  //       `- 이메일: ${order.email || 'N/A'}\n` +
  //       `- 전화번호: ${order.phone_num || 'N/A'}\n\n` +
  //       `**주문 상품:**\n${items}\n\n` +
  //       `**주문 시간:** ${new Date().toLocaleString('ko-KR')}`;

  //     sendDiscordMessage({ message });
  //     setNotificationSent(true);
  //   }
  // }, [order, orderId, orderItems, notificationSent]);


  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 font-sans text-foreground flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4"></div>
          <p className="text-zinc-600">{order?.payment_method === "paypal" ? "Loading..." : "로딩 중..."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 font-sans text-foreground">
      <main className="max-w-2xl mx-auto p-8">
        <div className="bg-white rounded-lg border border-black/6 shadow-sm p-8 md:p-12 text-center">
          {/* Test Mode Badge */}
          {isTestMode && (
            <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-center justify-center gap-2 text-yellow-800">
                <span className="text-2xl">⚠️</span>
                <span className="font-semibold">테스트 모드 주문</span>
              </div>
              <p className="text-sm text-yellow-700 mt-2">
                이 주문은 테스트 모드로 생성되었습니다. 실제 결제가 진행되지 않았습니다.
              </p>
            </div>
          )}

          {/* Success Icon */}
          <div className="mb-6">
            <div className={`w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto`}>
              <svg
                className={`w-12 h-12 text-green-600`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
          </div>

          {/* Title */}
          <h1 className="text-3xl font-semibold text-black mb-4">
            {isTestMode ? '테스트 주문이 생성되었습니다!' : '결제가 완료되었습니다!'}
          </h1>

          {/* Order ID */}
          {orderId && (
            <div className="mb-6">
              <p className="text-zinc-600 mb-2">
                주문번호
              </p>
              <p className="text-lg font-mono font-semibold text-black bg-zinc-100 px-4 py-2 rounded-md inline-block">
                {orderId}
              </p>
            </div>
          )}

          {/* Message - Different for PayPal */}
          <p className="text-zinc-600 mb-8">
            주문이 성공적으로 완료되었습니다.<br />
            입력하신 이메일로 주문 확인 메일이 발송됩니다.
          </p>
          

          {/* Action Buttons */}
          <div className="flex flex-col gap-4 justify-center">
            {orderId && (
              <Link
                href={isAuthenticated ? `/order/${orderId}` : `/order/lookup?orderId=${orderId}`}
                className="px-6 py-3 bg-black text-white rounded-md font-medium hover:opacity-90 transition-opacity"
              >
                주문 상세보기
              </Link>
            )}
            <Link
              href="/"
              className="px-6 py-3 bg-zinc-200 text-black rounded-md font-medium hover:opacity-90 transition-opacity"
            >
              쇼핑 계속하기
            </Link>
            <p>
              이메일은 <span className="text-red-500">스팸 {"(Spam)"}</span> 메일에서 확인 부탁드립니다.
            </p>
          </div>

          {/* Guest Signup Prompt */}
          {!isAuthenticated && (
            <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800 font-medium mb-2">
                회원가입하고 더 편리하게 이용하세요
              </p>
              <p className="text-xs text-blue-600 mb-3">
                주문 내역 관리, 디자인 저장, 쿠폰 할인 등 다양한 혜택을 받을 수 있습니다.
              </p>
              <Link
                href="/login"
                className="inline-block px-4 py-2 bg-blue-600 text-white text-sm rounded-md font-medium hover:bg-blue-700 transition"
              >
                회원가입 / 로그인
              </Link>
            </div>
          )}


          {/* Additional Info */}
          <div className="mt-12 pt-8 border-t border-zinc-200">
              <div className="space-y-3 text-sm text-zinc-600">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-zinc-200 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-semibold text-black">1</span>
                  </div>
                  <p className="text-left">주문 확인 메일을 확인해주세요</p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-zinc-200 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-semibold text-black">2</span>
                  </div>
                  <p className="text-left">배송 방법에 따라 상품이 발송됩니다</p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-zinc-200 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-semibold text-black">3</span>
                  </div>
                  <p className="text-left">배송 추적은 주문 상세 페이지에서 확인 가능합니다</p>
                </div>
              </div>
          </div>

          {/* Support Info */}
          {/* <div className="mt-8 p-4 bg-zinc-50 rounded-md">
            <p className="text-xs text-zinc-500">
              문의사항이 있으시면 고객센터로 연락해주세요 <span className="text-black font-semibold">1500-2000</span>
            </p>
          </div> */}
        </div>
      </main>
    </div>
  );
}

export default function PurchaseCompletePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-zinc-50 font-sans text-foreground flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4"></div>
          <p className="text-zinc-600">Loading...</p>
        </div>
      </div>
    }>
      <PurchaseCompleteContent />
    </Suspense>
  );
}
