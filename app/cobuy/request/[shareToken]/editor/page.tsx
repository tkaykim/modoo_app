'use client';

import { useEffect, useMemo, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import { MessageSquare, Send, ChevronUp, ChevronDown, XCircle } from 'lucide-react';
import { CoBuyRequest, CoBuyRequestComment, CoBuyRequestStatus, ProductConfig } from '@/types/types';
import DesignEditorViewer from '@/app/components/cobuy/DesignEditorViewer';

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

const formatDate = (dateString?: string | null) => {
  if (!dateString) return '';
  return new Date(dateString).toLocaleDateString('ko-KR', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
};

export default function CoBuyRequestEditorPage() {
  const params = useParams();
  const rawToken = params.shareToken;
  const shareToken = Array.isArray(rawToken) ? rawToken[0] : (rawToken as string);

  const [request, setRequest] = useState<RequestWithProduct | null>(null);
  const [comments, setComments] = useState<CoBuyRequestComment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const commentsEndRef = useRef<HTMLDivElement>(null);

  // Fetch request data
  useEffect(() => {
    if (!shareToken) return;
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/cobuy/request/${shareToken}`);
        if (!res.ok) throw new Error('Request not found');
        setRequest(await res.json());
      } catch {
        setError('요청 정보를 찾을 수 없습니다.');
      }
      setIsLoading(false);
    };
    fetchData();
  }, [shareToken]);

  // Fetch comments
  const fetchComments = async () => {
    if (!shareToken) return;
    try {
      const res = await fetch(`/api/cobuy/request/${shareToken}/comments`);
      if (res.ok) setComments(await res.json());
    } catch { /* ignore */ }
  };

  useEffect(() => {
    if (request) fetchComments();
  }, [request?.id]);

  // Auto-scroll to latest comment
  useEffect(() => {
    if (commentsOpen) commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [comments.length, commentsOpen]);

  // Poll for new comments
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
        if (request?.status === 'design_shared') {
          setRequest(prev => prev ? { ...prev, status: 'feedback' } : prev);
        }
      } else if (res.status === 401) {
        setError('로그인이 필요합니다.');
      }
    } catch { /* ignore */ }
    setIsSending(false);
  };

  const productConfig: ProductConfig | null = useMemo(() => {
    if (!request?.product?.configuration || !request.product.id) return null;
    return { productId: request.product.id, sides: request.product.configuration };
  }, [request?.product]);

  const designProductColor = useMemo(() => {
    const colorSelections = request?.admin_design?.color_selections as { productColor?: string } | null;
    return colorSelections?.productColor || '#FFFFFF';
  }, [request?.admin_design]);

  if (isLoading) {
    return (
      <div className="h-screen bg-neutral-800 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-3 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-neutral-400">디자인을 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (error || !request) {
    return (
      <div className="h-screen bg-neutral-800 flex items-center justify-center px-4">
        <div className="text-center">
          <XCircle className="w-10 h-10 text-neutral-500 mx-auto mb-3" />
          <p className="text-sm text-neutral-400">{error || '요청을 찾을 수 없습니다.'}</p>
        </div>
      </div>
    );
  }

  const hasCanvasDesign = !!(request.admin_design?.canvas_state && productConfig);
  const isRejected = request.status === 'rejected';
  const canComment = !isRejected && request.status !== 'session_created';

  return (
    <div className="h-screen flex flex-col bg-neutral-800 overflow-hidden">
      {/* Header bar */}
      <div className="shrink-0 bg-neutral-900 border-b border-neutral-700 px-4 py-2.5 flex items-center justify-between">
        <div className="min-w-0">
          <h1 className="text-sm font-semibold text-white truncate">{request.title}</h1>
          {request.product && (
            <p className="text-[11px] text-neutral-400 truncate">{request.product.title}</p>
          )}
        </div>
        <button
          onClick={() => setCommentsOpen(o => !o)}
          className="shrink-0 ml-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-neutral-700 text-neutral-200 hover:bg-neutral-600 transition"
        >
          <MessageSquare className="w-3.5 h-3.5" />
          댓글 ({comments.length})
          {commentsOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
        </button>
      </div>

      {/* Editor area */}
      <div className="flex-1 min-h-0 relative">
        {hasCanvasDesign ? (
          <DesignEditorViewer
            config={productConfig!}
            canvasState={request.admin_design!.canvas_state}
            productColor={designProductColor}
            fullscreen
          />
        ) : request.admin_design_preview_url ? (
          <div className="h-full flex items-center justify-center p-8">
            <img
              src={request.admin_design_preview_url}
              alt="관리자 디자인"
              className="max-w-full max-h-full object-contain rounded-lg"
            />
          </div>
        ) : (
          <div className="h-full flex items-center justify-center">
            <p className="text-sm text-neutral-500">아직 디자인이 공유되지 않았습니다.</p>
          </div>
        )}

        {/* Comments panel - slides up from bottom */}
        {commentsOpen && (
          <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-200 rounded-t-2xl shadow-2xl max-h-[50%] flex flex-col z-20">
            <div className="shrink-0 flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
              <p className="text-xs font-medium text-gray-700 flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5" /> 댓글 ({comments.length})
              </p>
              <button onClick={() => setCommentsOpen(false)} className="text-gray-400 hover:text-gray-600">
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-2 space-y-2">
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
                        {comment.is_admin ? '관리자' : '나'}
                      </span>
                      <span className="text-gray-400">{formatDate(comment.created_at)}</span>
                    </div>
                    <p className="text-gray-600 whitespace-pre-wrap">{comment.content}</p>
                  </div>
                ))
              )}
              <div ref={commentsEndRef} />
            </div>

            {canComment && (
              <div className="shrink-0 px-4 py-2.5 border-t border-gray-100 flex gap-2">
                <input
                  type="text"
                  value={commentText}
                  onChange={e => setCommentText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendComment(); } }}
                  placeholder="피드백을 입력해주세요..."
                  className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#3B55A5] transition"
                />
                <button
                  onClick={handleSendComment}
                  disabled={!commentText.trim() || isSending}
                  className="px-3 py-2 bg-[#3B55A5] text-white rounded-xl text-sm font-medium hover:bg-[#2D4280] disabled:opacity-50 transition flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
