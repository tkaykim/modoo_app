'use client';

import { useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { Faq } from '@/types/types';

interface FaqAccordionProps {
  faqs: Faq[];
  query: string;
}

const ALL = '전체';

export default function FaqAccordion({ faqs, query }: FaqAccordionProps) {
  const [category, setCategory] = useState<string>(ALL);
  const [openId, setOpenId] = useState<string | null>(null);

  // 카테고리 탭 (DB의 distinct category + 전체). null 카테고리는 '기타'.
  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const f of faqs) set.add(f.category && f.category.trim() ? f.category : '기타');
    return [ALL, ...Array.from(set)];
  }, [faqs]);

  const q = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    return faqs.filter((f) => {
      const cat = f.category && f.category.trim() ? f.category : '기타';
      const catOk = category === ALL || cat === category;
      const qOk =
        q === '' ||
        f.question.toLowerCase().includes(q) ||
        (f.answer ?? '').toLowerCase().includes(q) ||
        (f.tags ?? []).some((t) => t.toLowerCase().includes(q));
      return catOk && qOk;
    });
  }, [faqs, category, q]);

  return (
    <div>
      {/* 카테고리 탭 (무신사형 가로 스크롤 언더라인) */}
      {q === '' && categories.length > 2 && (
        <div className="flex gap-4 overflow-x-auto border-b border-gray-200 px-4 -mx-0 mb-1 scrollbar-hide">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`relative shrink-0 py-3 text-sm transition-colors ${
                category === c ? 'font-bold text-gray-900' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              {c}
              {category === c && (
                <span className="absolute left-0 -bottom-px h-0.5 w-full bg-gray-900" />
              )}
            </button>
          ))}
        </div>
      )}

      {/* 아코디언 리스트 */}
      {filtered.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-gray-400">
          {q ? '검색 결과가 없어요. 아래 채팅 상담이나 1:1 문의를 이용해 주세요.' : '등록된 FAQ가 없어요.'}
        </p>
      ) : (
        <ul>
          {filtered.map((faq) => {
            const isOpen = openId === faq.id;
            return (
              <li key={faq.id} className="border-b border-gray-100">
                <button
                  onClick={() => setOpenId(isOpen ? null : faq.id)}
                  className="flex w-full items-start justify-between gap-3 px-4 py-4 text-left"
                >
                  <span className="min-w-0">
                    {faq.category && (
                      <span className="block text-[11px] text-gray-400 mb-0.5">{faq.category}</span>
                    )}
                    <span className="text-sm font-medium text-gray-900">{faq.question}</span>
                  </span>
                  <ChevronDown
                    className={`mt-0.5 h-4 w-4 shrink-0 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                  />
                </button>
                {isOpen && (
                  <div className="px-4 pb-4 -mt-1">
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-600">{faq.answer}</p>
                    {faq.tags && faq.tags.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {faq.tags.map((t) => (
                          <span key={t} className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-500">
                            #{t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
