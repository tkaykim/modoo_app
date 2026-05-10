'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LayoutTemplate, ImageIcon } from 'lucide-react';
import { getProductTemplates } from '@/lib/templateService';
import type { TemplatePickerItem } from '@/types/types';
import { trackDesignAction } from '@/lib/gtm-events';

interface Props {
  productId: string;
}

export default function ProductTemplatesStrip({ productId }: Props) {
  const router = useRouter();
  const [items, setItems] = useState<TemplatePickerItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const data = await getProductTemplates(productId);
      if (!cancelled) {
        setItems(data);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [productId]);

  if (loading) return null;
  if (items.length === 0) return null;

  return (
    <section className="py-3">
      <div className="flex items-center gap-1.5 mb-2">
        <LayoutTemplate className="size-4 text-gray-700" />
        <h3 className="text-sm font-semibold text-gray-900">디자인 템플릿으로 바로 시작</h3>
      </div>
      <p className="text-xs text-gray-500 mb-3">사진만 교체해서 빠르게 주문하세요.</p>
      <div className="flex gap-2.5 overflow-x-auto -mx-4 px-4 pb-1 lg:mx-0 lg:px-0">
        {items.map((t) => (
          <button
            key={t.id}
            onClick={() => {
              trackDesignAction({
                action_type: 'template_card_click',
                product_id: productId,
              });
              router.push(`/editor/${productId}?templateId=${t.id}`);
            }}
            className="shrink-0 w-32 text-left"
          >
            <div className="w-32 h-32 rounded-lg overflow-hidden bg-gray-100 border border-gray-200 hover:border-black transition">
              {t.preview_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={t.preview_url} alt={t.title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <ImageIcon className="size-7 text-gray-300" />
                </div>
              )}
            </div>
            <p className="mt-1.5 text-xs font-medium text-gray-800 truncate">{t.title}</p>
          </button>
        ))}
      </div>
    </section>
  );
}
