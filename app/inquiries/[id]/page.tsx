'use client'

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { InquiryWithDetails, InquiryStatus } from '@/types/types';
import { createClient } from '@/lib/supabase-client';
import { ChevronLeft, MessageSquare, Send, Lock, Paperclip, ExternalLink } from 'lucide-react';
import Image from 'next/image';
import { formatKstDateLong } from '@/lib/kst';

const STATUS_LABELS: Record<InquiryStatus, string> = {
  pending: '대기중',
  ongoing: '진행중',
  completed: '완료'
};

const STATUS_COLORS: Record<InquiryStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  ongoing: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800'
};

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex border-b border-gray-100 last:border-b-0">
      <div className="w-30 sm:w-35 shrink-0 bg-gray-50 px-4 py-3 text-sm font-medium text-gray-600 flex items-center">
        {label}
      </div>
      <div className="flex-1 px-4 py-3 text-sm text-gray-800">{value}</div>
    </div>
  );
}

export default function InquiryDetailPage() {
  const router = useRouter();
  const params = useParams();
  const inquiryId = params.id as string;

  const [inquiry, setInquiry] = useState<InquiryWithDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [replyContent, setReplyContent] = useState('');
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // Password gate
  const [isVerified, setIsVerified] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    checkUserAndFetchInquiry();
  }, [inquiryId]);

  const checkUserAndFetchInquiry = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    setUser(user || null);

    let isAdminUser = false;
    let isOwner = false;

    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      isAdminUser = profile?.role === 'admin';
      setIsAdmin(isAdminUser);

      // Check if user owns this inquiry
      const { data: inquiryData } = await supabase
        .from('inquiries')
        .select('user_id')
        .eq('id', inquiryId)
        .single();

      isOwner = inquiryData?.user_id === user.id;
    }

    // Admins, owners, and session-verified users skip password check
    const sessionVerified = sessionStorage.getItem(`inquiry_verified_${inquiryId}`) === 'true';
    if (isAdminUser || isOwner || sessionVerified) {
      setIsVerified(true);
      await fetchInquiry();
    } else {
      setIsLoading(false);
    }
  };

  const handlePasswordSubmit = async () => {
    if (!passwordInput.trim()) return;

    setIsVerifying(true);
    setPasswordError('');

    try {
      const res = await fetch('/api/inquiries/verify-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inquiryId, password: passwordInput.trim() }),
      });

      const data = await res.json();

      if (data.match) {
        setIsVerified(true);
        setIsLoading(true);
        await fetchInquiry();
      } else {
        setPasswordError('비밀번호가 일치하지 않습니다.');
      }
    } catch {
      setPasswordError('오류가 발생했습니다.');
    } finally {
      setIsVerifying(false);
    }
  };

  const fetchInquiry = async () => {
    setIsLoading(true);
    const supabase = createClient();

    const { data, error } = await supabase
      .from('inquiries')
      .select(`
        *,
        user:profiles!inquiries_user_id_fkey(email),
        products:inquiry_products(
          id,
          product_id,
          product:products(*)
        ),
        replies:inquiry_replies(
          id,
          content,
          created_at,
          updated_at,
          admin:profiles!inquiry_replies_admin_id_fkey(email)
        )
      `)
      .eq('id', inquiryId)
      .single();

    if (!error && data) {
      setInquiry(data as any);
    } else {
      console.error('Error fetching inquiry:', error);
      alert('문의를 불러올 수 없습니다.');
      router.push('/inquiries');
    }

    setIsLoading(false);
  };

  const handleSubmitReply = async () => {
    if (!replyContent.trim()) {
      alert('답변 내용을 입력해주세요.');
      return;
    }

    if (!user) {
      alert('로그인이 필요합니다.');
      return;
    }

    setIsSubmittingReply(true);

    try {
      const supabase = createClient();

      const { error } = await supabase
        .from('inquiry_replies')
        .insert({
          inquiry_id: inquiryId,
          admin_id: user.id,
          content: replyContent.trim()
        });

      if (error) throw error;

      // Send email notification to inquiry writer (fire-and-forget)
      fetch('/api/inquiries/reply-notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inquiryId, replyContent: replyContent.trim() }),
      }).catch((err) => console.error('Failed to send reply notification:', err));

      setReplyContent('');
      await fetchInquiry();
    } catch (error) {
      console.error('Error submitting reply:', error);
      alert('답변 등록 중 오류가 발생했습니다.');
    } finally {
      setIsSubmittingReply(false);
    }
  };

  const handleUpdateStatus = async (newStatus: InquiryStatus) => {
    setIsUpdatingStatus(true);

    try {
      const supabase = createClient();

      const { error } = await supabase
        .from('inquiries')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', inquiryId);

      if (error) throw error;

      await fetchInquiry();
    } catch (error) {
      console.error('Error updating status:', error);
      alert('상태 변경 중 오류가 발생했습니다.');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const formatDate = (dateString: string) => formatKstDateLong(dateString);

  const getProductImageUrl = (product: any) => {
    if (product?.configuration && product.configuration.length > 0) {
      return product.configuration[0].imageUrl;
    }
    return '/placeholder-product.png';
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center text-gray-500">로딩 중...</div>
      </div>
    );
  }

  if (!isVerified) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="w-full px-4 py-4">
            <div className="flex items-center">
              <button
                onClick={() => router.back()}
                className="p-2 hover:bg-gray-100 rounded-full transition mr-2"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <h1 className="text-lg font-bold">비밀번호 확인</h1>
            </div>
          </div>
        </header>
        <div className="flex items-center justify-center px-4" style={{ minHeight: 'calc(100vh - 64px)' }}>
          <div className="w-full max-w-sm">
            <div className="bg-white rounded-lg p-8 shadow-sm text-center">
              <Lock className="w-12 h-12 mx-auto text-gray-300 mb-4" />
              <h2 className="text-lg font-bold mb-2">비밀글입니다</h2>
              <p className="text-sm text-gray-500 mb-6">
                이 문의를 보려면 비밀번호를 입력해주세요.
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handlePasswordSubmit();
                }}
              >
                <input
                  type="password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="비밀번호 입력"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#3B55A5] transition mb-3"
                  autoFocus
                  disabled={isVerifying}
                />
                {passwordError && (
                  <p className="text-sm text-red-500 mb-3">{passwordError}</p>
                )}
                <button
                  type="submit"
                  disabled={isVerifying || !passwordInput.trim()}
                  className="w-full py-3 bg-[#3B55A5] text-white rounded-lg hover:bg-[#2f4584] transition disabled:bg-gray-400 disabled:cursor-not-allowed text-sm font-medium"
                >
                  {isVerifying ? '확인 중...' : '확인'}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!inquiry) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center text-gray-500">문의를 찾을 수 없습니다.</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="w-full px-4 py-4">
          <div className="flex items-center">
            <button
              onClick={() => router.back()}
              className="p-2 hover:bg-gray-100 rounded-full transition mr-2"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <h1 className="text-lg font-bold">문의 상세</h1>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="w-full p-4 space-y-4">
        {/* Inquiry Details */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          {/* Header: Status + Title + Date */}
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <span className={`
                px-3 py-1 rounded text-sm font-medium
                ${STATUS_COLORS[inquiry.status]}
              `}>
                {STATUS_LABELS[inquiry.status]}
              </span>
              <span className="text-sm text-gray-500">
                {formatDate(inquiry.created_at)}
              </span>
            </div>
            <h2 className="text-xl font-bold">{inquiry.title}</h2>
          </div>

          {/* Info Table */}
          <div className="border-b border-gray-200">
            <DetailRow label="단체명" value={inquiry.group_name} />
            <DetailRow label="담당자명" value={inquiry.manager_name} />
            <DetailRow label="연락처" value={inquiry.phone} />
            {inquiry.kakao_id && (
              <DetailRow label="카카오톡 ID" value={inquiry.kakao_id} />
            )}
            {inquiry.desired_date && (
              <DetailRow label="착용희망날짜" value={inquiry.desired_date} />
            )}
            {inquiry.expected_qty && (
              <DetailRow label="예상수량" value={`${inquiry.expected_qty}개`} />
            )}
            {inquiry.fabric_color && (
              <DetailRow label="원단 색상" value={inquiry.fabric_color} />
            )}
          </div>

          {/* Content */}
          {inquiry.content && (
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-sm font-medium text-gray-700 mb-2">추가 내용</h3>
              <p className="text-gray-700 whitespace-pre-wrap text-sm">{inquiry.content}</p>
            </div>
          )}

          {/* File Attachments */}
          {inquiry.file_urls && inquiry.file_urls.length > 0 && (
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-sm font-medium text-gray-700 mb-3">
                <Paperclip className="w-4 h-4 inline-block mr-1" />
                첨부파일 ({inquiry.file_urls.length})
              </h3>
              <div className="space-y-2">
                {inquiry.file_urls.map((url: string, idx: number) => {
                  const fileName = decodeURIComponent(url.split('/').pop() || `파일 ${idx + 1}`);
                  return (
                    <a
                      key={idx}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-[#3B55A5] hover:underline"
                    >
                      <ExternalLink className="w-3 h-3 shrink-0" />
                      <span className="truncate">{fileName}</span>
                    </a>
                  );
                })}
              </div>
            </div>
          )}

          {/* Products */}
          {inquiry.products && inquiry.products.length > 0 && (
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-sm font-medium text-gray-700 mb-3">관련 제품</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {inquiry.products.map((item: any) => (
                  <div
                    key={item.id}
                    onClick={() => router.push(`/product/${item.product_id}`)}
                    className="border border-gray-200 rounded-lg p-2 cursor-pointer hover:border-gray-400 transition"
                  >
                    <div className="aspect-square bg-gray-100 rounded-lg mb-2 overflow-hidden relative">
                      <Image
                        src={getProductImageUrl(item.product)}
                        alt={item.product?.title || 'Product'}
                        fill
                        className="object-contain"
                      />
                    </div>
                    <p className="text-xs text-center line-clamp-2 font-medium">
                      {item.product?.title}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Admin Status Change */}
          {isAdmin && (
            <div className="p-6">
              <h3 className="text-sm font-medium text-gray-700 mb-3">상태 변경</h3>
              <div className="flex gap-2">
                {Object.entries(STATUS_LABELS).map(([status, label]) => (
                  <button
                    key={status}
                    onClick={() => handleUpdateStatus(status as InquiryStatus)}
                    disabled={isUpdatingStatus || inquiry.status === status}
                    className={`
                      px-4 py-2 rounded-lg text-sm font-medium transition
                      ${inquiry.status === status
                        ? 'bg-[#3B55A5] text-white cursor-default'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }
                      disabled:opacity-50 disabled:cursor-not-allowed
                    `}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Replies */}
        <div className="bg-white rounded-lg p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <MessageSquare className="w-5 h-5" />
            <h3 className="text-lg font-bold">
              답변 ({inquiry.replies?.length || 0})
            </h3>
          </div>

          {inquiry.replies && inquiry.replies.length > 0 ? (
            <div className="space-y-4 mb-6">
              {inquiry.replies.map((reply: any) => (
                <div key={reply.id} className="border-l-4 border-[#3B55A5] pl-4 py-2">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-[#3B55A5]">
                        모두 유니폼
                      </span>
                    </div>
                    <span className="text-xs text-gray-500">
                      {formatDate(reply.created_at)}
                    </span>
                  </div>
                  <p className="text-gray-700 whitespace-pre-wrap">{reply.content}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500 mb-6">
              아직 답변이 없습니다.
            </div>
          )}

          {/* Reply Form (Admin Only) */}
          {isAdmin && (
            <div className="pt-4 border-t border-gray-200">
              <textarea
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                placeholder="답변을 입력해주세요..."
                rows={4}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-black transition resize-none mb-3"
                disabled={isSubmittingReply}
              />
              <div className="flex justify-end">
                <button
                  onClick={handleSubmitReply}
                  disabled={isSubmittingReply || !replyContent.trim()}
                  className="flex items-center gap-2 px-6 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  <Send className="w-4 h-4" />
                  {isSubmittingReply ? '등록 중...' : '답변 등록'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
