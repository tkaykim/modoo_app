'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase-client';
import { ChevronLeft, ChevronRight } from 'lucide-react';

type GuideCategory = 'fabric' | 'printing' | 'order_guide';

const GUIDE_CATEGORIES: Record<GuideCategory, string> = {
  fabric: '원단 안내',
  printing: '인쇄방법',
  order_guide: '주문 가이드',
};

const categoryKeys = Object.keys(GUIDE_CATEGORIES) as GuideCategory[];

interface GuideListItem {
  id: string;
  title: string;
  category: string;
  created_at: string;
}

export default function GuidesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialCategory = searchParams.get('category') as GuideCategory | null;

  const [guides, setGuides] = useState<GuideListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<GuideCategory | 'all'>(
    initialCategory && categoryKeys.includes(initialCategory) ? initialCategory : 'all'
  );

  useEffect(() => {
    const fetchGuides = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const supabase = createClient();
        const query = supabase
          .from('announcements')
          .select('id, title, category, created_at')
          .eq('is_published', true)
          .in('category', ['fabric', 'printing', 'order_guide'])
          .order('created_at', { ascending: false });

        const { data, error: fetchError } = await query;

        if (fetchError) throw fetchError;
        setGuides((data || []) as GuideListItem[]);
      } catch (err) {
        console.error('Failed to fetch guides:', err);
        setError('가이드를 불러오는데 실패했습니다.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchGuides();
  }, []);

  const filteredGuides = activeCategory === 'all'
    ? guides
    : guides.filter((g) => g.category === activeCategory);

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

      <div className="max-w-4xl mx-auto px-4 py-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-3">
          <button
            onClick={() => setActiveCategory('all')}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              activeCategory === 'all'
                ? 'bg-black text-white'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            전체
          </button>
          {categoryKeys.map((key) => (
            <button
              key={key}
              onClick={() => setActiveCategory(key)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                activeCategory === key
                  ? 'bg-black text-white'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              {GUIDE_CATEGORIES[key]}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="text-center py-20">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em]" />
            <p className="text-gray-500 mt-4">가이드를 불러오는 중...</p>
          </div>
        ) : error ? (
          <div className="text-center py-20">
            <p className="text-red-500 mb-4">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-black text-white rounded-lg font-medium hover:bg-gray-800 transition-colors"
            >
              다시 시도
            </button>
          </div>
        ) : filteredGuides.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-gray-500 mb-2">등록된 가이드가 없습니다.</p>
            <p className="text-sm text-gray-400">곧 유용한 가이드가 등록될 예정이에요.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm divide-y divide-gray-100">
            {filteredGuides.map((guide) => (
              <Link
                key={guide.id}
                href={`/support/guides/${guide.id}`}
                className="flex items-center justify-between px-4 py-3.5 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`shrink-0 inline-block px-2 py-0.5 rounded text-xs font-medium ${
                    guide.category === 'fabric' ? 'bg-emerald-50 text-emerald-700' :
                    guide.category === 'printing' ? 'bg-purple-50 text-purple-700' :
                    'bg-amber-50 text-amber-700'
                  }`}>
                    {GUIDE_CATEGORIES[guide.category as GuideCategory] ?? guide.category}
                  </span>
                  <h3 className="text-sm font-medium text-gray-900 truncate">{guide.title}</h3>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-3">
                  <span className="text-xs text-gray-400">{new Date(guide.created_at).toLocaleDateString('ko-KR')}</span>
                  <ChevronRight className="w-4 h-4 text-gray-300" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
