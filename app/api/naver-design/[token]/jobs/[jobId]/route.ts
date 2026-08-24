import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { findNaverDesignSession, NAVER_DESIGN_MAX_CANVAS_STATE_BYTES, resolveNaverDesignSaveState, sanitizeNaverDesignCanvasState } from '@/lib/naver-design';

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
    if (Object.values(body.canvasState).some((value) => typeof value !== 'string')) {
      return NextResponse.json({ error: '캔버스 데이터 형식이 올바르지 않습니다.' }, { status: 400 });
    }
    const canvasState = sanitizeNaverDesignCanvasState(body.canvasState);
    if (Buffer.byteLength(JSON.stringify(canvasState), 'utf8') > NAVER_DESIGN_MAX_CANVAS_STATE_BYTES) {
      return NextResponse.json({ error: '캔버스 데이터가 너무 큽니다.' }, { status: 413 });
    }

    const admin = createAdminClient();
    const { data: job, error: jobError } = await admin
      .from('naver_design_jobs')
      .select('id,status,submitted_at')
      .eq('id', jobId)
      .eq('session_id', session.id)
      .maybeSingle();
    if (jobError) throw jobError;
    if (!job) return NextResponse.json({ error: '디자인 작업을 찾을 수 없습니다.' }, { status: 404 });
    const submit = body.submit === true;
    if (['reviewed', 'approved', 'cancelled'].includes(job.status) || (job.status === 'submitted' && !submit)) {
      return NextResponse.json({ error: '더 이상 수정할 수 없는 디자인입니다.' }, { status: 409 });
    }
    if (job.status === 'submitted' && submit) {
      return NextResponse.json({ data: { status: job.status, submittedAt: job.submitted_at } });
    }

    const now = new Date().toISOString();
    const next = resolveNaverDesignSaveState(job.status, job.submitted_at, submit, now);
    const { error: updateError } = await admin.from('naver_design_jobs').update({
      canvas_state: canvasState,
      product_color: typeof body.productColor === 'string' ? body.productColor : null,
      customer_note: typeof body.customerNote === 'string' ? body.customerNote.slice(0, 2000) : null,
      status: next.status,
      submitted_at: next.submittedAt,
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
      submitted_at: allSubmitted ? session.submitted_at || now : null,
      updated_at: now,
    }).eq('id', session.id);
    await admin.from('naver_design_events').insert({
      session_id: session.id,
      job_id: jobId,
      event_type: submit ? 'job_submitted' : 'job_saved',
    });

    return NextResponse.json({ data: { status: next.status, submittedAt: next.submittedAt } });
  } catch (error) {
    console.error('[naver-design] job save failed:', error);
    return NextResponse.json({ error: '디자인을 저장하지 못했습니다.' }, { status: 500 });
  }
}
