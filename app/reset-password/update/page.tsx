'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuthStore } from '@/store/useAuthStore'
import { createClient } from '@/lib/supabase-client'
import { Lock, Eye, EyeOff, CheckCircle, AlertCircle } from 'lucide-react'

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isValidSession, setIsValidSession] = useState<boolean | null>(null)
  const router = useRouter()
  const { updatePassword, isLoading } = useAuthStore()

  useEffect(() => {
    const checkSession = async () => {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()

      if (session) {
        setIsValidSession(true)
      } else {
        setIsValidSession(false)
      }
    }

    checkSession()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!password || !confirmPassword) {
      setError('모든 필드를 입력해주세요.')
      return
    }

    if (password.length < 6) {
      setError('비밀번호는 최소 6자 이상이어야 합니다.')
      return
    }

    if (password !== confirmPassword) {
      setError('비밀번호가 일치하지 않습니다.')
      return
    }

    const result = await updatePassword(password)

    if (!result.success) {
      setError(result.error || '비밀번호 변경에 실패했습니다.')
      return
    }

    setSuccess(true)

    // 재설정 링크로 들어온 시점에 이미 인증된 세션이므로, 다시 로그인을 시키지 않고
    // 홈으로 보낸다. (불필요한 재로그인 단계 제거)
    setTimeout(() => {
      router.push('/home')
      router.refresh()
    }, 2500)
  }

  if (isValidSession === null) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="animate-spin w-7 h-7 border-[3px] border-gray-200 border-t-brand rounded-full"></div>
      </div>
    )
  }

  if (isValidSession === false) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-4 py-8">
        <div className="max-w-[400px] w-full text-center">
          <div className="text-center mb-6 flex items-center justify-center">
            <img src="/icons/modoo_logo.png" alt="MODOO Uniform" className="h-10" />
          </div>
          <div className="bg-white rounded-xl shadow-lg shadow-gray-200/60 p-5">
            <div className="w-10 h-10 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-3">
              <AlertCircle className="w-5 h-5 text-red-500" />
            </div>
            <h2 className="text-base font-bold text-gray-900 mb-1.5">유효하지 않은 링크</h2>
            <p className="text-xs text-gray-500 mb-4">
              비밀번호 재설정 링크가 만료되었거나 유효하지 않습니다.
            </p>
            <Link
              href="/reset-password"
              className="inline-block py-2 px-4 rounded-lg text-xs font-semibold text-white bg-brand hover:bg-brand-deep active:scale-[0.98] transition-all duration-150"
            >
              다시 요청하기
            </Link>
          </div>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-4 py-8">
        <div className="max-w-[400px] w-full text-center">
          <div className="text-center mb-6 flex items-center justify-center">
            <img src="/icons/modoo_logo.png" alt="MODOO Uniform" className="h-10" />
          </div>
          <div className="bg-white rounded-xl shadow-lg shadow-gray-200/60 p-5">
            <div className="w-10 h-10 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-3">
              <CheckCircle className="w-5 h-5 text-emerald-500" />
            </div>
            <h2 className="text-base font-bold text-gray-900 mb-1.5">비밀번호가 변경되었습니다</h2>
            <p className="text-xs text-gray-500">
              비밀번호가 설정되었습니다.<br />
              잠시 후 홈으로 이동합니다...
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4 py-8">
      <div className="max-w-[400px] w-full">
        <div className="text-center mb-6 flex items-center justify-center">
          <img src="/icons/modoo_logo.png" alt="MODOO Uniform" className="h-10" />
        </div>

        <div className="bg-white rounded-xl shadow-lg shadow-gray-200/60 p-5">
          <h2 className="text-center text-lg font-bold text-gray-900 mb-1">새 비밀번호 설정</h2>
          <p className="text-center text-xs text-gray-500 mb-5">
            새로운 비밀번호를 입력해주세요.
          </p>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label htmlFor="password" className="block text-xs font-medium text-gray-600 mb-1">
                새 비밀번호
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-9 pr-10 py-2.5 border border-gray-200 rounded-lg placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand text-sm text-gray-900 transition-colors"
                  placeholder="최소 6자 이상"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-xs font-medium text-gray-600 mb-1">
                비밀번호 확인
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="block w-full pl-9 pr-10 py-2.5 border border-gray-200 rounded-lg placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand text-sm text-gray-900 transition-colors"
                  placeholder="비밀번호를 다시 입력해주세요"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="text-xs p-2.5 rounded-lg bg-red-50 text-red-700 border border-red-100 flex items-start gap-2">
                <span className="shrink-0 mt-0.5">!</span>
                <p>{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 px-4 rounded-lg text-sm font-semibold text-white bg-brand hover:bg-brand-deep active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  처리중...
                </span>
              ) : '비밀번호 변경'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
