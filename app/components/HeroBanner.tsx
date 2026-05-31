'use client';

import { useState, useEffect } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay } from 'swiper/modules';
import { createClient } from '@/lib/supabase-client';
import { maybeHealOnError } from '@/lib/supabase-resilient';
import { HeroBanner as HeroBannerType } from '@/types/types';
import Link from 'next/link';

import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/pagination';
import Image from 'next/image';

export default function HeroBanner() {
  const [banners, setBanners] = useState<HeroBannerType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    async function fetchBanners() {
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from('hero_banners')
          .select('*')
          .eq('is_active', true)
          .order('sort_order', { ascending: true });

        if (error) throw error;

        setBanners(data || []);
      } catch (err) {
        if (maybeHealOnError(err)) return;
        console.error('Error fetching hero banners:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch banners');
      } finally {
        setLoading(false);
      }
    }

    fetchBanners();
  }, []);

  if (loading) {
    return (
      <section className="w-full">
        <div className="h-35 sm:h-36 lg:h-42 bg-gray-100 rounded-2xl animate-pulse" />
      </section>
    );
  }

  if (error || banners.length === 0) {
    return null; // Hide banner section if there's an error or no banners
  }
  return (
    <section className="w-full">
      <style dangerouslySetInnerHTML={{
        __html: `
          .hero-swiper .swiper-slide {
            transition: transform 0.3s ease, opacity 0.3s ease;
            transform: scale(0.95);
          }
          .hero-swiper .swiper-slide-active {
            transform: scale(1);
            opacity: 1;
          }
        `
      }} />
      <Swiper
        modules={[Autoplay]}
        slidesPerView={1.3}
        centeredSlides={true}
        initialSlide={1}
        breakpoints={{
          640: {
            slidesPerView: 1.5,
          },
          1024: {
            slidesPerView: 3,
            centeredSlides: true,
            centeredSlidesBounds: true
          },
        }}
        onSwiper={(s) => setActiveIndex(s.realIndex)}
        onSlideChange={(s) => setActiveIndex(s.realIndex)}
        className="h-35 sm:h-36 lg:h-42 hero-swiper"
      >
        {banners.map((banner, index) => {
          const isActive = index === activeIndex;

          const BannerContent = (
            <>
              {/* Background Image — 이미지 자체에 카피가 디자인되어 있어 별도 텍스트/오버레이 없음 */}
              {banner.image_link ? (
                <Image
                  src={banner.image_link}
                  alt={banner.title}
                  fill
                  unoptimized
                  className="absolute inset-0 w-full h-full object-cover object-top"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-white/50 text-sm">
                  No image URL
                </div>
              )}

              {/* 인디케이터: 활성(가운데) 배너 우하단에 현재/전체 카운터 */}
              {isActive && banners.length > 1 && (
                <div className="absolute bottom-2 right-2 z-20 rounded-full bg-black/45 px-2 py-1 text-[11px] font-medium leading-none text-white tabular-nums backdrop-blur-sm">
                  {activeIndex + 1}/{banners.length}
                </div>
              )}
            </>
          );

          return (
            <SwiperSlide key={banner.id}>
              {banner.redirect_link ? (
                <Link
                  href={banner.redirect_link}
                  className={`block h-full w-full rounded-2xl lg:rounded-[20px] relative overflow-hidden lg:aspect-square lg:max-w-105 lg:mx-auto cursor-pointer hover:opacity-95 transition-opacity`}
                >
                  {BannerContent}
                </Link>
              ) : (
                <div
                  className={`block h-full w-full rounded-2xl lg:rounded-[20px] relative overflow-hidden lg:aspect-square lg:max-w-105 lg:mx-auto`}
                >
                  {BannerContent}
                </div>
              )}
            </SwiperSlide>
          );
        })}
      </Swiper>
    </section>
  );
}
