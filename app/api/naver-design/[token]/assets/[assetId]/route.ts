import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { findNaverDesignSession, isUuid } from '@/lib/naver-design';

export const runtime = 'nodejs';
type Params = { params: Promise<{ token: string; assetId: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { token, assetId } = await params;
  try {
    const session = await findNaverDesignSession(token);
    if (!session) return NextResponse.json({ error: '유효하지 않거나 만료된 링크입니다.' }, { status: 404 });
    if (!isUuid(assetId)) return NextResponse.json({ error: '파일을 찾을 수 없습니다.' }, { status: 404 });
    const admin = createAdminClient();
    const { data: asset, error } = await admin
      .from('naver_design_assets')
      .select('storage_bucket,storage_path,naver_design_jobs!inner(session_id)')
      .eq('id', assetId)
      .eq('naver_design_jobs.session_id', session.id)
      .maybeSingle();
    if (error) throw error;
    if (!asset) return NextResponse.json({ error: '파일을 찾을 수 없습니다.' }, { status: 404 });
    const { data: signed, error: signedError } = await admin.storage
      .from(asset.storage_bucket)
      .createSignedUrl(asset.storage_path, 60 * 60);
    if (signedError) throw signedError;
    return NextResponse.redirect(signed.signedUrl, { status: 307 });
  } catch (error) {
    console.error('[naver-design] asset read failed:', error);
    return NextResponse.json({ error: '파일을 불러오지 못했습니다.' }, { status: 500 });
  }
}
