import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, ChevronRight, MessageCircle, Sparkles } from "lucide-react";
import { unstable_cache } from "next/cache";
import { createAnonClient } from "@/lib/supabase";
import { Product } from "@/types/types";
import ProductCard from "@/app/components/ProductCard";
import Header from "@/app/components/Header";
import Footer from "@/app/components/Footer";
import { KST_TIMEZONE } from "@/lib/kst";

export const metadata: Metadata = {
  title: "문의 접수 완료 | 모두의 유니폼",
  robots: { index: false, follow: false },
};

const getFeaturedProducts = unstable_cache(
  async (): Promise<Product[]> => {
    const supabase = createAnonClient();
    const { data, error } = await supabase
      .from("products")
      .select("*, manufacturers(name)")
      .eq("is_active", true)
      .eq("is_featured", true)
      .order("sort_order", { ascending: true })
      .limit(6);

    if (error) {
      console.error("Error fetching featured products:", error);
      return [];
    }

    return (data ?? []).map(
      (product: { manufacturers?: { name: string } } & Omit<Product, "manufacturer_name">) => ({
        ...product,
        manufacturer_name: product.manufacturers?.name ?? null,
      })
    ) as Product[];
  },
  ["inquiry-success-featured-products"],
  { revalidate: 60, tags: ["products"] }
);

function isKstWeekend(d: Date = new Date()): boolean {
  // 'short' weekday in en-US gives Sun/Mon/.../Sat
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: KST_TIMEZONE,
    weekday: "short",
  }).format(d);
  return weekday === "Sat" || weekday === "Sun";
}

export default async function InquirySuccessPage() {
  const [products] = await Promise.all([getFeaturedProducts()]);
  const weekend = isKstWeekend();

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="mx-auto max-w-3xl px-4 py-10 lg:py-14">
        {/* Success Hero */}
        <section className="bg-white rounded-2xl border border-gray-200 px-6 py-10 lg:py-12 text-center shadow-sm">
          <div className="inline-flex items-center justify-center w-16 h-16 lg:w-20 lg:h-20 rounded-full bg-green-50 mb-5">
            <CheckCircle2 className="w-10 h-10 lg:w-12 lg:h-12 text-green-600" strokeWidth={2} />
          </div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-2">
            문의가 접수되었습니다
          </h1>
          <p className="text-sm lg:text-base text-gray-600 leading-relaxed">
            담당자 확인 후 <span className="font-semibold text-[#3B55A5]">카카오톡</span>으로
            견적서와 시안을 보내드릴게요.
          </p>

          {weekend && (
            <div className="mt-6 inline-flex items-start gap-2 text-left bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
              <MessageCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
              <p className="text-xs lg:text-sm text-amber-900">
                지금은 주말이라 답변이 다소 지연될 수 있어요. 평일에 빠르게 회신드리겠습니다.
              </p>
            </div>
          )}

          <div className="mt-7 flex flex-col sm:flex-row items-center justify-center gap-2">
            <Link
              href="/inquiries"
              className="w-full sm:w-auto px-6 py-3 text-sm bg-[#3B55A5] text-white rounded-lg hover:bg-[#2f4584] transition"
            >
              내 문의 내역 보기
            </Link>
            <Link
              href="/home"
              className="w-full sm:w-auto px-6 py-3 text-sm border border-gray-300 bg-white rounded-lg hover:bg-gray-50 transition"
            >
              홈으로 가기
            </Link>
          </div>
        </section>

        {/* Self-quote CTA */}
        {products.length > 0 && (
          <section className="mt-10">
            <div className="flex items-start gap-2 mb-3">
              <Sparkles className="w-5 h-5 text-[#3B55A5] mt-0.5 shrink-0" />
              <div>
                <h2 className="text-lg lg:text-xl font-bold text-gray-900">
                  견적을 직접 내볼 수도 있어요!
                </h2>
                <p className="text-sm text-gray-600 mt-1 leading-relaxed">
                  제품을 선택하고, 디자인을 삽입한 뒤 수량을 입력하면
                  <br className="hidden sm:inline" /> 자동으로 견적이 계산됩니다.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 lg:gap-4 mt-4">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>

            <div className="mt-4 text-right">
              <Link
                href="/home/search"
                className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
              >
                전체 상품 보기
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </section>
        )}

        {/* Reviews CTA */}
        <section className="mt-10 bg-white rounded-2xl border border-gray-200 p-6 lg:p-8 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-base lg:text-lg font-bold text-gray-900">
                다른 단체들은 어떻게 만들었을까요?
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                먼저 주문하신 분들의 실제 후기를 확인해보세요.
              </p>
            </div>
            <Link
              href="/home#reviews"
              className="inline-flex items-center justify-center gap-1 px-5 py-2.5 text-sm border border-gray-300 bg-white rounded-lg hover:bg-gray-50 transition shrink-0"
            >
              후기 보러 가기
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
