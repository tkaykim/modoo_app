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

    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data?.user) {
      response.cookies.set('login_return_to', '', { path: '/', maxAge: 0 })
      return response
    }
  }

  const errResp = NextResponse.redirect(`${origin}/auth/auth-code-error`)
  errResp.cookies.set('login_return_to', '', { path: '/', maxAge: 0 })
  return errResp
}
