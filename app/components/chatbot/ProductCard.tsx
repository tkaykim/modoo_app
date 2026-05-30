'use client';

import { ProductPreview } from '@/lib/chatbot/types';
import Image from 'next/image';

interface ProductCardProps {
  product: ProductPreview;
  onClick: () => void;
  selected?: boolean;
}

export default function ProductCard({ product, onClick, selected }: ProductCardProps) {
  const keywords = (product.keywords ?? []).filter((k) => k && k.trim()).slice(0, 4);
  return (
    <button
      onClick={onClick}
      aria-pressed={selected}
      className={`flex items-center gap-3 p-2 rounded-lg transition-colors text-left w-full ${
        selected
          ? 'bg-[#3B55A5]/5 border-2 border-[#3B55A5] ring-2 ring-[#3B55A5]/20'
          : 'bg-white border border-gray-200 hover:border-gray-300'
      }`}
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
        {keywords.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {keywords.map((k) => (
              <span key={k} className="text-[10px] text-gray-500 bg-gray-100 rounded px-1.5 py-0.5">
                #{k.replace(/^#/, '')}
              </span>
            ))}
          </div>
        )}
      </div>
      {selected && <span className="text-[#3B55A5] text-xs font-semibold shrink-0">선택됨</span>}
    </button>
  );
}
