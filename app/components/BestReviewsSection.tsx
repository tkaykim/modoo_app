'use client'

import { useState } from 'react';
import { FaStar } from 'react-icons/fa';
import { IoClose, IoChevronBack, IoChevronForward } from 'react-icons/io5';
import { MdVerified } from 'react-icons/md';
import Link from 'next/link';
import { formatKstDateOnly } from '@/lib/kst';
import Image from 'next/image';
import { ReviewWithProduct } from '@/types/types';

interface BestReviewsSectionProps {
  reviews: ReviewWithProduct[];
}

export default function BestReviewsSection({ reviews }: BestReviewsSectionProps) {
  const [selectedReview, setSelectedReview] = useState<ReviewWithProduct | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  if (reviews.length === 0) {
    return null;
  }

  return (
    <section className="w-full">
      <div className="flex items-center justify-between mb-3 lg:mb-4">
        <h2 className="text-lg lg:text-xl font-bold text-gray-900">BEST 후기</h2>
      </div>

      {/* Reviews horizontal scroll on mobile, grid on desktop */}
      <div className="flex gap-3 overflow-x-auto pb-2 lg:grid lg:grid-cols-4 xl:grid-cols-5 lg:overflow-visible">
        {reviews.map((review) => (
          <div
            key={review.id}
            className="flex-shrink-0 w-[200px] lg:w-auto bg-gray-50 rounded-lg overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => {
              setSelectedReview(review);
              setCurrentImageIndex(0);
            }}
          >
            {/* Review Image */}
            {review.review_image_urls && review.review_image_urls.length > 0 && (
              <div className="relative w-full aspect-square">
                <Image
                  src={review.review_image_urls[0]}
                  alt="리뷰 이미지"
                  fill
                  unoptimized
                  className="object-cover"
                  sizes="(max-width: 1024px) 200px, 20vw"
                />
              </div>
            )}

            {/* Review Info */}
            <div className="p-3">
              {/* Rating */}
              <div className="flex items-center gap-1 mb-2">
                {[...Array(5)].map((_, i) => (
                  <FaStar
                    key={i}
                    className={i < review.rating ? 'text-orange-400' : 'text-gray-300'}
                    size={12}
                  />
                ))}
              </div>

              {/* Review Content Preview */}
              <p className="text-sm text-gray-700 line-clamp-2 mb-2">
                {review.content}
              </p>

              {/* Product Link */}
              {review.product && (
                <Link
                  href={`/product/${review.product.id}`}
                  className="flex items-center gap-2 mt-2 group"
                  onClick={(e) => e.stopPropagation()}
                >
                  {review.product.thumbnail_image_link?.[0] && (
                    <div className="relative w-8 h-8 rounded border border-gray-200 overflow-hidden flex-shrink-0">
                      <Image
                        src={review.product.thumbnail_image_link[0]}
                        alt={review.product.title}
                        fill
                        unoptimized
                        className="object-cover"
                        sizes="32px"
                      />
                    </div>
                  )}
                  <span className="text-xs text-gray-500 group-hover:text-gray-700 truncate">
                    {review.product.title}
                  </span>
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Review Detail Modal */}
      {selectedReview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setSelectedReview(null)}
        >
          <div
            className="relative bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={() => setSelectedReview(null)}
              className="absolute top-3 right-3 z-10 p-1 rounded-full bg-white/80 hover:bg-white shadow-md"
              aria-label="닫기"
            >
              <IoClose size={24} className="text-gray-700" />
            </button>

            {/* Image Gallery */}
            {selectedReview.review_image_urls && selectedReview.review_image_urls.length > 0 && (
              <div className="relative w-full aspect-square bg-gray-100">
                <Image
                  src={selectedReview.review_image_urls[currentImageIndex]}
                  alt={`리뷰 이미지 ${currentImageIndex + 1}`}
                  fill
                  unoptimized
                  className="object-contain"
                  sizes="(max-width: 512px) 100vw, 512px"
                />

                {/* Image Navigation */}
                {selectedReview.review_image_urls.length > 1 && (
                  <>
                    <button
                      onClick={() => setCurrentImageIndex((prev) =>
                        prev === 0 ? selectedReview.review_image_urls.length - 1 : prev - 1
                      )}
                      className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/80 hover:bg-white shadow-md"
                      aria-label="이전 이미지"
                    >
                      <IoChevronBack size={20} className="text-gray-700" />
                    </button>
                    <button
                      onClick={() => setCurrentImageIndex((prev) =>
                        prev === selectedReview.review_image_urls.length - 1 ? 0 : prev + 1
                      )}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/80 hover:bg-white shadow-md"
                      aria-label="다음 이미지"
                    >
                      <IoChevronForward size={20} className="text-gray-700" />
                    </button>

                    {/* Image Indicators */}
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                      {selectedReview.review_image_urls.map((_, index) => (
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
            )}

            {/* Review Content */}
            <div className="p-5">
              {/* Header: Rating & Author */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-1">
                  {[...Array(5)].map((_, i) => (
                    <FaStar
                      key={i}
                      className={i < selectedReview.rating ? 'text-orange-400' : 'text-gray-300'}
                      size={16}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <span className="font-medium text-gray-700">{selectedReview.author_name}</span>
                  {selectedReview.is_verified_purchase && (
                    <span className="flex items-center gap-0.5 text-green-600 text-xs">
                      <MdVerified size={14} />
                      구매인증
                    </span>
                  )}
                </div>
              </div>

              {/* Title */}
              {selectedReview.title && (
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {selectedReview.title}
                </h3>
              )}

              {/* Content */}
              <p className="text-gray-700 whitespace-pre-wrap leading-relaxed mb-4">
                {selectedReview.content}
              </p>

              {/* Date */}
              <p className="text-xs text-gray-400 mb-4">
                {formatKstDateOnly(selectedReview.created_at)}
              </p>

              {/* Product Link */}
              {selectedReview.product && (
                <Link
                  href={`/product/${selectedReview.product.id}`}
                  className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  onClick={() => setSelectedReview(null)}
                >
                  {selectedReview.product.thumbnail_image_link?.[0] && (
                    <div className="relative w-12 h-12 rounded-lg border border-gray-200 overflow-hidden shrink-0">
                      <Image
                        src={selectedReview.product.thumbnail_image_link[0]}
                        alt={selectedReview.product.title}
                        fill
                        unoptimized
                        className="object-cover"
                        sizes="48px"
                      />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {selectedReview.product.title}
                    </p>
                    <p className="text-xs text-gray-500">상품 보러가기 →</p>
                  </div>
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
