'use client';

import { ShoppingBasket } from "lucide-react";
import Link from "next/link";
import { useCartStore } from "@/store/useCartStore";
import { useAuthStore } from "@/store/useAuthStore";
import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase-client";
import { addToCartDB } from "@/lib/cartService";

export default function CartButton() {
  const [mounted, setMounted] = useState(false);
  const items = useCartStore((state) => state.items);
  const setItems = useCartStore((state) => state.setItems);
  const clearCart = useCartStore((state) => state.clearCart);
  const { isAuthenticated, user } = useAuthStore();
  const prevAuthRef = useRef(isAuthenticated);

  // Count items: for authenticated users count by savedDesignId, for guests count all items
  const itemCount = isAuthenticated
    ? items.reduce((acc, item) => {
        if (item.savedDesignId && !acc.includes(item.savedDesignId)) {
          acc.push(item.savedDesignId);
        }
        return acc;
      }, [] as string[]).length
    : items.length;

  // Sync cart with auth state
  useEffect(() => {
    async function syncCart() {
      const wasAuthenticated = prevAuthRef.current;
      prevAuthRef.current = isAuthenticated;

      // User just logged out - clear the cart (DB items no longer valid)
      if (!isAuthenticated && wasAuthenticated) {
        clearCart();
        return;
      }

      // Not authenticated - leave guest cart items in store
      if (!isAuthenticated || !user) {
        return;
      }

      // User just logged in - merge any guest cart items into DB, then fetch from DB
      const guestItems = useCartStore.getState().items;
      if (wasAuthenticated === false && guestItems.length > 0) {
        try {
          for (const guestItem of guestItems) {
            await addToCartDB({
              productId: guestItem.productId,
              productTitle: guestItem.productTitle,
              productColor: guestItem.productColor,
              productColorName: guestItem.productColorName,
              productColorCode: guestItem.productColorCode,
              size: guestItem.size,
              quantity: guestItem.quantity,
              pricePerItem: guestItem.pricePerItem,
              canvasState: guestItem.canvasState,
              thumbnailUrl: guestItem.thumbnailUrl,
              designName: guestItem.designName,
              customFonts: guestItem.customFonts,
            });
          }
        } catch (err) {
          console.error('Error merging guest cart items:', err);
        }
      }

      // Fetch cart items from database
      try {
        const supabase = createClient();

        const { data, error } = await supabase
          .from('cart_items')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error fetching cart items:', error);
          return;
        }

        if (data) {
          const cartItems = data.map((item) => ({
            id: item.id,
            productId: item.product_id || '',
            productTitle: item.product_title,
            productColor: item.product_color,
            productColorName: item.product_color_name,
            size: item.size_id || item.size_name,
            quantity: item.quantity,
            pricePerItem: Number(item.price_per_item),
            canvasState: {} as Record<string, string>,
            thumbnailUrl: item.thumbnail_url || undefined,
            addedAt: new Date(item.created_at).getTime(),
            savedDesignId: item.saved_design_id || undefined,
            designName: undefined,
          }));

          setItems(cartItems);
        }
      } catch (err) {
        console.error('Error fetching cart items:', err);
      }
    }

    syncCart();
  }, [isAuthenticated, user, setItems, clearCart]);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <Link href="/cart" className="relative">
      <ShoppingBasket className="text-gray-700 size-6"/>
      {mounted && itemCount > 0 && (
        <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
          {itemCount > 99 ? '99+' : itemCount}
        </div>
      )}
    </Link>
  )
}
