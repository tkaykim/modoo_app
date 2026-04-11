import Header from "@/app/components/Header";
import HeroBanner from "@/app/components/HeroBanner";
import ProductCard from "../components/ProductCard"
import CategoryButton from "@/app/components/CategoryButton";
import ProductionExamples from "@/app/components/ProductionExamples";

import InquiryBoardSection from "@/app/components/InquiryBoardSection";
import CoBuySessionCard from "@/app/components/CoBuySessionCard";
import BestReviewsSection from "@/app/components/BestReviewsSection";
import { createAnonClient } from "@/lib/supabase";
import { Product, CoBuySessionWithDetails, ReviewWithProduct } from "@/types/types";
import { CATEGORIES } from "@/lib/categories";
import { unstable_cache } from "next/cache";
import Link from "next/link";
import Footer from "../components/Footer";
import PromotionalPopup from "../components/PromotionalPopup";
import { ChevronRight } from "lucide-react";

const getActiveProducts = unstable_cache(
  async (): Promise<Product[]> => {
    const supabase = createAnonClient();

    const { data, error } = await supabase
      .from('products')
      .select('*, manufacturers(name)')
      .eq('is_active', true)
      .eq('is_featured', true)
      .order('sort_order', { ascending: true })
      .limit(6);

    if (error) {
      console.error('Error fetching products:', error);
      return [];
    }

    return (data ?? []).map((product: { manufacturers?: { name: string } } & Omit<Product, 'manufacturer_name'>) => ({
      ...product,
      manufacturer_name: product.manufacturers?.name ?? null,
    })) as Product[];
  },
  ['home-featured-products'],
  { revalidate: 60, tags: ['products'] }
);

const getCategoryItems = () =>
  CATEGORIES.map((category) => ({
    key: category.key,
    name: category.name,
    icon: category.icon,
    href: `/home/search?category=${encodeURIComponent(category.key)}`,
  }));

const getPublicCoBuySessions = unstable_cache(
  async (): Promise<CoBuySessionWithDetails[]> => {
    const supabase = createAnonClient();

    const { data, error } = await supabase
      .from('cobuy_sessions')
      .select(`
        *,
        saved_design_screenshot:saved_design_screenshots (
          id,
          title,
          preview_url
        )
      `)
      .eq('is_public', true)
      .eq('status', 'gathering')
      .gte('end_date', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(4);

    if (error) {
      console.error('Error fetching public CoBuy sessions:', error);
      return [];
    }

    return (data ?? []) as CoBuySessionWithDetails[];
  },
  ['home-cobuy-sessions'],
  { revalidate: 30, tags: ['cobuy-sessions'] }
);

const getBestReviews = unstable_cache(
  async (): Promise<ReviewWithProduct[]> => {
    const supabase = createAnonClient();

    const { data, error } = await supabase
      .from('reviews')
      .select(`
        *,
        product:products (
          id,
          title,
          thumbnail_image_link
        )
      `)
      .eq('is_best', true)
      .order('best_order', { ascending: true })
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('Error fetching best reviews:', error);
      return [];
    }

    return (data ?? []) as ReviewWithProduct[];
  },
  ['home-best-reviews'],
  { revalidate: 60, tags: ['reviews'] }
);

export default async function HomePage() {
  const [products, cobuySessions, bestReviews] = await Promise.all([
    getActiveProducts(),
    getPublicCoBuySessions(),
    getBestReviews(),
  ]);

  return (
    <div className="min-h-screen bg-white">
      <PromotionalPopup />
      {/* Header */}
      <Header showHomeNav />
      <div className="lg:pt-6 pt-4 flex flex-col border-b border-black/30 pb-4">
        {/* Hero Banner */}
        <div className="w-full">
          <HeroBanner />
        </div>

        {/* Categories */}
        <section className="w-full mt-4 px-4 sm:px-6 lg:px-0 max-w-7xl lg:mx-auto">
          <h2 className="text-lg lg:text-xl font-bold text-gray-900 mb-3 lg:mb-4">카테고리</h2>
          <CategoriesSection />
        </section>
      </div>
      <main className="mx-auto max-w-7xl space-y-4 px-4 sm:px-0 lg:space-y-8 py-4 lg:py-6">
        {/* Featured Products Section */}
        <section className="w-full">
          <div className="flex items-center justify-between mb-3 lg:mb-4">
            <h2 className="text-lg lg:text-xl font-bold text-gray-900">인기 상품</h2>
            <Link href="/home/search" className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
              전체보기
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-3 lg:grid-cols-6 xl:grid-cols-6 gap-3 lg:gap-4">
            {products.length > 0 ? (
              products.map((product) => (
                <ProductCard key={product.id} product={product}/>
            ))
          ) : (
              <div className="col-span-full text-center py-12 text-sm lg:text-base text-gray-500">
                상품이 없습니다
              </div>
            )}
          </div>
        </section>

        {/* Best Reviews Section */}
        <BestReviewsSection reviews={bestReviews} />

        {/* Production Examples Section */}
        <ProductionExamples />

        {/* CoBuy Section */}
        {cobuySessions.length > 0 && (
          <section className="w-full">
            <div className="flex items-center justify-between mb-3 lg:mb-4">
              <h2 className="text-lg lg:text-xl font-bold text-gray-900">진행 중인 공동구매</h2>
              <Link
                href="/cobuy"
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                전체보기
              </Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 lg:gap-4">
              {cobuySessions.map((session) => (
                <CoBuySessionCard key={session.id} session={session} />
              ))}
            </div>
          </section>
        )}

        {/* Inquiry Board Section */}
        <div id="reviews"></div>
        <InquiryBoardSection />
      </main>
      <Footer />
    </div>
  );
}

function CategoriesSection() {
  const categoryItems = getCategoryItems();

  return (
    <div className="flex gap-3 sm:gap-4 lg:gap-6 overflow-x-auto pb-2 lg:overflow-visible">
      {categoryItems.map((category) => (
        <CategoryButton
          key={category.key}
          name={category.name}
          icon={category.icon}
          href={category.href}
        />
      ))}
    </div>
  )
}
