import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * 로그인/회원가입 실패 시, 해당 이메일이 "소셜(카카오/구글)로만 가입되어 비밀번호가 없는
 * 계정"인지 알려준다. 이런 계정은 이메일+비밀번호 경로에서 100% 막히므로, 어떤 버튼으로
 * 로그인해야 하는지 안내하기 위함이다.
 *
 * 보안: 이메일 존재 여부를 광범위하게 노출하지 않도록, **소셜 전용(email identity 없음)**
 * 계정에 대해서만 provider 를 반환한다. 일반 이메일/비밀번호 계정이나 미가입 이메일은
 * 동일하게 빈 배열을 반환한다(= 추가 정보 노출 없음). 소셜 전용 계정은 비밀번호가 없어
 * 무차별 대입 대상이 되지도 않는다.
 */
export async function POST(request: NextRequest) {
  let email = ''
  try {
    const body = await request.json()
    email = (body?.email ?? '').toString().trim().toLowerCase()
  } catch {
    return NextResponse.json({ providers: [] })
  }

  if (!email || !email.includes('@')) {
    return NextResponse.json({ providers: [] })
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    // 키가 없으면 조용히 힌트 없음으로 처리(기존 일반 안내로 폴백).
    return NextResponse.json({ providers: [] })
  }

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  try {
    // 이메일로 사용자 조회. listUsers 는 이메일 필터를 지원하지 않아 페이지를 순회한다.
    // (modoo 사용자 규모가 작고, 인증 실패 시에만 호출되므로 비용이 작다.)
    const perPage = 200
    let target: { app_metadata?: Record<string, unknown> | null } | null = null
    for (let page = 1; page <= 25 && !target; page++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage })
      if (error || !data?.users?.length) break
      target =
        data.users.find((u) => (u.email ?? '').toLowerCase() === email) ?? null
      if (data.users.length < perPage) break
    }

    if (!target) {
      return NextResponse.json({ providers: [] })
    }

    const meta = target.app_metadata ?? {}
    const rawProviders = Array.isArray((meta as { providers?: unknown }).providers)
      ? ((meta as { providers: unknown[] }).providers as string[])
      : typeof (meta as { provider?: unknown }).provider === 'string'
        ? [(meta as { provider: string }).provider]
        : []

    // 이메일/비밀번호 자격(email)이 있으면 비밀번호로 로그인이 가능하므로 힌트를 주지 않는다.
    if (rawProviders.includes('email')) {
      return NextResponse.json({ providers: [] })
    }

    // 안내 가능한 소셜 provider 만 노출.
    const social = rawProviders.filter((p) => p === 'kakao' || p === 'google')

    return NextResponse.json({ providers: social })
  } catch {
    return NextResponse.json({ providers: [] })
  }
}
