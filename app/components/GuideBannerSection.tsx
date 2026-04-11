'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { createClient } from '@/lib/supabase-client';
import { ChevronRight, BookOpen } from 'lucide-react';

const CATEGORY_LABELS: Record<string, string> = {
  fabric: '원단 안내',
  printing: '인쇄방법',
  order_guide: '주문 가이드',
};

const CATEGORY_ICONS: Record<string, string> = {
  fabric: '🧵',
  printing: '🖨️',
  order_guide: '📋',
};

interface GuideItem {
  id: string;
  title: string;
  category: string;
  image_links: string[] | null;
}

export default function GuideBannerSection() {
  const [guides, setGuides] = useState<GuideItem[]>([]);

  useEffect(() => {
    const fetchGuides = async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from('announcements')
        .select('id, title, category, image_links')
        .eq('is_published', true)
        .in('category', ['fabric', 'printing', 'order_guide'])
        .order('created_at', { ascending: false })
        .limit(3);

      setGuides((data || []) as GuideItem[]);
    };

    fetchGuides();
  }, []);

  if (guides.length === 0) return null;

  return (
    <section className="w-full">
      <div className="flex items-center justify-between mb-3 lg:mb-4">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-gray-700" />
          <h2 className="text-lg lg:text-xl font-bold text-gray-900">제작 가이드</h2>
        </div>
        <Link
          href="/support/guides"
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          전체보기
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4">
        {guides.map((guide) => (
          <Link
            key={guide.id}
            href={`/support/guides/${guide.id}`}
            className="group bg-white rounded-xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-md transition-all"
          >
            {guide.image_links && guide.image_links.length > 0 ? (
              <div className="relative w-full aspect-[16/9]">
                <Image
                  src={guide.image_links[0]}
                  alt={guide.title}
                  fill
                  unoptimized
                  className="object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>
            ) : (
              <div className="w-full aspect-[16/9] bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
                <span className="text-4xl">{CATEGORY_ICONS[guide.category] ?? '📄'}</span>
              </div>
            )}
            <div className="p-3 lg:p-4">
              <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium mb-1.5 ${
                guide.category === 'fabric' ? 'bg-emerald-50 text-emerald-700' :
                guide.category === 'printing' ? 'bg-purple-50 text-purple-700' :
                'bg-amber-50 text-amber-700'
              }`}>
                {CATEGORY_LABELS[guide.category] ?? guide.category}
              </span>
              <h3 className="text-sm lg:text-base font-semibold text-gray-900 line-clamp-2 group-hover:text-gray-600 transition-colors">
                {guide.title}
              </h3>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
