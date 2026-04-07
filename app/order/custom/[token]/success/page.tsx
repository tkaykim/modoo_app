'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';

export default function CustomOrderSuccessPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const paymentKey = searchParams.get('paymentKey');
  const orderId = searchParams.get('orderId');
  const amount = searchParams.get('amount');

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const confirmPayment = async () => {
      if (!paymentKey || !orderId || !amount || !token) {
        setStatus('error');
        setErrorMessage('결제 정보가 올바르지 않습니다.');
        return;
      }

      try {
        const res = await fetch('/api/order/custom/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            paymentKey,
            orderId,
            amount: Number(amount),
            token,
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          setStatus('error');
          setErrorMessage(data.error || '결제 확인에 실패했습니다.');
          return;
        }

        setStatus('success');
      } catch {
        setStatus('error');
        setErrorMessage('결제 확인 중 오류가 발생했습니다.');
      }
    };

    confirmPayment();
  }, [paymentKey, orderId, amount, token]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 font-medium">결제를 확인하고 있습니다...</p>
          <p className="text-gray-400 text-sm mt-2">잠시만 기다려주세요</p>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md mx-auto px-6">
          <XCircle className="w-20 h-20 mx-auto mb-6 text-red-500" />
          <h2 className="text-2xl font-bold mb-2">결제 확인 실패</h2>
          <p className="text-gray-600 mb-6">{errorMessage}</p>
          <p className="text-sm text-gray-500">
            문제가 지속되면 관리자에게 문의해주세요.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center max-w-md mx-auto px-6">
        <CheckCircle2 className="w-20 h-20 mx-auto mb-6 text-green-600" />
        <h2 className="text-2xl font-bold mb-2">결제가 완료되었습니다!</h2>
        <p className="text-gray-600 mb-4">
          주문이 정상적으로 접수되었습니다.
        </p>

        {orderId && (
          <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
            <p className="text-sm text-gray-500 mb-1">주문번호</p>
            <p className="font-medium text-gray-900">{orderId}</p>
          </div>
        )}

        {amount && (
          <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
            <p className="text-sm text-gray-500 mb-1">결제 금액</p>
            <p className="font-bold text-xl text-blue-600">
              {Number(amount).toLocaleString()}원
            </p>
          </div>
        )}

        <p className="text-sm text-gray-500">
          주문 관련 문의사항은 관리자에게 연락해주세요.
        </p>
      </div>
    </div>
  );
}
