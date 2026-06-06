import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const origin = requestUrl.origin

  // Resolve return URL: prefer query param, fall back to cookie
  let next = requestUrl.searchParams.get('next')
  if (!next || next === '/home') {
    const cookieValue = request.cookies.get('login_return_to')?.value
    if (cookieValue) {
      try { next = decodeURIComponent(cookieValue) } catch { /* keep existing */ }
    }
  }
  next = next || '/home'

  const isValidNext = next.startsWith('/') && !next.startsWith('//')
  const redirectUrl = `${origin}${isValidNext ? next : '/home'}`

  if (code) {
    // 리다이렉트 응답을 먼저 만들고, Supabase가 세션 쿠키를 "이 응답에 직접" 쓰도록 한다.
    // (next/headers cookies()로 쓴 쿠키는 직접 만든 NextResponse.redirect에 병합되지 않아
    //  Set-Cookie가 브라우저에 전달되지 않는다 → OAuth 로그인 후 비로그인으로 표시되던 버그)
    const response = NextResponse.redirect(redirectUrl)

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            )
          },
        },
      }
    )

    // 교환을 시도하되, 일시적 취소/5xx(예: 콜백이 다른 호스트로 307 점프하며 연결이 끊긴 경우
    // GoTrue가 'context canceled' 500을 던진다)에는 짧게 한 번 더 시도한다.
    let lastError: { message?: string } | null = null
    for (let attempt = 0; attempt < 2; attempt++) {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code)

      if (!error && data?.user) {
        response.cookies.set('login_return_to', '', { path: '/', maxAge: 0 })
        return response
      }

      lastError = error
      const transient = error && /cancel|timeout|fetch|network|502|503|504|500/i.test(error.message)
      if (attempt === 0 && transient) {
        await new Promise((r) => setTimeout(r, 300))
        continue
      }
      break
    }

    // 교환은 실패했지만 (중복 콜백 레이스 등으로) 이미 세션이 잡혀 있을 수 있다.
    // 그럴 땐 에러 페이지로 보내지 말고 성공으로 처리한다.
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      response.cookies.set('login_return_to', '', { path: '/', maxAge: 0 })
      return response
    }

    console.error('[auth/callback] exchange failed:', lastError?.message)
  }

  const errResp = NextResponse.redirect(`${origin}/auth/auth-code-error`)
  errResp.cookies.set('login_return_to', '', { path: '/', maxAge: 0 })
  return errResp
}
