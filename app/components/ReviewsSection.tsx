'use client'

import { useState, useEffect } from 'react';
import { FaStar } from 'react-icons/fa';
import { MessageSquare } from 'lucide-react';
import Link from 'next/link';
import { formatKstDateOnly } from '@/lib/kst';

interface Review {
  id: string;
  rating: number;
  title: string;
  content: string;
  author_name: string;
  is_verified_purchase: boolean;
  helpful_count: number;
  created_at: string;
  review_image_urls?: string[];
}

interface ReviewsSectionProps {
  productId: string;
  limit?: number;
}

export default function ReviewsSection({ productId, limit = 10 }: ReviewsSectionProps) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [averageRating, setAverageRating] = useState(0);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  useEffect(() => {
    const fetchReviews = async () => {
      try {
        const response = await fetch(`/api/reviews/${productId}?limit=${limit}`);
        const data = await response.json();

        if (data.reviews) {
          setReviews(data.reviews);

          // Calculate average rating
          if (data.reviews.length > 0) {
            const avg = data.reviews.reduce((sum: number, review: Review) => sum + review.rating, 0) / data.reviews.length;
            setAverageRating(avg);
          }
        }
      } catch (error) {
        console.error('Failed to fetch reviews:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchReviews();
  }, [productId, limit]);

  const formatDate = (dateString: string) => formatKstDateOnly(dateString);

  const maskName = (name: string) => {
    if (name.length <= 2) return name;
    const firstChar = name[0];
    const lastChar = name[name.length - 1];
    const maskedMiddle = '*'.repeat(name.length - 2);
    return `${firstChar}${maskedMiddle}${lastChar}`;
  };

  if (loading) {
    return (
      <div className="mt-4 p-3 bg-gray-50 rounded-lg">
        <p className="text-center text-xs text-gray-500">리뷰를 불러오는 중...</p>
      </div>
    );
  }

  if (reviews.length === 0) {
    return (
      <div className="mt-4 p-3 bg-gray-50 rounded-lg">
        <h3 className="text-sm font-bold mb-1">고객 리뷰</h3>
        <p className="text-xs text-gray-500">아직 리뷰가 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="mt-4">
      {/* Header */}
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center gap-1.5">
          <h3 className="text-sm font-bold">고객 리뷰</h3>
          <div className="flex items-center text-orange-400">
            <FaStar size={12} />
            <span className="ml-0.5 text-xs font-semibold">{averageRating.toFixed(1)}</span>
          </div>
          <span className="text-xs text-gray-500">({reviews.length}개의 리뷰)</span>
        </div>
        <Link
          href={`/reviews/${productId}`}
          className="text-xs text-[#3B55A5] hover:underline"
        >
          전체 보기
        </Link>
      </div>

      {/* Reviews List */}
      <div className="flex overflow-auto gap-2">
        {reviews.slice(0, limit).map((review) => (
          <div key={review.id} className="w-64 shrink-0 bg-gray-50 p-2 rounded-lg">
            {/* Rating and Author */}
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5">
                <div className="flex text-orange-400">
                  {[...Array(5)].map((_, i) => (
                    <FaStar
                      key={i}
                      className={i < review.rating ? 'text-orange-400' : 'text-gray-300'}
                      size={10}
                    />
                  ))}
                </div>
                <span className="text-xs font-medium">{maskName(review.author_name)}</span>
              </div>
              <span className="text-[10px] text-gray-500">{formatDate(review.created_at)}</span>
            </div>

            {/* Review Title */}
            <h4 className="font-semibold text-xs mb-0.5">{review.title}</h4>

            {/* Review Content */}
            <p className="text-xs text-gray-700 mb-1.5 line-clamp-3">{review.content}</p>

            {/* Review Images */}
            {review.review_image_urls && review.review_image_urls.length > 0 && (
              <div className="flex gap-1.5 mb-1.5 overflow-x-auto">
                {review.review_image_urls.map((url, idx) => (
                  <img
                    key={idx}
                    src={url}
                    alt={`리뷰 이미지 ${idx + 1}`}
                    className="w-12 h-12 object-cover rounded border border-gray-200 cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => setSelectedImage(url)}
                  />
                ))}
              </div>
            )}

            {/* Helpful Count */}
            {review.helpful_count > 0 && (
              <p className="text-[10px] text-gray-500">도움이 됨 {review.helpful_count}</p>
            )}
          </div>
        ))}
      </div>

      {/* Inquiry Link */}
      <div className="mt-3 flex justify-end">
        <Link
          href={`/inquiries/new?products=${productId}`}
          className="inline-flex items-center gap-1.5 text-xs text-[#3B55A5] hover:underline"
        >
          <MessageSquare className="w-3.5 h-3.5" />
          이 상품 문의하기
        </Link>
      </div>

      {/* Image Modal */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
          onClick={() => setSelectedImage(null)}
        >
          <div className="relative max-w-[90vw] max-h-[90vh]">
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute -top-10 right-0 text-white text-2xl font-bold hover:text-gray-300"
              aria-label="닫기"
            >
              ✕
            </button>
            <img
              src={selectedImage}
              alt="리뷰 이미지"
              className="max-w-full max-h-[85vh] object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  );
}