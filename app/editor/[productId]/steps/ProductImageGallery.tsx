'use client'
import { useState } from 'react'
import Image from 'next/image'

interface ProductImageGalleryProps {
  images: string[]
}

export default function ProductImageGallery({ images }: ProductImageGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0)

  if (images.length === 0) {
    return (
      <div className="w-full aspect-[4/5] bg-gray-100 flex items-center justify-center">
        <span className="text-sm text-gray-400">이미지 없음</span>
      </div>
    )
  }

  return (
    <div className="w-full">
      {/* Main Image */}
      <div className="relative w-full aspect-[4/5] bg-gray-50 overflow-hidden">
        <Image
          src={images[activeIndex]}
          alt={`제품 이미지 ${activeIndex + 1}`}
          fill
          className="object-contain"
          sizes="(max-width: 768px) 100vw, 50vw"
          priority
        />
      </div>

      {/* Thumbnail Dots / Strip */}
      {images.length > 1 && (
        <div className="flex justify-center gap-1.5 py-3">
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
  )
}
