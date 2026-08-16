import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';

// 도입 문의(B2B) 접수. 공개 엔드포인트라 최소 검증 + 길이 제한만 둔다.
const TRACKS = ['produce', 'mall_only', 'new_shop', 'outsource', 'supplier', 'unknown'];

const clip = (v: unknown, n: number): string | null => {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  return s ? s.slice(0, n) : null;
};

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: '요청을 읽지 못했습니다.' }, { status: 400 });
    }

    const track = TRACKS.includes(body.track) ? body.track : 'unknown';
    const contactName = clip(body.contactName, 40);
    const phone = clip(body.phone, 24);

    if (!contactName) {
      return NextResponse.json({ error: '성함을 입력해 주세요.' }, { status: 400 });
    }
    // 숫자 9자리 이상이면 통과 — 하이픈·공백·국가번호 표기를 모두 허용한다.
    if (!phone || (phone.match(/\d/g) || []).length < 9) {
      return NextResponse.json({ error: '연락처를 정확히 입력해 주세요.' }, { status: 400 });
    }
    if (body.agreePrivacy !== true) {
      return NextResponse.json({ error: '개인정보 수집·이용에 동의해 주세요.' }, { status: 400 });
    }

    const methods = Array.isArray(body.printMethods)
      ? body.printMethods.filter((m: unknown) => typeof m === 'string').slice(0, 6).map((m: string) => m.slice(0, 20))
      : null;

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('biz_leads')
      .insert({
        track,
        contact_name: contactName,
        phone,
        company: clip(body.company, 80),
        email: clip(body.email, 120),
        shop_url: clip(body.shopUrl, 300),
        platform: clip(body.platform, 30),
        monthly_orders: clip(body.monthlyOrders, 20),
        print_methods: methods && methods.length ? methods : null,
        pain_note: clip(body.painNote, 500),
        agree_privacy: true,
        agree_marketing: body.agreeMarketing === true,
        source: clip(body.source, 20) || 'web',
        utm_source: clip(body.utmSource, 60),
        utm_medium: clip(body.utmMedium, 60),
        utm_campaign: clip(body.utmCampaign, 80),
        referer: clip(request.headers.get('referer'), 300),
        user_agent: clip(request.headers.get('user-agent'), 300),
      })
      .select('id')
      .single();

    if (error) {
      console.error('[biz/leads] insert failed:', error.message);
      return NextResponse.json({ error: '접수에 실패했습니다. 잠시 후 다시 시도해 주세요.' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, id: data?.id ?? null });
  } catch (e) {
    console.error('[biz/leads] unexpected:', e);
    return NextResponse.json({ error: '접수에 실패했습니다.' }, { status: 500 });
  }
}
