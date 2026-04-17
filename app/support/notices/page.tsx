'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase-client';
import { formatKstDateOnly } from '@/lib/kst';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface AnnouncementListItem {
  id: string;
  title: string;
  created_at: string;
}

export default function NoticesPage() {
  const router = useRouter();
  const [announcements, setAnnouncements] = useState<AnnouncementListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAnnouncements = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const supabase = createClient();
        const { data, error: fetchError } = await supabase
          .from('announcements')
          .select('id, title, created_at')
          .eq('is_published', true)
          .or('category.eq.notice,category.is.null')
          .order('created_at', { ascending: false });

        if (fetchError) {
          throw fetchError;
        }

        setAnnouncements((data || []) as AnnouncementListItem[]);
      } catch (err) {
        console.error('Failed to fetch announcements:', err);
        setError('공지사항을 불러오는데 실패했습니다.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchAnnouncements();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="sticky top-0 bg-white z-40 border-b border-gray-200">
        <div className="flex items-center gap-3 px-4 py-4">
          <button onClick={() => router.back()} className="p-1">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-bold">공지사항</h1>
        </div>
      </div>

      <div className="max-w-3xl mx-auto">
        {isLoading ? (
          <div className="text-center py-20">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em]" />
            <p className="text-gray-500 mt-4">공지사항을 불러오는 중...</p>
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
        ) : announcements.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-gray-500 mb-2">공지사항이 없습니다.</p>
            <p className="text-sm text-gray-400">새로운 공지가 등록되면 안내해드릴게요.</p>
          </div>
        ) : (
          <div className="">
            {announcements.map((notice) => (
              <Link
                key={notice.id}
                href={`/support/notices/${notice.id}`}
                className="block bg-white border-b border-gray-200 px-5 py-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-base font-semibold text-gray-900 max-w-70 md:max-w-full truncate line-clamp-2">{notice.title}</h2>
                  <p>{formatKstDateOnly(notice.created_at)}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
