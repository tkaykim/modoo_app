import { type EmailOtpType } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const next = searchParams.get('next') ?? '/home'

  if (token_hash && type) {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    })

    if (!error) {
      const isValidNext = next.startsWith('/') && !next.startsWith('//')
      const redirectPath = isValidNext ? next : '/home'

      // For password recovery, redirect to the update password page
      if (type === 'recovery') {
        return NextResponse.redirect(`${origin}${redirectPath}`)
      }
      // For email confirmation, redirect to saved path or home
      return NextResponse.redirect(`${origin}${redirectPath}`)
    }
  }

  // Return the user to an error page
  return NextResponse.redirect(`${origin}/auth/auth-code-error`)
}
