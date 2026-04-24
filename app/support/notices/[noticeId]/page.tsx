'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase-client';
import { formatKstDateOnly } from '@/lib/kst';
import { trackContentView } from '@/lib/gtm-events';

interface AnnouncementDetail {
  id: string;
  title: string;
  content: string;
  created_at: string;
}

export default function NoticeDetailPage() {
  const router = useRouter();
  const params = useParams<{ noticeId: string }>();
  const noticeId = useMemo(() => params?.noticeId, [params]);

  const [notice, setNotice] = useState<AnnouncementDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchNotice = async () => {
      if (!noticeId) return;

      setIsLoading(true);
      setError(null);

      try {
        const supabase = createClient();
        const { data, error: fetchError } = await supabase
          .from('announcements')
          .select('id, title, content, created_at')
          .eq('id', noticeId)
          .eq('is_published', true)
          .maybeSingle();

        if (fetchError) {
          throw fetchError;
        }

        if (!data) {
          setError('공지사항을 찾을 수 없습니다.');
          setNotice(null);
          return;
        }

        setNotice(data as AnnouncementDetail);

        trackContentView({
          content_id: data.id,
          content_type: 'notice',
        });
      } catch (err) {
        console.error('Failed to fetch notice:', err);
        setError('공지사항을 불러오는데 실패했습니다.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchNotice();
  }, [noticeId]);

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

      <div className="max-w-3xl mx-auto p-4">
        {isLoading ? (
          <div className="text-center py-20">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em]" />
            <p className="text-gray-500 mt-4">공지사항을 불러오는 중...</p>
          </div>
        ) : error ? (
          <div className="text-center py-20">
            <p className="text-red-500 mb-4">{error}</p>
            <button
              onClick={() => router.push('/support/notices')}
              className="px-6 py-3 bg-black text-white rounded-lg font-medium hover:bg-gray-800 transition-colors"
            >
              목록으로
            </button>
          </div>
        ) : !notice ? null : (
          <article className="bg-white shadow-sm p-5">
            <h2 className="text-xl font-bold text-gray-900 mb-2">{notice.title}</h2>
            <div className="text-xs text-gray-400 mb-6">
              {formatKstDateOnly(notice.created_at)}
            </div>
            <div
              className="rich-content text-sm text-gray-700"
              dangerouslySetInnerHTML={{ __html: notice.content }}
            />
          </article>
        )}
      </div>
    </div>
  );
}

