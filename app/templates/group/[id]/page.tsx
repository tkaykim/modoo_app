import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ImageIcon } from 'lucide-react';
import Header from '@/app/components/Header';
import Footer from '@/app/components/Footer';
import { getGroupWithInstances } from '@/lib/templateService';
import { TEMPLATE_CATEGORY_LABELS, isTemplateCategory } from '@/lib/templateCategories';

type RouteParams = { params: Promise<{ id: string }> };

export const revalidate = 60;

export async function generateMetadata({ params }: RouteParams): Promise<Metadata> {
  const { id } = await params;
  const group = await getGroupWithInstances(id);
  if (!group) return { title: { absolute: '디자인 템플릿 · 모두의 유니폼' } };
  return {
    title: { absolute: `${group.title} · 디자인 템플릿` },
    description: group.description ?? `${group.title} 디자인을 다양한 제품에 적용해보세요.`,
    alternates: { canonical: `/templates/group/${id}` },
  };
}

export default async function GroupDetailPage({ params }: RouteParams) {
  const { id } = await params;
  const group = await getGroupWithInstances(id);
  if (!group || !group.is_active) notFound();

  const categoryLabel = isTemplateCategory(group.category)
    ? TEMPLATE_CATEGORY_LABELS[group.category]
    : null;

  return (
    <div className="min-h-screen bg-white text-black">
      <div className="w-full sticky top-0 bg-white/95 backdrop-blur z-40">
        <Header back={true} />
      </div>

      <main className="max-w-screen-lg mx-auto px-4 py-6">
        <Link href="/templates" className="text-xs text-gray-500 hover:text-gray-700 inline-flex items-center gap-1 mb-3">
          ← 템플릿 둘러보기
        </Link>

        {/* Group hero */}
        <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-5 mb-6">
          <div className="w-full md:w-72 aspect-square rounded-xl overflow-hidden bg-gray-100">
            {group.preview_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={group.preview_url} alt={group.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <ImageIcon className="size-10 text-gray-300" />
              </div>
            )}
          </div>
          <div>
            {categoryLabel && (
              <span className="inline-block text-[11px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 mb-2">
                {categoryLabel}
              </span>
            )}
            <h1 className="text-xl lg:text-2xl font-bold text-gray-900">{group.title}</h1>
            {group.description && (
              <p className="text-sm text-gray-600 mt-2 leading-relaxed">{group.description}</p>
            )}
            {group.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-3">
                {group.tags.map((t) => (
                  <span key={t} className="text-[11px] text-gray-500">#{t}</span>
                ))}
              </div>
            )}
            <p className="text-xs text-gray-500 mt-4">
              아래 제품 중 하나를 골라서 디자인을 시작하세요. 사진/텍스트만 교체하면 바로 주문할 수 있습니다.
            </p>
          </div>
        </div>

        {/* Product instances */}
        <h2 className="text-sm font-semibold text-gray-900 mb-3">
          이 디자인을 적용할 제품 ({group.templates.length}개)
        </h2>
        {group.templates.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-500">
            이 그룹에 적용된 제품이 아직 없습니다.
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {group.templates.map((t) => (
              <Link
                key={t.id}
                href={`/editor/${t.product_id}?templateId=${t.id}`}
                className="block group"
              >
                <div className="w-full aspect-square rounded-xl overflow-hidden bg-gray-100 border border-gray-200 group-hover:border-black transition">
                  {t.preview_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={t.preview_url} alt={t.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ImageIcon className="size-7 text-gray-300" />
                    </div>
                  )}
                </div>
                <p className="text-sm font-medium text-gray-900 truncate mt-2">
                  {t.product?.title ?? t.title}
                </p>
                {typeof t.product?.base_price === 'number' && (
                  <p className="text-xs text-gray-700">
                    <span className="text-gray-400">최저 </span>
                    {t.product.base_price.toLocaleString('ko-KR')}원~
                  </p>
                )}
              </Link>
            ))}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
