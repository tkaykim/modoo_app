'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { User, Package, Heart, CreditCard, LogOut, ChevronRight, ShoppingBag, Shield, MessageSquare, Users, Star, Ticket } from 'lucide-react';
import Header from '@/app/components/Header';
import { useAuthStore } from '@/store/useAuthStore';
import { createClient } from '@/lib/supabase-client';

// Menu Items Data
type MenuItem = {
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  href: string;
  badge?: string | null;
};

const shoppingMenuItems: MenuItem[] = [
  { icon: Package, label: '주문 내역', href: '/home/my-page/orders', badge: null },
  { icon: ShoppingBag, label: '나의 디자인', href: '/home/designs', badge: null },
  { icon: Users, label: '공동구매', href: '/home/my-page/cobuy', badge: null },
  { icon: Ticket, label: '내 쿠폰', href: '/home/my-page/coupons', badge: null },
  { icon: Heart, label: '찜한 상품', href: '/home/designs?tab=favorites', badge: null },
  { icon: Star, label: '나의 후기', href: '/reviews/my', badge: null },
  // { icon: CreditCard, label: '결제 수단', href: '/home/my-page/payment', badge: null },
];

const supportMenuItems: MenuItem[] = [
  { icon: MessageSquare, label: '나의 문의', href: '/inquiries?tab=my', badge: null },
  { label: '공지사항', href: '/support/notices', badge: null },
  { label: '이용약관', href: '/policies', badge: null },
  { label: '개인정보 처리방침', href: '/support/privacy', badge: null },
];

