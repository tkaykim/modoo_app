import Link from 'next/link'

export default function AuthCodeErrorPage() {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4 py-8">
      <div className="max-w-md w-full text-center">
        <div className="text-center mb-8 flex items-center justify-center">
          <img src="/icons/modoo_logo.png" alt="MODOO Uniform" />
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h2 className="text-xl font-bold text-red-800 mb-2">인증 오류</h2>
          <p className="text-red-700 mb-4">
            인증 과정에서 오류가 발생했습니다.
            링크가 만료되었거나 유효하지 않을 수 있습니다.
          </p>
          <div className="space-y-2">
            <Link
              href="/login"
              className="inline-block w-full py-2 px-4 rounded-md text-sm font-semibold text-white bg-brand hover:bg-brand-deep"
            >
              로그인으로 돌아가기
            </Link>
            <Link
              href="/reset-password"
              className="inline-block w-full py-2 px-4 rounded-md text-sm font-semibold text-brand border border-brand hover:bg-brand/5"
            >
              비밀번호 재설정 다시 요청
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
