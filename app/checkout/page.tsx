'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Script from 'next/script';
import Header from '@/app/components/Header';
import {
  getCartItemsWithDesigns,
  type CartItemWithDesign
} from '@/lib/cartService';
import {
  getAvailableCoupons,
  registerCoupon,
  validateCouponForOrder,
  calculateCouponDiscount,
  getCouponDisplayInfo,
} from '@/lib/couponService';
import TossPaymentWidget from '../components/toss/TossPaymentWidget';
import { useAuthStore } from '@/store/useAuthStore';
import { generateOrderId } from '@/lib/orderIdUtils';
import { CouponUsage } from '@/types/types';
import { Ticket, ChevronDown, ChevronUp, X, Check, AlertCircle } from 'lucide-react';

type ShippingMethod = 'domestic' | 'international' | 'pickup';
type PaymentMethod = 'toss' | 'paypal';

interface CustomerInfo {
  name: string;
  email: string;
  phone: string;
}

interface DomesticAddress {
  roadAddress: string;
  jibunAddress: string;
  detailAddress: string;
  postalCode: string;
}

interface InternationalAddress {
  country: string;
  postalCode: string;
  state: string;
  city: string;
  addressLine1: string;
  addressLine2: string;
}

export default function CheckoutPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  const [items, setItems] = useState<CartItemWithDesign[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [shippingMethod, setShippingMethod] = useState<ShippingMethod>('domestic');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('toss');
  const [tossWidgetKey, setTossWidgetKey] = useState(0);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo>({
    name: '',
    email: '',
    phone: '',
  });

  const [domesticAddress, setDomesticAddress] = useState<DomesticAddress>({
    roadAddress: '',
    jibunAddress: '',
    detailAddress: '',
    postalCode: '',
  });

  const [internationalAddress, setInternationalAddress] = useState<InternationalAddress>({
    country: '',
    postalCode: '',
    state: '',
    city: '',
    addressLine1: '',
    addressLine2: '',
  });

  // Coupon state
  const [availableCoupons, setAvailableCoupons] = useState<CouponUsage[]>([]);
  const [selectedCoupon, setSelectedCoupon] = useState<CouponUsage | null>(null);
  const [couponCode, setCouponCode] = useState('');
  const [couponMessage, setCouponMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [showCouponList, setShowCouponList] = useState(false);

  // Group items by design for display
  const groupedItems = items.reduce<Array<{
    id: string;
    product_id: string;
    saved_design_id?: string;
    product_title: string;
    designName?: string;
    thumbnail_url?: string;
    price_per_item: number;
    variants: Array<{
      product_color: string;
      product_color_name: string;
      size_id: string;
      size_name: string;
      quantity: number;
    }>;
    totalQuantity: number;
  }>>((acc, item) => {
    const groupKey = item.saved_design_id || item.product_id;
    const existingGroup = acc.find(g =>
      (g.saved_design_id && g.saved_design_id === item.saved_design_id) ||
      (!g.saved_design_id && g.product_id === item.product_id)
    );

    if (existingGroup) {
      // Add variant to existing group
      existingGroup.variants.push({
        product_color: item.product_color,
        product_color_name: item.product_color_name,
        size_id: item.size_id,
        size_name: item.size_name,
        quantity: item.quantity,
      });
      existingGroup.totalQuantity += item.quantity;
    } else {
      // Create new group
      acc.push({
        id: groupKey,
        product_id: item.product_id,
        saved_design_id: item.saved_design_id,
        product_title: item.product_title,
        designName: item.designName,
        thumbnail_url: item.thumbnail_url,
        price_per_item: item.price_per_item,
        variants: [{
          product_color: item.product_color,
          product_color_name: item.product_color_name,
          size_id: item.size_id,
          size_name: item.size_name,
          quantity: item.quantity,
        }],
        totalQuantity: item.quantity,
      });
    }

    return acc;
  }, []);

  // Generate unique order ID and order name
  const { orderId, orderName } = useMemo(() => {
    const id = generateOrderId();

    // Create order name from grouped items
    const firstItemName = groupedItems[0]?.designName || groupedItems[0]?.product_title || '주문 상품';
    const name = groupedItems.length > 1
      ? `${firstItemName} 외 ${groupedItems.length - 1}건`
      : firstItemName;

    return { orderId: id, orderName: name };
  }, [groupedItems]);

  // Fetch cart items (filtered to direct checkout items if applicable)
  useEffect(() => {
    const fetchCartItems = async () => {
      setIsLoading(true);
      try {
        let cartItems = await getCartItemsWithDesigns();

        // If direct checkout, filter to only the specific items
        const directIdsRaw = sessionStorage.getItem('directCheckoutItemIds');
        if (directIdsRaw) {
          sessionStorage.removeItem('directCheckoutItemIds');
          const directIds: string[] = JSON.parse(directIdsRaw);
          cartItems = cartItems.filter(item => directIds.includes(item.id!));
        }

        if (cartItems.length === 0) {
          router.push('/cart');
          return;
        }
        setItems(cartItems);
      } catch (error) {
        console.error('Error fetching cart items:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCartItems();
  }, [router]);

  // Fetch available coupons
  const fetchCoupons = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const coupons = await getAvailableCoupons();
      setAvailableCoupons(coupons);
    } catch (error) {
      console.error('Error fetching coupons:', error);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchCoupons();
    }
  }, [isAuthenticated, fetchCoupons]);

  // Auto-fill customer info from user profile when authenticated
  useEffect(() => {
    if (isAuthenticated && user) {
      setCustomerInfo({
        name: user.name || '',
        email: user.email || '',
        phone: user.phone || '',
      });
    }
  }, [isAuthenticated, user]);

  // Calculate totals
  const totalPrice = items.reduce((total, item) => total + item.price_per_item * item.quantity, 0);
  const deliveryFee = shippingMethod === 'pickup' ? 0 : shippingMethod === 'domestic' ? 3000 : 5000;
  const couponDiscount = selectedCoupon ? calculateCouponDiscount(selectedCoupon, totalPrice) : 0;
  const finalTotal = totalPrice + deliveryFee - couponDiscount;

  // Open Daum Address API
  const handleAddressSearch = () => {
    new (window as any).daum.Postcode({
      oncomplete: function(data: any) {
        setDomesticAddress({
          roadAddress: data.roadAddress,
          jibunAddress: data.jibunAddress,
          detailAddress: '',
          postalCode: data.zonecode,
        });
      }
    }).open();
  };

  // Coupon handlers
  const handleRegisterCoupon = async () => {
    if (!couponCode.trim()) {
      setCouponMessage({ type: 'error', text: '쿠폰 코드를 입력해주세요.' });
      return;
    }
    setCouponLoading(true);
    setCouponMessage(null);

    const result = await registerCoupon(couponCode);

    if (result.valid && result.couponUsage) {
      setCouponMessage({ type: 'success', text: '쿠폰이 등록되었습니다!' });
      setCouponCode('');
      await fetchCoupons();
      // Auto-select the newly registered coupon
      setSelectedCoupon(result.couponUsage);
      setShowCouponList(false);
    } else {
      setCouponMessage({ type: 'error', text: result.error || '쿠폰 등록에 실패했습니다.' });
    }

    setCouponLoading(false);
  };

  const handleSelectCoupon = (couponUsage: CouponUsage) => {
    const validation = validateCouponForOrder(couponUsage, totalPrice);
    if (validation.valid) {
      setSelectedCoupon(couponUsage);
      setCouponMessage(null);
      setShowCouponList(false);
    } else {
      setCouponMessage({ type: 'error', text: validation.error || '쿠폰을 사용할 수 없습니다.' });
    }
  };

  const handleRemoveCoupon = () => {
    setSelectedCoupon(null);
    setCouponMessage(null);
  };

  const handlePayPalPayment = () => {
    // Validate customer info
    if (!customerInfo.name || !customerInfo.email || !customerInfo.phone) {
      alert('고객 정보를 모두 입력해주세요.');
      return;
    }

    // Validate address based on shipping method
    if (shippingMethod === 'domestic') {
      if (!domesticAddress.roadAddress || !domesticAddress.detailAddress) {
        alert('배송 주소를 입력해주세요.');
        return;
      }
    } else if (shippingMethod === 'international') {
      if (!internationalAddress.country || !internationalAddress.city || !internationalAddress.addressLine1) {
        alert('배송 주소를 입력해주세요.');
        return;
      }
    }

    // TODO: Implement PayPal payment logic
    alert('PayPal 결제 기능은 준비 중입니다.');
  };

  // Callback to save order data before payment request
  const handleBeforePaymentRequest = () => {
    // Prepare full address string (legacy field for backward compatibility)
    const fullAddress = shippingMethod !== 'pickup'
      ? shippingMethod === 'domestic'
        ? `[${domesticAddress.postalCode}] ${domesticAddress.roadAddress} ${domesticAddress.detailAddress}`.trim()
        : `${internationalAddress.addressLine1} ${internationalAddress.addressLine2}`.trim()
      : null;

    // Prepare order data to be used after payment confirmation
    const orderData = {
      id: orderId,
      name: customerInfo.name,
      email: customerInfo.email,
      phone_num: customerInfo.phone,
      address: fullAddress,
      country_code: shippingMethod === 'international' ? internationalAddress.country : null,
      state: shippingMethod === 'international' ? internationalAddress.state : null,
      city: shippingMethod === 'international' ? internationalAddress.city : null,
      postal_code: shippingMethod !== 'pickup'
        ? (shippingMethod === 'domestic' ? domesticAddress.postalCode : internationalAddress.postalCode)
        : null,
      address_line_1: shippingMethod !== 'pickup'
        ? (shippingMethod === 'domestic' ? domesticAddress.roadAddress : internationalAddress.addressLine1)
        : null,
      address_line_2: shippingMethod !== 'pickup'
        ? (shippingMethod === 'domestic' ? domesticAddress.detailAddress : internationalAddress.addressLine2)
        : null,
      shipping_method: shippingMethod,
      delivery_fee: deliveryFee,
      total_amount: finalTotal,
      // Coupon data
      coupon_usage_id: selectedCoupon?.id || null,
      coupon_discount: couponDiscount,
    };

    // Store in sessionStorage for use in success page
    sessionStorage.setItem('pendingTossOrder', JSON.stringify({
      orderData,
      cartItems: items
    }));

    console.log('Order data stored for Toss payment:', orderData);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header back={true} />
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-gray-200 border-t-black rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Daum Postcode API */}
      <Script
        src="//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js"
        strategy="lazyOnload"
      />

      <div className="min-h-screen bg-gray-50 pb-32">
        {/* Header */}
        <div className="sticky top-0 bg-white z-50 border-b border-gray-200">
          <Header back={true} />
        </div>

      {/* Page Title */}
      {/* <div className="bg-white px-4 py-4 border-b border-gray-200">
        <h1 className="text-xl font-bold text-black">주문서</h1>
      </div> */}

      {/* Order Summary */}
      <div className="bg-white mt-2 p-4">
        <h2 className="font-medium text-black mb-3">주문 상품 ({groupedItems.length})</h2>
        <div className="space-y-3">
          {groupedItems.map((group) => (
            <div key={group.id} className="flex gap-3 pb-3 border-b border-gray-100 last:border-0">
              <div className="w-16 h-16 bg-gray-100 rounded-lg shrink-0 overflow-hidden">
                {group.thumbnail_url ? (
                  <img
                    src={group.thumbnail_url}
                    alt={group.product_title}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <div
                      className="w-12 h-12 rounded"
                      style={{ backgroundColor: group.variants[0].product_color }}
                    />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-medium text-black truncate">
                  {group.designName || group.product_title}
                </h3>
                {/* Show all variants */}
                <div className="mt-1 space-y-0.5">
                  {group.variants.map((variant, idx) => (
                    <p key={idx} className="text-xs text-gray-500">
                      {variant.product_color_name} / {variant.size_name} - {variant.quantity}개
                    </p>
                  ))}
                </div>
                <div className="flex justify-between items-center mt-1">
                  <span className="text-xs text-gray-600">총 {group.totalQuantity}개</span>
                  <span className="text-sm font-medium text-black">
                    {(group.price_per_item * group.totalQuantity).toLocaleString('ko-KR')}원
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Customer Information */}
      <div className="bg-white mt-2 p-4">
        <h2 className="font-medium text-black mb-4">주문자 정보</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-sm text-gray-700 mb-1">이름 <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={customerInfo.name}
              onChange={(e) => setCustomerInfo({ ...customerInfo, name: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-black focus:outline-none focus:ring-2 focus:ring-black"
              placeholder="이름을 입력하세요"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1">이메일 <span className="text-red-500">*</span></label>
            <input
              type="email"
              value={customerInfo.email}
              onChange={(e) => setCustomerInfo({ ...customerInfo, email: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-black focus:outline-none focus:ring-2 focus:ring-black"
              placeholder="example@email.com"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1">휴대폰 번호 <span className="text-red-500">*</span></label>
            <input
              type="tel"
              value={customerInfo.phone}
              onChange={(e) => setCustomerInfo({ ...customerInfo, phone: e.target.value.replace(/[^0-9]/g, '') })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-black focus:outline-none focus:ring-2 focus:ring-black"
              placeholder="01012345678"
            />
          </div>
        </div>
      </div>

      {/* Shipping Method */}
      <div className="bg-white mt-2 p-4 text-sm">
        <h2 className="font-medium text-black mb-4">배송 방법</h2>
        <div className="space-y-2">
          <button
            onClick={() => setShippingMethod('domestic')}
            className={`w-full p-4 rounded-lg border-2 transition text-left ${
              shippingMethod === 'domestic'
                ? 'border-black bg-gray-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-black">국내배송</p>
                <p className="text-xs text-gray-500 mt-1">배송비 3,000원</p>
              </div>
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                shippingMethod === 'domestic' ? 'border-black' : 'border-gray-300'
              }`}>
                {shippingMethod === 'domestic' && (
                  <div className="w-3 h-3 rounded-full bg-black"></div>
                )}
              </div>
            </div>
          </button>

          <button
            onClick={() => setShippingMethod('international')}
            className={`w-full p-4 rounded-lg border-2 transition text-left ${
              shippingMethod === 'international'
                ? 'border-black bg-gray-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-black">해외배송</p>
                <p className="text-xs text-gray-500 mt-1">배송비 15,000원</p>
              </div>
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                shippingMethod === 'international' ? 'border-black' : 'border-gray-300'
              }`}>
                {shippingMethod === 'international' && (
                  <div className="w-3 h-3 rounded-full bg-black"></div>
                )}
              </div>
            </div>
          </button>

          <button
            onClick={() => setShippingMethod('pickup')}
            className={`w-full p-4 rounded-lg border-2 transition text-left ${
              shippingMethod === 'pickup'
                ? 'border-black bg-gray-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-black">직접 픽업하기</p>
                <p className="text-xs text-gray-500 mt-1">배송비 무료</p>
              </div>
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                shippingMethod === 'pickup' ? 'border-black' : 'border-gray-300'
              }`}>
                {shippingMethod === 'pickup' && (
                  <div className="w-3 h-3 rounded-full bg-black"></div>
                )}
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* Address Input - Domestic */}
      {shippingMethod === 'domestic' && (
        <div className="bg-white mt-2 p-4 text-sm">
          <h2 className="font-medium text-black mb-4">배송지 정보<span className='text-red-500'>*</span></h2>
          <div className="space-y-3">
            <div>
              {/* <label className="block text-sm text-gray-700 mb-1">주소</label> */}
              <div className="flex gap-2">
                <button
                  onClick={handleAddressSearch}
                  className="w-full px-4 py-2.5 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition font-medium"
                >
                  주소 검색
                </button>
                <input
                  type="text"
                  value={domesticAddress.postalCode}
                  readOnly
                  className="px-4 py-2.5 border border-gray-300 rounded-lg text-black bg-gray-50"
                  placeholder="우편번호"
                />
              </div>
            </div>
            {domesticAddress.roadAddress && (
              <div className='flex flex-col gap-2'>
                <input
                  type="text"
                  value={domesticAddress.roadAddress}
                  readOnly
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-black bg-gray-100"
                  placeholder="도로명 주소"
                />
                <input
                  type="text"
                  value={domesticAddress.jibunAddress}
                  readOnly
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-black bg-gray-100"
                  placeholder="지번 주소"
                />
                <label className='text-xs'>상세 주소</label>
                <input
                  type="text"
                  value={domesticAddress.detailAddress}
                  onChange={(e) => setDomesticAddress({ ...domesticAddress, detailAddress: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-black focus:outline-none focus:ring-2 focus:ring-black"
                  placeholder="상세 주소 입력"
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Address Input - International */}
      {shippingMethod === 'international' && (
        <div className="bg-white mt-2 p-4">
          <h2 className="font-medium text-black mb-4">배송지 정보</h2>
          <div className="space-y-3">
            <div>
              <label className="block text-sm text-gray-700 mb-1">Country</label>
              <input
                type="text"
                value={internationalAddress.country}
                onChange={(e) => setInternationalAddress({ ...internationalAddress, country: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-black focus:outline-none focus:ring-2 focus:ring-black"
                placeholder="Enter country"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-gray-700 mb-1">Postal Code</label>
                <input
                  type="text"
                  value={internationalAddress.postalCode}
                  onChange={(e) => setInternationalAddress({ ...internationalAddress, postalCode: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-black focus:outline-none focus:ring-2 focus:ring-black"
                  placeholder="12345"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1">State</label>
                <input
                  type="text"
                  value={internationalAddress.state}
                  onChange={(e) => setInternationalAddress({ ...internationalAddress, state: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-black focus:outline-none focus:ring-2 focus:ring-black"
                  placeholder="CA"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">City</label>
              <input
                type="text"
                value={internationalAddress.city}
                onChange={(e) => setInternationalAddress({ ...internationalAddress, city: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-black focus:outline-none focus:ring-2 focus:ring-black"
                placeholder="Los Angeles"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">Address Line 1</label>
              <input
                type="text"
                value={internationalAddress.addressLine1}
                onChange={(e) => setInternationalAddress({ ...internationalAddress, addressLine1: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-black focus:outline-none focus:ring-2 focus:ring-black"
                placeholder="Street address"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">Address Line 2</label>
              <input
                type="text"
                value={internationalAddress.addressLine2}
                onChange={(e) => setInternationalAddress({ ...internationalAddress, addressLine2: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-black focus:outline-none focus:ring-2 focus:ring-black"
                placeholder="Apt, suite, etc. (optional)"
              />
            </div>
          </div>
        </div>
      )}

      {/* Pickup Information */}
      {shippingMethod === 'pickup' && (
        <div className="bg-white mt-2 p-4">
          <h2 className="font-medium text-black mb-3">픽업 안내</h2>
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm text-gray-700 mb-2">
              <strong>픽업 장소:</strong> 서울특별시 마포구 성지3길 55, 4층
            </p>
            <p className="text-sm text-gray-700 mb-2">
              <strong>운영 시간:</strong> 평일 10:00 ~ 18:00 (점심시간 12:00 ~ 13:00)
            </p>
            <p className="text-sm text-gray-500">
              주문 완료 후 영업일 기준 3-5일 후 픽업 가능합니다. 주말/공휴일 휴무
            </p>
          </div>
        </div>
      )}

      {/* Coupon Section - Only show for authenticated users */}
      {isAuthenticated && (
        <div className="bg-white mt-2 p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-medium text-black">쿠폰</h2>
            {availableCoupons.length > 0 && (
              <span className="text-sm text-gray-500">보유 {availableCoupons.length}장</span>
            )}
          </div>

          {/* Coupon Selection - Radio style */}
          <div className="space-y-2">
            {/* No Coupon Option */}
            <button
              onClick={handleRemoveCoupon}
              className={`w-full p-3 rounded-lg border-2 text-left transition ${
                !selectedCoupon
                  ? 'border-black bg-gray-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-black">쿠폰 사용 안함</span>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                  !selectedCoupon ? 'border-black' : 'border-gray-300'
                }`}>
                  {!selectedCoupon && (
                    <div className="w-3 h-3 rounded-full bg-black"></div>
                  )}
                </div>
              </div>
            </button>

            {/* Available Coupons */}
            {availableCoupons.map((couponUsage) => {
              const coupon = couponUsage.coupon;
              if (!coupon) return null;
              const displayInfo = getCouponDisplayInfo(coupon);
              const validation = validateCouponForOrder(couponUsage, totalPrice);
              const isDisabled = !validation.valid;
              const isSelected = selectedCoupon?.id === couponUsage.id;
              const discountAmount = isSelected ? couponDiscount : calculateCouponDiscount(couponUsage, totalPrice);

              return (
                <button
                  key={couponUsage.id}
                  onClick={() => !isDisabled && handleSelectCoupon(couponUsage)}
                  disabled={isDisabled}
                  className={`w-full p-3 rounded-lg border-2 text-left transition ${
                    isDisabled
                      ? 'border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed'
                      : isSelected
                        ? 'border-[#3B55A5] bg-[#3B55A5]/5'
                        : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Ticket className={`w-4 h-4 shrink-0 ${isSelected ? 'text-[#3B55A5]' : 'text-gray-400'}`} />
                        <p className="font-medium text-black text-sm truncate">
                          {coupon.display_name || coupon.code}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <p className={`font-bold text-sm ${isSelected ? 'text-[#3B55A5]' : 'text-gray-700'}`}>
                          {displayInfo.discountText}
                        </p>
                        {!isDisabled && (
                          <span className="text-xs text-red-500 font-medium">
                            (-{discountAmount.toLocaleString()}원)
                          </span>
                        )}
                      </div>
                      {displayInfo.minOrderText && (
                        <p className="text-xs text-gray-500 mt-1">
                          {displayInfo.minOrderText}
                        </p>
                      )}
                      {isDisabled && validation.error && (
                        <p className="text-xs text-red-500 mt-1">{validation.error}</p>
                      )}
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      isSelected ? 'border-[#3B55A5]' : 'border-gray-300'
                    }`}>
                      {isSelected && (
                        <div className="w-3 h-3 rounded-full bg-[#3B55A5]"></div>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Register New Coupon */}
          <div className="mt-4 pt-4 border-t border-gray-200">
            <button
              onClick={() => setShowCouponList(!showCouponList)}
              className="w-full flex items-center justify-between py-2 text-sm text-gray-600 hover:text-black"
            >
              <span>쿠폰 코드 등록하기</span>
              {showCouponList ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>

            {showCouponList && (
              <div className="mt-2 flex gap-2">
                <input
                  type="text"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                  placeholder="쿠폰 코드 입력"
                  className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-black focus:outline-none focus:ring-2 focus:ring-[#3B55A5]"
                  onKeyDown={(e) => e.key === 'Enter' && handleRegisterCoupon()}
                />
                <button
                  onClick={handleRegisterCoupon}
                  disabled={couponLoading || !couponCode.trim()}
                  className="px-4 py-2.5 bg-gray-800 text-white rounded-lg font-medium hover:bg-gray-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {couponLoading ? '...' : '등록'}
                </button>
              </div>
            )}
          </div>

          {/* Coupon Message */}
          {couponMessage && (
            <div
              className={`mt-3 p-2 rounded-lg flex items-center gap-2 text-sm ${
                couponMessage.type === 'success'
                  ? 'bg-green-50 text-green-700'
                  : 'bg-red-50 text-red-700'
              }`}
            >
              {couponMessage.type === 'success' ? (
                <Check className="w-4 h-4 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0" />
              )}
              {couponMessage.text}
            </div>
          )}
        </div>
      )}

      {/* Payment Summary */}
      <div className="bg-white mt-2 p-4">
        <h2 className="font-medium text-black mb-3">결제 금액</h2>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">상품 금액</span>
            <span className="text-black">{totalPrice.toLocaleString('ko-KR')}원</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">배송비</span>
            <span className="text-black">{deliveryFee.toLocaleString('ko-KR')}원</span>
          </div>
          {couponDiscount > 0 && (
            <div className="flex justify-between text-sm p-2 -mx-2 bg-blue-50 rounded-lg">
              <span className="text-blue-600 font-medium flex items-center gap-1">
                쿠폰 할인
              </span>
              <span className="text-blue-600 font-bold">-{couponDiscount.toLocaleString('ko-KR')}원</span>
            </div>
          )}
          <div className="h-px bg-gray-200 my-3"></div>
          <div className="flex justify-between items-center">
            <span className="font-medium text-black">총 결제금액</span>
            <div className="text-right">
              {couponDiscount > 0 && (
                <span className="text-sm text-gray-400 line-through mr-2">
                  {(totalPrice + deliveryFee).toLocaleString('ko-KR')}원
                </span>
              )}
              <span className={`text-xl font-bold ${couponDiscount > 0 ? 'text-[#3B55A5]' : 'text-black'}`}>
                {finalTotal.toLocaleString('ko-KR')}원
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Payment Method Section */}
      <div className="bg-white mt-2 p-4">
        <h2 className="font-medium text-black mb-4">결제 수단</h2>
        <div className="space-y-2">
          <button
            onClick={() => {
              if (paymentMethod !== 'toss') {
                setTossWidgetKey(prev => prev + 1);
              }
              setPaymentMethod('toss');
            }}
            className={`w-full p-4 rounded-lg border-2 transition text-left ${
              paymentMethod === 'toss'
                ? 'border-black bg-gray-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#3B55A5] rounded-lg flex items-center justify-center text-white font-bold text-sm">
                  토스
                </div>
                <div>
                  <p className="font-medium text-black">간편결제</p>
                  <p className="text-xs text-gray-500 mt-1">토스페이먼츠로 간편하게 결제</p>
                </div>
              </div>
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                paymentMethod === 'toss' ? 'border-black' : 'border-gray-300'
              }`}>
                {paymentMethod === 'toss' && (
                  <div className="w-3 h-3 rounded-full bg-black"></div>
                )}
              </div>
            </div>
          </button>

          {/* <button
            onClick={() => setPaymentMethod('paypal')}
            className={`w-full p-4 rounded-lg border-2 transition text-left ${
              paymentMethod === 'paypal'
                ? 'border-black bg-gray-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#0070ba] rounded-lg flex items-center justify-center text-white font-bold text-xs">
                  PP
                </div>
                <div>
                  <p className="font-medium text-black">PayPal</p>
                  <p className="text-xs text-gray-500 mt-1">페이팔로 안전하게 결제</p>
                </div>
              </div>
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                paymentMethod === 'paypal' ? 'border-black' : 'border-gray-300'
              }`}>
                {paymentMethod === 'paypal' && (
                  <div className="w-3 h-3 rounded-full bg-black"></div>
                )}
              </div>
            </div>
          </button> */}
        </div>
      </div>

      {/* Toss Payment Widget - Only show when Toss is selected */}
      {paymentMethod === 'toss' && (
        <div className='w-full px-4 bg-white '>
          <TossPaymentWidget
            key={tossWidgetKey}
            amount={finalTotal}
            orderId={orderId}
            orderName={orderName}
            customerEmail={customerInfo.email}
            customerName={customerInfo.name}
            customerMobilePhone={customerInfo.phone}
            successUrl={typeof window !== 'undefined' ? window.location.origin + "/toss/success" : "/toss/success"}
            failUrl={typeof window !== 'undefined' ? window.location.origin + "/toss/fail" : "/toss/fail"}
            enableCoupon={false}
            onReady={() => console.log("Toss payment widget ready")}
            onError={(error) => {
              console.error("Toss payment error:", error);
              alert(`결제 위젯 오류: ${error.message}`);
            }}
            onBeforePaymentRequest={handleBeforePaymentRequest}
          />
        </div>
      )}

      {/* Bottom Fixed Bar - Only show for PayPal */}
      {paymentMethod === 'paypal' && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 pb-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs text-gray-500">총 결제금액</p>
              <p className="text-lg font-bold text-black">
                {finalTotal.toLocaleString('ko-KR')}원
              </p>
            </div>
            <button
              onClick={handlePayPalPayment}
              className="flex-1 max-w-xs px-8 py-3 bg-black text-white rounded-lg font-medium hover:bg-gray-800 transition"
            >
              결제하기
            </button>
          </div>
        </div>
      )}
    </div>
    </>
  );
}