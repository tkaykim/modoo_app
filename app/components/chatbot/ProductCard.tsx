'use client';

import { ProductPreview } from '@/lib/chatbot/types';
import Image from 'next/image';

interface ProductCardProps {
  product: ProductPreview;
  onClick: () => void;
}

export default function ProductCard({ product, onClick }: ProductCardProps) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 p-2 bg-white border border-gray-200 rounded-lg hover:border-gray-300 transition-colors text-left w-full"
    >
      <div className="w-14 h-14 relative flex-shrink-0 bg-gray-100 rounded-md overflow-hidden">
        {product.thumbnail_image_link?.[0] ? (
          <Image
            src={product.thumbnail_image_link[0]}
            alt={product.title}
            fill
            className="object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
            No Image
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">
          {product.title}
        </p>
        <p className="text-sm text-blue-600 font-semibold">
          {product.base_price.toLocaleString()}원
        </p>
      </div>
    </button>
  );
}
