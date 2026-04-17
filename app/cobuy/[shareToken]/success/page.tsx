'use client'

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams, useParams } from 'next/navigation';
import { CheckCircle, Truck, MapPin, Package, User, Mail, Phone, Store } from 'lucide-react';
import { CoBuySelectedItem } from '@/types/types';
import { formatKstDateLong } from '@/lib/kst';

type ConfirmStatus = 'loading' | 'success' | 'error';

interface ParticipantInfo {
  name: string;
  email: string;
  phone: string | null;
  selected_items: CoBuySelectedItem[];
  total_quantity: number;
  delivery_method: 'pickup' | 'delivery' | null;
  delivery_info: {
    recipientName: string;
    phone: string;
    address: string;
    addressDetail: string;
    postalCode: string;
    memo?: string;
  } | null;
  delivery_fee: number;
  payment_amount: number | null;
  paid_at: string | null;
}

function getErrorDetails(error: unknown): { message: string; code?: string } {
  if (error instanceof Error) {
    const code = (error as { code?: unknown })?.code;
    return {
      message: error.message,
      code: typeof code === 'string' ? code : undefined,
    };
  }

  if (typeof error === 'string') {
    return { message: error };
  }

  if (error && typeof error === 'object') {
    const maybeMessage = (error as { message?: unknown })?.message;
    const maybeError = (error as { error?: unknown })?.error;
    const maybeCode = (error as { code?: unknown })?.code;

    const message =
      typeof maybeMessage === 'string'
        ? maybeMessage
        : typeof maybeError === 'string'
          ? maybeError
          : '결제 확인 중 오류가 발생했습니다';

    return {
      message,
      code: typeof maybeCode === 'string' ? maybeCode : undefined,
    };
  }

  return { message: '결제 확인 중 오류가 발생했습니다' };
}

function CoBuyPaymentSuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams();
  const rawShareToken = params.shareToken;
  const shareToken = Array.isArray(rawShareToken) ? rawShareToken[0] : (rawShareToken as string);
  const [status, setStatus] = useState<ConfirmStatus>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [participant, setParticipant] = useState<ParticipantInfo | null>(null);

  useEffect(() => {
    const confirmPayment = async () => {
      let resolvedParticipantId: string | undefined;
      let resolvedSessionId: string | undefined;

      try {
        const orderId = searchParams.get('orderId');
        const paymentKey = searchParams.get('paymentKey');
        const amountRaw = searchParams.get('amount');
        const amount = amountRaw ? Number(amountRaw) : Number.NaN;

        if (!orderId || !paymentKey || !Number.isFinite(amount)) {
          throw new Error('결제 정보가 올바르지 않습니다.');
        }

        const participantIdFromUrl = searchParams.get('participantId') || undefined;
        const sessionIdFromUrl = searchParams.get('sessionId') || undefined;

        let participantId = participantIdFromUrl;
        let sessionId = sessionIdFromUrl;

        if (!participantId || !sessionId) {
          const pendingPaymentJson = sessionStorage.getItem('pendingCoBuyPayment');
          if (pendingPaymentJson) {
            const pendingPayment = JSON.parse(pendingPaymentJson) as {
              participantId?: string;
              sessionId?: string;
              orderId?: string;
            };
            participantId ||= pendingPayment.participantId;
            sessionId ||= pendingPayment.sessionId;
          }
        }

        if (!participantId || !sessionId) {
          throw new Error('참여자 정보를 찾을 수 없습니다.');
        }

        resolvedParticipantId = participantId;
        resolvedSessionId = sessionId;

        const requestData = {
          orderId,
          amount,
          paymentKey,
          participantId,
          sessionId,
        };

        const response = await fetch('/api/cobuy/payment/confirm', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestData),
        });

        const responseClone = response.clone();
        let json: unknown;
        try {
          json = await response.json();
        } catch (parseError) {
          const text = await responseClone.text().catch(() => '');
          const error = new Error('결제 확인 응답을 처리하지 못했습니다.');
          (error as { code?: string }).code = 'INVALID_RESPONSE';
          (error as { cause?: unknown }).cause = parseError;
          console.error('CoBuy payment confirmation parse error:', {
            status: response.status,
            text,
          });
          throw error;
        }

        if (!response.ok || !(json as { success?: boolean } | null)?.success) {
          const errorMessage =
            typeof (json as { message?: unknown })?.message === 'string'
              ? (json as { message: string }).message
              : typeof (json as { error?: unknown })?.error === 'string'
                ? (json as { error: string }).error
                : '결제 확인 실패';

          const errorCode = (json as { code?: unknown })?.code;
          const error = new Error(errorMessage);
          if (typeof errorCode === 'string') {
            (error as { code?: string }).code = errorCode;
          }

          console.error('CoBuy payment confirmation failed:', {
            status: response.status,
            errorMessage,
            errorCode,
          });
          throw error;
        }

        sessionStorage.removeItem('pendingCoBuyPayment');

        // Extract participant data from response
        const participantData = (json as { participant?: ParticipantInfo })?.participant;
        if (participantData) {
          setParticipant(participantData);
        }

        setStatus('success');
      } catch (error) {
        const { message, code } = getErrorDetails(error);
        console.error('CoBuy payment confirmation error:', message, code);
        setErrorMessage(message);
        setStatus('error');
        const failParams = new URLSearchParams({
          code: code || 'UNKNOWN',
          message,
        });
        const participantId = resolvedParticipantId || searchParams.get('participantId') || undefined;
        const sessionId = resolvedSessionId || searchParams.get('sessionId') || undefined;
        if (participantId) failParams.set('participantId', participantId);
        if (sessionId) failParams.set('sessionId', sessionId);
        router.replace(`/cobuy/${shareToken}/fail?${failParams.toString()}`);
      }
    };

    confirmPayment();
  }, [router, searchParams, shareToken]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4" />
          <p className="text-lg text-gray-700">결제를 확인하고 있습니다...</p>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">{errorMessage || '결제 확인에 실패했습니다.'}</p>
      </div>
    );
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ko-KR').format(amount) + '원';
  };

  const formatDate = (dateString: string) => formatKstDateLong(dateString);

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-lg mx-auto">
        {/* Success Header */}
        <div className="bg-white rounded-2xl shadow-sm p-6 text-center mb-4">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">결제가 완료되었습니다</h1>
          <p className="text-gray-600">
            공동구매 참여가 정상적으로 접수되었습니다.
          </p>
        </div>

        {participant && (
          <>
            {/* Order Info */}
            <div className="bg-white rounded-2xl shadow-sm p-6 mb-4">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Package className="w-5 h-5" />
                주문 정보
              </h2>

              {/* Selected Items */}
              <div className="space-y-2 mb-4">
                {participant.selected_items && participant.selected_items.length > 0 ? (
                  participant.selected_items.map((item, index) => (
                    <div key={index} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
                      <span className="text-gray-700">{item.size}</span>
                      <span className="text-gray-900 font-medium">{item.quantity}개</span>
                    </div>
                  ))
                ) : (
                  <div className="text-gray-500">주문 항목 정보 없음</div>
                )}
              </div>

              <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                <span className="text-gray-700">총 수량</span>
                <span className="text-gray-900 font-semibold">{participant.total_quantity}개</span>
              </div>
            </div>

            {/* Delivery Info */}
            <div className="bg-white rounded-2xl shadow-sm p-6 mb-4">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                {participant.delivery_method === 'delivery' ? (
                  <Truck className="w-5 h-5" />
                ) : (
                  <Store className="w-5 h-5" />
                )}
                {participant.delivery_method === 'delivery' ? '배송 정보' : '수령 방법'}
              </h2>

              {participant.delivery_method === 'pickup' && (
                <div className="text-gray-700">
                  <p className="font-medium">직접 수령</p>
                  <p className="text-sm text-gray-500 mt-1">주최자에게 직접 수령합니다.</p>
                </div>
              )}

              {participant.delivery_method === 'delivery' && participant.delivery_info && (
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <User className="w-4 h-4 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-sm text-gray-500">받는 분</p>
                      <p className="text-gray-900">{participant.delivery_info.recipientName}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Phone className="w-4 h-4 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-sm text-gray-500">연락처</p>
                      <p className="text-gray-900">{participant.delivery_info.phone}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-sm text-gray-500">배송지</p>
                      <p className="text-gray-900">
                        ({participant.delivery_info.postalCode}) {participant.delivery_info.address}
                        {participant.delivery_info.addressDetail && `, ${participant.delivery_info.addressDetail}`}
                      </p>
                    </div>
                  </div>

                  {participant.delivery_info.memo && (
                    <div className="flex items-start gap-3">
                      <div className="w-4 h-4" />
                      <div>
                        <p className="text-sm text-gray-500">배송 메모</p>
                        <p className="text-gray-900">{participant.delivery_info.memo}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Payment Info */}
            <div className="bg-white rounded-2xl shadow-sm p-6 mb-4">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">결제 정보</h2>

              <div className="space-y-2">
                {participant.delivery_method === 'delivery' && participant.delivery_fee > 0 && (
                  <div className="flex justify-between items-center text-gray-600">
                    <span>배송비</span>
                    <span>{formatCurrency(participant.delivery_fee)}</span>
                  </div>
                )}

                <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                  <span className="text-gray-900 font-medium">총 결제 금액</span>
                  <span className="text-xl font-bold text-gray-900">
                    {participant.payment_amount ? formatCurrency(participant.payment_amount) : '-'}
                  </span>
                </div>

                {participant.paid_at && (
                  <div className="text-right text-sm text-gray-500">
                    {formatDate(participant.paid_at)}
                  </div>
                )}
              </div>
            </div>

            {/* Contact Info */}
            <div className="bg-white rounded-2xl shadow-sm p-6 mb-4">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">참여자 정보</h2>

              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <User className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-900">{participant.name}</span>
                </div>

                <div className="flex items-center gap-3">
                  <Mail className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-900">{participant.email}</span>
                </div>

                {participant.phone && (
                  <div className="flex items-center gap-3">
                    <Phone className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-900">{participant.phone}</span>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* Action Button */}
        <button
          type="button"
          onClick={() => router.push(`/cobuy/${shareToken}`)}
          className="w-full py-4 rounded-xl bg-black text-white font-medium hover:bg-gray-800 transition"
        >
          공동구매 페이지로 돌아가기
        </button>
      </div>
    </div>
  );
}

export default function CoBuyPaymentSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4" />
          <p className="text-lg text-gray-700">결제를 확인하고 있습니다...</p>
        </div>
      </div>
    }>
      <CoBuyPaymentSuccessContent />
    </Suspense>
  );
}