export default function MyPage() {
  const router = useRouter();
  const { user, isAuthenticated, setUser, logout, setLoading } = useAuthStore();
  const [stats, setStats] = useState({
    orders: 0,
    designs: 0,
    favorites: 0,
    reviews: 0,
  });

  useEffect(() => {
    const checkAuth = async () => {
      setLoading(true);
      try {
        const supabase = createClient();
        const { data: { user: supabaseUser } } = await supabase.auth.getUser();

        if (supabaseUser) {
          // Fetch user profile with role
          const { data: profile } = await supabase
            .from('profiles')
            .select('name, role, email, phone_number')
            .eq('id', supabaseUser.id)
            .single();

          // Set user data from Supabase - prefer profile data over user_metadata
          setUser({
            id: supabaseUser.id,
            email: profile?.email || supabaseUser.email || '',
            name: profile?.name || supabaseUser.user_metadata?.name || supabaseUser.user_metadata?.full_name,
            avatar_url: supabaseUser.user_metadata?.avatar_url,
            phone: profile?.phone_number || supabaseUser.phone,
            role: profile?.role || 'customer',
          });
        } else {
          logout();
        }
      } catch (error) {
        console.error('Error checking auth:', error);
        logout();
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [setUser, logout, setLoading]);

  useEffect(() => {
    const fetchStats = async () => {
      if (!isAuthenticated || !user) {
        setStats({ orders: 0, designs: 0, favorites: 0, reviews: 0 });
        return;
      }

      const supabase = createClient();

      const [
        ordersResult,
        designsResult,
        favoritesResult,
        reviewsResult,
      ] = await Promise.all([
        supabase
          .from('orders')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id),
        supabase
          .from('saved_designs')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id),
        supabase
          .from('favorites')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id),
        supabase
          .from('reviews')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id),
      ]);

      if (ordersResult.error) {
        console.error('Failed to fetch order count:', ordersResult.error);
      }
      if (designsResult.error) {
        console.error('Failed to fetch design count:', designsResult.error);
      }
      if (favoritesResult.error) {
        console.error('Failed to fetch favorite count:', favoritesResult.error);
      }
      if (reviewsResult.error) {
        console.error('Failed to fetch review count:', reviewsResult.error);
      }

      setStats({
        orders: ordersResult.count || 0,
        designs: designsResult.count || 0,
        favorites: favoritesResult.count || 0,
        reviews: reviewsResult.count || 0,
      });
    };

    fetchStats();
  }, [isAuthenticated, user]);

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Desktop Header */}
      <div className="hidden md:block">
        <Header showHomeNav />
      </div>

      {/* Mobile Header */}
      <div className="md:hidden bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="flex items-center px-4 py-2.5">
          <h1 className="text-sm font-semibold text-gray-900">내정보</h1>
        </div>
      </div>

      {/* Profile Section */}
      <section className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-3 md:py-6">
          {isAuthenticated ? (
            <div className="flex items-center gap-4">
              {/* Profile Image */}
              <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center overflow-hidden">
                {user?.avatar_url ? (
                  <img src={user.avatar_url} alt={user.name || 'User'} className="w-full h-full object-cover" />
                ) : (
                  <User className="w-8 h-8 text-gray-500" />
                )}
              </div>

              {/* User Info */}
              <div className="flex-1">
                <h2 className="text-base font-bold text-gray-900 md:text-xl">{user?.name || '사용자'}</h2>
                <p className="text-sm text-gray-500">{user?.email}</p>
              </div>

            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-gray-900 mb-0.5 md:text-lg md:mb-1">로그인이 필요합니다</h2>
                <p className="text-xs text-gray-500 md:text-sm">로그인하고 더 많은 기능을 이용하세요</p>
              </div>
              <Link
                href="/login"
                className="shrink-0 px-4 py-1.5 bg-[#3B55A5] text-white text-sm rounded-lg font-medium hover:bg-[#2D4280] transition-colors md:px-6 md:py-2"
              >
                로그인
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* Quick Stats */}
      {isAuthenticated && (
        <section className="bg-white border-b border-gray-200 mb-2">
          <div className="max-w-7xl mx-auto px-4 py-3 md:py-4">
            <div className="grid grid-cols-4 gap-2 md:gap-4">
              <Link href="/home/my-page/orders" className="flex flex-col items-center gap-1">
                <div className="text-base font-bold text-gray-900 md:text-xl">{stats.orders}</div>
                <div className="text-xs text-gray-500">주문</div>
              </Link>
              <Link href="/home/designs" className="flex flex-col items-center gap-1">
                <div className="text-base font-bold text-gray-900 md:text-xl">{stats.designs}</div>
                <div className="text-xs text-gray-500">디자인</div>
              </Link>
              <Link href="/home/designs?tab=favorites" className="flex flex-col items-center gap-1">
                <div className="text-base font-bold text-gray-900 md:text-xl">{stats.favorites}</div>
                <div className="text-xs text-gray-500">찜</div>
              </Link>
              <Link href="/reviews/my" className="flex flex-col items-center gap-1">
                <div className="text-base font-bold text-gray-900 md:text-xl">{stats.reviews}</div>
                <div className="text-xs text-gray-500">후기</div>
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Menu Sections */}
      <div>

        {/* Shopping Section */}
        <section className="bg-white">
          <div className="max-w-7xl mx-auto px-4 py-2">
            <h3 className="text-sm font-semibold text-gray-500 mb-2 px-2">쇼핑</h3>
            <MenuList items={shoppingMenuItems} />
          </div>
        </section>

        {/* Support Section */}
        <section className="bg-white border-t border-gray-100">
          <div className="max-w-7xl mx-auto px-4 py-2">
            <h3 className="text-sm font-semibold text-gray-500 mb-2 px-2">고객센터</h3>
            <MenuList items={supportMenuItems} />
          </div>
        </section>

        {/* Logout Button (Only show if logged in) */}
        {isAuthenticated && (
          <section className="bg-white border-t border-gray-100">
            <div className="max-w-7xl mx-auto px-4 py-2">
              <button
                onClick={async () => {
                  const supabase = createClient();
                  await supabase.auth.signOut();
                  logout();
                  router.push('/login');
                }}
                className="w-full flex items-center gap-3 px-2 py-2.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                <LogOut className="w-5 h-5" />
                <span className="flex-1 text-left text-sm font-medium md:text-base">로그아웃</span>
              </button>
            </div>
          </section>
        )}
      </div>

      {/* App Version */}
      <div className="mt-4 text-center pb-4 md:mt-8">
        <p className="text-xs text-gray-400">버전 1.0.0</p>
      </div>
    </div>
  );
}

// Menu List Component
function MenuList({ items }: { items: MenuItem[] }) {
  return (
    <div className="space-y-1">
      {items.map((item, index) => (
        <Link
          key={index}
          href={item.href}
          className="flex items-center gap-3 px-2 py-2.5 hover:bg-gray-50 rounded-lg transition-colors"
        >
          {item.icon && <item.icon className="w-5 h-5 text-gray-600" />}
          <span className="flex-1 text-sm text-gray-900 md:text-base">{item.label}</span>
          {item.badge && (
            <span className="px-2 py-0.5 bg-red-500 text-white text-xs rounded-full">
              {item.badge}
            </span>
          )}
          <ChevronRight className="w-5 h-5 text-gray-400" />
        </Link>
      ))}
    </div>
  );
}
