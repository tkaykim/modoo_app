import { type EmailOtpType } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null

  let next = searchParams.get('next')
  if (!next || next === '/home') {
    const cookieValue = request.cookies.get('login_return_to')?.value
    if (cookieValue) {
      try { next = decodeURIComponent(cookieValue) } catch { /* keep existing */ }
    }
  }
  next = next || '/home'

  if (token_hash && type) {
    const isValidNext = next.startsWith('/') && !next.startsWith('//')
    // 비밀번호 재설정(recovery) 링크는 무조건 새 비밀번호 설정 화면으로 보낸다.
    // 그렇지 않으면 링크 클릭만으로 로그인된 채 /home 으로 떨어져, 정작 비밀번호는
    // 영영 설정되지 않는다(특히 카카오/구글로 가입해 비번이 없는 계정은 다음 방문에
    // 같은 "로그인 안 됨 → 비번찾기" 벽에 매번 다시 부딪힌다).
    const redirectPath =
      type === 'recovery' ? '/reset-password/update' : isValidNext ? next : '/home'

    // 세션 쿠키를 반환할 응답 객체에 직접 쓴다.
    // (next/headers cookies()로 쓴 쿠키는 직접 만든 NextResponse.redirect에 병합되지 않아
    //  이메일 인증/비번 재설정 후에도 비로그인으로 표시되던 잠복 결함 — callback과 동일)
    const response = NextResponse.redirect(`${origin}${redirectPath}`)

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

    const { error } = await supabase.auth.verifyOtp({ type, token_hash })

    if (!error) {
      // recovery / email confirmation 모두 동일하게 세션 쿠키가 실린 응답을 반환
      return response
    }
  }

  // Return the user to an error page
  return NextResponse.redirect(`${origin}/auth/auth-code-error`)
}
