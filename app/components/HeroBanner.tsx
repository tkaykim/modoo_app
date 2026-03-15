'use client';

import { useState, useEffect } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay } from 'swiper/modules';
import { createClient } from '@/lib/supabase-client';
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
        <div className="h-70 sm:h-72 lg:h-84 bg-gray-100 rounded-2xl animate-pulse" />
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
        className="h-70 sm:h-72 lg:h-84 hero-swiper"
      >
        {banners.map((banner) => {

          const BannerContent = (
            <>
              {/* Background Image - Using regular img tag for better compatibility */}
              {banner.image_link && (
                <>
                  <Image
                    src={banner.image_link}
                    alt={banner.title}
                    fill
                    unoptimized
                    className="absolute inset-0 w-full h-full object-cover object-top"
                  />
                  {/* Debug: Show image URL */}
                  <div className="absolute top-2 left-2 bg-black/50 text-white text-xs p-1 rounded z-30 max-w-[200px] truncate">
                    {banner.bg_image}
                  </div>
                </>
              )}

              {!banner.image_link && (
                <div className="absolute inset-0 flex items-center justify-center text-white/50 text-sm">
                  No image URL
                </div>
              )}

              {/* Gradient overlay */}
              <div className="absolute inset-0 bg-linear-to-t from-black/70 via-black/20 to-transparent rounded-2xl lg:rounded-[20px] pointer-events-none z-10" />

              {/* Content */}
              <div className="relative z-20">
                <h2 className="text-lg lg:text-xl font-bold mb-1">{banner.title}</h2>
                <p className="text-sm text-white/90">{banner.subtitle}</p>
              </div>
            </>
          );

          return (
            <SwiperSlide key={banner.id}>
              {banner.redirect_link ? (
                <Link
                  href={banner.redirect_link}
                  className={`h-full rounded-2xl lg:rounded-[20px] flex flex-col items-start justify-end text-white py-5 lg:py-6 px-5 lg:px-6 relative overflow-hidden lg:aspect-square lg:max-w-105 lg:mx-auto cursor-pointer hover:opacity-95 transition-opacity`}
                >
                  {BannerContent}
                </Link>
              ) : (
                <div
                  className={`h-full rounded-2xl lg:rounded-[20px] flex flex-col items-start justify-end text-white py-5 lg:py-6 px-5 lg:px-6 relative overflow-hidden lg:aspect-square lg:max-w-105 lg:mx-auto`}
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
