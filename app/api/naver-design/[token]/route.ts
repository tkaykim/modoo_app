import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { findNaverDesignSession } from '@/lib/naver-design';

export const runtime = 'nodejs';

type Params = { params: Promise<{ token: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { token } = await params;
  try {
    const session = await findNaverDesignSession(token);
    if (!session) return NextResponse.json({ error: '유효하지 않거나 만료된 디자인 접수 링크입니다.' }, { status: 404 });

    const admin = createAdminClient();
    const { data: jobs, error: jobsError } = await admin
      .from('naver_design_jobs')
      .select('id,local_product_id,color_code,product_name,option_summary,quantity,status,canvas_state,product_color,customer_note,submitted_at,updated_at')
      .eq('session_id', session.id)
      .order('created_at');
    if (jobsError) throw jobsError;

    const productIds = [...new Set((jobs ?? []).map((job) => job.local_product_id).filter(Boolean))] as string[];
    const [{ data: products, error: productsError }, { data: colors, error: colorsError }] = await Promise.all([
      productIds.length
        ? admin.from('products').select('id,title,configuration').in('id', productIds)
        : Promise.resolve({ data: [], error: null }),
      productIds.length
        ? admin.from('product_colors').select('product_id,side_mockups,manufacturer_colors(name,hex,color_code)').in('product_id', productIds).eq('is_active', true)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (productsError) throw productsError;
    if (colorsError) throw colorsError;

    const productMap = new Map((products ?? []).map((product) => [product.id, product]));
    const colorsByProduct = new Map<string, Array<{ side_mockups: Record<string, string> | null; manufacturer_colors: { name: string; hex: string; color_code: string } | null }>>();
    for (const raw of colors ?? []) {
      const row = raw as unknown as { product_id: string; side_mockups: Record<string, string> | null; manufacturer_colors: { name: string; hex: string; color_code: string } | null };
      const list = colorsByProduct.get(row.product_id) ?? [];
      list.push(row);
      colorsByProduct.set(row.product_id, list);
    }

    const now = new Date().toISOString();
    await admin.from('naver_design_sessions').update({
      first_viewed_at: session.first_viewed_at || now,
      last_viewed_at: now,
      status: session.status === 'draft' ? 'in_progress' : session.status,
      updated_at: now,
    }).eq('id', session.id);
    await admin.from('naver_design_events').insert({ session_id: session.id, event_type: 'link_opened' });

    return NextResponse.json({
      session: { ...session, status: session.status === 'draft' ? 'in_progress' : session.status },
      jobs: (jobs ?? []).map((job) => {
        const product = job.local_product_id ? productMap.get(job.local_product_id) : null;
        const productColors = job.local_product_id ? colorsByProduct.get(job.local_product_id) ?? [] : [];
        const selectedColor = productColors.find((color) => color.manufacturer_colors?.color_code === job.color_code) ?? null;
        const configuration = Array.isArray(product?.configuration)
          ? product.configuration.map((side: Record<string, unknown>) => ({
              ...side,
              imageUrl: selectedColor?.side_mockups?.[String(side.id)] || side.imageUrl,
            }))
          : [];
        return {
          ...job,
          product: product ? { id: product.id, title: product.title, configuration } : null,
          selectedColor: selectedColor?.manufacturer_colors ?? null,
        };
      }),
    });
  } catch (error) {
    console.error('[naver-design] session load failed:', error);
    return NextResponse.json({ error: '디자인 접수 정보를 불러오지 못했습니다.' }, { status: 500 });
  }
}
