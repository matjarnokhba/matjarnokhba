"use client";

import { useEffect, useState, useCallback } from "react";
import type { Product, CartItem } from "@/lib/data/products";

const STORAGE_KEY = "nokhba-cart";

export function useCart() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isReady, setIsReady] = useState(false);

  // ═══════ تحميل من localStorage ═══════
  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setItems(JSON.parse(saved));
      }
    } catch (err) {
      console.error("Failed to load cart:", err);
    }
    setIsReady(true);
  }, []);

  // ═══════ حفظ في localStorage ═══════
  useEffect(() => {
    if (!isReady || typeof window === "undefined") return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch (err) {
      console.error("Failed to save cart:", err);
    }
  }, [items, isReady]);

  // ═══════ إضافة منتج ═══════
  const addItem = useCallback(
    (product: Product, quantity = 1, color?: string, size?: string) => {
      setItems((current) => {
        const existing = current.find(
          (item) =>
            item.id === product.id &&
            item.selectedColor === color &&
            item.selectedSize === size
        );

        if (existing) {
          return current.map((item) =>
            item.id === product.id &&
            item.selectedColor === color &&
            item.selectedSize === size
              ? { ...item, quantity: item.quantity + quantity }
              : item
          );
        }

        return [
          ...current,
          {
            ...product,
            quantity,
            selectedColor: color,
            selectedSize: size,
          },
        ];
      });
    },
    []
  );

  // ═══════ تحديث الكمية ═══════
  const updateQuantity = useCallback(
    (id: number, color: string | undefined, size: string | undefined, delta: number) => {
      setItems((current) =>
        current.flatMap((item) => {
          const matches =
            item.id === id &&
            item.selectedColor === color &&
            item.selectedSize === size;

          if (!matches) return [item];

          const newQty = item.quantity + delta;
          if (newQty <= 0) return [];
          return [{ ...item, quantity: newQty }];
        })
      );
    },
    []
  );

  // ═══════ حذف منتج ═══════
  const removeItem = useCallback(
    (id: number, color: string | undefined, size: string | undefined) => {
      setItems((current) =>
        current.filter(
          (item) =>
            !(
              item.id === id &&
              item.selectedColor === color &&
              item.selectedSize === size
            )
        )
      );
    },
    []
  );

  // ═══════ إفراغ السلة ═══════
  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  // ═══════ عدد المنتجات ═══════
  const totalCount = items.reduce((sum, item) => sum + item.quantity, 0);

  // ═══════ المجموع الفرعي ═══════
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