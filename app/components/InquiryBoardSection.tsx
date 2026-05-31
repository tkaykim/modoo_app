'use client'

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-client';
import { InquiryWithDetails } from '@/types/types';
import { isToday } from '@/lib/utils';
import { MessageSquare, ChevronRight, ChevronLeft, Lock, Paperclip } from 'lucide-react';

const ITEMS_PER_PAGE = 10;

export default function InquiryBoardSection() {
  const router = useRouter();
  const [inquiries, setInquiries] = useState<InquiryWithDetails[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // Password modal
  const [passwordModalId, setPasswordModalId] = useState<string | null>(null);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  const supabase = createClient();
  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  useEffect(() => {
    async function loadUser() {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user || null);

      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();
        setIsAdmin(profile?.role === 'admin');
      }
    }
    loadUser();
  }, []);

  useEffect(() => {
    async function fetchInquiries() {
      setLoading(true);

      const { count } = await supabase
        .from('inquiries')
        .select('*', { count: 'exact', head: true });

      if (count !== null) {
        setTotalCount(count);
      }

      const { data } = await supabase
        .from('inquiries')
        .select(`
          *,
          replies:inquiry_replies(id)
        `)
        .order('created_at', { ascending: false })
        .range((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE - 1);

      if (data) {
        setInquiries(data);
      }

      setLoading(false);
    }

    fetchInquiries();
  }, [currentPage]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const handleInquiryClick = (inquiry: InquiryWithDetails) => {
    if (isAdmin || (user && inquiry.user_id === user.id)) {
      sessionStorage.setItem(`inquiry_verified_${inquiry.id}`, 'true');
      router.push(`/inquiries/${inquiry.id}`);
      return;
    }
    setPasswordModalId(inquiry.id);
    setPasswordInput('');
    setPasswordError('');
  };

  const handlePasswordSubmit = async () => {
    if (!passwordInput.trim() || !passwordModalId) return;

    setIsVerifying(true);
    setPasswordError('');

    try {
      const res = await fetch('/api/inquiries/verify-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inquiryId: passwordModalId, password: passwordInput.trim() }),
      });
      const data = await res.json();

      if (data.match) {
        sessionStorage.setItem(`inquiry_verified_${passwordModalId}`, 'true');
        router.push(`/inquiries/${passwordModalId}`);
        setPasswordModalId(null);
      } else {
        setPasswordError('비밀번호가 일치하지 않습니다.');
      }
    } catch {
      setPasswordError('오류가 발생했습니다.');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <section className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 lg:mb-4">
        <div className="flex items-center gap-2">
          <h2 className="text-lg lg:text-xl font-bold text-gray-900">문의 게시판</h2>
        </div>
        <Link
          href="/inquiries"
          className="flex items-center gap-1 text-xs lg:text-sm text-gray-600 hover:text-black transition"
        >
          전체보기
          <ChevronRight className="w-3 h-3 lg:w-4 lg:h-4" />
        </Link>
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="bg-white rounded-lg p-8 lg:p-12 text-center">
          <div className="animate-spin rounded-full h-10 w-10 lg:h-12 lg:w-12 border-b-2 border-gray-900 mx-auto mb-3"></div>
          <p className="text-sm lg:text-base text-gray-500">로딩 중...</p>
        </div>
      ) : (
        <>
          {inquiries && inquiries.length > 0 ? (
            <>
              <div>
                {/* Table Header */}
                <div className="flex items-center px-4 py-2 border-b border-gray-300 bg-gray-50 text-xs text-gray-500 font-medium tracking-wider">
                  <span className="flex-1">제목</span>
                  <span className="w-16 sm:w-20 text-center shrink-0">상태</span>
                  <span className="hidden sm:block w-28 text-center shrink-0">작성자</span>
                  <span className="w-20 sm:w-24 text-right shrink-0">날짜</span>
                </div>
                {inquiries.map((inquiry) => (
                  <div
                    key={inquiry.id}
                    onClick={() => handleInquiryClick(inquiry)}
                    className="flex items-center px-4 py-3 transition cursor-pointer border-b border-gray-200 hover:bg-gray-50"
                  >
                    {/* Subject */}
                    <div className="flex-1 min-w-0 flex items-center gap-1">
                      <span className="text-sm truncate">{inquiry.title}</span>
                      <Lock className="w-3 h-3 text-gray-400 shrink-0" />
                      {isToday(inquiry.created_at) && (
                        <span className="text-xs text-red-500 font-bold shrink-0">NEW</span>
                      )}
                      {inquiry.file_urls && inquiry.file_urls.length > 0 && (
                        <Paperclip className="w-3 h-3 text-gray-400 shrink-0" />
                      )}
                    </div>
                    {/* Status */}
                    <span className={`w-16 sm:w-20 text-center text-[10px] sm:text-xs font-medium shrink-0 ${
                      inquiry.status === 'completed'
                        ? 'text-green-600'
                        : inquiry.status === 'ongoing'
                        ? 'text-[#0052CC]'
                        : 'text-gray-400'
                    }`}>
                      {inquiry.status === 'completed' ? '답변완료' : inquiry.status === 'ongoing' ? '진행중' : '대기중'}
                    </span>
                    {/* Writer */}
                    <span className="hidden sm:block w-28 text-center text-sm text-gray-700 shrink-0 truncate">
                      {inquiry.manager_name ?? ''}
                    </span>
                    {/* Date */}
                    <span className="w-20 sm:w-24 text-right text-sm text-gray-500 shrink-0">
                      {formatDate(inquiry.created_at)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-1 lg:gap-2 mt-6 lg:mt-8">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="px-2 py-1.5 lg:px-3 lg:py-2 rounded-lg border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition"
                    aria-label="이전 페이지"
                  >
                    <ChevronLeft className="w-3 h-3 lg:w-4 lg:h-4" />
                  </button>

                  <div className="flex items-center gap-1">
                    {(() => {
                      const maxVisible = 5;
                      let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
                      let end = start + maxVisible - 1;
                      if (end > totalPages) {
                        end = totalPages;
                        start = Math.max(1, end - maxVisible + 1);
                      }
                      const pages: (number | string)[] = [];
                      if (start > 1) { pages.push(1); if (start > 2) pages.push('...'); }
                      for (let i = start; i <= end; i++) pages.push(i);
                      if (end < totalPages) { if (end < totalPages - 1) pages.push('...'); pages.push(totalPages); }
                      return pages.map((page, idx) =>
                        typeof page === 'string' ? (
                          <span key={`ellipsis-${idx}`} className="px-1 text-xs text-gray-400">...</span>
                        ) : (
                          <button
                            key={page}
                            onClick={() => setCurrentPage(page)}
                            className={`
                              px-2 py-1.5 lg:px-3 lg:py-2 rounded-lg text-xs lg:text-sm transition
                              ${currentPage === page
                                ? 'bg-black text-white'
                                : 'border border-gray-300 hover:bg-gray-50'
                              }
                            `}
                          >
                            {page}
                          </button>
                        )
                      );
                    })()}
                  </div>

                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="px-2 py-1.5 lg:px-3 lg:py-2 rounded-lg border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition"
                    aria-label="다음 페이지"
                  >
                    <ChevronRight className="w-3 h-3 lg:w-4 lg:h-4" />
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="bg-white rounded-lg p-8 lg:p-12 text-center">
              <MessageSquare className="w-10 h-10 lg:w-12 lg:h-12 mx-auto text-gray-300 mb-3" />
              <p className="text-sm lg:text-base text-gray-500 mb-4">등록된 문의가 없습니다.</p>
            </div>
          )}
        </>
      )}

      {/* Password Modal */}
      {passwordModalId && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-4" onClick={() => setPasswordModalId(null)}>
          <div className="bg-white rounded-lg p-8 shadow-lg w-full max-w-sm text-center" onClick={(e) => e.stopPropagation()}>
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
                className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#0052CC] transition mb-3"
                autoFocus
                disabled={isVerifying}
              />
              {passwordError && (
                <p className="text-sm text-red-500 mb-3">{passwordError}</p>
              )}
              <button
                type="submit"
                disabled={isVerifying || !passwordInput.trim()}
                className="w-full py-3 bg-[#0052CC] text-white rounded-lg hover:bg-[#2f4584] transition disabled:bg-gray-400 disabled:cursor-not-allowed text-sm font-medium"
              >
                {isVerifying ? '확인 중...' : '확인'}
              </button>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
