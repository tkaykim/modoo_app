'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Ticket, ArrowLeft, AlertCircle, Check, Clock, X } from 'lucide-react';
import Header from '@/app/components/Header';
import { useAuthStore } from '@/store/useAuthStore';
import { registerCoupon, getUserCoupons, getCouponDisplayInfo } from '@/lib/couponService';
import { CouponUsage } from '@/types/types';

type TabType = 'register' | 'my-coupons';

export default function CouponsPage() {
  const router = useRouter();
  const { isAuthenticated, user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<TabType>('my-coupons');
  const [coupons, setCoupons] = useState<CouponUsage[]>([]);
  const [loading, setLoading] = useState(true);
  const [couponCode, setCouponCode] = useState('');
  const [registering, setRegistering] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchCoupons = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      const userCoupons = await getUserCoupons();
      setCoupons(userCoupons);
    } catch (error) {
      console.error('Error fetching coupons:', error);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchCoupons();
    }
  }, [isAuthenticated, fetchCoupons]);

  const handleRegisterCoupon = async () => {
    if (!couponCode.trim()) {
      setMessage({ type: 'error', text: '쿠폰 코드를 입력해주세요.' });
      return;
    }

    setRegistering(true);
    setMessage(null);

    const result = await registerCoupon(couponCode);

    if (result.valid) {
      setMessage({ type: 'success', text: '쿠폰이 등록되었습니다!' });
      setCouponCode('');
      // Refresh coupon list
      await fetchCoupons();
      // Switch to my-coupons tab
      setActiveTab('my-coupons');
    } else {
      setMessage({ type: 'error', text: result.error || '쿠폰 등록에 실패했습니다.' });
    }

    setRegistering(false);
  };

  const isExhausted = (usage: CouponUsage): boolean => {
    const coupon = usage.coupon;
    const perUser = coupon?.max_uses_per_user ?? null;
    const exhaustedPerUser = perUser !== null && usage.uses_count >= perUser;
    const exhaustedGlobal =
      coupon?.max_uses != null && coupon.current_uses >= coupon.max_uses;
    return exhaustedPerUser || exhaustedGlobal;
  };

  const getCouponStatus = (usage: CouponUsage): { label: string; color: string; icon: React.ReactNode } => {
    if (isExhausted(usage)) {
      return {
        label: '사용완료',
        color: 'bg-gray-100 text-gray-500',
        icon: <Check className="w-2.5 h-2.5" />,
      };
    }
    if (usage.expires_at && new Date(usage.expires_at) < new Date()) {
      return {
        label: '만료',
        color: 'bg-red-50 text-red-500',
        icon: <X className="w-2.5 h-2.5" />,
      };
    }
    return {
      label: '사용가능',
      color: 'bg-green-50 text-green-600',
      icon: <Ticket className="w-2.5 h-2.5" />,
    };
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return `${date.getFullYear()}.${date.getMonth() + 1}.${date.getDate()}`;
  };

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-4">
        <Ticket className="w-12 h-12 text-gray-300 mb-3" />
        <h2 className="text-sm font-medium text-gray-900 mb-1">로그인이 필요합니다</h2>
        <p className="text-xs text-gray-500 mb-4">쿠폰을 확인하려면 로그인해주세요.</p>
        <button
          onClick={() => router.push('/login')}
          className="px-4 py-2 bg-black text-white text-xs rounded-lg font-medium hover:bg-gray-800 transition-colors"
        >
          로그인
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pb-20">
      {/* Header */}
      <div className="hidden md:block">
        <Header showHomeNav />
      </div>

      {/* Mobile Header */}
      <div className="md:hidden bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="flex items-center px-4 py-3">
          <button onClick={() => router.back()} className="p-1 -ml-1 mr-2">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <h1 className="text-sm font-semibold text-gray-900">내 쿠폰</h1>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-lg mx-auto">
        {/* Tabs */}
        <div className="bg-white border-b border-gray-100">
          <div className="flex">
            <button
              onClick={() => setActiveTab('my-coupons')}
              className={`flex-1 py-2.5 text-xs font-medium text-center border-b-2 transition-colors ${
                activeTab === 'my-coupons'
                  ? 'border-black text-black'
                  : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              내 쿠폰
            </button>
            <button
              onClick={() => setActiveTab('register')}
              className={`flex-1 py-2.5 text-xs font-medium text-center border-b-2 transition-colors ${
                activeTab === 'register'
                  ? 'border-black text-black'
                  : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              쿠폰 등록
            </button>
          </div>
        </div>

        {/* Message */}
        {message && (
          <div
            className={`mx-3 mt-3 p-2.5 rounded-lg flex items-center gap-2 ${
              message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
            }`}
          >
            {message.type === 'success' ? (
              <Check className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span className="text-xs">{message.text}</span>
          </div>
        )}

        {/* Register Tab */}
        {activeTab === 'register' && (
          <div className="p-3">
            <div className="bg-white rounded-lg p-3 border border-gray-100">
              <h2 className="text-sm font-medium text-gray-900 mb-3">쿠폰 코드 등록</h2>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                  placeholder="쿠폰 코드 입력"
                  className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-1 focus:ring-black focus:border-black outline-none"
                  onKeyDown={(e) => e.key === 'Enter' && handleRegisterCoupon()}
                />
                <button
                  onClick={handleRegisterCoupon}
                  disabled={registering || !couponCode.trim()}
                  className="px-4 py-2 bg-black text-white text-xs rounded-lg font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {registering ? '...' : '등록'}
                </button>
              </div>
              <p className="mt-2 text-xs text-gray-400">
                쿠폰 코드를 입력하고 등록 버튼을 눌러주세요.
              </p>
            </div>
          </div>
        )}

        {/* My Coupons Tab */}
        {activeTab === 'my-coupons' && (
          <div className="p-3 space-y-2">
            {loading ? (
              <div className="flex items-center justify-center py-10">
                <div className="w-6 h-6 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : coupons.length === 0 ? (
              <div className="text-center py-10">
                <Ticket className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <h3 className="text-sm font-medium text-gray-900 mb-1">등록된 쿠폰이 없습니다</h3>
                <p className="text-xs text-gray-400 mb-3">쿠폰 코드를 등록해 보세요!</p>
                <button
                  onClick={() => setActiveTab('register')}
                  className="px-4 py-2 bg-black text-white text-xs rounded-lg font-medium hover:bg-gray-800 transition-colors"
                >
                  쿠폰 등록하기
                </button>
              </div>
            ) : (
              coupons.map((usage) => {
                const coupon = usage.coupon;
                if (!coupon) return null;

                const status = getCouponStatus(usage);
                const displayInfo = getCouponDisplayInfo(coupon);
                const isInactive = isExhausted(usage) || (usage.expires_at && new Date(usage.expires_at) < new Date());

                return (
                  <div
                    key={usage.id}
                    className={`bg-white rounded-lg overflow-hidden border ${
                      isInactive
                        ? 'border-gray-100 opacity-50'
                        : 'border-gray-200'
                    }`}
                  >
                    <div className="p-3">
                      {/* Header */}
                      <div className="flex items-start justify-between mb-1.5">
                        <div className="min-w-0 flex-1">
                          <h3 className="text-xs font-medium text-gray-900 truncate">
                            {coupon.display_name || coupon.code}
                          </h3>
                          {coupon.display_name && (
                            <p className="text-[10px] font-mono text-gray-400 mt-0.5">{coupon.code}</p>
                          )}
                        </div>
                        <span
                          className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium shrink-0 ml-2 ${status.color}`}
                        >
                          {status.icon}
                          {status.label}
                        </span>
                      </div>

                      {/* Discount */}
                      <div className="text-base font-bold text-black mb-1.5">
                        {displayInfo.discountText}
                      </div>

                      {/* Info */}
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-gray-400">
                        {displayInfo.minOrderText && (
                          <span>{displayInfo.minOrderText}</span>
                        )}
                        <span className="flex items-center gap-0.5">
                          <Clock className="w-3 h-3" />
                          {usage.expires_at
                            ? `${formatDate(usage.expires_at)}까지`
                            : displayInfo.expiryText}
                        </span>
                      </div>

                      {/* Used info — 다회 사용 쿠폰은 사용 횟수, 단회는 사용완료일 */}
                      {usage.uses_count > 0 && (
                        <p className="mt-1.5 text-[10px] text-gray-400">
                          {coupon.max_uses_per_user === null
                            ? `${usage.uses_count}회 사용`
                            : coupon.max_uses_per_user > 1
                              ? `${usage.uses_count}/${coupon.max_uses_per_user}회 사용`
                              : `${formatDate(usage.used_at)} 사용완료`}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
