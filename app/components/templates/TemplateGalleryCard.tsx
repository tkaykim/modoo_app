'use client';

import Link from 'next/link';
import { ImageIcon } from 'lucide-react';
import type { TemplatePickerItem } from '@/types/types';
import { TEMPLATE_CATEGORY_LABELS, isTemplateCategory } from '@/lib/templateCategories';
import { trackDesignAction } from '@/lib/gtm-events';

interface Props {
  template: TemplatePickerItem;
}

export default function TemplateGalleryCard({ template }: Props) {
  const productId = template.product?.id;
  const href = productId ? `/editor/${productId}?templateId=${template.id}` : '#';
  const price = template.product?.base_price;
  const categoryLabel = isTemplateCategory(template.category)
    ? TEMPLATE_CATEGORY_LABELS[template.category]
    : null;

  return (
    <Link
      href={href}
      onClick={() => trackDesignAction({
        action_type: 'template_card_click',
        product_id: productId,
      })}
      className="block group"
    >
      <div className="relative w-full aspect-square rounded-xl overflow-hidden bg-gray-100 border border-gray-200 group-hover:border-black transition">
        {template.preview_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={template.preview_url}
            alt={template.title}
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
        <p className="text-sm font-medium text-gray-900 truncate">{template.title}</p>
        {template.product && (
          <p className="text-xs text-gray-500 truncate">{template.product.title}</p>
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
