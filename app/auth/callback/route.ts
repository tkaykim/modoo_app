import { createServerClient } from '@supabase/ssr'
import { createClient as createAdminBase } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// 임시 진단: 콜백 시도마다 verifier 쿠키 존재/교환 결과를 DB에 기록 (원인 확정 후 제거)
async function logDiag(row: Record<string, unknown>) {
  try {
    const admin = createAdminBase(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    )
    await admin.from('auth_callback_diag').insert(row)
  } catch { /* 진단 실패는 무시 */ }
}

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

  const cookieNames = request.cookies.getAll().map((c) => c.name)
  const hasVerifier = cookieNames.some((n) => n.includes('code-verifier'))

  if (code) {
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

    let exchangeOk = false
    let errorMessage: string | null = null
    let userId: string | null = null
    let provider: string | null = null
    try {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code)
      exchangeOk = !error && Boolean(data?.user)
      errorMessage = error?.message ?? null
      userId = data?.user?.id ?? null
      provider = (data?.user?.app_metadata?.provider as string) ?? null
    } catch (e) {
      errorMessage = (e as Error)?.message ?? 'threw'
    }

    await logDiag({
      has_code: true,
      has_verifier: hasVerifier,
      cookie_names: cookieNames,
      exchange_ok: exchangeOk,
      error_message: errorMessage,
      user_id: userId,
      provider,
      host: request.headers.get('host'),
      ua: request.headers.get('user-agent'),
    })

    if (exchangeOk) {
      response.cookies.set('login_return_to', '', { path: '/', maxAge: 0 })
      return response
    }
  } else {
    await logDiag({
      has_code: false,
      has_verifier: hasVerifier,
      cookie_names: cookieNames,
      exchange_ok: false,
      error_message: 'no_code: ' + (requestUrl.searchParams.get('error_description') || requestUrl.searchParams.get('error') || ''),
      host: request.headers.get('host'),
      ua: request.headers.get('user-agent'),
    })
  }

  const errResp = NextResponse.redirect(`${origin}/auth/auth-code-error`)
  errResp.cookies.set('login_return_to', '', { path: '/', maxAge: 0 })
  return errResp
}
