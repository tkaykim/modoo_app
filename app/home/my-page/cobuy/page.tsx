'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import { getUserCoBuySessions } from '@/lib/cobuyService';
import { getUserCoBuyRequests } from '@/lib/cobuyRequestService';
import { CoBuySession, CoBuyRequest, CoBuyRequestStatus } from '@/types/types';
import {
  Users, Calendar, Copy, CheckCircle, FileText,
  ArrowRight, Package,
} from 'lucide-react';
import Header from '@/app/components/Header';
import { formatKstMonthDay } from '@/lib/kst';

type Tab = 'requests' | 'sessions';

const requestStatusLabels: Record<CoBuyRequestStatus, string> = {
  pending: '검토 대기',
  in_progress: '디자인 작업중',
  design_shared: '디자인 공유됨',
  feedback: '피드백 중',
  confirmed: '확정됨',
  session_created: '공동구매 생성됨',
  rejected: '거절됨',
};

const requestStatusColors: Record<CoBuyRequestStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  in_progress: 'bg-blue-100 text-blue-800',
  design_shared: 'bg-purple-100 text-purple-800',
  feedback: 'bg-orange-100 text-orange-800',
  confirmed: 'bg-green-100 text-green-800',
  session_created: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-red-100 text-red-800',
};

const sessionStatusLabels: Record<CoBuySession['status'], string> = {
  gathering: '모집중',
  gather_complete: '모집 완료',
  order_complete: '주문 완료',
  manufacturing: '제작중',
  manufacture_complete: '제작 완료',
  delivering: '배송중',
  delivery_complete: '배송 완료',
  cancelled: '취소됨',
};

const sessionStatusColors: Record<CoBuySession['status'], string> = {
  gathering: 'bg-green-100 text-green-800',
  gather_complete: 'bg-blue-100 text-blue-800',
  order_complete: 'bg-blue-100 text-blue-800',
  manufacturing: 'bg-yellow-100 text-yellow-800',
  manufacture_complete: 'bg-blue-100 text-blue-800',
  delivering: 'bg-purple-100 text-purple-800',
  delivery_complete: 'bg-gray-100 text-gray-800',
  cancelled: 'bg-red-100 text-red-800',
};

