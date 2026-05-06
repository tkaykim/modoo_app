import { createAnonClient } from '@/lib/supabase';
import { createAdminClient } from '@/lib/supabase-admin';
import { STORAGE_BUCKETS, STORAGE_FOLDERS } from '@/lib/storage-config';
import { NextResponse } from 'next/server';

const ALLOWED_TYPES = ['logo', 'image', 'reference'] as const;
type AllowedAssetType = typeof ALLOWED_TYPES[number];

async function resolveMall(slugOrToken: string) {
  const supabase = createAnonClient();
  const { data: bySlug } = await supabase
    .from('partner_malls')
    .select('id')
    .eq('slug', slugOrToken)
    .eq('is_active', true)
    .maybeSingle();
  if (bySlug) return bySlug;

  const { data: byToken } = await supabase
    .from('partner_malls')
    .select('id')
    .eq('share_token', slugOrToken)
    .eq('is_active', true)
    .maybeSingle();
  return byToken;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ shareToken: string }> },
) {
  const { shareToken } = await params;
  if (!shareToken) {
    return NextResponse.json({ error: 'Slug 또는 share token이 필요합니다.' }, { status: 400 });
  }

  const mall = await resolveMall(shareToken);
  if (!mall) {
    return NextResponse.json({ error: '유효하지 않은 파트너몰입니다.' }, { status: 404 });
  }

  const payload = await request.json().catch(() => null);
  const fileBase64: string | undefined = payload?.file_base64;
  const name: string = payload?.name ?? 'asset.png';
  const requestedType: string = payload?.asset_type ?? 'image';
  const assetType: AllowedAssetType = (ALLOWED_TYPES as readonly string[]).includes(requestedType)
    ? (requestedType as AllowedAssetType)
    : 'image';

  if (!fileBase64 || typeof fileBase64 !== 'string') {
    return NextResponse.json({ error: '이미지 데이터가 필요합니다.' }, { status: 400 });
  }
  if (!fileBase64.startsWith('data:image/')) {
    return NextResponse.json({ error: '이미지 형식이 올바르지 않습니다.' }, { status: 400 });
  }

  const matches = fileBase64.match(/^data:image\/(\w+);base64,(.+)$/);
  if (!matches) {
    return NextResponse.json({ error: '이미지 데이터 파싱 실패' }, { status: 400 });
  }
  const fileExt = matches[1] === 'jpeg' ? 'jpg' : matches[1];
  const buffer = Buffer.from(matches[2], 'base64');

  // 5MB 상한
  if (buffer.byteLength > 5 * 1024 * 1024) {
    return NextResponse.json({ error: '5MB 이하 이미지만 업로드 가능합니다.' }, { status: 413 });
  }

  const admin = createAdminClient();
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 8);
  const fileName = `${mall.id}-${timestamp}-${random}.${fileExt}`;
  const filePath = `${STORAGE_FOLDERS.PARTNER_MALL_ASSETS}/${fileName}`;

  const { data: uploadData, error: uploadError } = await admin.storage
    .from(STORAGE_BUCKETS.USER_DESIGNS)
    .upload(filePath, buffer, {
      contentType: `image/${fileExt === 'jpg' ? 'jpeg' : fileExt}`,
      cacheControl: '3600',
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: urlData } = admin.storage
    .from(STORAGE_BUCKETS.USER_DESIGNS)
    .getPublicUrl(uploadData.path);

  const fingerprint =
    request.headers.get('x-actor-fingerprint') ??
    request.headers.get('user-agent')?.slice(0, 80) ??
    null;

  const { data, error } = await admin
    .from('partner_mall_assets')
    .insert({
      partner_mall_id: mall.id,
      asset_type: assetType,
      url: urlData.publicUrl,
      name,
      mime_type: `image/${fileExt === 'jpg' ? 'jpeg' : fileExt}`,
      file_size: buffer.byteLength,
      is_primary: false,
      sort_order: null,
      created_by_role: 'guest',
      created_by_fingerprint: fingerprint,
    })
    .select(`
      id, partner_mall_id, asset_type, url, name,
      is_primary, sort_order, created_by_role, created_at
    `)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}
