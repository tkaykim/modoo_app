'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { CheckCircle, AlertCircle, Loader2, ArrowLeft, Send, RotateCcw } from 'lucide-react';
import Link from 'next/link';
import { formatKstDateOnly } from '@/lib/kst';

interface DesignItem {
  id: string;
  product_title: string;
  design_title: string | null;
  thumbnail_url: string | null;
  design_status: string;
  design_shared_at: string | null;
  design_confirmed_at: string | null;
  design_revision_note: string | null;
}

type ViewState = 'loading' | 'review' | 'confirmed' | 'revision_sent' | 'error';

export default function DesignReviewPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const orderId = params.orderId as string;
  const token = searchParams.get('token');

  const [items, setItems] = useState<DesignItem[]>([]);
  const [viewState, setViewState] = useState<ViewState>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [revisionNote, setRevisionNote] = useState('');
  const [showRevisionForm, setShowRevisionForm] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchItems = useCallback(async () => {
    try {
      const res = await fetch(`/api/orders/${orderId}/design-items${token ? `?token=${token}` : ''}`);
      if (!res.ok) {
        setErrorMsg('주문 정보를 불러올 수 없습니다.');
        setViewState('error');
        return;
      }
      const data = await res.json();
      setItems(data.items || []);

      const hasReviewable = (data.items || []).some(
        (i: DesignItem) => i.design_status === 'design_shared'
      );
      const allConfirmed = (data.items || []).every(
        (i: DesignItem) => i.design_status === 'confirmed'
      );

      if (allConfirmed && (data.items || []).length > 0) {
        setViewState('confirmed');
      } else if (hasReviewable) {
        setViewState('review');
      } else {
        setViewState('review');
      }
    } catch {
      setErrorMsg('네트워크 오류가 발생했습니다.');
      setViewState('error');
    }
  }, [orderId, token]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const handleConfirm = async (itemId: string) => {
    if (!confirm('이 시안을 확정하시겠습니까? 확정 후에는 변경이 어렵습니다.')) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/orders/${orderId}/items/${itemId}/confirm-design`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      if (res.ok) {
        await fetchItems();
      } else {
        const data = await res.json();
        alert(data.error || '확정에 실패했습니다.');
      }
    } catch {
      alert('오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevision = async (itemId: string) => {
    if (!revisionNote.trim()) {
      alert('수정 요청 내용을 입력해주세요.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/orders/${orderId}/items/${itemId}/request-revision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, note: revisionNote.trim() }),
      });
      if (res.ok) {
        setShowRevisionForm(null);
        setRevisionNote('');
        setViewState('revision_sent');
        await fetchItems();
      } else {
        const data = await res.json();
        alert(data.error || '수정 요청에 실패했습니다.');
      }
    } catch {
      alert('오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const designStatusLabel = (status: string) => {
    switch (status) {
      case 'design_shared': return { text: '시안 확인 대기', color: 'text-purple-700 bg-purple-50 border-purple-200' };
      case 'confirmed': return { text: '시안 확정 완료', color: 'text-green-700 bg-green-50 border-green-200' };
      case 'revision_requested': return { text: '수정 요청 중', color: 'text-amber-700 bg-amber-50 border-amber-200' };
      case 'in_progress': return { text: '디자인 작업 중', color: 'text-blue-700 bg-blue-50 border-blue-200' };
      default: return { text: '대기', color: 'text-gray-700 bg-gray-50 border-gray-200' };
    }
  };

  if (viewState === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-purple-600 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">시안 정보를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (viewState === 'error') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-sm p-8 text-center max-w-md w-full">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-900 mb-2">오류</h2>
          <p className="text-gray-500 text-sm">{errorMsg}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <Link href={`/order/${orderId}`} className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-4">
            <ArrowLeft className="w-4 h-4 mr-1" />
            주문 상세로 돌아가기
          </Link>
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                <Send className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">시안 확인</h1>
                <p className="text-sm text-gray-500">주문번호 {orderId}</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 mt-3 leading-relaxed">
              디자인 시안을 확인하시고, 만족하시면 확정을, 수정이 필요하시면 수정 요청을 해주세요.
            </p>
          </div>
        </div>

        {/* Revision sent success message */}
        {viewState === 'revision_sent' && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 flex items-start gap-3">
            <RotateCcw className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium text-amber-800">수정 요청이 전달되었습니다</p>
              <p className="text-sm text-amber-600 mt-1">담당자가 수정 후 다시 시안을 보내드리겠습니다.</p>
            </div>
          </div>
        )}

        {/* All confirmed success message */}
        {viewState === 'confirmed' && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6 flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium text-green-800">모든 시안이 확정되었습니다</p>
              <p className="text-sm text-green-600 mt-1">확정된 디자인으로 제작이 진행됩니다. 감사합니다!</p>
            </div>
          </div>
        )}

        {/* Design Items */}
        <div className="space-y-4">
          {items.map((item) => {
            const status = designStatusLabel(item.design_status);
            return (
              <div key={item.id} className="bg-white rounded-xl shadow-sm overflow-hidden">
                {/* Item Header */}
                <div className="p-5 border-b border-gray-100">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900">{item.design_title || item.product_title}</h3>
                    <span className={`px-2.5 py-1 text-xs font-medium rounded-full border ${status.color}`}>
                      {status.text}
                    </span>
                  </div>
                  {item.design_title && item.design_title !== item.product_title && (
                    <p className="text-sm text-gray-500 mt-1">{item.product_title}</p>
                  )}
                </div>

                {/* Preview Image */}
                {item.thumbnail_url && (
                  <div className="p-5 bg-gray-50 flex justify-center">
                    <img
                      src={item.thumbnail_url}
                      alt={item.design_title || item.product_title}
                      className="max-w-full max-h-96 object-contain rounded-lg"
                    />
                  </div>
                )}

                {/* Revision note display */}
                {item.design_status === 'revision_requested' && item.design_revision_note && (
                  <div className="px-5 py-3 bg-amber-50 border-t border-amber-100">
                    <p className="text-xs font-medium text-amber-800 mb-1">내 수정 요청 내용</p>
                    <p className="text-sm text-amber-700 whitespace-pre-wrap">{item.design_revision_note}</p>
                  </div>
                )}

                {/* Actions */}
                {item.design_status === 'design_shared' && (
                  <div className="p-5 border-t border-gray-100">
                    {showRevisionForm === item.id ? (
                      <div className="space-y-3">
                        <textarea
                          value={revisionNote}
                          onChange={(e) => setRevisionNote(e.target.value)}
                          placeholder="수정이 필요한 부분을 상세히 적어주세요..."
                          className="w-full h-24 px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleRevision(item.id)}
                            disabled={submitting || !revisionNote.trim()}
                            className="flex-1 py-2.5 px-4 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                          >
                            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                            수정 요청
                          </button>
                          <button
                            onClick={() => { setShowRevisionForm(null); setRevisionNote(''); }}
                            className="py-2.5 px-4 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200"
                          >
                            취소
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleConfirm(item.id)}
                          disabled={submitting}
                          className="flex-1 py-3 px-4 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                          시안 확정
                        </button>
                        <button
                          onClick={() => setShowRevisionForm(item.id)}
                          disabled={submitting}
                          className="flex-1 py-3 px-4 bg-gray-100 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-200 disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          <RotateCcw className="w-4 h-4" />
                          수정 요청
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Confirmed status */}
                {item.design_status === 'confirmed' && (
                  <div className="p-5 border-t border-gray-100 bg-green-50/50">
                    <div className="flex items-center gap-2 text-green-700">
                      <CheckCircle className="w-5 h-5" />
                      <span className="text-sm font-medium">시안이 확정되었습니다</span>
                      {item.design_confirmed_at && (
                        <span className="text-xs text-green-600 ml-auto">
                          {formatKstDateOnly(item.design_confirmed_at)}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {items.length === 0 && (
          <div className="bg-white rounded-xl shadow-sm p-8 text-center">
            <p className="text-gray-500">확인할 시안이 없습니다.</p>
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 text-center text-xs text-gray-400">
          <p>문의사항이 있으시면 카카오톡 채널 &quot;모두의유니폼&quot;으로 연락해주세요.</p>
          <p className="mt-1">T. 010-8140-0621</p>
        </div>
      </div>
    </div>
  );
}
