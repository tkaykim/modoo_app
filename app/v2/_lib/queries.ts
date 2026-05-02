import "server-only";
import { unstable_cache } from "next/cache";
import { createAnonClient } from "@/lib/supabase";
import { createClient as createServerClient } from "@/lib/supabase";
import type { Product, Review } from "@/types/types";
import type {
  V2CatalogProduct,
  V2Category,
  V2ProductDetail,
  V2OrderSummary,
  V2UserStats,
  V2SavedDesign,
  V2UserProfile,
  V2HomeData,
} from "./types";
export type {
  V2CatalogProduct,
  V2Category,
  V2ProductDetail,
  V2OrderSummary,
  V2UserStats,
  V2SavedDesign,
  V2UserProfile,
  V2HomeData,
};
export { getOrderStatusLabel, getOrderStageIndex } from "./types";

const NEW_DAYS = 14;

export const getV2CatalogProducts = unstable_cache(
  async (): Promise<V2CatalogProduct[]> => {
    const supabase = createAnonClient();
    const [productsRes, reviewsRes, colorsRes] = await Promise.all([
      supabase
        .from("products")
        .select(
          "id, title, thumbnail_image_link, base_price, discount_rates, category, is_featured, created_at, manufacturers(name)"
        )
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false })
        .limit(60),
      supabase.from("reviews").select("product_id"),
      supabase.from("product_colors").select("product_id").eq("is_active", true),
    ]);

    type ProductRow = {
      id: string;
      title: string;
      thumbnail_image_link: string[] | null;
      base_price: number;
      discount_rates: { min_quantity: number; discount_rate: number }[] | null;
      category: string | null;
      is_featured: boolean | null;
      created_at: string;
      manufacturers?: { name: string } | { name: string }[] | null;
    };

    const reviewCounts: Record<string, number> = {};
    for (const r of reviewsRes.data ?? []) {
      const pid = (r as { product_id: string }).product_id;
      reviewCounts[pid] = (reviewCounts[pid] || 0) + 1;
    }
    const colorCounts: Record<string, number> = {};
    for (const c of colorsRes.data ?? []) {
      const pid = (c as { product_id: string }).product_id;
      colorCounts[pid] = (colorCounts[pid] || 0) + 1;
    }

    const cutoff = Date.now() - NEW_DAYS * 24 * 60 * 60 * 1000;

    return ((productsRes.data as ProductRow[] | null) ?? []).map((p) => {
      const reviewCount = reviewCounts[p.id] || 0;
      const tier = (p.discount_rates ?? []).reduce<{
        min_quantity: number;
        discount_rate: number;
      } | null>((acc, t) => {
        if (!acc || t.min_quantity < acc.min_quantity) return t;
        return acc;
      }, null);
      const discounted =
        tier && tier.discount_rate > 0
          ? Math.round(p.base_price * (1 - tier.discount_rate / 100))
          : null;
      const manuName = Array.isArray(p.manufacturers)
        ? p.manufacturers[0]?.name ?? null
        : p.manufacturers?.name ?? null;
      return {
        id: p.id,
        title: p.title,
        thumbnail: p.thumbnail_image_link?.[0] ?? null,
        price: discounted ?? p.base_price,
        originalPrice: discounted ? p.base_price : null,
        category: p.category,
        manufacturerName: manuName,
        colorCount: colorCounts[p.id] || 0,
        reviewCount,
        isBest: reviewCount >= 100 || !!p.is_featured,
        isNew: new Date(p.created_at).getTime() > cutoff,
        isHot: reviewCount >= 50 && reviewCount < 100,
      };
    });
  },
  ["v2-catalog-products"],
  { revalidate: 60, tags: ["products"] }
);

export const getV2Categories = unstable_cache(
  async (): Promise<V2Category[]> => {
    const supabase = createAnonClient();
    const { data } = await supabase
      .from("product_categories")
      .select("key, name, icon")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });
    return (data ?? []) as V2Category[];
  },
  ["v2-categories"],
  { revalidate: 300, tags: ["categories"] }
);

