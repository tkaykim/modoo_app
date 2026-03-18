'use client'
import { ArrowLeft, User } from "lucide-react";
import CartButton from "./CartButton";
import { useRouter } from "next/navigation";
import Link from "next/link";


export default function Header({
  back = false,
  backHref,
  showHomeNav = false,
}: {
  back?: boolean;
  backHref?: string;
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
                      <button className="" onClick={() => router.back()}>
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
                  <Link href="/home/designs" className="hover:text-black transition">내 디자인</Link>
                  <Link href="/home/my-page" className="hover:text-black transition">내정보</Link>
                </nav>
              )}

              {/* Shopping card button */}
              {showHomeNav ? (
                <div className="hidden lg:flex items-center justify-end gap-4 text-gray-600 lg:w-48">
                  <CartButton />
                  <Link href="/home/my-page" className="hover:text-black transition" aria-label="내 정보">
                    <User className="size-5" />
                  </Link>
                </div>
              ) : (
                <div className="hidden lg:flex items-center justify-end gap-4 text-gray-600 lg:w-48">
                  <CartButton />
                </div>
              )}
            </div>
          </div>
        </div>
      </header>
  )
}
