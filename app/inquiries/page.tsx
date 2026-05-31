'use client'

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Faq, InquiryWithDetails } from '@/types/types';
import { createClient } from '@/lib/supabase-client';
import { maybeHealOnError } from '@/lib/supabase-resilient';
import { formatKstDateInputValue, isTodayKst } from '@/lib/kst';
import { useAuthStore } from '@/store/useAuthStore';
import FaqAccordion from '@/app/components/support/FaqAccordion';
import {
  ChevronLeft, ChevronRight, ChevronDown, Search, Lock, Paperclip, MessageSquare,
  MessagesSquare, FileText, Plus,
} from 'lucide-react';

const ITEMS_PER_PAGE = 20;

type View = 'landing' | 'all' | 'my';

function statusLabel(status: string) {
  if (status === 'completed') return { text: '답변완료', cls: 'text-green-600' };
  if (status === 'ongoing') return { text: '진행중', cls: 'text-[#0052CC]' };
  return { text: '대기중', cls: 'text-gray-400' };
}

export default function InquiriesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const authName = useAuthStore((s) => s.user?.name);

  const tab = searchParams.get('tab');
  const view: View = tab === 'all' ? 'all' : tab === 'my' ? 'my' : 'landing';

  const [user, setUser] = useState<any>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // Landing data
  const [faqs, setFaqs] = useState<Faq[]>([]);
  const [faqSearch, setFaqSearch] = useState('');
  const [boardPreview, setBoardPreview] = useState<InquiryWithDetails[]>([]);
  const [myPreview, setMyPreview] = useState<InquiryWithDetails[]>([]);
  const [landingLoading, setLandingLoading] = useState(true);
  const [faqOpen, setFaqOpen] = useState(false);

  // Full list views
  const [inquiries, setInquiries] = useState<InquiryWithDetails[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [listLoading, setListLoading] = useState(true);

  // Password modal
  const [passwordModalId, setPasswordModalId] = useState<string | null>(null);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  useEffect(() => { setCurrentPage(1); }, [view]);

  // Auth
  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user || null);
      if (user) {
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
        setIsAdmin(profile?.role === 'admin');
      }
      setAuthChecked(true);
    })();
  }, []);

  // 'my' view requires login
  useEffect(() => {
    if (view === 'my' && authChecked && !user) {
      alert('로그인이 필요합니다.');
      router.push('/login?redirect=/inquiries?tab=my');
    }
  }, [view, authChecked, user, router]);

  const inquirySelect = `
    *,
    products:inquiry_products(id, product_id, product:products(*)),
    replies:inquiry_replies(id, content, created_at, admin:profiles!inquiry_replies_admin_id_fkey(name))
  `;

  // Landing fetch (faqs + previews)
  useEffect(() => {
    if (view !== 'landing' || !authChecked) return;
    (async () => {
      setLandingLoading(true);
      const supabase = createClient();
      try {
        const faqP = supabase.from('faqs').select('*').eq('is_published', true)
          .order('sort_order', { ascending: true }).order('created_at', { ascending: false });
        const boardP = supabase.from('inquiries').select(inquirySelect)
          .order('created_at', { ascending: false }).range(0, 4);
        const myP = user?.id
          ? supabase.from('inquiries').select(inquirySelect).eq('user_id', user.id)
              .order('created_at', { ascending: false }).range(0, 2)
          : Promise.resolve({ data: [], error: null } as any);

        const [faqRes, boardRes, myRes] = await Promise.all([faqP, boardP, myP]);
        if (faqRes.error && maybeHealOnError(faqRes.error)) return;
        if (faqRes.data) setFaqs(faqRes.data as Faq[]);
        if (boardRes.data) setBoardPreview(boardRes.data as InquiryWithDetails[]);
        if (myRes.data) setMyPreview(myRes.data as InquiryWithDetails[]);
      } finally {
        setLandingLoading(false);
      }
    })();
  }, [view, authChecked, user?.id]);

  // Full list fetch (all / my)
  useEffect(() => {
    if (view === 'landing') return;
    if (view === 'my' && (!authChecked || !user)) return;
    (async () => {
      setListLoading(true);
      const supabase = createClient();
      const from = (currentPage - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;
      try {
        let query = supabase.from('inquiries').select(inquirySelect, { count: 'exact' });
        if (view === 'my' && user?.id) query = query.eq('user_id', user.id);
        const { data, error, count } = await query.order('created_at', { ascending: false }).range(from, to);
        if (error) { if (maybeHealOnError(error)) return; console.error(error); return; }
        if (data) { setInquiries(data as InquiryWithDetails[]); setTotalCount(count || 0); }
      } finally {
        setListLoading(false);
      }
    })();
  }, [view, currentPage, authChecked, user?.id]);

  const formatDate = (s: string) => formatKstDateInputValue(s) || '-';

  const handleInquiryClick = (inq: InquiryWithDetails) => {
    if (isAdmin || (user && inq.user_id === user.id)) {
      sessionStorage.setItem(`inquiry_verified_${inq.id}`, 'true');
      router.push(`/inquiries/${inq.id}`);
      return;
    }
    setPasswordModalId(inq.id);
    setPasswordInput('');
    setPasswordError('');
  };

  const handlePasswordSubmit = async () => {
    if (!passwordInput.trim() || !passwordModalId) return;
    setIsVerifying(true);
    setPasswordError('');
    try {
      const res = await fetch('/api/inquiries/verify-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inquiryId: passwordModalId, password: passwordInput.trim() }),
      });
      const data = await res.json();
      if (data.match) {
        sessionStorage.setItem(`inquiry_verified_${passwordModalId}`, 'true');
        router.push(`/inquiries/${passwordModalId}`);
        setPasswordModalId(null);
      } else setPasswordError('비밀번호가 일치하지 않습니다.');
    } catch { setPasswordError('오류가 발생했습니다.'); }
    finally { setIsVerifying(false); }
  };

  // ── Shared inquiry row ──
  const InquiryRow = ({ inq }: { inq: InquiryWithDetails }) => {
    const st = statusLabel(inq.status);
    return (
      <div
        onClick={() => handleInquiryClick(inq)}
        className="flex items-center gap-2 px-4 py-3 cursor-pointer border-b border-gray-100 hover:bg-gray-50 transition"
      >
        <div className="flex-1 min-w-0 flex items-center gap-1">
          <Lock className="w-3 h-3 text-gray-300 shrink-0" />
          <span className="text-sm text-gray-900 truncate">{inq.title}</span>
          {inq.replies && inq.replies.length > 0 && (
            <span className="text-xs text-red-500 font-bold shrink-0">+{inq.replies.length}</span>
          )}
          {isTodayKst(inq.created_at) && <span className="text-[10px] text-red-500 font-bold shrink-0">NEW</span>}
          {inq.file_urls && inq.file_urls.length > 0 && <Paperclip className="w-3 h-3 text-gray-300 shrink-0" />}
        </div>
        <span className={`text-xs font-medium shrink-0 ${st.cls}`}>{st.text}</span>
        <span className="w-20 text-right text-xs text-gray-400 shrink-0">{formatDate(inq.created_at)}</span>
      </div>
    );
  };

  // ════════════ LANDING ════════════
  if (view === 'landing') {
    return (
      <div className="min-h-screen bg-white pb-24">
        {/* Header */}
        <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
          <div className="flex items-center px-2 py-3">
            <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-full transition">
              <ChevronLeft className="w-6 h-6" />
            </button>
            <h1 className="text-lg font-bold">문의하기</h1>
          </div>
        </header>

        {/* Greeting + Search */}
        <section className="px-4 pt-5 pb-4">
          <p className="text-xl font-bold leading-snug">
            {authName ? `${authName}님,` : '안녕하세요!'}<br />무엇을 도와드릴까요?
          </p>
          <div className="relative mt-4">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={faqSearch}
              onChange={(e) => setFaqSearch(e.target.value)}
              placeholder="궁금한 점을 검색해 보세요 (예: 색상, 샘플, 가격, 인쇄방식 등)"
              className="w-full pl-11 pr-4 py-3.5 rounded-full border border-gray-300 text-sm focus:outline-none focus:border-[#0052CC] transition"
            />
          </div>
        </section>

        {/* FAQ — 기본 접힘, 헤더 탭으로 펼침. 검색 중엔 결과를 그대로 노출. */}
        <section className="mt-1">
          {(() => {
            const searching = faqSearch.trim() !== '';
            const showFaq = faqOpen || searching;
            return (
              <>
                <button
                  onClick={() => setFaqOpen((v) => !v)}
                  className="flex w-full items-center justify-between px-4 py-4 text-left"
                >
                  <span className="text-base font-bold">자주 묻는 질문</span>
                  <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${showFaq ? 'rotate-180' : ''}`} />
                </button>
                {showFaq && (
                  landingLoading ? (
                    <p className="px-4 py-8 text-center text-sm text-gray-400">불러오는 중...</p>
                  ) : (
                    <FaqAccordion faqs={faqs} query={faqSearch} />
                  )
                )}
              </>
            );
          })()}
        </section>

        {/* 채팅 상담 */}
        <section className="mt-2 border-t-8 border-gray-50">
          <button
            onClick={() => router.push('/chat')}
            className="flex w-full items-center gap-3 px-4 py-4 text-left hover:bg-gray-50 transition border-b border-gray-100"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#0052CC]/10 shrink-0">
              <MessagesSquare className="w-5 h-5 text-[#0052CC]" />
            </span>
            <span className="flex-1 min-w-0">
              <span className="flex items-center gap-2">
                <span className="text-sm font-bold text-gray-900">채팅 상담</span>
                <span className="text-[11px] font-medium text-[#0052CC] bg-[#0052CC]/10 px-1.5 py-0.5 rounded">바로 답변 가능</span>
              </span>
              <span className="block text-xs text-gray-500 mt-0.5">제품 추천·예상 견적을 바로 안내해 드려요</span>
            </span>
            <ChevronRight className="w-5 h-5 text-gray-300 shrink-0" />
          </button>

          {/* 나의 문의 */}
          <button
            onClick={() => {
              if (!user) { alert('로그인이 필요합니다.'); router.push('/login?redirect=/inquiries?tab=my'); return; }
              router.push('/inquiries?tab=my');
            }}
            className="flex w-full items-center gap-3 px-4 py-4 text-left hover:bg-gray-50 transition border-b border-gray-100"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 shrink-0">
              <FileText className="w-5 h-5 text-gray-600" />
            </span>
            <span className="flex-1 min-w-0">
              <span className="text-sm font-bold text-gray-900">나의 문의</span>
              <span className="block text-xs text-gray-500 mt-0.5">
                {user ? (myPreview.length > 0 ? `최근 문의 ${myPreview.length}건` : '문의 내역이 없어요') : '로그인 후 확인'}
              </span>
            </span>
            <ChevronRight className="w-5 h-5 text-gray-300 shrink-0" />
          </button>
          {user && myPreview.length > 0 && (
            <div className="border-b border-gray-100">{myPreview.map((inq) => <InquiryRow key={inq.id} inq={inq} />)}</div>
          )}
        </section>

        {/* 공개 문의 게시판 (활발함의 증거) */}
        <section className="mt-2 border-t-8 border-gray-50">
          <div className="flex items-center justify-between px-4 py-3">
            <div>
              <h2 className="text-base font-bold">실시간 문의</h2>
              <p className="text-xs text-gray-400 mt-0.5">지금도 많은 분들이 상담받고 계세요</p>
            </div>
            <button onClick={() => router.push('/inquiries?tab=all')} className="text-xs text-gray-500 flex items-center gap-0.5 hover:text-[#0052CC]">
              전체보기 <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
          {landingLoading ? (
            <p className="px-4 py-6 text-center text-sm text-gray-400">불러오는 중...</p>
          ) : boardPreview.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-gray-400">등록된 문의가 없어요.</p>
          ) : (
            <div className="border-t border-gray-100">{boardPreview.map((inq) => <InquiryRow key={inq.id} inq={inq} />)}</div>
          )}
        </section>

        {/* Sticky CTA — 채팅 상담 / 1:1 문의 게시판 */}
        <div className="fixed bottom-0 inset-x-0 z-20 bg-white border-t border-gray-100 p-3 flex gap-2">
          <button
            onClick={() => router.push('/chat')}
            className="flex-1 py-3.5 bg-white text-[#0052CC] border border-[#0052CC] rounded-xl font-bold text-sm hover:bg-blue-50 transition flex items-center justify-center gap-1.5"
          >
            <MessagesSquare className="w-4 h-4" /> 채팅 상담 시작하기
          </button>
          <button
            onClick={() => router.push('/inquiries?tab=all')}
            className="flex-1 py-3.5 bg-[#0052CC] text-white rounded-xl font-bold text-sm hover:bg-[#2f4584] transition flex items-center justify-center gap-1.5"
          >
            <FileText className="w-4 h-4" /> 1:1 문의 게시판
          </button>
        </div>

        {passwordModalId && <PasswordModal />}
      </div>
    );
  }

  // ════════════ FULL LIST (all / my) ════════════
  return (
    <div className="min-h-screen bg-white pb-24">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="flex items-center px-2 py-3">
          <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-full transition">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-lg font-bold">{view === 'my' ? '나의 문의' : '실시간 문의'}</h1>
        </div>
      </header>

      <div>
        {listLoading ? (
          <div className="text-center py-12 text-gray-400 text-sm">로딩 중...</div>
        ) : inquiries.length === 0 ? (
          <div className="text-center py-16">
            <MessageSquare className="w-14 h-14 mx-auto text-gray-200 mb-3" />
            <p className="text-gray-400 text-sm mb-5">등록된 문의가 없습니다.</p>
            <button onClick={() => router.push('/inquiries/new')} className="px-6 py-3 bg-[#0052CC] text-white rounded-lg text-sm hover:bg-[#2f4584] transition">
              첫 문의 등록하기
            </button>
          </div>
        ) : (
          <div className="border-t border-gray-100">
            {inquiries.map((inq) => <InquiryRow key={inq.id} inq={inq} />)}
          </div>
        )}

        {!listLoading && totalPages > 1 && inquiries.length > 0 && (
          <div className="flex items-center justify-center gap-2 py-8">
            <button onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}
              className="px-3 py-2 rounded-lg border border-gray-300 disabled:opacity-50 hover:bg-gray-50 transition">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="text-sm text-gray-600 px-2">{currentPage} / {totalPages}</span>
            <button onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
              className="px-3 py-2 rounded-lg border border-gray-300 disabled:opacity-50 hover:bg-gray-50 transition">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>

      <div className="fixed bottom-0 inset-x-0 z-20 bg-white border-t border-gray-100 p-3 flex gap-2">
        <button onClick={() => router.push('/chat')}
          className="flex-1 py-3.5 bg-white text-[#0052CC] border border-[#0052CC] rounded-xl font-bold text-sm hover:bg-blue-50 transition flex items-center justify-center gap-1.5">
          <MessagesSquare className="w-4 h-4" /> 채팅 상담
        </button>
        <button onClick={() => router.push('/inquiries/new')}
          className="flex-1 py-3.5 bg-[#0052CC] text-white rounded-xl font-bold text-sm hover:bg-[#2f4584] transition flex items-center justify-center gap-1.5">
          <Plus className="w-4 h-4" /> 1:1 문의하기
        </button>
      </div>

      {passwordModalId && <PasswordModal />}
    </div>
  );

  // ── Password modal (shared) ──
  function PasswordModal() {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-4" onClick={() => setPasswordModalId(null)}>
        <div className="bg-white rounded-2xl p-8 shadow-lg w-full max-w-sm text-center" onClick={(e) => e.stopPropagation()}>
          <Lock className="w-12 h-12 mx-auto text-gray-300 mb-4" />
          <h2 className="text-lg font-bold mb-2">비밀글입니다</h2>
          <p className="text-sm text-gray-500 mb-6">이 문의를 보려면 비밀번호를 입력해주세요.</p>
          <form onSubmit={(e) => { e.preventDefault(); handlePasswordSubmit(); }}>
            <input type="password" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)}
              placeholder="비밀번호 입력" autoFocus disabled={isVerifying}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#0052CC] transition mb-3" />
            {passwordError && <p className="text-sm text-red-500 mb-3">{passwordError}</p>}
            <button type="submit" disabled={isVerifying || !passwordInput.trim()}
              className="w-full py-3 bg-[#0052CC] text-white rounded-lg hover:bg-[#2f4584] transition disabled:bg-gray-400 text-sm font-medium">
              {isVerifying ? '확인 중...' : '확인'}
            </button>
          </form>
        </div>
      </div>
    );
  }
}