export default function CoBuyListPage() {
  const router = useRouter();
  const { isAuthenticated, user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<Tab>('requests');
  const [sessions, setSessions] = useState<CoBuySession[]>([]);
  const [requests, setRequests] = useState<CoBuyRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      if (!isAuthenticated || !user) {
        setIsLoading(false);
        return;
      }
      try {
        setIsLoading(true);
        const [sessionsData, requestsData] = await Promise.all([
          getUserCoBuySessions(),
          getUserCoBuyRequests(),
        ]);
        setSessions(sessionsData);
        setRequests(requestsData);
      } catch (err) {
        console.error('Error fetching CoBuy data:', err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, [isAuthenticated, user]);

  const copyShareLink = (shareToken: string, prefix: string = 'cobuy') => {
    const shareUrl = `${window.location.origin}/${prefix}/${shareToken}`;
    navigator.clipboard.writeText(shareUrl);
    setCopiedToken(shareToken);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const formatDate = (dateString: string) => formatKstMonthDay(dateString);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 pb-20">
        <Header back />
        <div className="text-center py-20 px-4">
          <p className="text-gray-500 mb-4">로그인이 필요합니다</p>
          <button
            onClick={() => router.push('/login')}
            className="px-6 py-3 bg-[#3B55A5] text-white rounded-xl font-medium"
          >
            로그인하기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <Header back />

      <div className="max-w-2xl mx-auto px-4 pt-2">
        {/* Tabs */}
        <div className="flex bg-gray-100 rounded-xl p-1 mb-4">
          <button
            onClick={() => setActiveTab('requests')}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition ${
              activeTab === 'requests'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500'
            }`}
          >
            요청 {requests.length > 0 && <span className="text-xs text-gray-400 ml-1">({requests.length})</span>}
          </button>
          <button
            onClick={() => setActiveTab('sessions')}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition ${
              activeTab === 'sessions'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500'
            }`}
          >
            공동구매 {sessions.length > 0 && <span className="text-xs text-gray-400 ml-1">({sessions.length})</span>}
          </button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#3B55A5]" />
          </div>
        ) : activeTab === 'requests' ? (
          /* ============ REQUESTS TAB ============ */
          requests.length === 0 ? (
            <div className="text-center py-16">
              <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p className="text-sm text-gray-500 mb-1">요청이 없습니다</p>
              <p className="text-xs text-gray-400 mb-4">공동구매 요청을 만들어보세요</p>
              <button
                onClick={() => router.push('/home/cobuy/request/create')}
                className="px-5 py-2.5 bg-[#3B55A5] text-white rounded-xl text-sm font-medium"
              >
                새 요청 만들기
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {requests.map(req => {
                const statusLabel = requestStatusLabels[req.status];
                const statusColor = requestStatusColors[req.status];

                return (
                  <div
                    key={req.id}
                    onClick={() => router.push(`/cobuy/request/${req.share_token}`)}
                    className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:border-gray-300 transition cursor-pointer"
                  >
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="min-w-0 flex-1">
                          <h3 className="text-sm font-semibold text-gray-900 truncate">{req.title}</h3>
                          <p className="text-xs text-gray-400 mt-0.5">{formatDate(req.created_at)}</p>
                        </div>
                        <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-medium ${statusColor}`}>
                          {statusLabel}
                        </span>
                      </div>

                      {req.description && (
                        <p className="text-xs text-gray-500 line-clamp-1 mb-2">{req.description}</p>
                      )}

                      {/* Status Progress */}
                      <RequestStatusBar status={req.status} />

                      {/* Quick info */}
                      <div className="flex items-center gap-3 mt-2.5 text-[10px] text-gray-400">
                        {req.confirmed_price && (
                          <span>₩{Number(req.confirmed_price).toLocaleString()}</span>
                        )}
                        {req.cobuy_session_id && (
                          <span className="flex items-center gap-0.5 text-emerald-600 font-medium">
                            <Package className="w-3 h-3" /> 세션 생성됨
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              <button
                onClick={() => router.push('/home/cobuy/request/create')}
                className="w-full py-3 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-400 hover:border-[#3B55A5] hover:text-[#3B55A5] transition"
              >
                + 새 요청 만들기
              </button>
            </div>
          )
        ) : (
          /* ============ SESSIONS TAB ============ */
          sessions.length === 0 ? (
            <div className="text-center py-16">
              <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p className="text-sm text-gray-500 mb-1">공동구매가 없습니다</p>
              <p className="text-xs text-gray-400">요청이 확정되면 공동구매가 생성됩니다</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sessions.map(session => {
                const statusLabel = sessionStatusLabels[session.status];
                const statusColor = sessionStatusColors[session.status];
                const isExpired = new Date(session.end_date) < new Date();
                const isCopied = copiedToken === session.share_token;

                return (
                  <div
                    key={session.id}
                    className="bg-white rounded-xl border border-gray-200 overflow-hidden"
                  >
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="min-w-0 flex-1">
                          <h3 className="text-sm font-semibold text-gray-900 truncate">{session.title}</h3>
                          {session.description && (
                            <p className="text-xs text-gray-500 line-clamp-1 mt-0.5">{session.description}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${statusColor}`}>
                            {statusLabel}
                          </span>
                          {isExpired && session.status === 'gathering' && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-100 text-red-800">
                              만료
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Stats */}
                      <div className="flex items-center gap-4 text-xs text-gray-500 mb-3">
                        <span className="flex items-center gap-1">
                          <Users className="w-3.5 h-3.5" />
                          {session.current_participant_count}명
                          {session.max_participants && ` / ${session.max_participants}`}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          {formatDate(session.start_date)} ~ {formatDate(session.end_date)}
                        </span>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2">
                        <button
                          onClick={() => router.push(`/home/my-page/cobuy/${session.id}`)}
                          className="flex-1 py-2 bg-gray-900 text-white text-xs rounded-lg font-medium hover:bg-gray-800 transition flex items-center justify-center gap-1"
                        >
                          관리하기 <ArrowRight className="w-3 h-3" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); copyShareLink(session.share_token); }}
                          className="py-2 px-3 border border-gray-200 text-xs rounded-lg hover:bg-gray-50 transition flex items-center gap-1.5"
                        >
                          {isCopied ? (
                            <><CheckCircle className="w-3.5 h-3.5 text-green-600" /><span className="text-green-600">복사됨</span></>
                          ) : (
                            <><Copy className="w-3.5 h-3.5" /> 링크</>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Request Status Progress Bar
// ============================================================================

const REQUEST_STEPS: { key: CoBuyRequestStatus; label: string }[] = [
  { key: 'pending', label: '대기' },
  { key: 'in_progress', label: '작업중' },
  { key: 'design_shared', label: '공유' },
  { key: 'confirmed', label: '확정' },
  { key: 'session_created', label: '생성' },
];

function RequestStatusBar({ status }: { status: CoBuyRequestStatus }) {
  if (status === 'rejected') {
    return (
      <div className="flex items-center gap-1.5 text-[10px] text-red-500 font-medium">
        <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
        요청이 거절되었습니다
      </div>
    );
  }

  // Map feedback to design_shared step (same visual position)
  const statusForStep = status === 'feedback' ? 'design_shared' : status;
  const currentIdx = REQUEST_STEPS.findIndex(s => s.key === statusForStep);

  return (
    <div className="flex items-center gap-0.5">
      {REQUEST_STEPS.map((step, idx) => {
        const isPast = idx < currentIdx;
        const isCurrent = idx === currentIdx;
        return (
          <div key={step.key} className="flex-1 flex flex-col items-center gap-1">
            <div
              className={`w-full h-1 rounded-full ${
                isPast || isCurrent ? 'bg-[#3B55A5]' : 'bg-gray-200'
              }`}
            />
            <span className={`text-[9px] ${isPast || isCurrent ? 'text-[#3B55A5] font-medium' : 'text-gray-300'}`}>
              {step.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
