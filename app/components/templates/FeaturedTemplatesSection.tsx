import Link from 'next/link';
import { ChevronRight, ImageIcon } from 'lucide-react';
import { getFeaturedTemplates } from '@/lib/templateService';

export default async function FeaturedTemplatesSection() {
  const items = await getFeaturedTemplates(8);
  if (items.length === 0) return null;

  return (
    <section className="w-full">
      <div className="flex items-center justify-between mb-3 lg:mb-4">
        <h2 className="text-lg lg:text-xl font-bold text-gray-900">템플릿으로 빠르게 시작</h2>
        <Link href="/templates" className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
          전체보기
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>
      <p className="text-xs text-gray-500 mb-3">사진과 텍스트만 교체해서 즉시 주문하세요.</p>
      <div className="flex gap-3 overflow-x-auto -mx-4 px-4 pb-1 lg:mx-0 lg:px-0 lg:grid lg:grid-cols-4 lg:gap-4">
        {items.map((t) => {
          const productId = t.product?.id;
          const href = productId ? `/editor/${productId}?templateId=${t.id}` : '#';
          return (
            <Link key={t.id} href={href} className="shrink-0 w-40 lg:w-auto block group">
              <div className="w-40 h-40 lg:w-full lg:aspect-square rounded-xl overflow-hidden bg-gray-100 border border-gray-200 group-hover:border-black transition">
                {t.preview_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={t.preview_url} alt={t.title} className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageIcon className="size-7 text-gray-300" />
                  </div>
                )}
              </div>
              <p className="mt-1.5 text-sm font-medium text-gray-900 truncate">{t.title}</p>
              {t.product && (
                <p className="text-xs text-gray-500 truncate">{t.product.title}</p>
              )}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
