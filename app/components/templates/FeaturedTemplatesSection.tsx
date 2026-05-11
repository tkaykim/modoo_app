import Link from 'next/link';
import { ChevronRight, ImageIcon, Layers } from 'lucide-react';
import { getFeaturedGalleryItems } from '@/lib/templateService';

export default async function FeaturedTemplatesSection() {
  const items = await getFeaturedGalleryItems(8);
  if (items.length === 0) return null;

  return (
    <section className="w-full">
      <div className="flex items-center justify-between mb-3 lg:mb-4">
        <h2 className="text-lg lg:text-xl font-bold text-gray-900">자주 쓰이는 템플릿으로 빠르게 제작</h2>
        <Link href="/templates" className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
          전체보기
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>
      <p className="text-xs text-gray-500 mb-3">사진과 텍스트만 교체해서 즉시 주문하세요.</p>
      <div className="flex gap-3 overflow-x-auto -mx-4 px-4 pb-1 lg:mx-0 lg:px-0 lg:grid lg:grid-cols-4 lg:gap-4">
        {items.map((it) => {
          if (it.kind === 'group') {
            return (
              <Link key={`g-${it.id}`} href={`/templates/group/${it.id}`} className="shrink-0 w-40 lg:w-auto block group">
                <div className="relative w-40 h-40 lg:w-full lg:aspect-square rounded-xl overflow-hidden bg-gray-100 border border-gray-200 group-hover:border-black transition">
                  {it.preview_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={it.preview_url} alt={it.title} className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Layers className="size-7 text-gray-300" />
                    </div>
                  )}
                  <span className="absolute top-2 left-2 inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-white/90 text-gray-800">
                    <Layers className="w-2.5 h-2.5" />
                    {it.instance_count}개 제품
                  </span>
                </div>
                <p className="mt-1.5 text-sm font-medium text-gray-900 truncate">{it.title}</p>
                {it.description && (
                  <p className="text-xs text-gray-500 truncate">{it.description}</p>
                )}
              </Link>
            );
          }
          const productId = it.product?.id ?? it.product_id;
          return (
            <Link key={`s-${it.id}`} href={`/editor/${productId}?templateId=${it.id}`} className="shrink-0 w-40 lg:w-auto block group">
              <div className="w-40 h-40 lg:w-full lg:aspect-square rounded-xl overflow-hidden bg-gray-100 border border-gray-200 group-hover:border-black transition">
                {it.preview_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={it.preview_url} alt={it.title} className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageIcon className="size-7 text-gray-300" />
                  </div>
                )}
              </div>
              <p className="mt-1.5 text-sm font-medium text-gray-900 truncate">{it.title}</p>
              {it.product && (
                <p className="text-xs text-gray-500 truncate">{it.product.title}</p>
              )}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
