'use client'

import { useState, useEffect } from 'react';
import { FaStar } from 'react-icons/fa';
import { IoClose, IoChevronBack, IoChevronForward } from 'react-icons/io5';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import Header from '@/app/components/Header';
import { formatKstDateOnly } from '@/lib/kst';

interface Review {
  id: string;
  rating: number;
  title: string;
  content: string;
  author_name: string;
  is_verified_purchase: boolean;
  helpful_count: number;
  review_image_urls: string[];
  created_at: string;
}

export default function ReviewsPage() {
  const params = useParams();
  const productId = params?.productId as string;
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [averageRating, setAverageRating] = useState(0);
  const [modalImages, setModalImages] = useState<string[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [ratingDistribution, setRatingDistribution] = useState<Record<number, number>>({
    5: 0,
    4: 0,
    3: 0,
    2: 0,
    1: 0,
  });

  useEffect(() => {
    const fetchReviews = async () => {
      try {
        const response = await fetch(`/api/reviews/${productId}`);
        const data = await response.json();

        if (data.reviews) {
          setReviews(data.reviews);

          // Calculate average rating
          if (data.reviews.length > 0) {
            const avg = data.reviews.reduce((sum: number, review: Review) => sum + review.rating, 0) / data.reviews.length;
            setAverageRating(avg);

            // Calculate rating distribution
            const distribution: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
            data.reviews.forEach((review: Review) => {
              distribution[review.rating]++;
            });
            setRatingDistribution(distribution);
          }
        }
      } catch (error) {
        console.error('Failed to fetch reviews:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchReviews();
  }, [productId]);

  const formatDate = (dateString: string) => formatKstDateOnly(dateString);

  const getPercentage = (count: number) => {
    if (reviews.length === 0) return 0;
    return Math.round((count / reviews.length) * 100);
  };

  const maskAuthorName = (name: string) => {
    if (!name || name.length <= 1) return name;
    if (name.length === 2) return name[0] + '*';
    return name[0] + '*'.repeat(name.length - 2) + name[name.length - 1];
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="sticky top-0 bg-white z-50 border-b border-gray-200">
        <Header back={true} />
      </div>

      <div className="max-w-4xl mx-auto px-3 py-2">
        {/* Title */}
        <h1 className="text-base font-bold mb-3">고객 리뷰</h1>

        {loading ? (
          <div className="text-center py-12">
            <p className="text-gray-500">리뷰를 불러오는 중...</p>
          </div>
        ) : reviews.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">아직 리뷰가 없습니다.</p>
          </div>
        ) : (
          <>
            {/* Rating Summary */}
            <div className="bg-gray-50 rounded-lg p-3 mb-3">
              <div className="flex items-start gap-4">
                {/* Average Rating */}
                <div className="text-center">
                  <div className="text-3xl font-bold mb-1">{averageRating.toFixed(1)}</div>
                  <div className="flex text-orange-400 mb-1 justify-center">
                    {[...Array(5)].map((_, i) => (
                      <FaStar
                        key={i}
                        size={12}
                        className={i < Math.round(averageRating) ? 'text-orange-400' : 'text-gray-300'}
                      />
                    ))}
                  </div>
                  <div className="text-xs text-gray-600">{reviews.length}개의 리뷰</div>
                </div>

                {/* Rating Distribution */}
                <div className="flex-1">
                  {[5, 4, 3, 2, 1].map((rating) => (
                    <div key={rating} className="flex items-center gap-1.5 mb-1">
                      <div className="flex items-center gap-0.5 w-9">
                        <FaStar className="text-orange-400" size={10} />
                        <span className="text-xs">{rating}</span>
                      </div>
                      <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                        <div
                          className="bg-orange-400 h-1.5 rounded-full"
                          style={{ width: `${getPercentage(ratingDistribution[rating])}%` }}
                        ></div>
                      </div>
                      <span className="text-xs text-gray-600 w-9 text-right">
                        {getPercentage(ratingDistribution[rating])}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Reviews List */}
            <div className="space-y-3">
              {reviews.map((review) => (
                <div key={review.id} className="border-b border-gray-200 pb-3 last:border-b-0">
                  {/* Rating and Author */}
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <div className="flex text-orange-400">
                        {[...Array(5)].map((_, i) => (
                          <FaStar
                            key={i}
                            className={i < review.rating ? 'text-orange-400' : 'text-gray-300'}
                            size={12}
                          />
                        ))}
                      </div>
                      <span className="text-xs font-medium">{maskAuthorName(review.author_name)}</span>
                      {review.is_verified_purchase && (
                        <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded">
                          구매확인
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-gray-500">{formatDate(review.created_at)}</span>
                  </div>

                  {/* Review Title */}
                  <h3 className="font-semibold text-sm mb-1">{review.title}</h3>

                  {/* Review Content */}
                  <p className="text-xs text-gray-700 mb-2 leading-relaxed">{review.content}</p>

                  {/* Review Images */}
                  {review.review_image_urls && review.review_image_urls.length > 0 && (
                    <div className="flex gap-1.5 mb-2">
                      {review.review_image_urls.map((url, index) => (
                        <button
                          key={index}
                          onClick={() => {
                            setModalImages(review.review_image_urls);
                            setCurrentImageIndex(index);
                          }}
                          className="relative w-16 h-16 rounded-md overflow-hidden border border-gray-200 flex-shrink-0"
                        >
                          <Image
                            src={url}
                            alt={`리뷰 이미지 ${index + 1}`}
                            fill
                            unoptimized
                            className="object-cover"
                            sizes="64px"
                          />
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Helpful Count */}
                  {review.helpful_count > 0 && (
                    <div className="flex items-center">
                      <button className="text-xs text-gray-500 hover:text-gray-700 border border-gray-300 rounded px-2 py-0.5">
                        도움이 됨 ({review.helpful_count})
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Image Modal */}
      {modalImages.length > 0 && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setModalImages([])}
        >
          <div
            className="relative max-w-lg w-full max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={() => setModalImages([])}
              className="absolute -top-10 right-0 p-1 rounded-full bg-white/80 hover:bg-white shadow-md z-10"
              aria-label="닫기"
            >
              <IoClose size={24} className="text-gray-700" />
            </button>

            {/* Image */}
            <div className="relative w-full aspect-square bg-gray-100 rounded-xl overflow-hidden">
              <Image
                src={modalImages[currentImageIndex]}
                alt={`리뷰 이미지 ${currentImageIndex + 1}`}
                fill
                unoptimized
                className="object-contain"
                sizes="(max-width: 512px) 100vw, 512px"
              />

              {/* Navigation Arrows */}
              {modalImages.length > 1 && (
                <>
                  <button
                    onClick={() => setCurrentImageIndex((prev) =>
                      prev === 0 ? modalImages.length - 1 : prev - 1
                    )}
                    className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/80 hover:bg-white shadow-md"
                    aria-label="이전 이미지"
                  >
                    <IoChevronBack size={20} className="text-gray-700" />
                  </button>
                  <button
                    onClick={() => setCurrentImageIndex((prev) =>
                      prev === modalImages.length - 1 ? 0 : prev + 1
                    )}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/80 hover:bg-white shadow-md"
                    aria-label="다음 이미지"
                  >
                    <IoChevronForward size={20} className="text-gray-700" />
                  </button>

                  {/* Indicator Dots */}
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                    {modalImages.map((_, index) => (
                      <button
                        key={index}
                        onClick={() => setCurrentImageIndex(index)}
                        className={`w-2 h-2 rounded-full transition-colors ${
                          index === currentImageIndex ? 'bg-white' : 'bg-white/50'
                        }`}
                        aria-label={`이미지 ${index + 1}`}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
