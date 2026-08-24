import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { ensureNaverDesignBucket, findNaverDesignSession, NAVER_DESIGN_BUCKET, NAVER_DESIGN_MAX_FILE_BYTES, safeFileExtension } from '@/lib/naver-design';

export const runtime = 'nodejs';
type Params = { params: Promise<{ token: string; jobId: string }> };

export async function POST(request: Request, { params }: Params) {
  const { token, jobId } = await params;
  try {
    const session = await findNaverDesignSession(token);
    if (!session) return NextResponse.json({ error: '유효하지 않거나 만료된 링크입니다.' }, { status: 404 });
    const body = await request.json().catch(() => null);
    const fileName = typeof body?.fileName === 'string' ? body.fileName.slice(0, 240) : '';
    const contentType = typeof body?.contentType === 'string' ? body.contentType.slice(0, 120) : 'application/octet-stream';
    const size = Number(body?.size);
    const assetKind = body?.assetKind === 'original' ? 'original' : 'processed';
    if (!fileName || !Number.isFinite(size) || size <= 0 || size > NAVER_DESIGN_MAX_FILE_BYTES) {
      return NextResponse.json({ error: '파일 정보가 올바르지 않거나 50MB를 초과했습니다.' }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: job, error: jobError } = await admin
      .from('naver_design_jobs')
      .select('id,status')
      .eq('id', jobId)
      .eq('session_id', session.id)
      .maybeSingle();
    if (jobError) throw jobError;
    if (!job) return NextResponse.json({ error: '디자인 작업을 찾을 수 없습니다.' }, { status: 404 });
    if (['approved', 'cancelled'].includes(job.status)) return NextResponse.json({ error: '업로드할 수 없는 작업입니다.' }, { status: 409 });

    await ensureNaverDesignBucket();
    const assetId = randomUUID();
    const path = `${session.id}/${jobId}/${assetId}.${safeFileExtension(fileName, contentType)}`;
    const { data: signed, error: signedError } = await admin.storage
      .from(NAVER_DESIGN_BUCKET)
      .createSignedUploadUrl(path, { upsert: false });
    if (signedError) throw signedError;

    const { error: assetError } = await admin.from('naver_design_assets').insert({
      id: assetId,
      job_id: jobId,
      storage_bucket: NAVER_DESIGN_BUCKET,
      storage_path: path,
      asset_kind: assetKind,
      original_name: fileName,
      content_type: contentType,
      size_bytes: size,
    });
    if (assetError) throw assetError;

    return NextResponse.json({
      data: {
        path: signed.path,
        signedToken: signed.token,
        assetUrl: `/api/naver-design/${encodeURIComponent(token)}/assets/${assetId}`,
      },
    });
  } catch (error) {
    console.error('[naver-design] signed upload failed:', error);
    return NextResponse.json({ error: '파일 업로드를 준비하지 못했습니다.' }, { status: 500 });
  }
}
