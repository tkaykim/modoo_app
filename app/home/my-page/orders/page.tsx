'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/app/components/Header';
import { createClient } from '@/lib/supabase-client';
import { useAuthStore } from '@/store/useAuthStore';
import { Package } from 'lucide-react';
import { formatKstDateNumeric } from '@/lib/kst';

type OrderItem = {
  id: string;
  product_id: string;
  product_title: string | null;
  quantity: number | null;
  thumbnail_url: string | null;
};

type Order = {
  id: string;
  created_at: string;
  order_status: string | null;
  payment_status: string | null;
  total_amount: number | null;
  order_items?: OrderItem[];
};

const statusMap: Record<string, { label: string; className: string }> = {
  payment_pending: { label: '결제대기', className: 'bg-amber-100 text-amber-800' },
  payment_completed: { label: '결제완료', className: 'bg-blue-100 text-blue-800' },
  in_production: { label: '제작중', className: 'bg-yellow-100 text-yellow-800' },
  shipping: { label: '배송중', className: 'bg-indigo-100 text-indigo-800' },
  delivered: { label: '배송완료', className: 'bg-green-100 text-green-800' },
  cancelled: { label: '취소', className: 'bg-red-100 text-red-800' },
  partially_cancelled: { label: '부분취소', className: 'bg-red-100 text-red-800' },
};

export default function OrdersPage() {
  const router = useRouter();
  const { isAuthenticated, user } = useAuthStore();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reviewOrder, setReviewOrder] = useState<Order | null>(null);

  useEffect(() => {
    const fetchOrders = async () => {
      setIsLoading(true);
      setError(null);

      const supabase = createClient();
      const { data: { user: supabaseUser } } = await supabase.auth.getUser();
      const userId = supabaseUser?.id || user?.id;

      if (!userId) {
        setIsLoading(false);
        return;
      }

      const { data, error: fetchError } = await supabase
        .from('orders')
        .select('id, created_at, order_status, payment_status, total_amount, order_items(id, product_id, product_title, quantity, thumbnail_url)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (fetchError) {
        console.error('Failed to fetch orders:', fetchError);
        setError('주문 내역을 불러오는데 실패했습니다.');
        setIsLoading(false);
        return;
      }

      setOrders((data || []) as Order[]);
      setIsLoading(false);
    };

    fetchOrders();
  }, [user?.id]);

  const orderCount = useMemo(() => orders.length, [orders.length]);

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <Header back />

      <div className="max-w-4xl mx-auto p-4">
        {!isAuthenticated ? (
          <div className="text-center py-20">
            <p className="text-gray-500 mb-4">로그인이 필요합니다</p>
            <p className="text-sm text-gray-400 mb-6">
              주문 내역을 확인하려면 로그인해주세요
            </p>
            <button
              onClick={() => router.push('/login')}
              className="px-6 py-3 bg-black text-white rounded-lg font-medium hover:bg-gray-800 transition-colors"
            >
              로그인하기
            </button>
          </div>
        ) : isLoading ? (
          <div className="text-center py-20">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]" />
            <p className="text-gray-500 mt-4">주문 내역을 불러오는 중...</p>
          </div>
        ) : error ? (
          <div className="text-center py-20">
            <p className="text-red-500 mb-4">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-black text-white rounded-lg font-medium hover:bg-gray-800 transition-colors"
            >
              다시 시도
            </button>
          </div>
        ) : orderCount === 0 ? (
          <div className="text-center py-20">
            <Package className="w-16 h-16 mx-auto mb-4 text-gray-400" />
            <p className="text-gray-500 mb-4">주문 내역이 없습니다</p>
            <p className="text-sm text-gray-400 mb-6">
              마음에 드는 상품을 담아 주문해보세요
            </p>
            <button
              onClick={() => router.push('/home')}
              className="px-6 py-3 bg-[#3B55A5] text-white rounded-lg font-medium hover:bg-[#2D4280] transition-colors"
            >
              쇼핑하러 가기
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => {
              const statusKey = (order.order_status || 'payment_completed').toLowerCase();
              const status = statusMap[statusKey] || statusMap.payment_completed;
              const itemCount = order.order_items?.length || 0;
              const totalQuantity = order.order_items?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0;
              const formattedDate = formatKstDateNumeric(order.created_at);
              const formattedTotal = (order.total_amount || 0).toLocaleString('ko-KR');

              return (
                <div
                  key={order.id}
                  className="bg-white rounded-lg border border-gray-200 p-3 cursor-pointer hover:border-gray-300 transition-colors"
                  onClick={() => router.push(`/order/${order.id}`)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="min-w-0 flex-1 mr-2">
                      <p className="text-xs text-gray-500">주문번호</p>
                      <p className="text-xs font-medium text-gray-900 truncate">{order.id}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium shrink-0 ${status.className}`}>
                      {status.label}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs text-gray-600 mb-2">
                    <span>{formattedDate}</span>
                    <span>총 {formattedTotal}원</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex -space-x-2">
                      {(order.order_items || []).slice(0, 3).map((item) => (
                        <div
                          key={item.id}
                          className="w-9 h-9 rounded-md border border-gray-200 bg-gray-100 overflow-hidden"
                        >
                          {item.thumbnail_url ? (
                            <img
                              src={item.thumbnail_url}
                              alt={item.product_title || '주문 상품'}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[10px] text-gray-400">
                              없음
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    <div className="text-xs text-gray-700 min-w-0">
                      {itemCount > 0 ? (
                        <span className="line-clamp-1">
                          {order.order_items?.[0]?.product_title || '주문 상품'}
                          {itemCount > 1 ? ` 외 ${itemCount - 1}건` : ''}
                          <span className="ml-1 text-gray-500">({totalQuantity}개)</span>
                        </span>
                      ) : (
                        <span>주문 상품 없음</span>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setReviewOrder(order);
                    }}
                    disabled={itemCount === 0}
                    className="mt-3 w-full py-2 rounded-md border border-gray-300 text-xs font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50"
                  >
                    리뷰 작성하기
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {reviewOrder && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setReviewOrder(null)}
          />
          <div className="relative pb-25 w-full md:max-w-lg bg-white rounded-t-2xl md:rounded-2xl p-4 md:p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-gray-900">상품 선택</h2>
              <button
                onClick={() => setReviewOrder(null)}
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                닫기
              </button>
            </div>

            <p className="text-sm text-gray-500 mb-4">
              리뷰를 작성할 상품을 선택해주세요.
            </p>

            <div className="space-y-2 max-h-[60vh] overflow-auto">
              {(reviewOrder.order_items || []).map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    const params = new URLSearchParams({
                      productId: item.product_id,
                      orderId: reviewOrder.id,
                    });
                    router.push(`/reviews/my/create?${params.toString()}`);
                  }}
                  className="w-full flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 text-left"
                >
                  <div className="w-12 h-12 rounded-md border border-gray-200 bg-gray-100 overflow-hidden shrink-0">
                    {item.thumbnail_url ? (
                      <img
                        src={item.thumbnail_url}
                        alt={item.product_title || '주문 상품'}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">
                        없음
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900">
                      {item.product_title || '주문 상품'}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      수량: {item.quantity || 0}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
