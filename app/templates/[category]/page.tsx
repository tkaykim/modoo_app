import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Header from '@/app/components/Header';
import Footer from '@/app/components/Footer';
import CategoryChips from '@/app/components/templates/CategoryChips';
import TemplateGalleryCard from '@/app/components/templates/TemplateGalleryCard';
import { getTemplatesByFilter } from '@/lib/templateService';
import {
  TEMPLATE_CATEGORIES,
  TEMPLATE_CATEGORY_LABELS,
  isTemplateCategory,
} from '@/lib/templateCategories';

type RouteParams = { params: Promise<{ category: string }> };

export const revalidate = 60;

export function generateStaticParams() {
  return TEMPLATE_CATEGORIES.map((category) => ({ category }));
}

export async function generateMetadata({ params }: RouteParams): Promise<Metadata> {
  const { category } = await params;
  if (!isTemplateCategory(category)) {
    return { title: { absolute: '디자인 템플릿 · 모두의 유니폼' } };
  }
  const label = TEMPLATE_CATEGORY_LABELS[category];
  return {
    title: { absolute: `${label} 디자인 템플릿 · 모두의 유니폼` },
    description: `${label} 카테고리 커스텀 의류 디자인 템플릿. 사진만 교체해 빠르게 주문하세요.`,
    alternates: { canonical: `/templates/${category}` },
  };
}

export default async function TemplatesCategoryPage({ params }: RouteParams) {
  const { category } = await params;
  if (!isTemplateCategory(category)) notFound();

  const items = await getTemplatesByFilter({ category });
  const label = TEMPLATE_CATEGORY_LABELS[category];

  return (
    <div className="min-h-screen bg-white text-black">
      <div className="w-full sticky top-0 bg-white/95 backdrop-blur z-40">
        <Header back={true} />
      </div>

      <main className="max-w-screen-lg mx-auto px-4 py-6">
        <div className="mb-4">
          <h1 className="text-xl font-bold">{label} 디자인 템플릿</h1>
          <p className="text-sm text-gray-500 mt-1">사진과 텍스트만 교체해서 즉시 주문하세요.</p>
        </div>

        <div className="mb-5">
          <CategoryChips active={category} />
        </div>

        {items.length === 0 ? (
          <div className="py-16 text-center text-sm text-gray-500">
            이 카테고리에 등록된 템플릿이 아직 없습니다.
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {items.map((t) => (
              <TemplateGalleryCard key={t.id} template={t} />
            ))}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
