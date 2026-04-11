"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { createClient } from "@/lib/supabase-client";

const STORAGE_KEY = "hidePromoUntil";

type PopupBanner = {
  id: string;
  title: string;
  image_url: string;
  redirect_url: string | null;
};

export default function PromotionalPopup() {
  const [visible, setVisible] = useState(false);
  const [banner, setBanner] = useState<PopupBanner | null>(null);
  const router = useRouter();

  useEffect(() => {
    const hideUntil = localStorage.getItem(STORAGE_KEY);
    if (hideUntil) {
      const today = new Date().toDateString();
      if (new Date(hideUntil).toDateString() === today) return;
    }

    async function fetchBanner() {
      try {
        const supabase = createClient();
        const now = new Date().toISOString();
        const { data, error } = await supabase
          .from("popup_banners")
          .select("id, title, image_url, redirect_url")
          .eq("is_active", true)
          .or(`start_date.is.null,start_date.lte.${now}`)
          .or(`end_date.is.null,end_date.gte.${now}`)
          .order("sort_order", { ascending: true })
          .limit(1)
          .maybeSingle();

        if (error) {
          console.error("Error fetching popup banner:", error);
          return;
        }

        if (data) {
          setBanner(data);
          setVisible(true);
        }
      } catch (err) {
        console.error("Error fetching popup banner:", err);
      }
    }

    fetchBanner();
  }, []);

  if (!visible || !banner) return null;

  const hideForToday = () => {
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);
    localStorage.setItem(STORAGE_KEY, endOfDay.toISOString());
    setVisible(false);
  };

  const handleImageClick = () => {
    setVisible(false);
    if (banner.redirect_url) {
      if (banner.redirect_url.startsWith("http")) {
        window.open(banner.redirect_url, "_blank");
      } else {
        router.push(banner.redirect_url);
      }
    }
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50"
      onClick={() => setVisible(false)}
    >
      <div
        className="relative w-[90%] max-w-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={() => setVisible(false)}
          className="absolute -top-3 -right-3 z-10 rounded-full bg-white p-1 shadow"
        >
          <X className="h-5 w-5 text-gray-600" />
        </button>

        <div
          className={`overflow-hidden rounded-xl${banner.redirect_url ? " cursor-pointer" : ""}`}
          onClick={banner.redirect_url ? handleImageClick : undefined}
        >
          <img
            src={banner.image_url}
            alt={banner.title}
            className="w-full object-contain"
          />
        </div>

        <button
          onClick={hideForToday}
          className="mt-2 w-full rounded-lg bg-white/90 py-2 text-sm text-gray-500 hover:bg-white"
        >
          오늘 하루 그만보기
        </button>
      </div>
    </div>
  );
}