export async function getV2ProductDetail(
  productId: string
): Promise<V2ProductDetail | null> {
  const supabase = createAnonClient();
  const [productRes, colorsRes, reviewsRes] = await Promise.all([
    supabase
      .from("products")
      .select(
        "id, title, base_price, category, configuration, size_options, discount_rates, thumbnail_image_link, description_image, product_code, manufacturers(name)"
      )
      .eq("id", productId)
      .eq("is_active", true)
      .maybeSingle(),
    supabase
      .from("product_colors")
      .select(
        "id, sort_order, manufacturer_colors(id, name, hex, color_code)"
      )
      .eq("product_id", productId)
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    supabase
      .from("reviews")
      .select("rating")
      .eq("product_id", productId),
  ]);

  if (!productRes.data) return null;
  const p = productRes.data as {
    id: string;
    title: string;
    base_price: number;
    category: string | null;
    size_options: { label: string; size_code: string }[] | null;
    discount_rates: { min_quantity: number; discount_rate: number }[] | null;
    thumbnail_image_link: string[] | null;
    description_image: string[] | null;
    product_code: string | null;
    manufacturers?: { name: string } | { name: string }[] | null;
  };

  const colors = ((colorsRes.data as
    | {
        id: string;
        manufacturer_colors:
          | { id: string; name: string; hex: string }
          | { id: string; name: string; hex: string }[]
          | null;
      }[]
    | null) ?? []
  )
    .map((c) => {
      const mc = Array.isArray(c.manufacturer_colors)
        ? c.manufacturer_colors[0]
        : c.manufacturer_colors;
      if (!mc) return null;
      return { id: c.id, name: mc.name, hex: mc.hex };
    })
    .filter((c): c is { id: string; name: string; hex: string } => !!c);

  const ratings = (reviewsRes.data ?? []) as { rating: number }[];
  const rating =
    ratings.length === 0
      ? null
      : Math.round(
          (ratings.reduce((s, r) => s + r.rating, 0) / ratings.length) * 100
        ) / 100;
  const manuName = Array.isArray(p.manufacturers)
    ? p.manufacturers[0]?.name ?? null
    : p.manufacturers?.name ?? null;

  return {
    id: p.id,
    title: p.title,
    manufacturerName: manuName,
    description: null,
    category: p.category,
    basePrice: p.base_price,
    thumbnails: p.thumbnail_image_link ?? [],
    primaryImage: p.thumbnail_image_link?.[0] ?? null,
    productCode: p.product_code,
    sizes: p.size_options ?? [],
    colors,
    discountTiers: p.discount_rates ?? [],
    rating,
    reviewCount: ratings.length,
    totalSold: 0,
  };
}

export async function getV2Order(
  orderId: string,
  userId?: string | null
): Promise<V2OrderSummary | null> {
  const supabase = await createServerClient();
  let q = supabase
    .from("orders")
    .select(
      "id, customer_name, customer_phone, address_line_1, address_line_2, city, state, total_amount, order_status, created_at, order_items(id, product_title, quantity, price_per_item, thumbnail_url)"
    )
    .eq("id", orderId);
  if (userId) q = q.eq("user_id", userId);
  const { data } = await q.maybeSingle();
  if (!data) return null;
  const o = data as {
    id: string;
    customer_name: string;
    customer_phone: string;
    address_line_1: string | null;
    address_line_2: string | null;
    city: string | null;
    state: string | null;
    total_amount: number;
    order_status: string;
    created_at: string;
    order_items:
      | {
          id: string;
          product_title: string;
          quantity: number;
          price_per_item: number;
          thumbnail_url: string | null;
        }[]
      | null;
  };
  const items = o.order_items ?? [];
  const totalQty = items.reduce((s, i) => s + i.quantity, 0);
  const addr = [o.state, o.city, o.address_line_1, o.address_line_2]
    .filter(Boolean)
    .join(" ");
  return {
    id: o.id,
    orderName: items[0]?.product_title
      ? items.length > 1
        ? `${items[0].product_title} 외 ${items.length - 1}건`
        : items[0].product_title
      : null,
    totalAmount: o.total_amount,
    totalQuantity: totalQty,
    orderStatus: o.order_status,
    createdAt: o.created_at,
    customerName: o.customer_name,
    customerPhone: o.customer_phone,
    shippingAddress: addr,
    estimatedDelivery: null,
    items: items.map((i) => ({
      id: i.id,
      productTitle: i.product_title,
      quantity: i.quantity,
      pricePerItem: i.price_per_item,
      thumbnailUrl: i.thumbnail_url,
    })),
  };
}

