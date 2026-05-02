// Pure types + helpers — safe to import from client components.
// No next/headers, no server-only deps.

export interface V2CatalogProduct {
  id: string;
  title: string;
  thumbnail: string | null;
  price: number;
  originalPrice: number | null;
  category: string | null;
  manufacturerName: string | null;
  colorCount: number;
  reviewCount: number;
  isBest: boolean;
  isNew: boolean;
  isHot: boolean;
}

export interface V2Category {
  key: string;
  name: string;
  icon: string | null;
}

export interface V2ProductDetail {
  id: string;
  title: string;
  manufacturerName: string | null;
  description: string | null;
  category: string | null;
  basePrice: number;
  thumbnails: string[];
  primaryImage: string | null;
  productCode: string | null;
  sizes: { label: string; size_code: string }[];
  colors: { id: string; name: string; hex: string }[];
  discountTiers: { min_quantity: number; discount_rate: number }[];
  rating: number | null;
  reviewCount: number;
  totalSold: number;
}

export interface V2OrderSummary {
  id: string;
  orderName: string | null;
  totalAmount: number;
  totalQuantity: number;
  orderStatus: string;
  createdAt: string;
  customerName: string;
  customerPhone: string;
  shippingAddress: string;
  estimatedDelivery: string | null;
  items: {
    id: string;
    productTitle: string;
    quantity: number;
    pricePerItem: number;
    thumbnailUrl: string | null;
  }[];
}

export interface V2UserStats {
  orders: number;
  designs: number;
  coupons: number;
  reviews: number;
}

export interface V2SavedDesign {
  id: string;
  title: string;
  preview: string | null;
  productId: string;
  updatedAt: string;
}

export interface V2UserProfile {
  id: string;
  name: string;
  email: string;
  role: string | null;
  initials: string;
}

export interface V2HomeData {
  user: V2UserProfile | null;
  featuredProducts: V2CatalogProduct[];
  categories: V2Category[];
  ongoingOrder: V2OrderSummary | null;
}

const ORDER_STATUS_LABELS: Record<string, string> = {
  payment_pending: "결제대기",
  payment_completed: "결제완료",
  in_production: "제작중",
  shipping: "배송중",
  delivered: "배송완료",
  cancelled: "취소",
  partially_cancelled: "부분취소",
};

export function getOrderStatusLabel(status: string): string {
  return ORDER_STATUS_LABELS[status] ?? status;
}

export function getOrderStageIndex(status: string): number {
  if (status === "payment_pending") return 0;
  if (status === "payment_completed") return 1;
  if (status === "in_production") return 2;
  if (status === "shipping") return 3;
  if (status === "delivered") return 4;
  return 0;
}
