
'use client'

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { clearCart } from "@/lib/cartService";
import { useCartStore } from "@/store/useCartStore";
import { trackPurchaseAttempt } from "@/lib/gtm-events";

function WidgetSuccessPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    // 결제 시도(intent) 추적 — confirm API 호출 전에 1회 발화. orderId 단위 dedupe로 중복 방지.
    // 이걸 통해 /toss/success 페이지 도달자(=실제 결제 시도자) 수를 GA에서 안정적으로 측정.
    try {
      const orderId = searchParams.get('orderId');
      const amount = Number(searchParams.get('amount')) || 0;
      const dedupeKey = `gtm_purchase_attempt_pushed_${orderId ?? ''}`;
      if (orderId && typeof window !== 'undefined' && !sessionStorage.getItem(dedupeKey)) {
        sessionStorage.setItem(dedupeKey, '1');
        trackPurchaseAttempt({ transaction_id: orderId, value: amount });
      }
    } catch {
      // 트래킹 실패는 무시
    }

    async function confirm() {
      try {
        // Get pending order data from sessionStorage
        const pendingOrderJson = sessionStorage.getItem('pendingTossOrder');
        if (!pendingOrderJson) {
          throw new Error('주문 정보를 찾을 수 없습니다.');
        }

        const { orderData, cartItems } = JSON.parse(pendingOrderJson);

        const requestData = {
          orderId: searchParams.get("orderId"),
          amount: searchParams.get("amount"),
          paymentKey: searchParams.get("paymentKey"),
          orderData,
          cartItems,
        };

        const response = await fetch("/api/toss/confirm", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestData),
        });

        const json = await response.json();

        if (!response.ok || !json.success) {
          throw { message: json.message || json.error || '결제 확인 실패', code: json.code };
        }

        // Purchase 픽셀/GTM 발화는 /payment/complete 도착 페이지에서 수행 (네비게이션 race로 fbq 비콘 유실 방지).
        // 여기서는 페이로드만 sessionStorage에 넘겨둔다.
        try {
          const totalAmount = Number(searchParams.get('amount')) || 0;
          const items = Array.isArray(cartItems)
            ? cartItems.map((it: {
                productId?: string;
                productTitle?: string;
                productColorName?: string;
                size?: string;
                pricePerItem?: number;
                quantity?: number;
                savedDesignId?: string;
              }) => ({
                item_id: it.productId ?? '',
                item_name: it.productTitle ?? '',
                item_variant: it.size,
                price: it.pricePerItem,
                quantity: it.quantity,
                design_id: it.savedDesignId,
              }))
            : [];
          sessionStorage.setItem(
            `meta_purchase_payload_${json.orderId}`,
            JSON.stringify({
              transaction_id: String(json.orderId),
              value: totalAmount,
              items,
            }),
          );
        } catch {
          // 페이로드 저장 실패해도 결제 흐름은 막지 않음
        }

        // Clear pending order data
        sessionStorage.removeItem('pendingTossOrder');

        // Clear cart - DB clear for authenticated users, store clear for all
        clearCart().catch(() => {}); // Silently ignore for guests (no auth session)
        useCartStore.getState().clearCart();

        // Redirect to complete page with order ID
        router.push(`/payment/complete?orderId=${json.orderId}`);
      } catch (error) {
        console.error('Payment confirmation error:', error);
        sessionStorage.removeItem('pendingTossOrder');
        const errorMessage = error instanceof Error ? error.message : '결제 확인 중 오류가 발생했습니다';
        const errorCode = (error as { code?: string })?.code || 'UNKNOWN';
        router.push(`/toss/fail?code=${errorCode}&message=${errorMessage}`);
      }
    }

    confirm();
  }, [searchParams, router]);

  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4"></div>
        <p className="text-lg text-zinc-700">결제를 확인하고 있습니다...</p>
      </div>
    </div>
  );
}

export default function WidgetSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4"></div>
          <p className="text-lg text-zinc-700">결제를 확인하고 있습니다...</p>
        </div>
      </div>
    }>
      <WidgetSuccessPageContent />
    </Suspense>
  );
}
