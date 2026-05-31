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

  // ── 임시 진단 로깅 (원인 확정 후 제거) ──────────────────────────────
  const incomingCookieNames = request.cookies.getAll().map((c) => c.name)
  console.log('[AUTH_CALLBACK] in', JSON.stringify({
    host: request.headers.get('host'),
    proto: request.headers.get('x-forwarded-proto'),
    origin,
    hasCode: Boolean(code),
    params: Array.from(requestUrl.searchParams.keys()),
    error_param: requestUrl.searchParams.get('error'),
    error_desc: requestUrl.searchParams.get('error_description'),
    incomingCookies: incomingCookieNames,
    hasVerifier: incomingCookieNames.some((n) => n.includes('code-verifier')),
  }))
  // ─────────────────────────────────────────────────────────────────

  if (code) {
    // 리다이렉트 응답을 먼저 만들고, Supabase가 세션 쿠키를 "이 응답에 직접" 쓰도록 한다.
    const response = NextResponse.redirect(redirectUrl)
    const setCookieLog: Array<{ name: string; options: unknown }> = []

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              setCookieLog.push({ name, options })
              response.cookies.set(name, value, options)
            })
          },
        },
      }
    )

    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    // ── 임시 진단 로깅 ──────────────────────────────────────────────
    console.log('[AUTH_CALLBACK] exchange', JSON.stringify({
      ok: !error && Boolean(data?.user),
      userId: data?.user?.id ?? null,
      provider: data?.user?.app_metadata?.provider ?? null,
      errorName: error?.name ?? null,
      errorStatus: (error as { status?: number } | null)?.status ?? null,
      errorMessage: error?.message ?? null,
      cookiesSet: setCookieLog,
    }))
    // ───────────────────────────────────────────────────────────────

    if (!error && data?.user) {
      response.cookies.set('login_return_to', '', { path: '/', maxAge: 0 })
      return response
    }
  }

  console.log('[AUTH_CALLBACK] -> auth-code-error')
  const errResp = NextResponse.redirect(`${origin}/auth/auth-code-error`)
  errResp.cookies.set('login_return_to', '', { path: '/', maxAge: 0 })
  return errResp
}
