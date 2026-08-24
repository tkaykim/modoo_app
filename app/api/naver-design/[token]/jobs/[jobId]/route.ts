import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { findNaverDesignSession } from '@/lib/naver-design';

export const runtime = 'nodejs';
type Params = { params: Promise<{ token: string; jobId: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const { token, jobId } = await params;
  try {
    const session = await findNaverDesignSession(token);
    if (!session) return NextResponse.json({ error: '유효하지 않거나 만료된 링크입니다.' }, { status: 404 });
    const body = await request.json().catch(() => null);
    if (!body || typeof body.canvasState !== 'object' || Array.isArray(body.canvasState)) {
      return NextResponse.json({ error: '캔버스 데이터가 필요합니다.' }, { status: 400 });
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
    if (['approved', 'cancelled'].includes(job.status)) {
      return NextResponse.json({ error: '더 이상 수정할 수 없는 디자인입니다.' }, { status: 409 });
    }

    const submit = body.submit === true;
    const now = new Date().toISOString();
    const nextStatus = submit ? 'submitted' : job.status === 'needs_mapping' ? 'needs_mapping' : 'in_progress';
    const { error: updateError } = await admin.from('naver_design_jobs').update({
      canvas_state: body.canvasState,
      product_color: typeof body.productColor === 'string' ? body.productColor : null,
      customer_note: typeof body.customerNote === 'string' ? body.customerNote.slice(0, 2000) : null,
      status: nextStatus,
      submitted_at: submit ? now : null,
      updated_at: now,
    }).eq('id', jobId).eq('session_id', session.id);
    if (updateError) throw updateError;

    const { data: allJobs, error: countError } = await admin
      .from('naver_design_jobs')
      .select('status')
      .eq('session_id', session.id);
    if (countError) throw countError;
    const submittedCount = (allJobs ?? []).filter((row) => ['submitted', 'reviewed', 'approved'].includes(row.status)).length;
    const allSubmitted = (allJobs?.length ?? 0) > 0 && submittedCount === allJobs?.length;
    await admin.from('naver_design_sessions').update({
      submitted_job_count: submittedCount,
      status: allSubmitted ? 'submitted' : 'in_progress',
      submitted_at: allSubmitted ? now : null,
      updated_at: now,
    }).eq('id', session.id);
    await admin.from('naver_design_events').insert({
      session_id: session.id,
      job_id: jobId,
      event_type: submit ? 'job_submitted' : 'job_saved',
    });

    return NextResponse.json({ data: { status: nextStatus, submittedAt: submit ? now : null } });
  } catch (error) {
    console.error('[naver-design] job save failed:', error);
    return NextResponse.json({ error: '디자인을 저장하지 못했습니다.' }, { status: 500 });
  }
}