export async function getV2LatestOrderForUser(
  userId: string
): Promise<V2OrderSummary | null> {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("orders")
    .select("id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return getV2Order((data as { id: string }).id, userId);
}

export async function getV2InProgressOrders(
  userId: string
): Promise<V2OrderSummary[]> {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("orders")
    .select(
      "id, customer_name, customer_phone, address_line_1, address_line_2, city, state, total_amount, order_status, created_at, order_items(id, product_title, quantity, price_per_item, thumbnail_url)"
    )
    .eq("user_id", userId)
    .in("order_status", [
      "payment_pending",
      "payment_completed",
      "in_production",
      "shipping",
    ])
    .order("created_at", { ascending: false })
    .limit(5);
  return ((data as Parameters<typeof shapeOrder>[0][] | null) ?? []).map(
    shapeOrder
  );
}

type RawOrder = {
  id: string;
  customer_name: string;
  customer_phone: string;
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  state: string | null;
  total_amount: number;
  order_status: string;
  created_at: string;
  order_items:
    | {
        id: string;
        product_title: string;
        quantity: number;
        price_per_item: number;
        thumbnail_url: string | null;
      }[]
    | null;
};

function shapeOrder(o: RawOrder): V2OrderSummary {
  const items = o.order_items ?? [];
  const totalQty = items.reduce((s, i) => s + i.quantity, 0);
  const addr = [o.state, o.city, o.address_line_1, o.address_line_2]
    .filter(Boolean)
    .join(" ");
  return {
    id: o.id,
    orderName: items[0]?.product_title
      ? items.length > 1
        ? `${items[0].product_title} 외 ${items.length - 1}건`
        : items[0].product_title
      : null,
    totalAmount: o.total_amount,
    totalQuantity: totalQty,
    orderStatus: o.order_status,
    createdAt: o.created_at,
    customerName: o.customer_name,
    customerPhone: o.customer_phone,
    shippingAddress: addr,
    estimatedDelivery: null,
    items: items.map((i) => ({
      id: i.id,
      productTitle: i.product_title,
      quantity: i.quantity,
      pricePerItem: i.price_per_item,
      thumbnailUrl: i.thumbnail_url,
    })),
  };
}

export async function getV2UserStats(userId: string): Promise<V2UserStats> {
  const supabase = await createServerClient();
  const [orders, designs, reviews, coupons] = await Promise.all([
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId),
    supabase
      .from("saved_designs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId),
    supabase
      .from("reviews")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId),
    supabase
      .from("coupon_usages")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .is("used_at", null),
  ]);
  return {
    orders: orders.count ?? 0,
    designs: designs.count ?? 0,
    reviews: reviews.count ?? 0,
    coupons: coupons.count ?? 0,
  };
}

export async function getV2UserDesigns(
  userId: string
): Promise<V2SavedDesign[]> {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("saved_designs")
    .select("id, title, preview_url, product_id, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(8);
  return (
    ((data as
      | {
          id: string;
          title: string;
          preview_url: string | null;
          product_id: string;
          updated_at: string;
        }[]
      | null) ?? []) as {
      id: string;
      title: string;
      preview_url: string | null;
      product_id: string;
      updated_at: string;
    }[]
  ).map((d) => ({
    id: d.id,
    title: d.title,
    preview: d.preview_url,
    productId: d.product_id,
    updatedAt: d.updated_at,
  }));
}

export async function getV2CurrentUser(): Promise<V2UserProfile | null> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("name, email, role, phone_number")
    .eq("id", user.id)
    .maybeSingle();
  const p = profile as {
    name: string | null;
    email: string | null;
    role: string | null;
  } | null;
  const name = p?.name || user.email?.split("@")[0] || "고객";
  const initials = name
    .replace(/[^A-Za-z가-힣]/g, "")
    .slice(0, 2)
    .toUpperCase();
  return {
    id: user.id,
    name,
    email: p?.email || user.email || "",
    role: p?.role ?? null,
    initials,
  };
}

export async function getV2HomeData(): Promise<V2HomeData> {
  const user = await getV2CurrentUser();
  const [featured, categories] = await Promise.all([
    getV2CatalogProducts(),
    getV2Categories(),
  ]);
  let ongoingOrder: V2OrderSummary | null = null;
  if (user) {
    const inProg = await getV2InProgressOrders(user.id);
    ongoingOrder = inProg[0] ?? null;
  }
  return { user, featuredProducts: featured.slice(0, 6), categories, ongoingOrder };
}

// helpers + types re-exported from ./types at top of file

// Re-export Product/Review for convenience
export type { Product, Review };
