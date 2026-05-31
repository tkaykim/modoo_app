import { NextResponse } from 'next/server';
import { createClient as createAuthedClient } from '@/lib/supabase';
import { createAdminClient } from '@/lib/supabase-admin';
import { inquiryKeyMatches } from '@/lib/inquiry-access';

export const runtime = 'nodejs';

/**
 * 문의 답변 등록 (관리자 + 고객 공용).
 * 권한: 로그인 관리자 / 문의 작성자(owner) / 비밀번호 일치한 비로그인 고객.
 * 서비스롤로 insert하여 RLS와 무관하게 동작하되, 위 권한을 서버에서 검증한다.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const inquiryId = body?.inquiryId || body?.inquiry_id;
  const content = typeof body?.content === 'string' ? body.content.trim() : '';
  const fileUrls = Array.isArray(body?.file_urls)
    ? body.file_urls.filter((u: unknown) => typeof u === 'string' && u.length > 0)
    : [];
  const password = typeof body?.password === 'string' ? body.password : '';

  if (!inquiryId || typeof inquiryId !== 'string') {
    return NextResponse.json({ error: '문의 ID가 필요합니다.' }, { status: 400 });
  }
  if (!content && fileUrls.length === 0) {
    return NextResponse.json({ error: '답변 내용 또는 첨부가 필요합니다.' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: inquiry, error: inqErr } = await admin
    .from('inquiries')
    .select('id, user_id, password, phone')
    .eq('id', inquiryId)
    .single();
  if (inqErr || !inquiry) {
    return NextResponse.json({ error: '문의를 찾을 수 없습니다.' }, { status: 404 });
  }

  // 권한 판별
  let isAdminRole = false;
  let allowed = false;
  let adminId: string | null = null;
  try {
    const authed = await createAuthedClient();
    const { data: { user } } = await authed.auth.getUser();
    if (user) {
      const { data: prof } = await admin.from('profiles').select('role').eq('id', user.id).single();
      if (prof?.role === 'admin' || prof?.role === 'super_admin') {
        isAdminRole = true;
        allowed = true;
        adminId = user.id;
      } else if (inquiry.user_id && inquiry.user_id === user.id) {
        allowed = true; // 작성자 본인(고객)
      }
    }
  } catch {
    /* 비로그인 — 아래 비밀번호 검증으로 진행 */
  }
  if (!allowed && inquiryKeyMatches(password, inquiry)) {
    allowed = true; // 전화번호 또는 비밀번호 인증 고객
  }
  if (!allowed) {
    return NextResponse.json({ error: '답변 권한이 없습니다.' }, { status: 403 });
  }

  const { data, error } = await admin
    .from('inquiry_replies')
    .insert({
      inquiry_id: inquiryId,
      content,
      file_urls: fileUrls,
      admin_id: adminId,
      is_admin: isAdminRole,
    })
    .select('id, content, file_urls, is_admin, admin_id, created_at, updated_at')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data, is_admin: isAdminRole });
}
