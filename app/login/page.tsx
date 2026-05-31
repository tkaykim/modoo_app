'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useAuthStore } from '@/store/useAuthStore'
import { AuthErrorKind } from '@/lib/auth-errors'
import { Mail, Lock, User, Phone, Eye, EyeOff, ArrowLeft } from 'lucide-react'

const LOGIN_RETURN_TO_KEY = 'login:returnTo'

function getSafeRedirectPath(value: string | null) {
  if (!value) return null
  if (!value.startsWith('/')) return null
  if (value.startsWith('//')) return null
  if (value.startsWith('/login')) return null
  return value
}

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [errorKind, setErrorKind] = useState<AuthErrorKind | null>(null)
  const [isSignUp, setIsSignUp] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()

  const { login, signUp, signInWithOAuth, isLoading } = useAuthStore()

  useEffect(() => {
    const errorParam = searchParams.get('error')
    if (errorParam === 'no_account') {
      setError('계정이 존재하지 않습니다. 먼저 회원가입을 진행해주세요.')
      setIsSignUp(true)
    }
  }, [searchParams])

  const handleGoogleLogin = async () => {
    setError(null)
    setErrorKind(null)
    const result = await signInWithOAuth('google', 'login')
    if (!result.success) {
      setError(result.error || '구글 로그인에 실패했습니다')
    }
  }

  const handleKakaoLogin = async () => {
    setError(null)
    setErrorKind(null)
    const result = await signInWithOAuth('kakao', 'login')
    if (!result.success) {
      setError(result.error || '카카오 로그인에 실패했습니다')
    }
  }

  const handleGoogleSignup = async () => {
    setError(null)
    setErrorKind(null)
    const result = await signInWithOAuth('google', 'signup')
    if (!result.success) {
      setError(result.error || '구글 회원가입에 실패했습니다')
    }
  }

  const handleKakaoSignup = async () => {
    setError(null)
    setErrorKind(null)
    const result = await signInWithOAuth('kakao', 'signup')
    if (!result.success) {
      setError(result.error || '카카오 회원가입에 실패했습니다')
    }
  }

  const loginFormRef = useRef<HTMLDivElement>(null)
  const signupFormRef = useRef<HTMLDivElement>(null)
  const [containerHeight, setContainerHeight] = useState<number | undefined>(undefined)

  useEffect(() => {
    const updateHeight = () => {
      const activeRef = isSignUp ? signupFormRef : loginFormRef
      if (activeRef.current) {
        setContainerHeight(activeRef.current.offsetHeight)
      }
    }
    updateHeight()
  }, [isSignUp, error])

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setErrorKind(null)

    try {
      if (isSignUp) {
        const result = await signUp(email, password, name, phoneNumber)

        if (!result.success) {
          setError(result.error || '회원가입에 실패했습니다')
          setErrorKind(result.errorKind ?? 'unknown')
          return
        }

        if (result.needsEmailConfirmation) {
          setError('이메일을 확인하여 인증을 완료해주세요!')
        } else {
          const redirectFromQuery = getSafeRedirectPath(searchParams.get('redirect'))
          const redirectFromSession = (() => {
            try {
              return getSafeRedirectPath(sessionStorage.getItem(LOGIN_RETURN_TO_KEY))
                  || getSafeRedirectPath(localStorage.getItem(LOGIN_RETURN_TO_KEY))
            } catch {
              return null
            }
          })()
          const redirectTo = redirectFromSession || redirectFromQuery || '/home'

          router.replace(redirectTo)
          router.refresh()

          try {
            sessionStorage.removeItem(LOGIN_RETURN_TO_KEY)
            localStorage.removeItem(LOGIN_RETURN_TO_KEY)
          } catch {
            // ignore
          }
        }
      } else {
        const result = await login(email, password)

        if (!result.success) {
          setError(result.error || '로그인에 실패했습니다')
          setErrorKind(result.errorKind ?? 'unknown')
          return
        }

        const redirectFromQuery = getSafeRedirectPath(searchParams.get('redirect'))
        const redirectFromSession = (() => {
          try {
            return getSafeRedirectPath(sessionStorage.getItem(LOGIN_RETURN_TO_KEY))
                || getSafeRedirectPath(localStorage.getItem(LOGIN_RETURN_TO_KEY))
          } catch {
            return null
          }
        })()
        const redirectTo = redirectFromSession || redirectFromQuery || '/home'

        router.replace(redirectTo)
        router.refresh()

        try {
          sessionStorage.removeItem(LOGIN_RETURN_TO_KEY)
          localStorage.removeItem(LOGIN_RETURN_TO_KEY)
        } catch {
          // ignore
        }
      }
    } catch (err) {
      const error = err as Error
      setError(error.message || '인증 중 오류가 발생했습니다')
    }
  }

  const switchTab = (toSignUp: boolean) => {
    setError(null)
    setErrorKind(null)
    setIsSignUp(toSignUp)
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4 py-8">
      <div className="max-w-[400px] w-full">
        {/* Logo with back link */}
        <div className="mb-6 flex items-center justify-center relative">
          <Link href="/" className="absolute left-0 flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors" aria-label="홈으로 돌아가기">
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>홈</span>
          </Link>
          <img src="/icons/modoo_logo.png" alt="MODOO Uniform" className="h-10" />
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-xl shadow-lg shadow-gray-200/60 overflow-hidden">
          {/* Tab Switcher */}
          <div className="flex bg-gray-50 p-1 m-4 mb-0 rounded-lg">
            <button
              type="button"
              onClick={() => switchTab(false)}
              className={`flex-1 py-2 text-xs font-semibold rounded-md transition-all duration-200 ${
                !isSignUp
                  ? 'bg-white text-[#0052CC] shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              로그인
            </button>
            <button
              type="button"
              onClick={() => switchTab(true)}
              className={`flex-1 py-2 text-xs font-semibold rounded-md transition-all duration-200 ${
                isSignUp
                  ? 'bg-white text-[#0052CC] shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              회원가입
            </button>
          </div>

          {/* Sliding Container */}
          <div
            className="overflow-hidden transition-[height] duration-300 ease-out"
            style={{ height: containerHeight ? `${containerHeight}px` : 'auto' }}
          >
            <div
              className={`flex transition-transform duration-300 ease-out ${
                isSignUp ? '-translate-x-1/2' : 'translate-x-0'
              }`}
              style={{ width: '200%' }}
            >
              {/* Login Form */}
              <div ref={loginFormRef} className="w-1/2 p-5 pt-4">
                <form className="space-y-3" onSubmit={handleAuth}>
                  <div>
                    <label htmlFor="login-email" className="block text-xs font-medium text-gray-600 mb-1">
                      이메일
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        id="login-email"
                        type="email"
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="block w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-lg placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-[#0052CC]/20 focus:border-[#0052CC] text-sm text-gray-900 transition-colors"
                        placeholder="example@email.com"
                        tabIndex={isSignUp ? -1 : 0}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label htmlFor="login-password" className="block text-xs font-medium text-gray-600">
                        비밀번호
                      </label>
                      <Link
                        href="/reset-password"
                        className="text-[11px] text-[#0052CC]/70 hover:text-[#0052CC] transition-colors"
                        tabIndex={isSignUp ? -1 : 0}
                      >
                        비밀번호 찾기
                      </Link>
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        id="login-password"
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="block w-full pl-9 pr-10 py-2.5 border border-gray-200 rounded-lg placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-[#0052CC]/20 focus:border-[#0052CC] text-sm text-gray-900 transition-colors"
                        placeholder="••••••••"
                        tabIndex={isSignUp ? -1 : 0}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                        tabIndex={isSignUp ? -1 : 0}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {error && !isSignUp && (
                    <div className={`text-xs p-2.5 rounded-lg flex flex-col gap-2 ${
                      error.includes('이메일을 확인')
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                        : 'bg-red-50 text-red-700 border border-red-100'
                    }`}>
                      <div className="flex items-start gap-2">
                        <span className="shrink-0 mt-0.5">{error.includes('이메일을 확인') ? '✓' : '!'}</span>
                        <p className="leading-relaxed">{error}</p>
                      </div>
                      {errorKind === 'invalid_credentials' && (
                        <div className="flex flex-wrap gap-2 pl-5">
                          <button
                            type="button"
                            onClick={() => switchTab(true)}
                            className="px-2.5 py-1 text-[11px] font-semibold bg-white border border-red-200 text-red-700 rounded hover:bg-red-100 transition"
                          >
                            회원가입 하러 가기
                          </button>
                          <Link
                            href="/reset-password"
                            className="px-2.5 py-1 text-[11px] font-semibold bg-white border border-red-200 text-red-700 rounded hover:bg-red-100 transition"
                          >
                            비밀번호 찾기
                          </Link>
                        </div>
                      )}
                      {errorKind === 'email_not_confirmed' && (
                        <p className="text-[11px] pl-5 text-red-600/80">
                          인증 메일이 안 보이시면 스팸함도 확인해주세요.
                        </p>
                      )}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isLoading || isSignUp}
                    className="w-full py-2.5 px-4 rounded-lg text-sm font-semibold text-white bg-[#0052CC] hover:bg-[#003D99] active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0052CC] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150"
                    tabIndex={isSignUp ? -1 : 0}
                  >
                    {isLoading && !isSignUp ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        처리중...
                      </span>
                    ) : '로그인'}
                  </button>

                  {/* Divider */}
                  <div className="relative my-4">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-gray-100"></div>
                    </div>
                    <div className="relative flex justify-center">
                      <span className="px-3 bg-white text-[11px] text-gray-400">간편 로그인</span>
                    </div>
                  </div>

                  {/* OAuth Buttons */}
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={handleGoogleLogin}
                      disabled={isLoading}
                      className="flex-1 py-2.5 px-3 rounded-lg text-xs font-medium text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-gray-200 disabled:opacity-50 flex items-center justify-center gap-2 transition-all"
                      tabIndex={isSignUp ? -1 : 0}
                    >
                      <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                      </svg>
                      Google
                    </button>

                    <button
                      type="button"
                      onClick={handleKakaoLogin}
                      disabled={isLoading}
                      className="flex-1 py-2.5 px-3 rounded-lg text-xs font-medium text-[#3C1E1E] bg-[#FEE500] hover:bg-[#FDD800] focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[#FEE500]/50 disabled:opacity-50 flex items-center justify-center gap-2 transition-all"
                      tabIndex={isSignUp ? -1 : 0}
                    >
                      <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="#3C1E1E">
                        <path d="M12 3C6.48 3 2 6.48 2 10.8c0 2.76 1.84 5.18 4.6 6.54-.2.76-.72 2.76-.82 3.19-.13.54.2.53.42.39.17-.11 2.72-1.85 3.83-2.6.64.09 1.29.13 1.97.13 5.52 0 10-3.48 10-7.8S17.52 3 12 3z"/>
                      </svg>
                      Kakao
                    </button>
                  </div>
                </form>
              </div>

              {/* Sign Up Form */}
              <div ref={signupFormRef} className="w-1/2 p-5 pt-4">
                <form className="space-y-3" onSubmit={handleAuth}>
                  <div>
                    <label htmlFor="signup-name" className="block text-xs font-medium text-gray-600 mb-1">
                      이름
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        id="signup-name"
                        type="text"
                        autoComplete="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="block w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-lg placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-[#0052CC]/20 focus:border-[#0052CC] text-sm text-gray-900 transition-colors"
                        placeholder="홍길동"
                        tabIndex={isSignUp ? 0 : -1}
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="signup-email" className="block text-xs font-medium text-gray-600 mb-1">
                      이메일
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        id="signup-email"
                        type="email"
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="block w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-lg placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-[#0052CC]/20 focus:border-[#0052CC] text-sm text-gray-900 transition-colors"
                        placeholder="example@email.com"
                        tabIndex={isSignUp ? 0 : -1}
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="signup-phone" className="block text-xs font-medium text-gray-600 mb-1">
                      전화번호
                    </label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        id="signup-phone"
                        type="tel"
                        autoComplete="tel"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value.replace(/[^0-9]/g, ''))}
                        className="block w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-lg placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-[#0052CC]/20 focus:border-[#0052CC] text-sm text-gray-900 transition-colors"
                        placeholder="01012345678"
                        tabIndex={isSignUp ? 0 : -1}
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="signup-password" className="block text-xs font-medium text-gray-600 mb-1">
                      비밀번호
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        id="signup-password"
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="new-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="block w-full pl-9 pr-10 py-2.5 border border-gray-200 rounded-lg placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-[#0052CC]/20 focus:border-[#0052CC] text-sm text-gray-900 transition-colors"
                        placeholder="6자 이상"
                        tabIndex={isSignUp ? 0 : -1}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                        tabIndex={isSignUp ? 0 : -1}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {error && isSignUp && (
                    <div className={`text-xs p-2.5 rounded-lg flex flex-col gap-2 ${
                      error.includes('이메일을 확인')
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                        : 'bg-red-50 text-red-700 border border-red-100'
                    }`}>
                      <div className="flex items-start gap-2">
                        <span className="shrink-0 mt-0.5">{error.includes('이메일을 확인') ? '✓' : '!'}</span>
                        <p className="leading-relaxed">{error}</p>
                      </div>
                      {errorKind === 'already_registered' && (
                        <div className="pl-5">
                          <button
                            type="button"
                            onClick={() => switchTab(false)}
                            className="px-2.5 py-1 text-[11px] font-semibold bg-white border border-red-200 text-red-700 rounded hover:bg-red-100 transition"
                          >
                            로그인 하러 가기
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isLoading || !isSignUp}
                    className="w-full py-2.5 px-4 rounded-lg text-sm font-semibold text-white bg-[#0052CC] hover:bg-[#003D99] active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0052CC] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150"
                    tabIndex={isSignUp ? 0 : -1}
                  >
                    {isLoading && isSignUp ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        처리중...
                      </span>
                    ) : '회원가입'}
                  </button>

                  {/* Divider */}
                  <div className="relative my-4">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-gray-100"></div>
                    </div>
                    <div className="relative flex justify-center">
                      <span className="px-3 bg-white text-[11px] text-gray-400">간편 회원가입</span>
                    </div>
                  </div>

                  {/* OAuth Signup Buttons */}
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={handleGoogleSignup}
                      disabled={isLoading}
                      className="flex-1 py-2.5 px-3 rounded-lg text-xs font-medium text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-gray-200 disabled:opacity-50 flex items-center justify-center gap-2 transition-all"
                      tabIndex={isSignUp ? 0 : -1}
                    >
                      <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                      </svg>
                      Google
                    </button>

                    <button
                      type="button"
                      onClick={handleKakaoSignup}
                      disabled={isLoading}
                      className="flex-1 py-2.5 px-3 rounded-lg text-xs font-medium text-[#3C1E1E] bg-[#FEE500] hover:bg-[#FDD800] focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[#FEE500]/50 disabled:opacity-50 flex items-center justify-center gap-2 transition-all"
                      tabIndex={isSignUp ? 0 : -1}
                    >
                      <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="#3C1E1E">
                        <path d="M12 3C6.48 3 2 6.48 2 10.8c0 2.76 1.84 5.18 4.6 6.54-.2.76-.72 2.76-.82 3.19-.13.54.2.53.42.39.17-.11 2.72-1.85 3.83-2.6.64.09 1.29.13 1.97.13 5.52 0 10-3.48 10-7.8S17.52 3 12 3z"/>
                      </svg>
                      Kakao
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-[11px] text-gray-400">
          계속 진행함으로써 이용약관 및 개인정보 처리방침에 동의합니다
        </p>
      </div>
    </div>
  )
}
