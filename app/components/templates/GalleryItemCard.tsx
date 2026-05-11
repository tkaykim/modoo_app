'use client';

import Link from 'next/link';
import { ImageIcon, Layers } from 'lucide-react';
import type { TemplateGalleryItem } from '@/types/types';
import { TEMPLATE_CATEGORY_LABELS, isTemplateCategory } from '@/lib/templateCategories';
import { trackDesignAction } from '@/lib/gtm-events';

interface Props {
  item: TemplateGalleryItem;
}

/**
 * Unified gallery card — handles both group and single template items.
 * Group cards link to /templates/group/[id]; single cards go straight to editor.
 */
export default function GalleryItemCard({ item }: Props) {
  const categoryLabel = isTemplateCategory(item.category)
    ? TEMPLATE_CATEGORY_LABELS[item.category]
    : null;

  if (item.kind === 'group') {
    return (
      <Link
        href={`/templates/group/${item.id}`}
        onClick={() =>
          trackDesignAction({
            action_type: 'template_card_click',
          })
        }
        className="block group"
      >
        <div className="relative w-full aspect-square rounded-xl overflow-hidden bg-gray-100 border border-gray-200 group-hover:border-black transition">
          {item.preview_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.preview_url}
              alt={item.title}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Layers className="size-8 text-gray-300" />
            </div>
          )}
          <span className="absolute top-2 left-2 inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-white/90 text-gray-800">
            <Layers className="w-2.5 h-2.5" />
            {item.instance_count}개 제품
          </span>
          {categoryLabel && (
            <span className="absolute top-2 right-2 text-[10px] font-medium px-2 py-0.5 rounded-full bg-white/90 text-gray-700">
              {categoryLabel}
            </span>
          )}
        </div>
        <div className="mt-2">
          <p className="text-sm font-medium text-gray-900 truncate">{item.title}</p>
          {item.description && (
            <p className="text-xs text-gray-500 truncate">{item.description}</p>
          )}
        </div>
      </Link>
    );
  }

  // Single template card
  const productId = item.product?.id ?? item.product_id;
  const href = `/editor/${productId}?templateId=${item.id}`;
  const price = item.product?.base_price;
  return (
    <Link
      href={href}
      onClick={() =>
        trackDesignAction({
          action_type: 'template_card_click',
          product_id: productId,
        })
      }
      className="block group"
    >
      <div className="relative w-full aspect-square rounded-xl overflow-hidden bg-gray-100 border border-gray-200 group-hover:border-black transition">
        {item.preview_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.preview_url}
            alt={item.title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageIcon className="size-8 text-gray-300" />
          </div>
        )}
        {categoryLabel && (
          <span className="absolute top-2 left-2 text-[10px] font-medium px-2 py-0.5 rounded-full bg-white/90 text-gray-700">
            {categoryLabel}
          </span>
        )}
      </div>
      <div className="mt-2">
        <p className="text-sm font-medium text-gray-900 truncate">{item.title}</p>
        {item.product && (
          <p className="text-xs text-gray-500 truncate">{item.product.title}</p>
        )}
        {typeof price === 'number' && (
          <p className="text-xs text-gray-700 mt-0.5">
            <span className="text-gray-400">최저 </span>
            {price.toLocaleString('ko-KR')}원~
          </p>
        )}
      </div>
    </Link>
  );
}
