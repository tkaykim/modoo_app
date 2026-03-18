'use client'
import { useState } from 'react'
import Image from 'next/image'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface ProductImageGalleryProps {
  images: string[]
}

export default function ProductImageGallery({ images }: ProductImageGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0)

  if (images.length === 0) {
    return (
      <div className="w-full aspect-4/5 bg-gray-100 flex items-center justify-center">
        <span className="text-sm text-gray-400">이미지 없음</span>
      </div>
    )
  }

  const goPrev = () => setActiveIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1))
  const goNext = () => setActiveIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0))

  return (
    <div className="w-full lg:flex lg:gap-3">
      {/* Thumbnails - desktop only */}
      {images.length > 1 && (
        <div className="hidden lg:flex lg:flex-col lg:gap-2 lg:w-20 lg:shrink-0 lg:overflow-y-auto lg:max-h-175">
          {images.map((img, idx) => (
            <button
              key={idx}
              onClick={() => setActiveIndex(idx)}
              className={`rounded-lg overflow-hidden border-2 transition-all shrink-0 ${
                idx === activeIndex
                  ? 'border-black'
                  : 'border-gray-200 hover:border-gray-400'
              }`}
            >
              <Image
                src={img}
                alt={`썸네일 ${idx + 1}`}
                width={80}
                height={80}
                className="w-full aspect-square object-cover"
              />
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 min-w-0">
        {/* Main Image */}
        <div className="relative w-full aspect-1/1 bg-gray-50 overflow-hidden lg:rounded-lg">
          <Image
            src={images[activeIndex]}
            alt={`제품 이미지 ${activeIndex + 1}`}
            fill
            className="object-contain"
            sizes="(max-width: 768px) 100vw, 50vw"
            priority
          />

          {/* Desktop navigation arrows */}
          {images.length > 1 && (
            <>
              <button
                onClick={goPrev}
                className="hidden lg:flex absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 items-center justify-center rounded-full bg-white/80 hover:bg-white shadow transition"
              >
                <ChevronLeft className="size-5 text-gray-700" />
              </button>
              <button
                onClick={goNext}
                className="hidden lg:flex absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 items-center justify-center rounded-full bg-white/80 hover:bg-white shadow transition"
              >
                <ChevronRight className="size-5 text-gray-700" />
              </button>
            </>
          )}

          {/* Image counter */}
          {images.length > 1 && (
            <div className="absolute bottom-3 right-3 text-xs text-white bg-black/50 px-2 py-1 rounded">
              {activeIndex + 1} / {images.length}
            </div>
          )}
        </div>

        {/* Mobile dots */}
        {images.length > 1 && (
          <div className="flex justify-center gap-1.5 py-3 lg:hidden">
            {images.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setActiveIndex(idx)}
                className={`w-2 h-2 rounded-full transition-colors ${
                  idx === activeIndex ? 'bg-gray-800' : 'bg-gray-300'
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}