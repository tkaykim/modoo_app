'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Header from '@/app/components/Header';
import { createClient } from '@/lib/supabase-client';
import { useAuthStore } from '@/store/useAuthStore';
import { FaStar } from 'react-icons/fa';

type MyReview = {
  id: string;
  product_id: string;
  rating: number;
  title: string;
  content: string;
  is_verified_purchase: boolean | null;
  created_at: string | null;
  product?: {
    title: string;
    thumbnail_image_link: string[] | null;
  } | null;
};

export default function MyReviewsPage() {
  const router = useRouter();
  const { isAuthenticated, user } = useAuthStore();
  const [reviews, setReviews] = useState<MyReview[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    const fetchReviews = async () => {
      setIsLoading(true);
      setError(null);

      const supabase = createClient();
      const { data: { user: supabaseUser } } = await supabase.auth.getUser();
      const userId = supabaseUser?.id || user?.id;

      if (!userId) {
        setIsLoading(false);
        return;
      }

      const { data, error: fetchError } = await supabase
        .from('reviews')
        .select('id, product_id, rating, title, content, is_verified_purchase, created_at, product:products(title, thumbnail_image_link)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (fetchError) {
        console.error('Failed to fetch my reviews:', fetchError);
        setError('리뷰를 불러오는데 실패했습니다.');
        setIsLoading(false);
        return;
      }

      const normalized: MyReview[] = (data || []).map((row: any) => {
        const product = Array.isArray(row.product) ? row.product[0] : row.product;
        return {
          id: row.id,
          product_id: row.product_id,
          rating: row.rating,
          title: row.title,
          content: row.content,
          is_verified_purchase: row.is_verified_purchase,
          created_at: row.created_at,
          product: product
            ? {
              title: product.title,
              thumbnail_image_link: product.thumbnail_image_link,
            }
            : null,
        };
      });

      setReviews(normalized);
      setIsLoading(false);
    };

    fetchReviews();
  }, [user?.id]);

  const reviewCount = useMemo(() => reviews.length, [reviews.length]);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  const handleDelete = async (reviewId: string) => {
    const confirmed = window.confirm('리뷰를 삭제할까요?');
    if (!confirmed) return;

    setDeletingId(reviewId);
    setError(null);

    try {
      const res = await fetch(`/api/reviews/my/${reviewId}`, { method: 'DELETE' });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error || '리뷰 삭제에 실패했습니다.');
        return;
      }

      setReviews((prev) => prev.filter((r) => r.id !== reviewId));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <Header back />

      <div className="max-w-4xl mx-auto p-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-gray-900">내 리뷰</h1>
          <Link
            href="/home/my-page/orders"
            className="px-3 py-2 rounded-md bg-black text-white text-sm font-medium hover:bg-gray-800 transition-colors"
          >
            주문에서 리뷰 작성
          </Link>
        </div>

        {!isAuthenticated ? (
          <div className="text-center py-20">
            <p className="text-gray-500 mb-4">로그인이 필요합니다</p>
            <p className="text-sm text-gray-400 mb-6">
              내가 작성한 리뷰를 보려면 로그인해주세요
            </p>
            <button
              onClick={() => router.push('/login')}
              className="px-6 py-3 bg-black text-white rounded-lg font-medium hover:bg-gray-800 transition-colors"
            >
              로그인하기
            </button>
          </div>
        ) : isLoading ? (
          <div className="text-center py-20">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]" />
            <p className="text-gray-500 mt-4">리뷰를 불러오는 중...</p>
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
        ) : reviewCount === 0 ? (
          <div className="text-center py-20">
            <p className="text-gray-600 mb-2">작성한 리뷰가 없습니다</p>
            <p className="text-sm text-gray-400 mb-6">주문한 상품에 리뷰를 남겨보세요</p>
            <button
              onClick={() => router.push('/home/my-page/orders')}
              className="px-6 py-3 bg-[#3B55A5] text-white rounded-lg font-medium hover:bg-[#2D4280] transition-colors"
            >
              주문 내역 보기
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {reviews.map((review) => (
              <div key={review.id} className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-md border border-gray-200 bg-gray-100 overflow-hidden">
                      {review.product?.thumbnail_image_link?.[0] ? (
                        <img
                          src={review.product.thumbnail_image_link[0]}
                          alt={review.product?.title || '상품'}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">
                          없음
                        </div>
                      )}
                    </div>
                    <div>
                      <Link
                        href={`/reviews/${review.product_id}`}
                        className="text-sm font-medium text-gray-900 hover:underline"
                      >
                        {review.product?.title || '상품'}
                      </Link>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex text-orange-400">
                          {[...Array(5)].map((_, i) => (
                            <FaStar
                              key={i}
                              className={i < review.rating ? 'text-orange-400' : 'text-gray-300'}
                              size={14}
                            />
                          ))}
                        </div>
                        {review.is_verified_purchase ? (
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                            구매확인
                          </span>
                        ) : null}
                        <span className="text-xs text-gray-500">{formatDate(review.created_at)}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleDelete(review.id)}
                    disabled={deletingId === review.id}
                    className="text-sm text-red-600 hover:text-red-700 disabled:opacity-50"
                  >
                    {deletingId === review.id ? '삭제 중...' : '삭제'}
                  </button>
                </div>

                <div className="mt-3">
                  <h3 className="font-semibold text-gray-900 mb-1">{review.title}</h3>
                  <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{review.content}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
