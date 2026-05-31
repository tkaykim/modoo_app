
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CircleUser, LayoutTemplate, PanelRightDashedIcon, PencilLine, PersonStanding, PlusCircle, Search } from 'lucide-react';
import CartButton from './CartButton';
import { BsPerson } from 'react-icons/bs';

type NavItem = {
  id: string;
  label: string;
  href: string;
  icon: React.ReactNode;
};

export default function BottomNavBar() {
  const pathname = usePathname();

  // Hide bottom nav on full-screen pages
  if (pathname?.startsWith('/home/cobuy/create') || pathname?.startsWith('/home/cobuy/request/create')) {
    return null;
  }

  const navItems: NavItem[] = [
    {
      id: 'home',
      label: '홈',
      href: '/home',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
    },
    {
      id: 'search',
      label: '검색',
      href: '/home/search',
      icon: (
        <Search size={20} />
      ),
    },
    {
      id: 'designs',
      label: '내 디자인',
      href: '/home/designs',
      icon: (
        <PencilLine size={20} />
      ),
    },
    {
      id: 'mypage',
      label: '내정보',
      href: '/home/my-page',
      icon: (
        <CircleUser size={20} />
      ),
    },
  ];

  // Helper function to check if a nav item is active
  const isActive = (href: string) => {
    if (href === '/home') {
      return pathname === '/home';
    }
    return pathname?.startsWith(href);
  };

  return (
    <nav className="w-full fixed bottom-0 left-0 bg-white border-t border-gray-200 shadow-lg z-50 rounded-t-xl pb-3 lg:hidden">
      <div className="max-w-7xl mx-auto px-2">
        <div className="flex items-center justify-around h-16">
          {navItems.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              className={`flex flex-col items-center justify-center flex-1 h-full transition-all duration-200 active:scale-95 ${
                isActive(item.href)
                  ? 'text-[#0052CC]'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <div className={`relative transition-transform duration-200 ${
                isActive(item.href) ? 'scale-110' : 'scale-100'
              }`}>
                {item.icon}
              </div>
              <span className={`text-[10px] mt-0.5 font-medium transition-all duration-200 ${
                isActive(item.href) ? 'font-semibold' : ''
              }`}>{item.label}</span>
            </Link>
          ))}

          {/* Cart button using CartButton component */}
          <div
            className="flex flex-col items-center justify-center flex-1 h-full transition-all duration-200 active:scale-95 text-gray-600 hover:text-gray-900"
          >
            <div className="transition-transform duration-200 hover:scale-110">
              <CartButton />
            </div>
            <span className="text-[10px] mt-0.5 font-medium">장바구니</span>
          </div>
        </div>
      </div>
    </nav>
  );
}
