'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle, Clock } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { trackPurchase } from '@/lib/gtm-events';

function PaymentCompleteContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated } = useAuthStore();
  const orderId = searchParams.get('orderId');
  const method = searchParams.get('method');
  const isBankTransfer = method === 'bank_transfer';
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!orderId) {
      router.push('/home');
      return;
    }

    // Meta Pixel + GTM Purchase 발화: /toss/success가 sessionStorage에 남긴 페이로드 사용.
    // dedupe 가드(orderId 단위)로 새로고침/뒤로가기 재진입 시 중복 발화 차단.
    try {
      const dedupeKey = `gtm_purchase_pushed_${orderId}`;
      const payloadKey = `meta_purchase_payload_${orderId}`;
      if (typeof window !== 'undefined' && !sessionStorage.getItem(dedupeKey)) {
        const raw = sessionStorage.getItem(payloadKey);
        if (raw) {
          const payload = JSON.parse(raw) as {
            transaction_id: string;
            value: number;
            items: Array<{
              item_id: string;
              item_name: string;
              item_variant?: string;
              price?: number;
              quantity?: number;
              design_id?: string;
            }>;
          };
          if (payload?.transaction_id) {
            trackPurchase({
              transaction_id: payload.transaction_id,
              value: payload.value,
              items: payload.items ?? [],
            });
            sessionStorage.setItem(dedupeKey, '1');
            sessionStorage.removeItem(payloadKey);
          }
        }
      }
    } catch {
      // 트래킹 실패는 결제 완료 화면에 영향 주지 않음
    }

    setIsLoading(false);
  }, [orderId, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-gray-200 border-t-black rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
        <div className="flex flex-col items-center text-center">
          {isBankTransfer ? (
            <>
              <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mb-6">
                <Clock className="w-12 h-12 text-amber-600" />
              </div>

              <h1 className="text-2xl font-bold text-black mb-2">
                주문이 접수되었습니다
              </h1>

              <p className="text-gray-600 mb-4">
                아래 계좌로 입금해 주시면 확인 후 구매가 확정됩니다.
              </p>

              <div className="w-full bg-gray-50 rounded-lg p-4 mb-4">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-sm text-gray-600">주문번호</span>
                  <span className="text-sm font-medium text-black">{orderId}</span>
                </div>
                <div className="border-t border-gray-200 pt-3">
                  <p className="text-sm font-semibold text-black mb-2">입금 계좌</p>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-700">우리은행</span>
                    <span className="text-sm text-black font-bold">1005-904-144208</span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1 text-right">예금주: 김현준(피스코프)</p>
                </div>
              </div>

              <div className="w-full p-3 bg-amber-50 border border-amber-200 rounded-lg mb-8">
                <p className="text-xs text-amber-800">
                  관리자가 입금을 확인한 후 주문이 확정됩니다. 입금이 확인되지 않으면 주문이 취소될 수 있습니다.
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6">
                <CheckCircle className="w-12 h-12 text-green-600" />
              </div>

              <h1 className="text-2xl font-bold text-black mb-2">
                결제가 완료되었습니다!
              </h1>

              <p className="text-gray-600 mb-8">
                주문이 성공적으로 접수되었습니다.
              </p>

              <div className="w-full bg-gray-50 rounded-lg p-4 mb-8">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-gray-600">주문번호</span>
                  <span className="text-sm font-medium text-black">{orderId}</span>
                </div>
                <p className="text-xs text-gray-500 mt-4">
                  주문 내역은 이메일로 전송됩니다.
                </p>
              </div>
            </>
          )}

          {/* Action Buttons */}
          <div className="w-full space-y-3">
            <Link
              href={isAuthenticated ? `/order/${orderId}` : `/order/lookup?orderId=${orderId}`}
              className="w-full block px-6 py-3 bg-black text-white rounded-lg font-medium hover:bg-gray-800 transition text-center"
            >
              주문 상세보기
            </Link>

            <Link
              href="/home"
              className="w-full block px-6 py-3 bg-gray-100 text-black rounded-lg font-medium hover:bg-gray-200 transition text-center"
            >
              계속 쇼핑하기
            </Link>
          </div>

          {/* Guest Signup Prompt */}
          {!isAuthenticated && (
            <div className="w-full mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg text-left">
              <p className="text-sm text-blue-800 font-medium mb-1">
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
        </div>
      </div>
    </div>
  );
}

export default function PaymentCompletePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-gray-200 border-t-black rounded-full animate-spin"></div>
      </div>
    }>
      <PaymentCompleteContent />
    </Suspense>
  );
}