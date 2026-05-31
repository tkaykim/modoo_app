import { createBrowserClient } from '@supabase/ssr'
import { processLock } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'

// 브라우저에서는 모듈 캐시로 단일 인스턴스를 유지한다.
// 한 페이지에서 여러 컴포넌트가 createClient()를 호출해도 같은 인스턴스를 공유하므로,
// 같은 storageKey(sb-<ref>-auth-token)의 Navigator Lock을 두고 경합하지 않는다.
let browserClient: SupabaseClient | undefined

// 기본 락(navigatorLock)은 origin 전역 Web Locks API를 쓴다. 모바일 크롬은 백그라운드 탭을
// freeze 시키는데, 얼어붙은 탭이 auth-token 락을 쥔 채 반납하지 못하면 다른 탭의 클라이언트가
// 10초간 락을 기다리다 "Acquiring an exclusive Navigator LockManager lock ... timed out"으로
// 실패하고, 그 사이 모든 DB 쿼리가 멈춰 배너/문의게시판 등이 로딩되지 않는다.
// (시크릿탭/데스크탑은 경합 자체가 없어 정상)
//
// processLock은 navigator.locks 대신 JS 컨텍스트 내부(in-memory)에서 직렬화한다.
// → 같은 탭 안에서는 auth 동작이 정상적으로 직렬화되어 동시성 레이스가 없고,
//   탭 사이에는 락을 공유하지 않으므로 얼어붙은 백그라운드 탭이 이 탭을 막을 수 없다.
const authOptions = { lock: processLock } as const

export function createClient() {
  if (typeof window === 'undefined') {
    return createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: authOptions }
    )
  }
  if (!browserClient) {
    browserClient = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: authOptions }
    )
  }
  return browserClient
}
