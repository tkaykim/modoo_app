'use client'

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Faq, InquiryWithDetails } from '@/types/types';
import { createClient } from '@/lib/supabase-client';
import { maybeHealOnError } from '@/lib/supabase-resilient';
import { formatKstDateInputValue, isTodayKst } from '@/lib/kst';
import { ChevronLeft, MessageSquare, Plus, Search, ChevronRight, HelpCircle, Lock, Paperclip } from 'lucide-react';

const ITEMS_PER_PAGE = 20;

export default function InquiriesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [inquiries, setInquiries] = useState<InquiryWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'my' | 'faq'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [faqs, setFaqs] = useState<Faq[]>([]);
  const [faqTotalCount, setFaqTotalCount] = useState(0);
  const [authChecked, setAuthChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // Password modal
  const [passwordModalId, setPasswordModalId] = useState<string | null>(null);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  // Calculate total pages
  const totalPages = Math.ceil((activeTab === 'faq' ? faqTotalCount : totalCount) / ITEMS_PER_PAGE);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, searchQuery]);

  // Set initial tab from URL params
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'my' || tab === 'faq') setActiveTab(tab);
    else setActiveTab('all');
  }, [searchParams]);

  useEffect(() => {
    const loadUser = async () => {
      const supabase = createClient();
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

      setAuthChecked(true);
    };

    loadUser();
  }, []);

  useEffect(() => {
    if (activeTab === 'my' && authChecked && !user) {
      alert('로그인이 필요합니다.');
      router.push('/login?redirect=/inquiries?tab=my');
    }
  }, [activeTab, authChecked, user, router]);

  useEffect(() => {
    const fetchContent = async () => {
      if (activeTab === 'my' && !authChecked) return;
      if (activeTab === 'my' && authChecked && !user) return;

      setIsLoading(true);
      const supabase = createClient();

      const from = (currentPage - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;

      try {
        if (activeTab === 'faq') {
          let query = supabase
            .from('faqs')
            .select('*', { count: 'exact' })
            .eq('is_published', true);

          if (searchQuery.trim() !== '') {
            query = query.ilike('question', `%${searchQuery.trim()}%`);
          }

          const { data, error, count } = await query
            .order('sort_order', { ascending: true })
            .order('created_at', { ascending: false })
            .range(from, to);

          if (!error && data) {
            setFaqs(data as Faq[]);
            setFaqTotalCount(count || 0);
          } else if (error) {
            if (maybeHealOnError(error)) return;
            console.error('Error fetching FAQs:', error);
          }

          return;
        }

        let query = supabase
          .from('inquiries')
          .select(`
            *,
            products:inquiry_products(
              id,
              product_id,
              product:products(*)
            ),
            replies:inquiry_replies(
              id,
              content,
              created_at,
              admin:profiles!inquiry_replies_admin_id_fkey(name)
            )
          `, { count: 'exact' });

        if (activeTab === 'my' && user?.id) {
          query = query.eq('user_id', user.id);
        }

        if (searchQuery.trim() !== '') {
          query = query.or(`title.ilike.%${searchQuery}%,content.ilike.%${searchQuery}%`);
        }

        const { data, error, count } = await query
          .order('created_at', { ascending: false })
          .range(from, to);

        if (!error && data) {
          setInquiries(data as InquiryWithDetails[]);
          setTotalCount(count || 0);
        } else if (error) {
          if (maybeHealOnError(error)) return;
          console.error('Error fetching inquiries:', error);
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchContent();
  }, [currentPage, activeTab, searchQuery, authChecked, user, user?.id]);

  const formatDate = (dateString: string) => formatKstDateInputValue(dateString) || '-';

  const handleInquiryClick = (inquiry: InquiryWithDetails) => {
    // Admins and owners skip password
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
    <div className="min-h-screen pb-20">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="w-full mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <button
                onClick={() => router.back()}
                className="p-2 hover:bg-gray-100 rounded-full transition mr-2"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <h1 className="text-lg font-bold">문의 게시판</h1>
            </div>
            <button
              onClick={() => router.push('/inquiries/new')}
              className="flex items-center gap-2 px-4 py-2 bg-[#3B55A5] text-white rounded-lg hover:bg-[#2f4584] transition"
            >
              <Plus className="w-4 h-4" />
              <span className="text-sm font-medium">문의하기</span>
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => {
                setActiveTab('all');
                router.replace('/inquiries');
              }}
              className={`
                flex-1 px-4 py-2 rounded-lg text-sm font-medium transition
                ${activeTab === 'all'
                  ? 'bg-[#3B55A5] text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }
              `}
            >
              전체
            </button>
            <button
              onClick={() => {
                if (!user) {
                  alert('로그인이 필요합니다.');
                  router.replace('/login?redirect=/inquiries?tab=my');
                  return;
                }
                setActiveTab('my');
                router.replace('/inquiries?tab=my');
              }}
              className={`
                flex-1 px-4 py-2 rounded-lg text-sm font-medium transition
                ${activeTab === 'my'
                  ? 'bg-[#3B55A5] text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }
              `}
            >
              나의 문의
            </button>
            <button
              onClick={() => {
                setActiveTab('faq');
                router.replace('/inquiries?tab=faq');
              }}
              className={`
                flex-1 px-4 py-2 rounded-lg text-sm font-medium transition
                ${activeTab === 'faq'
                  ? 'bg-[#3B55A5] text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }
              `}
            >
              FAQ
            </button>
          </div>

          {/* Search */}
          {/* <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={activeTab === 'faq' ? '질문으로 검색...' : '제목이나 내용으로 검색...'}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-black transition"
            />
          </div> */}
        </div>
      </header>

      {/* Content */}
      <div className="">
        {isLoading ? (
          <div className="text-center py-12 text-gray-500">로딩 중...</div>
        ) : activeTab === 'faq' ? (
          faqs.length === 0 ? (
            <div className="text-center py-12">
              <HelpCircle className="w-16 h-16 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500 mb-6">
                {searchQuery ? '검색 결과가 없습니다.' : '등록된 FAQ가 없습니다.'}
              </p>
            </div>
          ) : (
            <div className="">
              {faqs.map((faq) => (
                <details
                  key={faq.id}
                  className="bg-white p-4 transition border-b border-black/30"
                >
                  <summary className="cursor-pointer">
                    <div className="flex flex-col gap-1">
                      <span className="font-bold text-lg">{faq.question}</span>
                      {faq.category && (
                        <span className="text-xs text-gray-500">{faq.category}</span>
                      )}
                    </div>
                  </summary>
                  <div className="mt-3 text-sm text-gray-700 whitespace-pre-wrap">
                    {faq.answer}
                  </div>
                  {faq.tags && faq.tags.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {faq.tags.map((tag) => (
                        <span
                          key={tag}
                          className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-700"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </details>
              ))}
            </div>
          )
        ) : inquiries.length === 0 ? (
          <div className="text-center py-12">
            <MessageSquare className="w-16 h-16 mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500 mb-6">
              {searchQuery
                ? '검색 결과가 없습니다.'
                : activeTab === 'my'
                ? '등록된 문의가 없습니다.'
                : '등록된 문의가 없습니다.'
              }
            </p>
            {!searchQuery && (
              <button
                onClick={() => router.push('/inquiries/new')}
                className="px-6 py-3 bg-[#3B55A5] text-white rounded-lg hover:bg-[#2f4584] transition"
              >
                첫 문의 등록하기
              </button>
            )}
          </div>
        ) : (
          <div className="">
            {/* Table Header */}
            <div className="flex items-center px-4 py-2 border-b border-gray-300 bg-gray-50 text-xs text-gray-500 font-medium uppercase tracking-wider">
              <span className="flex-1">제목</span>
              <span className="hidden sm:block w-28 text-center shrink-0">작성자</span>
              <span className="w-16 sm:w-20 text-center shrink-0">답변 상태</span>
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
                  {inquiry.replies && inquiry.replies.length > 0 && (
                    <span className="text-xs text-red-500 font-bold shrink-0">+{inquiry.replies.length}</span>
                  )}
                  <Lock className="w-3 h-3 text-gray-400 shrink-0" />
                  {isTodayKst(inquiry.created_at) && (
                    <span className="text-xs text-red-500 font-bold shrink-0">NEW</span>
                  )}
                  {inquiry.file_urls && inquiry.file_urls.length > 0 && (
                    <Paperclip className="w-3 h-3 text-gray-400 shrink-0" />
                  )}
                </div>
                {/* Writer */}
                <span className="hidden sm:block w-28 text-center text-sm text-gray-700 shrink-0 truncate">
                  {inquiry.manager_name ?? ''}
                </span>
                {/* Status */}
                <span className={`w-16 sm:w-20 text-center text-xs font-medium shrink-0 ${
                  inquiry.status === 'completed'
                    ? 'text-green-600'
                    : inquiry.status === 'ongoing'
                    ? 'text-blue-600'
                    : 'text-gray-400'
                }`}>
                  {inquiry.status === 'completed' ? '답변완료' : inquiry.status === 'ongoing' ? '진행중' : '대기중'}
                </span>
                {/* Date */}
                <span className="w-20 sm:w-24 text-right text-sm text-gray-500 shrink-0">
                  {formatDate(inquiry.created_at)}
                </span>
              </div>
            ))}
          </div>
        )}

        {!isLoading &&
          totalPages > 1 &&
          (activeTab === 'faq' ? faqs.length > 0 : inquiries.length > 0) && (
            <div className="flex items-center justify-center gap-2 py-8">
              <button
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="px-3 py-2 rounded-lg border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                  const shouldShow =
                    page === 1 ||
                    page === totalPages ||
                    (page >= currentPage - 1 && page <= currentPage + 1);

                  const shouldShowEllipsis =
                    (page === 2 && currentPage > 3) ||
                    (page === totalPages - 1 && currentPage < totalPages - 2);

                  if (shouldShowEllipsis) {
                    return (
                      <span key={page} className="px-2 text-gray-400">
                        ...
                      </span>
                    );
                  }

                  if (!shouldShow) return null;

                  return (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`
                        min-w-[40px] px-3 py-2 rounded-lg transition
                        ${
                          currentPage === page
                            ? 'bg-[#3B55A5] text-white'
                            : 'border border-gray-300 hover:bg-gray-50'
                        }
                      `}
                    >
                      {page}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-2 rounded-lg border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          )}
      </div>

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
      )}
    </div>
  );
}
