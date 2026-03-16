'use client';

import { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import {
  MessageSquare, Send, CheckCircle, Clock, Pencil, Eye,
  XCircle, Package,
} from 'lucide-react';
import { CoBuyRequest, CoBuyRequestComment, CoBuyRequestStatus, CoBuyRequestQuantityExpectations, ProductConfig } from '@/types/types';
import Header from '@/app/components/Header';
import DesignEditorViewer from '@/app/components/cobuy/DesignEditorViewer';
import { getPricingInfo } from '@/lib/cobuyPricing';

type RequestWithProduct = CoBuyRequest & {
  product?: {
    id: string;
    title: string;
    thumbnail_image_link: string[] | null;
    configuration?: any;
  } | null;
  admin_design?: {
    id: string;
    canvas_state: Record<string, string>;
    color_selections: Record<string, any> | null;
  } | null;
};

const statusConfig: Record<CoBuyRequestStatus, { label: string; icon: typeof Clock; color: string; bgColor: string }> = {
  pending: { label: '검토 대기중', icon: Clock, color: 'text-yellow-600', bgColor: 'bg-yellow-50' },
  in_progress: { label: '디자인 작업중', icon: Pencil, color: 'text-blue-600', bgColor: 'bg-blue-50' },
  design_shared: { label: '디자인 확인 요청', icon: Eye, color: 'text-purple-600', bgColor: 'bg-purple-50' },
  feedback: { label: '피드백 전달됨', icon: MessageSquare, color: 'text-orange-600', bgColor: 'bg-orange-50' },
  confirmed: { label: '디자인 확정', icon: CheckCircle, color: 'text-green-600', bgColor: 'bg-green-50' },
  session_created: { label: '공동구매 시작됨', icon: Package, color: 'text-emerald-600', bgColor: 'bg-emerald-50' },
  rejected: { label: '거절됨', icon: XCircle, color: 'text-red-600', bgColor: 'bg-red-50' },
};

const statusOrder: CoBuyRequestStatus[] = [
  'pending', 'in_progress', 'design_shared', 'confirmed', 'session_created',
];

const formatDate = (dateString?: string | null) => {
  if (!dateString) return '';
  return new Date(dateString).toLocaleDateString('ko-KR', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
};

export default function CoBuyRequestFeedbackPage() {
  const params = useParams();
  const rawToken = params.shareToken;
  const shareToken = Array.isArray(rawToken) ? rawToken[0] : (rawToken as string);

  const [request, setRequest] = useState<RequestWithProduct | null>(null);
  const [comments, setComments] = useState<CoBuyRequestComment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const commentsEndRef = useRef<HTMLDivElement>(null);

  // Fetch request data + poll every 15s for updates (admin design, status changes)
  const fetchRequestData = useCallback(async () => {
    if (!shareToken) return;
    try {
      const res = await fetch(`/api/cobuy/request/${shareToken}`);
      if (!res.ok) throw new Error('Request not found');
      const data = await res.json();
      setRequest(prev => {
        if (!prev) return data;
        // Only update state if meaningful fields changed (prevents canvas re-render flicker)
        const designChanged = JSON.stringify(prev.admin_design) !== JSON.stringify(data.admin_design);
        const statusChanged = prev.status !== data.status;
        const priceChanged = prev.confirmed_price !== data.confirmed_price;
        const sessionChanged = prev.cobuy_session_id !== data.cobuy_session_id;
        if (designChanged || statusChanged || priceChanged || sessionChanged) return data;
        return prev;
      });
      if (isLoading) setIsLoading(false);
    } catch {
      if (isLoading) {
        setError('요청 정보를 찾을 수 없습니다.');
        setIsLoading(false);
      }
    }
  }, [shareToken, isLoading]);

  useEffect(() => {
    fetchRequestData();
    const interval = setInterval(fetchRequestData, 15000);
    return () => clearInterval(interval);
  }, [fetchRequestData]);

  // Fetch comments
  const fetchComments = async () => {
    if (!shareToken) return;
    try {
      const res = await fetch(`/api/cobuy/request/${shareToken}/comments`);
      if (res.ok) {
        const data = await res.json();
        setComments(data);
      }
    } catch { /* ignore */ }
  };

  useEffect(() => {
    if (request) fetchComments();
  }, [request?.id]);

  // Auto-scroll to latest comment
  useEffect(() => {
    commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [comments.length]);

  // Poll for new comments every 15 seconds
  useEffect(() => {
    if (!request) return;
    const interval = setInterval(fetchComments, 15000);
    return () => clearInterval(interval);
  }, [request?.id]);

  const handleSendComment = async () => {
    if (!commentText.trim() || isSending || !shareToken) return;
    setIsSending(true);

    try {
      const res = await fetch(`/api/cobuy/request/${shareToken}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: commentText.trim() }),
      });

      if (res.ok) {
        setCommentText('');
        await fetchComments();
      }
    } catch {
      // ignore
    }

    setIsSending(false);
  };

  const handleConfirmDesign = async () => {
    if (isConfirming || !shareToken) return;
    setIsConfirming(true);
    try {
      const res = await fetch(`/api/cobuy/request/${shareToken}/confirm`, {
        method: 'POST',
      });
      if (res.ok) {
        setRequest(prev => prev ? { ...prev, status: 'confirmed' } : prev);
      }
    } catch {
      // ignore
    }
    setIsConfirming(false);
  };

  const productConfig: ProductConfig | null = useMemo(() => {
    if (!request?.product?.configuration || !request.product.id) return null;
    return { productId: request.product.id, sides: request.product.configuration };
  }, [request?.product]);

  // Unified canvas: show admin design if exists, otherwise user's freeform sketch
  const unifiedCanvas = useMemo(() => {
    if (!productConfig) return null;

    if (request?.admin_design?.canvas_state) {
      const colorSelections = request.admin_design.color_selections as { productColor?: string } | null;
      // Ensure values are strings for DesignEditorViewer
      const canvasState: Record<string, string> = {};
      Object.entries(request.admin_design.canvas_state).forEach(([sideId, val]) => {
        canvasState[sideId] = typeof val === 'string' ? val : JSON.stringify(val);
      });
      return {
        source: 'admin' as const,
        canvasState,
        productColor: colorSelections?.productColor || '#FFFFFF',
      };
    }

    if (request?.freeform_canvas_state && Object.keys(request.freeform_canvas_state).length > 0) {
      const colorSelections = request.freeform_color_selections as Record<string, any> | null;
      const productColor = colorSelections?._productColor?.hex || '#FFFFFF';
      const canvasState: Record<string, string> = {};
      Object.entries(request.freeform_canvas_state).forEach(([sideId, val]) => {
        canvasState[sideId] = typeof val === 'string' ? val : JSON.stringify(val);
      });
      return {
        source: 'freeform' as const,
        canvasState,
        productColor,
      };
    }

    return null;
  }, [request?.admin_design, request?.freeform_canvas_state, request?.freeform_color_selections, productConfig]);

  // Estimated pricing from quantity expectations
  const estimatedPricing = useMemo(() => {
    const qty = (request?.quantity_expectations as CoBuyRequestQuantityExpectations)?.estimatedQuantity;
    if (!qty) return null;
    return { qty, pricing: getPricingInfo(qty) };
  }, [request?.quantity_expectations]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-3 border-[#3B55A5] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">요청 정보를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (error || !request) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center">
          <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-gray-100 flex items-center justify-center">
            <XCircle className="w-7 h-7 text-gray-400" />
          </div>
          <p className="text-sm text-gray-600">{error || '요청을 찾을 수 없습니다.'}</p>
        </div>
      </div>
    );
  }

  const currentStatus = statusConfig[request.status];
  const StatusIcon = currentStatus.icon;
  const currentStepIndex = statusOrder.indexOf(request.status);
  const isRejected = request.status === 'rejected';

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <div className="max-w-lg mx-auto px-4 py-5 pb-32">
        {/* Title */}
        <div className="mb-5">
          <h1 className="text-lg font-bold text-gray-900">{request.title}</h1>
          {request.product && (
            <p className="text-xs text-gray-500 mt-0.5">{request.product.title}</p>
          )}
        </div>

        {/* Status Badge */}
        <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium mb-4 ${currentStatus.bgColor} ${currentStatus.color}`}>
          <StatusIcon className="w-3.5 h-3.5" />
          {currentStatus.label}
        </div>

        {/* Progress Steps */}
        {!isRejected && (
          <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
            <div className="flex items-start">
              {statusOrder.map((status, idx) => {
                const isDone = idx < currentStepIndex;
                const isCurrent = idx === currentStepIndex;
                const isActive = isDone || isCurrent;
                const isLast = idx === statusOrder.length - 1;
                return (
                  <div key={status} className={`flex items-start ${isLast ? '' : 'flex-1'}`}>
                    {/* Circle + Label */}
                    <div className="flex flex-col items-center" style={{ width: 28 }}>
                      <div className={`w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold shrink-0 ${
                        isCurrent
                          ? 'bg-[#3B55A5] text-white animate-pulse'
                          : isDone
                            ? 'bg-gray-300 text-white'
                            : 'border-2 border-dashed border-gray-300 text-gray-400'
                      }`}>
                        {idx + 1}
                      </div>
                      <p className={`text-[9px] mt-1.5 text-center leading-tight whitespace-nowrap ${
                        isCurrent ? 'text-[#3B55A5] font-semibold' : isDone ? 'text-gray-400 font-medium' : 'text-gray-400'
                      }`}>
                        {statusConfig[status].label}
                      </p>
                    </div>
                    {/* Dashed connector */}
                    {!isLast && (
                      <div className="flex-1 flex items-center" style={{ height: 28 }}>
                        <div className={`w-full border-t-2 border-dashed mx-1 ${
                          isDone ? 'border-[#3B55A5]' : 'border-gray-300'
                        }`} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Unified Design Canvas */}
        {unifiedCanvas && productConfig && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-4">
            <div className="flex items-center justify-between px-4 pt-3">
              <p className="text-xs font-medium text-gray-500">
                {unifiedCanvas.source === 'admin' ? '디자인 미리보기' : '내 디자인 스케치'}
              </p>
              {unifiedCanvas.source === 'admin' && (
                <span className="text-[10px] text-purple-600 font-medium bg-purple-50 px-2 py-0.5 rounded-full">
                  관리자 작업
                </span>
              )}
            </div>
            <div className="px-2 pb-2 pt-1">
              <DesignEditorViewer
                config={productConfig}
                canvasState={unifiedCanvas.canvasState}
                productColor={unifiedCanvas.productColor}
              />
            </div>
            {request.status === 'design_shared' && (
              <p className="text-xs text-purple-600 px-4 pb-3">
                디자인을 확인하고 아래에서 확정해 주세요.
              </p>
            )}
          </div>
        )}

        {/* Fallback: preview image if no canvas data */}
        {!unifiedCanvas && request.freeform_preview_url && (
          <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
            <p className="text-xs font-medium text-gray-500 mb-2">내 디자인 스케치</p>
            <div className="rounded-lg bg-gray-50 border border-gray-100 overflow-hidden">
              <img
                src={request.freeform_preview_url}
                alt="내 디자인"
                className="w-full h-auto object-contain max-h-64"
              />
            </div>
          </div>
        )}

        {/* Confirm CTA — shown when design_shared */}
        {request.status === 'design_shared' && (
          <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
            <p className="text-sm font-medium text-gray-800 mb-3">디자인을 확인해 주세요</p>
            <button
              onClick={handleConfirmDesign}
              disabled={isConfirming}
              className="w-full py-3.5 bg-[#3B55A5] text-white rounded-xl text-sm font-bold hover:bg-[#2D4280] disabled:opacity-50 transition flex items-center justify-center gap-2"
            >
              {isConfirming ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <CheckCircle className="w-4 h-4" />
              )}
              디자인 확정하기
            </button>
            <p className="text-[11px] text-gray-400 mt-2 text-center">
              수정이 필요하시면 아래 대화에서 의견을 남겨주세요.
            </p>
          </div>
        )}

        {/* Admin-set Pricing */}
        {request.confirmed_price ? (
          <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
            <p className="text-xs font-medium text-gray-500 mb-2">견적 정보</p>
            <div className="space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">벌당 단가</span>
                <span className="font-medium text-gray-900">{Number(request.confirmed_price).toLocaleString()}원</span>
              </div>
              {estimatedPricing?.qty && (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">예상 수량</span>
                    <span className="font-medium text-gray-900">{estimatedPricing.qty}벌</span>
                  </div>
                  <div className="border-t border-gray-100 pt-1.5 flex justify-between text-sm">
                    <span className="text-gray-700 font-medium">합계 금액</span>
                    <span className="font-bold text-[#3B55A5]">
                      {(Number(request.confirmed_price) * estimatedPricing.qty).toLocaleString()}원
                    </span>
                  </div>
                </>
              )}
              <p className="text-[10px] text-gray-400 mt-1">* 실제 금액은 최종 수량에 따라 변동될 수 있습니다.</p>
            </div>
          </div>
        ) : estimatedPricing ? (
          <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
            <p className="text-xs font-medium text-gray-500 mb-2">예상 견적</p>
            {estimatedPricing.pricing ? (
              <div className="space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">예상 수량</span>
                  <span className="font-medium text-gray-900">{estimatedPricing.qty}벌</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">벌당 단가</span>
                  <span className="font-medium">
                    <span className="line-through text-gray-400">{estimatedPricing.pricing.unitPrice.toLocaleString()}원</span>
                    <span className="text-red-500 ml-1">{estimatedPricing.pricing.discountedUnitPrice.toLocaleString()}원</span>
                    {estimatedPricing.pricing.note ? ` ${estimatedPricing.pricing.note}` : ''}
                  </span>
                </div>
                <div className="border-t border-gray-100 pt-1.5 flex justify-between text-sm">
                  <span className="text-gray-700 font-medium">예상 합계</span>
                  <span className="font-bold text-[#3B55A5]">
                    {estimatedPricing.pricing.discountedTotalPrice.toLocaleString()}원
                  </span>
                </div>
                <p className="text-[10px] text-gray-400 mt-1">* 실제 금액은 디자인 확정 후 변동될 수 있습니다.</p>
              </div>
            ) : (
              <p className="text-xs text-red-500">
                예상 수량 {estimatedPricing.qty}벌은 최소 주문 수량(20벌) 미만입니다.
              </p>
            )}
          </div>
        ) : null}

        {/* CoBuy Session Link */}
        {request.status === 'session_created' && request.cobuy_session_id && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-4">
            <div className="flex items-center gap-2 mb-2">
              <Package className="w-4 h-4 text-emerald-600" />
              <p className="text-sm font-medium text-emerald-800">공동구매가 생성되었습니다!</p>
            </div>
            <p className="text-xs text-emerald-700">
              공동구매 링크를 통해 참여자를 모집할 수 있습니다.
            </p>
          </div>
        )}

        {/* Request Description */}
        {request.description && (
          <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
            <p className="text-xs font-medium text-gray-500 mb-1">요청 설명</p>
            <p className="text-sm text-gray-700">{request.description}</p>
          </div>
        )}

        {/* Comments Section */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs font-medium text-gray-500 mb-3 flex items-center gap-1.5">
            <MessageSquare className="w-3.5 h-3.5" />
            대화 ({comments.length})
          </p>

          <div className="space-y-2 max-h-80 overflow-y-auto mb-3">
            {comments.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-6">아직 대화가 없습니다.</p>
            ) : (
              comments.map(comment => (
                <div
                  key={comment.id}
                  className={`p-2.5 rounded-lg text-xs ${
                    comment.is_admin
                      ? 'bg-blue-50 border border-blue-100'
                      : 'bg-gray-50 border border-gray-100 ml-6'
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className={`font-medium ${comment.is_admin ? 'text-blue-700' : 'text-gray-700'}`}>
                      {comment.is_admin ? '관리자' : '고객'}
                    </span>
                    <span className="text-gray-400">{formatDate(comment.created_at)}</span>
                  </div>
                  <p className="text-gray-600 whitespace-pre-wrap">{comment.content}</p>
                </div>
              ))
            )}
            <div ref={commentsEndRef} />
          </div>
        </div>
      </div>

      {/* Fixed Comment Input */}
      {!isRejected && request.status !== 'session_created' && request.status !== 'confirmed' && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-3 safe-area-inset-bottom">
          <div className="max-w-lg mx-auto flex gap-2">
            <input
              type="text"
              value={commentText}
              onChange={e => setCommentText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendComment(); } }}
              placeholder="피드백을 입력해주세요..."
              className="feedback-comment-input flex-1 px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#3B55A5] transition"
            />
            <button
              onClick={handleSendComment}
              disabled={!commentText.trim() || isSending}
              className="px-4 py-2.5 bg-[#3B55A5] text-white rounded-xl text-sm font-medium hover:bg-[#2D4280] disabled:opacity-50 transition flex items-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              전송
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
