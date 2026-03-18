'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';

function PaymentCompleteContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated } = useAuthStore();
  const orderId = searchParams.get('orderId');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Verify that we have an order ID
    if (!orderId) {
      router.push('/home');
      return;
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
          {/* Success Icon */}
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6">
            <CheckCircle className="w-12 h-12 text-green-600" />
          </div>

          {/* Title */}
          <h1 className="text-2xl font-bold text-black mb-2">
            결제가 완료되었습니다!
          </h1>

          <p className="text-gray-600 mb-8">
            주문이 성공적으로 접수되었습니다.
          </p>

          {/* Order ID */}
          <div className="w-full bg-gray-50 rounded-lg p-4 mb-8">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-gray-600">주문번호</span>
              <span className="text-sm font-medium text-black">{orderId}</span>
            </div>
            <p className="text-xs text-gray-500 mt-4">
              주문 내역은 이메일로 전송됩니다.
            </p>
          </div>

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