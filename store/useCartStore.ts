import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { FontMetadata } from '@/lib/fontUtils';

export interface CartItemData {
  id: string; // Unique identifier for this cart item
  productId: string;
  productTitle: string;
  productColor: string;
  productColorName: string;
  productColorCode?: string;
  size: string; // Size option (e.g., "S", "M", "L", "XL")
  quantity: number;
  pricePerItem: number; // Base price + design costs
  canvasState: Record<string, string>; // Serialized canvas state for each side
  thumbnailUrl?: string; // Optional thumbnail image
  addedAt: number; // Timestamp
  savedDesignId?: string; // Reference to the saved design in Supabase
  designName?: string; // Custom name for the design
  // Guest-specific design data (stored inline since no saved_designs DB row)
  colorSelections?: Record<string, string>;
  textSvgExports?: Record<string, unknown>;
  customFonts?: FontMetadata[];
  previewImage?: string;
  retouchRequested?: boolean;
}

interface CartState {
  items: CartItemData[];

  // Add item to cart
  addItem: (item: Omit<CartItemData, 'id' | 'addedAt'>) => void;

  // Remove item from cart
  removeItem: (itemId: string) => void;

  // Update item quantity
  updateQuantity: (itemId: string, quantity: number) => void;

  // Clear entire cart
  clearCart: () => void;

  // Set items from database
  setItems: (items: CartItemData[]) => void;

  // Get total quantity
  getTotalQuantity: () => number;

  // Get total price
  getTotalPrice: () => number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (item) => {
        const newItem: CartItemData = {
          ...item,
          id: `${item.productId}-${item.size}-${Date.now()}`,
          addedAt: Date.now(),
        };

        set((state) => ({
          items: [...state.items, newItem],
        }));
      },

      removeItem: (itemId) => {
        set((state) => ({
          items: state.items.filter((item) => item.id !== itemId),
        }));
      },

      updateQuantity: (itemId, quantity) => {
        if (quantity <= 0) {
          get().removeItem(itemId);
          return;
        }

        set((state) => ({
          items: state.items.map((item) =>
            item.id === itemId ? { ...item, quantity } : item
          ),
        }));
      },

      clearCart: () => {
        set({ items: [] });
      },

      setItems: (items) => {
        set({ items });
      },

      getTotalQuantity: () => {
        return get().items.reduce((total, item) => total + item.quantity, 0);
      },

      getTotalPrice: () => {
        return get().items.reduce(
          (total, item) => total + item.pricePerItem * item.quantity,
          0
        );
      },
    }),
    {
      name: 'cart-storage', // localStorage key
    }
  )
);
