import type { Metadata } from 'next';
import Header from '@/app/components/Header';
import Footer from '@/app/components/Footer';
import CategoryChips from '@/app/components/templates/CategoryChips';
import TemplateGalleryCard from '@/app/components/templates/TemplateGalleryCard';
import { getTemplatesByFilter } from '@/lib/templateService';

export const metadata: Metadata = {
  title: { absolute: '디자인 템플릿 둘러보기 · 모두의 유니폼' },
  description: '가족·반려동물·단체·로고 등 다양한 커스텀 의류 디자인 템플릿. 사진만 교체해 빠르게 주문하세요.',
  alternates: { canonical: '/templates' },
};

export const revalidate = 60;

export default async function TemplatesIndexPage() {
  const items = await getTemplatesByFilter({});

  return (
    <div className="min-h-screen bg-white text-black">
      <div className="w-full sticky top-0 bg-white/95 backdrop-blur z-40">
        <Header back={true} />
      </div>

      <main className="max-w-screen-lg mx-auto px-4 py-6">
        <div className="mb-4">
          <h1 className="text-xl font-bold">디자인 템플릿</h1>
          <p className="text-sm text-gray-500 mt-1">사진과 텍스트만 교체해서 즉시 주문하세요.</p>
        </div>

        <div className="mb-5">
          <CategoryChips active={null} />
        </div>

        {items.length === 0 ? (
          <div className="py-16 text-center text-sm text-gray-500">
            아직 등록된 템플릿이 없습니다.
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
