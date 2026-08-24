import { Suspense } from 'react';
import { createAdminClient } from '@/lib/supabase-admin';
import AiDesignerWizard from './AiDesignerWizard';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'AI 디자이너 | 모두의 유니폼',
  description: '의류·색상·이미지·위치만 고르면 AI가 4면 시안 초안을 만들어 드립니다. 디자인 걱정 없이 단체복 주문하세요.',
};

export default async function AiDesignerPage() {
  const admin = createAdminClient();
  const { data: products } = await admin
    .from('products')
    .select('id, title, category, base_price, thumbnail_image_link, popularity')
    .eq('is_active', true)
    .order('popularity', { ascending: false, nullsFirst: false });

  const list = (products ?? []).map((p) => ({
    id: p.id as string,
    title: p.title as string,
    category: (p.category as string) || 'etc',
    base_price: Number(p.base_price) || 0,
    thumbnail: Array.isArray(p.thumbnail_image_link) ? (p.thumbnail_image_link[0] as string) ?? null : null,
  }));

  return (
    <Suspense fallback={<div className="min-h-screen bg-[#f6f7fb]" />}>
      <AiDesignerWizard products={list} />
    </Suspense>
  );
}
