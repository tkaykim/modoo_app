'use client'

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Search, FileText, ChevronRight } from 'lucide-react';
import { formatKstDateLong } from '@/lib/kst';

interface GuestInquiry {
  id: string;
  title: string;
  status: string;
  created_at: string;
  has_reply: boolean;
}

function statusLabel(status: string) {
  if (status === 'completed') return { text: '답변완료', cls: 'bg-green-100 text-green-800' };
  if (status === 'ongoing') return { text: '진행중', cls: 'bg-blue-100 text-blue-800' };
  return { text: '대기중', cls: 'bg-yellow-100 text-yellow-800' };
}

export default function InquiryLookupPage() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);
  const [results, setResults] = useState<GuestInquiry[]>([]);

  const handleLookup = async () => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 8) {
      setError('전화번호를 정확히 입력해주세요.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/inquiries/guest-lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: digits }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || '조회에 실패했습니다.');
      setResults(Array.isArray(data.inquiries) ? data.inquiries : []);
      setSearched(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : '조회 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const openInquiry = (id: string) => {
    // 전화번호가 열람 키(lib/inquiry-access)이므로, 조회 성공 = 본인 확인.
    // 상세 페이지가 다시 묻지 않도록 세션에 인증 표시 + 재답글용 키(전화번호) 저장.
    try {
      const digits = phone.replace(/\D/g, '');
      sessionStorage.setItem(`inquiry_verified_${id}`, 'true');
      sessionStorage.setItem(`inquiry_pw_${id}`, digits);
    } catch { /* sessionStorage 불가 시에도 상세에서 다시 확인 가능 */ }
    router.push(`/inquiries/${id}`);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="w-full px-4 py-4">
          <div className="flex items-center">
            <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-full transition mr-2">
              <ChevronLeft className="w-6 h-6" />
            </button>
            <h1 className="text-lg font-bold">비회원 문의 조회</h1>
          </div>
        </div>
      </header>

      <div className="w-full max-w-lg mx-auto p-4">
        <div className="bg-white rounded-lg p-6 shadow-sm">
          <p className="text-sm text-gray-600 mb-4">
            로그인 없이, 문의 작성 시 입력하신 <b>전화번호</b>로 내 문의와 답변을 확인할 수 있어요.
          </p>
          <form
            onSubmit={(e) => { e.preventDefault(); handleLookup(); }}
            className="flex gap-2"
          >
            <input
              type="tel"
              inputMode="numeric"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="전화번호 (예: 010-1234-5678)"
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-brand transition"
              autoFocus
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || phone.replace(/\D/g, '').length < 8}
              className="flex items-center gap-1 px-5 py-3 bg-brand text-white rounded-lg hover:bg-[#2f4584] transition disabled:bg-gray-400 disabled:cursor-not-allowed text-sm font-medium"
            >
              <Search className="w-4 h-4" />
              {loading ? '조회 중...' : '조회'}
            </button>
          </form>
          {error && <p className="text-sm text-red-500 mt-3">{error}</p>}
        </div>

        {searched && (
          <div className="mt-4 bg-white rounded-lg shadow-sm overflow-hidden">
            {results.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <FileText className="w-10 h-10 mx-auto text-gray-300 mb-3" />
                <p className="text-sm">해당 전화번호로 접수된 문의가 없어요.</p>
                <p className="text-xs text-gray-400 mt-1">문의 작성 시 입력한 번호와 동일한지 확인해주세요.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {results.map((inq) => {
                  const s = statusLabel(inq.status);
                  return (
                    <button
                      key={inq.id}
                      onClick={() => openInquiry(inq.id)}
                      className="flex w-full items-center gap-3 px-4 py-4 text-left hover:bg-gray-50 transition"
                    >
                      <span className="flex-1 min-w-0">
                        <span className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${s.cls}`}>{s.text}</span>
                          {inq.has_reply && (
                            <span className="text-[11px] font-medium text-brand">답변 도착</span>
                          )}
                        </span>
                        <span className="block text-sm font-medium text-gray-900 truncate mt-1">{inq.title}</span>
                        <span className="block text-xs text-gray-400 mt-0.5">{formatKstDateLong(inq.created_at)}</span>
                      </span>
                      <ChevronRight className="w-5 h-5 text-gray-300 shrink-0" />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
