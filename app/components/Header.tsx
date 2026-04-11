'use client'
import { ArrowLeft } from "lucide-react";
import CartButton from "./CartButton";
import { useRouter } from "next/navigation";
import Link from "next/link";


export default function Header({
  back = false,
  backHref,
  onBack,
  showHomeNav = false,
}: {
  back?: boolean;
  backHref?: string;
  onBack?: () => void;
  showHomeNav?: boolean;
}) {
  const router = useRouter()

  return (
    <header className="bg-white/70 backdrop-blur-md shadow-sm lg:shadow-none sticky top-0 z-50 border-b border-white/40">
        <div className="max-w-7xl mx-auto px-2 sm:px-3 lg:px-0">
          <div className="flex flex-col">
            <div className="flex items-center justify-between h-11 sm:h-14 lg:h-16 gap-2 sm:gap-4">
              {/* If back is enabled show the back button instead */}
              <div className="flex items-center lg:w-48">
                {
                  back ? (
                    backHref ? (
                      <Link href={backHref}>
                        <ArrowLeft className="text-gray-700 size-5 sm:size-6"/>
                      </Link>
                    ) : (
                      <button className="" onClick={onBack || (() => router.back())}>
                        <ArrowLeft className="text-gray-700 size-5 sm:size-6"/>
                      </button>
                    )
                  ) :
                    (showHomeNav ? (
                      <Link
                        href="/home"
                        className="text-lg font-black tracking-[0.18em] text-gray-900"
                        aria-label="MODOO 홈"
                      >
                        <img src="/icons/modoo_logo.png" alt="모두의 유니폼"  className="w-15 sm:w-20"/>
                      </Link>
                    ) : (
                      <button className="size-6">
                        {/* <Menu className="text-gray-700 size-6"/> */}
                      </button>
                    ))
                }
              </div>

              {/* Logo / Placeholder */}
              {!showHomeNav && (
                <Link
                  href="/home"
                  className="text-lg font-black tracking-[0.18em] text-gray-900"
                  aria-label="MODOO 홈"
                >
                  <img src="/icons/modoo_logo.png" alt="모두의 유니폼"  className="w-15 sm:w-20"/>
                </Link>
              )}

              {showHomeNav && (
                <nav className="hidden lg:flex flex-1 items-center justify-center gap-8 text-base font-semibold text-gray-700">
                  <Link href="/home" className="hover:text-black transition">홈</Link>
                  <Link href="/home/search" className="hover:text-black transition">검색</Link>
                  <Link href="/support/guides" className="hover:text-black transition">제작가이드</Link>
                  <Link href="/inquiries/new" className="hover:text-black transition">문의하기</Link>
                  <Link href="/home/my-page" className="hover:text-black transition">내정보</Link>
                </nav>
              )}

              {/* 모바일: 제작가이드/문의하기 버튼 (lg 미만에서만 표시) */}
              {showHomeNav && (
                <div className="flex lg:hidden items-center gap-1.5">
                  <Link
                    href="/support/guides"
                    className="px-2.5 py-1 rounded-full border border-gray-300 text-xs font-semibold text-gray-700 hover:bg-gray-100 transition-colors"
                  >
                    제작가이드
                  </Link>
                  <Link
                    href="/inquiries/new"
                    className="px-2.5 py-1 rounded-full border border-blue-500 bg-blue-500 text-xs font-semibold text-white hover:bg-blue-600 transition-colors"
                  >
                    문의하기
                  </Link>
                </div>
              )}

              {/* Shopping card button */}
              <div className="hidden lg:flex items-center justify-end gap-4 text-gray-600 lg:w-48">
                <CartButton />
              </div>
            </div>
          </div>
        </div>
      </header>
  )
}
