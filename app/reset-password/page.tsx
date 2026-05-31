'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useAuthStore } from '@/store/useAuthStore'
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react'

export default function ResetPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const { resetPasswordForEmail, isLoading } = useAuthStore()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!email) {
      setError('이메일을 입력해주세요.')
      return
    }

    const result = await resetPasswordForEmail(email)

    if (!result.success) {
      setError(result.error || '비밀번호 재설정 요청에 실패했습니다.')
      return
    }

    setSuccess(true)
  }

  if (success) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-4 py-8">
        <div className="max-w-[400px] w-full">
          <div className="mb-4">
            <Link href="/login" className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-[#0052CC] transition-colors">
              <ArrowLeft className="w-3.5 h-3.5" />
              로그인으로 돌아가기
            </Link>
          </div>

          <div className="text-center mb-6 flex items-center justify-center">
            <img src="/icons/modoo_logo.png" alt="MODOO Uniform" className="h-10" />
          </div>

          <div className="bg-white rounded-xl shadow-lg shadow-gray-200/60 p-5 text-center">
            <div className="w-10 h-10 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-3">
              <CheckCircle className="w-5 h-5 text-emerald-500" />
            </div>
            <h2 className="text-base font-bold text-gray-900 mb-1.5">이메일을 확인해주세요</h2>
            <p className="text-xs text-gray-500 leading-relaxed">
              <span className="font-medium text-gray-700">{email}</span>로<br />
              비밀번호 재설정 링크를 보냈습니다.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4 py-8">
      <div className="max-w-[400px] w-full">
        <div className="mb-4">
          <Link href="/login" className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-[#0052CC] transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" />
            로그인으로 돌아가기
          </Link>
        </div>

        <div className="text-center mb-6 flex items-center justify-center">
          <img src="/icons/modoo_logo.png" alt="MODOO Uniform" className="h-10" />
        </div>

        <div className="bg-white rounded-xl shadow-lg shadow-gray-200/60 p-5">
          <h2 className="text-center text-lg font-bold text-gray-900 mb-1">비밀번호 찾기</h2>
          <p className="text-center text-xs text-gray-500 mb-5">
            가입한 이메일 주소를 입력하시면 재설정 링크를 보내드립니다.
          </p>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label htmlFor="email" className="block text-xs font-medium text-gray-600 mb-1">
                이메일
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-lg placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-[#0052CC]/20 focus:border-[#0052CC] text-sm text-gray-900 transition-colors"
                  placeholder="example@email.com"
                />
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
              className="w-full py-2.5 px-4 rounded-lg text-sm font-semibold text-white bg-[#0052CC] hover:bg-[#003D99] active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0052CC] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  처리중...
                </span>
              ) : '재설정 링크 보내기'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
