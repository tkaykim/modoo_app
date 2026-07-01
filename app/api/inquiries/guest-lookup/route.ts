import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';

export const runtime = 'nodejs';

// 비회원 문의 조회 — 문의 작성 시 남긴 전화번호로 본인 문의 목록을 찾는다.
// 게시판 설계상 "전화번호 = 열람 키"(lib/inquiry-access)라, 전화번호 일치가 곧 본인 확인이다.
// 내용·비밀번호·이메일 등 민감정보는 반환하지 않고, 상세는 여전히 /inquiries/[id] 확인 게이트를 거친다.
export async function POST(req: Request) {
  let body: { phone?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const digits = (body.phone ?? '').replace(/\D/g, '');
  // 최소 8자리 이상일 때만 조회(빈/짧은 값 오매칭·열거 방지)
  if (digits.length < 8) {
    return NextResponse.json({ error: '전화번호를 정확히 입력해주세요.' }, { status: 400 });
  }

  const admin = createAdminClient();

  // phone 저장 형식이 제각각(하이픈/공백 포함)이라, 후보를 넓게 가져와 숫자만 비교한다.
  const { data: rows, error } = await admin
    .from('inquiries')
    .select('id, title, status, created_at, phone')
    .eq('is_admin', false)
    .order('created_at', { ascending: false })
    .limit(500);

  if (error) {
    return NextResponse.json({ error: '조회 중 오류가 발생했습니다.' }, { status: 500 });
  }

  const matched = (rows ?? []).filter(
    (r: { phone?: string | null }) => (r.phone ?? '').replace(/\D/g, '') === digits
  );

  if (matched.length === 0) {
    return NextResponse.json({ inquiries: [] });
  }

  // 답변(관리자) 유무 표시
  const ids = matched.map((r: { id: string }) => r.id);
  const { data: replies } = await admin
    .from('inquiry_replies')
    .select('inquiry_id')
    .in('inquiry_id', ids)
    .eq('is_admin', true);
  const repliedSet = new Set((replies ?? []).map((r: { inquiry_id: string }) => r.inquiry_id));

  const inquiries = matched.map((r: { id: string; title: string; status: string; created_at: string }) => ({
    id: r.id,
    title: r.title,
    status: r.status,
    created_at: r.created_at,
    has_reply: repliedSet.has(r.id),
  }));

  return NextResponse.json({ inquiries });
}
