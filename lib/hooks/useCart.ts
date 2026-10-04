"use client";

import { useEffect, useState, useCallback } from "react";
import type { Product, CartItem } from "@/lib/data/products";

const STORAGE_KEY = "nokhba-cart";

// ═══ نوع موسّع (variantId + label) ═══
export type CartItemV2 = CartItem & {
  variantId: number;
  variantLabel?: string;
  stockSnapshot?: number;
};

export type AddItemOptions = {
  variantId: number;
  variantLabel: string;
  quantity?: number;
  stockSnapshot?: number;
  selectedColor?: string;
  selectedSize?: string;
};

export function useCart() {
  const [items, setItems] = useState<CartItemV2[]>([]);
  const [isReady, setIsReady] = useState(false);

  // ═══ تحميل ═══
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // تنظيف العناصر القديمة بدون variantId
        const cleaned: CartItemV2[] = (parsed || []).filter(
          (x: any) => typeof x?.variantId === "number"
        );
        setItems(cleaned);
      }
    } catch (err) {
      console.error("Failed to load cart:", err);
    }
    setIsReady(true);
  }, []);

  // ═══ حفظ ═══
  useEffect(() => {
    if (!isReady || typeof window === "undefined") return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch (err) {
      console.error("Failed to save cart:", err);
    }
  }, [items, isReady]);

  // ═══ إضافة (opts اختياري) ═══
  const addItem = useCallback(
    (product: Product, opts?: AddItemOptions) => {
      const variantId = opts?.variantId ?? product.variantId;

      if (!variantId) {
        console.error("addItem: variantId مطلوب");
        return;
      }

      const variantLabel = opts?.variantLabel ?? "";
      const quantity = opts?.quantity ?? 1;
      const stockSnapshot = opts?.stockSnapshot ?? product.stock;
      const selectedColor = opts?.selectedColor;
      const selectedSize = opts?.selectedSize;

      setItems((current) => {
        const existing = current.find((item) => item.variantId === variantId);

        if (existing) {
          const maxQty = stockSnapshot ?? existing.stockSnapshot ?? 99;
          const newQty = Math.min(existing.quantity + quantity, maxQty);
          return current.map((item) =>
            item.variantId === variantId ? { ...item, quantity: newQty } : item
          );
        }

        return [
          ...current,
          {
            ...product,
            variantId,
            variantLabel,
            quantity,
            stockSnapshot,
            selectedColor,
            selectedSize,
          },
        ];
      });
    },
    []
  );

  // ═══ تحديث كمية (variantId فقط) ═══
  const updateQuantity = useCallback(
    (variantId: number, delta: number) => {
      setItems((current) =>
        current.flatMap((item) => {
          if (item.variantId !== variantId) return [item];
          const newQty = item.quantity + delta;
          if (newQty <= 0) return [];
          const maxQty = item.stockSnapshot ?? 99;
          return [{ ...item, quantity: Math.min(newQty, maxQty) }];
        })
      );
    },
    []
  );

  // ═══ حذف ═══
  const removeItem = useCallback((variantId: number) => {
    setItems((current) =>
      current.filter((item) => item.variantId !== variantId)
    );
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  const totalCount = items.reduce((sum, item) => sum + item.quantity, 0);

  const subtotal = items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  return {
    items,
    totalCount,
    subtotal,
    isReady,
    addItem,
    updateQuantity,
    removeItem,
    clearCart,
  };
}