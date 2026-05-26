import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { createClient as createServerClient } from '@/lib/supabase';

export const runtime = 'nodejs';

interface CreateBody {
  title: string;
  content: string;
  group_name: string;
  manager_name: string;
  phone: string;
  kakao_id?: string | null;
  desired_date?: string | null;
  expected_qty?: number | null;
  fabric_color?: string | null;
  password: string;
  file_urls: string[];
  product_ids: string[];
}

export async function POST(req: Request) {
  let body: CreateBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.title?.trim()) return NextResponse.json({ error: 'title required' }, { status: 400 });
  if (!body.group_name?.trim()) return NextResponse.json({ error: 'group_name required' }, { status: 400 });
  if (!body.manager_name?.trim()) return NextResponse.json({ error: 'manager_name required' }, { status: 400 });
  if (!body.phone?.trim() && !body.kakao_id?.toString().trim()) {
    return NextResponse.json({ error: 'phone or kakao_id required' }, { status: 400 });
  }
  if (!body.password?.trim()) return NextResponse.json({ error: 'password required' }, { status: 400 });

  let userId: string | null = null;
  try {
    const supabase = await createServerClient();
    const { data } = await supabase.auth.getUser();
    userId = data.user?.id ?? null;
  } catch {
    userId = null;
  }

  const admin = createAdminClient();

  const { data: inquiry, error: insertErr } = await admin
    .from('inquiries')
    .insert({
      user_id: userId,
      title: body.title.trim(),
      content: body.content?.trim() || '',
      status: 'pending',
      group_name: body.group_name.trim(),
      manager_name: body.manager_name.trim(),
      phone: body.phone?.trim() || '',
      kakao_id: body.kakao_id?.toString().trim() || null,
      desired_date: body.desired_date || null,
      expected_qty: body.expected_qty ?? null,
      fabric_color: body.fabric_color?.trim() || null,
      password: body.password.trim(),
      file_urls: Array.isArray(body.file_urls) ? body.file_urls : [],
    })
    .select('id')
    .single();

  if (insertErr || !inquiry) {
    console.error('[inquiries/create] insert inquiries failed', insertErr);
    return NextResponse.json({ error: 'insert_failed' }, { status: 500 });
  }

  const productIds = Array.isArray(body.product_ids)
    ? body.product_ids.filter((id) => typeof id === 'string' && id.length > 0)
    : [];

  if (productIds.length > 0) {
    const rows = productIds.map((product_id) => ({
      inquiry_id: inquiry.id,
      product_id,
    }));
    const { error: linkErr } = await admin.from('inquiry_products').insert(rows);
    if (linkErr) {
      console.error('[inquiries/create] insert inquiry_products failed — rolling back', linkErr);
      await admin.from('inquiries').delete().eq('id', inquiry.id);
      return NextResponse.json({ error: 'link_failed' }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, id: inquiry.id });
}
