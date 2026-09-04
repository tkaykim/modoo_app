import { NextResponse } from 'next/server';
import { createClient as createAuthedClient } from '@/lib/supabase';
import { createAdminClient } from '@/lib/supabase-admin';

export const runtime = 'nodejs';

/**
 * AI 디자이너 — 과잠(부위별 색상 상품) 디자이너 상담 접수.
 *
 * 바시티 자켓처럼 부위별 색·엠블럼·학번·명단이 필요한 상품은 위저드로 시안을 만들지 않고
 * 기존 문의(inquiries) 경로로 접수한다. 이후 시안 협의·결제는 기존 문의 처리 흐름을 그대로 탄다.
 * - inquiries + inquiry_products 생성(service role, 서버 검증 후)
 * - 관리자 알림은 기존 /api/inquiries/notify 재사용
 * - ai_designer_requests 세션에 접수 결과를 기록해 위저드 원장에서 추적 가능하게 한다
 */

interface PartColor {
  layerId: string;
  layerName: string;
  hex: string;
  colorName: string;
}

interface IntakeBody {
  sessionId?: string;
  productId: string;
  partColors: PartColor[];
  schoolName: string;
  backText?: string;
  elements: string[];
  roster?: string;
  totalQty: number;
  desiredDate?: string;
  note?: string;
  contact: { name: string; email: string; phone?: string; kakaoId?: string };
  password?: string;
  fileUrls: string[];
  /** 개발 환경에서만 유효 — E2E 시 관리자 알림 메일 생략 */
  skipNotify?: boolean;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function str(v: unknown, max: number): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

function randomPassword(): string {
  return Math.random().toString(36).slice(2, 10);
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as IntakeBody | null;
  if (!body) return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 });

  const productId = str(body.productId, 40);
  if (!UUID_RE.test(productId)) return NextResponse.json({ error: '상품 정보가 올바르지 않습니다.' }, { status: 400 });
  const sessionId = UUID_RE.test(str(body.sessionId, 40)) ? str(body.sessionId, 40) : null;

  const schoolName = str(body.schoolName, 100);
  if (!schoolName) return NextResponse.json({ error: '학교·학과명을 입력해 주세요.' }, { status: 400 });

  const contactName = str(body.contact?.name, 50);
  const email = str(body.contact?.email, 120);
  const phone = str(body.contact?.phone, 40);
  const kakaoId = str(body.contact?.kakaoId, 60);
  if (!contactName) return NextResponse.json({ error: '담당자 이름을 입력해 주세요.' }, { status: 400 });
  if (!EMAIL_RE.test(email)) return NextResponse.json({ error: '이메일 형식을 확인해 주세요.' }, { status: 400 });

  const totalQty = Number.isInteger(body.totalQty) ? body.totalQty : Number.parseInt(String(body.totalQty), 10);
  if (!Number.isInteger(totalQty) || totalQty < 1 || totalQty > 10000) {
    return NextResponse.json({ error: '수량을 확인해 주세요.' }, { status: 400 });
  }

  const partColors = (Array.isArray(body.partColors) ? body.partColors : []).slice(0, 10).map((c) => ({
    layerId: str(c?.layerId, 40),
    layerName: str(c?.layerName, 40),
    hex: str(c?.hex, 9),
    colorName: str(c?.colorName, 40),
  })).filter((c) => c.layerName && c.hex);
  const elements = (Array.isArray(body.elements) ? body.elements : []).slice(0, 10).map((e) => str(e, 40)).filter(Boolean);
  const backText = str(body.backText, 200);
  const roster = str(body.roster, 5000);
  const rosterLines = roster.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const note = str(body.note, 2000);
  const desiredDate = /^\d{4}-\d{2}-\d{2}$/.test(str(body.desiredDate, 10)) ? str(body.desiredDate, 10) : null;

  // 첨부는 우리 스토리지(inquiry-files 등) 공개 URL만 허용 — 임의 외부 링크 저장 방지
  const storagePrefix = `${process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''}/storage/v1/object/public/`;
  const fileUrls = (Array.isArray(body.fileUrls) ? body.fileUrls : [])
    .map((u) => str(u, 500))
    .filter((u) => storagePrefix.length > 40 && u.startsWith(storagePrefix))
    .slice(0, 10);

  const authed = await createAuthedClient();
  const { data: { user } } = await authed.auth.getUser();

  const password = str(body.password, 40);
  if (!user && password.length < 4) {
    return NextResponse.json({ error: '비회원은 접수 조회용 비밀번호(4자 이상)가 필요합니다.' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: product } = await admin.from('products').select('id, title').eq('id', productId).single();
  if (!product) return NextResponse.json({ error: '상품을 찾을 수 없습니다.' }, { status: 404 });

  const colorSummary = partColors.map((c) => `${c.layerName} ${c.colorName || c.hex}`).join(' / ');
  const title = `[과잠 접수] ${schoolName} ${product.title} ${totalQty}장`;
  const contentLines = [
    '[AI 디자이너 과잠 디자이너 상담 접수]',
    `학교·학과: ${schoolName}`,
    `부위별 색상: ${partColors.map((c) => `${c.layerName} ${c.colorName || ''}(${c.hex})`).join(' / ') || '미선택'}`,
    `넣을 요소: ${elements.join(', ') || '미선택'}`,
    backText ? `등판 문구: ${backText}` : null,
    `총 수량: ${totalQty}장${rosterLines.length ? ` (명단 ${rosterLines.length}명)` : ''}`,
    rosterLines.length ? `명단:\n${rosterLines.join('\n')}` : null,
    note ? `추가 요청: ${note}` : null,
    fileUrls.length ? `첨부 파일 ${fileUrls.length}개` : null,
    sessionId ? `AI 디자이너 세션: ${sessionId}` : null,
  ].filter((l): l is string => !!l);

  const { data: inquiry, error: inqErr } = await admin
    .from('inquiries')
    .insert({
      user_id: user?.id ?? null,
      title,
      content: contentLines.join('\n'),
      status: 'pending',
      group_name: schoolName,
      manager_name: contactName,
      email,
      phone: phone || null,
      kakao_id: kakaoId || null,
      desired_date: desiredDate,
      expected_qty: totalQty,
      fabric_color: colorSummary || null,
      password: password || randomPassword(),
      file_urls: fileUrls,
    })
    .select('id')
    .single();
  if (inqErr || !inquiry) {
    console.error('[ai-designer/varsity-intake] inquiry insert failed', inqErr);
    return NextResponse.json({ error: '접수 저장에 실패했습니다. 잠시 후 다시 시도해 주세요.' }, { status: 500 });
  }

  const { error: ipErr } = await admin
    .from('inquiry_products')
    .insert({ inquiry_id: inquiry.id, product_id: productId });
  if (ipErr) console.error('[ai-designer/varsity-intake] inquiry_products insert failed', ipErr);

  // 위저드 원장에 접수 결과 기록 (세션 소유자 검증 후)
  if (sessionId) {
    const { data: session } = await admin
      .from('ai_designer_requests')
      .select('id, user_id')
      .eq('id', sessionId)
      .maybeSingle();
    if (session && (!session.user_id || session.user_id === user?.id)) {
      await admin
        .from('ai_designer_requests')
        .update({
          product_id: productId,
          user_id: session.user_id ?? user?.id ?? null,
          customer_note: `과잠 디자이너 상담 접수 → 문의 ${inquiry.id}`,
          updated_at: new Date().toISOString(),
        })
        .eq('id', sessionId);
    }
  }

  // 관리자 알림 — 기존 문의 알림 경로 재사용 (실패해도 접수는 유지)
  const skipNotify = body.skipNotify === true && process.env.NODE_ENV !== 'production';
  if (!skipNotify) {
    try {
      await fetch(new URL('/api/inquiries/notify', req.url), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          groupName: schoolName,
          managerName: contactName,
          email,
          phone: phone || undefined,
          kakaoId: kakaoId || undefined,
          desiredDate: desiredDate ?? undefined,
          expectedQty: totalQty,
          content: contentLines.join('\n'),
          fabricColor: colorSummary || undefined,
          fileCount: fileUrls.length,
          productNames: [product.title],
        }),
      });
    } catch (e) {
      console.error('[ai-designer/varsity-intake] notify failed', e);
    }
  }

  return NextResponse.json({ ok: true, inquiryId: inquiry.id, isMember: !!user });
}
