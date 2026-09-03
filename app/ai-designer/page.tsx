import { Suspense } from 'react';
import { getAiDesignerCatalog } from '@/lib/aiDesigner/catalog';
import AiDesignerWizard from './AiDesignerWizard';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'AI 디자이너 | 모두의 유니폼',
  description: '의류·색상·이미지·위치만 고르면 AI가 4면 시안 초안을 만들어 드립니다. 디자인 걱정 없이 단체복 주문하세요.',
};

export default async function AiDesignerPage() {
  // 상품 목록은 /v2/mall 카탈로그와 같은 소스(정렬·리뷰·색상 수·키워드)를 쓴다.
  const { products, categories } = await getAiDesignerCatalog();

  return (
    <Suspense fallback={<div className="min-h-screen bg-[#f6f7fb]" />}>
      <AiDesignerWizard products={products} categories={categories} />
    </Suspense>
  );
}
