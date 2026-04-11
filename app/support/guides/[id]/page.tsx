'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase-client';

const CATEGORY_LABELS: Record<string, string> = {
  fabric: '원단 안내',
  printing: '인쇄방법',
  order_guide: '주문 가이드',
};

interface GuideDetail {
  id: string;
  title: string;
  content: string;
  category: string;
  created_at: string;
}

interface RelatedGuide {
  id: string;
  title: string;
  category: string;
}

export default function GuideDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const guideId = useMemo(() => params?.id, [params]);

  const [guide, setGuide] = useState<GuideDetail | null>(null);
  const [relatedGuides, setRelatedGuides] = useState<RelatedGuide[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchGuide = async () => {
      if (!guideId) return;

      setIsLoading(true);
      setError(null);

      try {
        const supabase = createClient();
        const { data, error: fetchError } = await supabase
          .from('announcements')
          .select('id, title, content, category, created_at')
          .eq('id', guideId)
          .eq('is_published', true)
          .maybeSingle();

        if (fetchError) throw fetchError;

        if (!data) {
          setError('가이드를 찾을 수 없습니다.');
          setGuide(null);
          return;
        }

        setGuide(data as GuideDetail);

        const { data: related } = await supabase
          .from('announcements')
          .select('id, title, category')
          .eq('is_published', true)
          .eq('category', data.category)
          .neq('id', guideId)
          .order('created_at', { ascending: false })
          .limit(4);

        setRelatedGuides((related || []) as RelatedGuide[]);
      } catch (err) {
        console.error('Failed to fetch guide:', err);
        setError('가이드를 불러오는데 실패했습니다.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchGuide();
  }, [guideId]);

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="sticky top-0 bg-white z-40 border-b border-gray-200">
        <div className="flex items-center gap-3 px-4 py-4">
          <button onClick={() => router.back()} className="p-1">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-bold">가이드</h1>
        </div>
      </div>

      <div className="max-w-3xl mx-auto p-4">
        {isLoading ? (
          <div className="text-center py-20">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em]" />
            <p className="text-gray-500 mt-4">가이드를 불러오는 중...</p>
          </div>
        ) : error ? (
          <div className="text-center py-20">
            <p className="text-red-500 mb-4">{error}</p>
            <button
              onClick={() => router.push('/support/guides')}
              className="px-6 py-3 bg-black text-white rounded-lg font-medium hover:bg-gray-800 transition-colors"
            >
              목록으로
            </button>
          </div>
        ) : !guide ? null : (
          <>
            <article className="bg-white shadow-sm rounded-xl overflow-hidden">
              <div className="p-5 pb-3">
                <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium mb-3 ${
                  guide.category === 'fabric' ? 'bg-emerald-50 text-emerald-700' :
                  guide.category === 'printing' ? 'bg-purple-50 text-purple-700' :
                  'bg-amber-50 text-amber-700'
                }`}>
                  {CATEGORY_LABELS[guide.category] ?? guide.category}
                </span>
                <h2 className="text-xl font-bold text-gray-900 mb-2">{guide.title}</h2>
                <div className="text-xs text-gray-400 mb-4">
                  {new Date(guide.created_at).toLocaleDateString('ko-KR')}
                </div>
              </div>

              <div
                className="px-5 pb-6 rich-content text-[15px] text-gray-700"
                dangerouslySetInnerHTML={{ __html: guide.content }}
              />
            </article>

            {relatedGuides.length > 0 && (
              <div className="mt-6">
                <h3 className="text-base font-bold text-gray-900 mb-3">관련 가이드</h3>
                <div className="space-y-2">
                  {relatedGuides.map((related) => (
                    <Link
                      key={related.id}
                      href={`/support/guides/${related.id}`}
                      className="block bg-white rounded-lg px-4 py-3 border border-gray-100 hover:bg-gray-50 transition-colors"
                    >
                      <span className="text-sm font-medium text-gray-800">{related.title}</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-6 text-center">
              <Link
                href="/support/guides"
                className="inline-block px-6 py-3 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
              >
                가이드 목록 보기
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
