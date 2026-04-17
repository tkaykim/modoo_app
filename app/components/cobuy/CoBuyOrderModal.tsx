'use client';

import { useState, useMemo } from 'react';
import { X, Calendar, Users, ShoppingBag, Package, AlertCircle } from 'lucide-react';
import { CoBuySession, CoBuyParticipant } from '@/types/types';
import { updateCoBuySession } from '@/lib/cobuyService';
import { formatKstDateOnly, formatKstDateInputValue } from '@/lib/kst';

interface CoBuyOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: CoBuySession;
  participants: CoBuyParticipant[];
  onOrderCreated: () => void;
  onSessionUpdated: (session: CoBuySession) => void;
  shareToken?: string;
}

type ModalView = 'summary' | 'extend';

export default function CoBuyOrderModal({
  isOpen,
  onClose,
  session,
  participants,
  onOrderCreated,
  onSessionUpdated,
  shareToken,
}: CoBuyOrderModalProps) {
  const [view, setView] = useState<ModalView>('summary');
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [isExtending, setIsExtending] = useState(false);
  const [newEndDate, setNewEndDate] = useState(formatKstDateInputValue(session.end_date));
  const [error, setError] = useState<string | null>(null);

  const isSurveyMode = session.payment_mode === 'survey';

  const completedParticipants = useMemo(
    () => participants.filter((p) =>
      isSurveyMode
        ? p.payment_status === 'not_required'
        : p.payment_status === 'completed'
    ),
    [participants, isSurveyMode]
  );

  const totalQuantity = useMemo(
    () =>
      completedParticipants.reduce((sum, p) => sum + (p.total_quantity || 0), 0),
    [completedParticipants]
  );

  const totalPaid = useMemo(
    () =>
      completedParticipants.reduce(
        (sum, p) => sum + (p.payment_amount || 0),
        0
      ),
    [completedParticipants]
  );

  // Aggregate variants for order summary
  const aggregatedVariants = useMemo(() => {
    const variantMap = new Map<string, { size: string; quantity: number }>();

    completedParticipants.forEach((participant) => {
      const items = participant.selected_items || [];
      items.forEach((item) => {
        const key = item.size;
        if (variantMap.has(key)) {
          variantMap.get(key)!.quantity += item.quantity;
        } else {
          variantMap.set(key, { size: item.size, quantity: item.quantity });
        }
      });

      // Fallback to legacy selected_size if no selected_items
      if (items.length === 0 && participant.selected_size) {
        const key = participant.selected_size;
        if (variantMap.has(key)) {
          variantMap.get(key)!.quantity += 1;
        } else {
          variantMap.set(key, { size: participant.selected_size, quantity: 1 });
        }
      }
    });

    return Array.from(variantMap.values()).sort((a, b) =>
      a.size.localeCompare(b.size)
    );
  }, [completedParticipants]);

  const handleCreateOrder = async () => {
    if (completedParticipants.length === 0) {
      setError(isSurveyMode ? '참여자가 없습니다.' : '결제가 완료된 참여자가 없습니다.');
      return;
    }

    setIsCreatingOrder(true);
    setError(null);

    try {
      const response = await fetch('/api/cobuy/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: session.id,
          ...(shareToken ? { shareToken } : {}),
          orderData: {
            id: `CB-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            name: '공동구매 주문',
            email: '',
            phone_num: '',
            shipping_method: 'pickup',
            delivery_fee: 0,
            total_amount: 0,
            address_line_1: null,
            address_line_2: null,
            country_code: null,
            state: null,
            city: null,
            postal_code: null,
          },
          variants: aggregatedVariants,
        }),
      });

      const result = await response.json();

      if (result.success) {
        onOrderCreated();
        onClose();
      } else {
        setError(result.error || '주문 생성에 실패했습니다.');
      }
    } catch (err) {
      console.error('Error creating order:', err);
      setError('주문 생성 중 오류가 발생했습니다.');
    } finally {
      setIsCreatingOrder(false);
    }
  };

  const handleExtendSession = async () => {
    const selectedDate = new Date(newEndDate);
    const currentEndDate = new Date(session.end_date);

    if (selectedDate <= currentEndDate) {
      setError('새 종료일은 현재 종료일보다 이후여야 합니다.');
      return;
    }

    setIsExtending(true);
    setError(null);

    try {
      if (shareToken) {
        const res = await fetch('/api/cobuy/host/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ shareToken, action: 'extend_end_date', endDate: selectedDate.toISOString() }),
        });
        const json = await res.json();
        if (res.ok && json.data) {
          onSessionUpdated(json.data);
          setView('summary');
        } else {
          setError(json.error || '종료일 연장에 실패했습니다.');
        }
      } else {
        const updated = await updateCoBuySession(session.id, {
          endDate: selectedDate,
        });
        if (updated) {
          onSessionUpdated(updated);
          setView('summary');
        } else {
          setError('종료일 연장에 실패했습니다.');
        }
      }
    } catch (err) {
      console.error('Error extending session:', err);
      setError('종료일 연장 중 오류가 발생했습니다.');
    } finally {
      setIsExtending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900">
            {view === 'summary' ? '공동구매 주문' : '기간 연장'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto max-h-[calc(90vh-140px)]">
          {view === 'summary' ? (
            <>
              {/* Session Info */}
              <div className="bg-gray-50 rounded-xl p-4 mb-4">
                <h3 className="font-medium text-gray-900 mb-3">{session.title}</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-2 text-gray-600">
                    <Calendar className="w-4 h-4" />
                    <span>
                      종료일: {formatKstDateOnly(session.end_date)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-600">
                    <Users className="w-4 h-4" />
                    <span>참여자: {completedParticipants.length}명</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-600">
                    <ShoppingBag className="w-4 h-4" />
                    <span>총 수량: {totalQuantity}벌</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-600">
                    <Package className="w-4 h-4" />
                    <span>총 금액: ₩{totalPaid.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Variant Summary */}
              {aggregatedVariants.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">
                    사이즈별 수량
                  </h4>
                  <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
                    {aggregatedVariants.map((variant) => (
                      <div
                        key={variant.size}
                        className="flex justify-between items-center px-4 py-2"
                      >
                        <span className="text-gray-900">{variant.size}</span>
                        <span className="font-medium text-gray-700">
                          {variant.quantity}벌
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Minimum quantity warning */}
              {session.min_quantity && totalQuantity < session.min_quantity && (
                <div className="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg mb-4">
                  <AlertCircle className="w-5 h-5 text-yellow-600 shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-yellow-800">
                      최소 수량 미달
                    </p>
                    <p className="text-yellow-700">
                      최소 {session.min_quantity}벌 필요 (현재 {totalQuantity}벌,{' '}
                      {session.min_quantity - totalQuantity}벌 더 필요)
                    </p>
                  </div>
                </div>
              )}

              {/* Error message */}
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg mb-4">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              {/* No participants warning */}
              {completedParticipants.length === 0 && (
                <div className="flex items-start gap-2 p-3 bg-gray-50 border border-gray-200 rounded-lg mb-4">
                  <AlertCircle className="w-5 h-5 text-gray-500 shrink-0 mt-0.5" />
                  <p className="text-sm text-gray-600">
                    결제가 완료된 참여자가 없습니다.
                  </p>
                </div>
              )}
            </>
          ) : (
            <>
              {/* Extend View */}
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-600 mb-3">
                    현재 종료일:{' '}
                    <span className="font-medium">
                      {formatKstDateOnly(session.end_date)}
                    </span>
                  </p>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    새 종료일
                  </label>
                  <input
                    type="date"
                    value={newEndDate}
                    onChange={(e) => setNewEndDate(e.target.value)}
                    min={formatKstDateInputValue(session.end_date)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-black"
                  />
                </div>

                {/* Error message */}
                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          {view === 'summary' ? (
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setError(null);
                  setView('extend');
                }}
                className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-100 transition-colors"
              >
                연장 신청하기
              </button>
              <button
                onClick={handleCreateOrder}
                disabled={isCreatingOrder || completedParticipants.length === 0}
                className="flex-1 px-4 py-3 bg-black text-white rounded-lg font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isCreatingOrder ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    처리 중...
                  </span>
                ) : (
                  '주문 생성'
                )}
              </button>
            </div>
          ) : (
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setError(null);
                  setView('summary');
                }}
                className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-100 transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleExtendSession}
                disabled={isExtending}
                className="flex-1 px-4 py-3 bg-black text-white rounded-lg font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isExtending ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    처리 중...
                  </span>
                ) : (
                  '연장하기'
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
