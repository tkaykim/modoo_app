import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

// 브라우저에서는 모듈 캐시로 단일 인스턴스를 유지한다.
// 한 페이지에서 여러 컴포넌트가 createClient()를 호출해도 같은 인스턴스를 공유하므로,
// 같은 storageKey(sb-<ref>-auth-token)의 Navigator Lock을 두고 경합하지 않는다.
// (락 경합 시 10초 후 "Acquiring an exclusive Navigator LockManager lock ... timed out" 발생)
let browserClient: SupabaseClient | undefined

export function createClient() {
  if (typeof window === 'undefined') {
    return createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }
  if (!browserClient) {
    browserClient = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }
  return browserClient
}
