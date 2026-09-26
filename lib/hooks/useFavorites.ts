"use client";

import { useEffect, useState, useCallback } from "react";
import type { Product } from "@/lib/data/products";

const STORAGE_KEY = "nokhba-favorites";

export function useFavorites() {
  const [favorites, setFavorites] = useState<Product[]>([]);
  const [isReady, setIsReady] = useState(false);

  // ═══════ تحميل من localStorage ═══════
  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setFavorites(JSON.parse(saved));
    } catch (err) {
      console.error("Failed to load favorites:", err);
    }
    setIsReady(true);
  }, []);

  // ═══════ حفظ في localStorage ═══════
  useEffect(() => {
    if (!isReady || typeof window === "undefined") return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
    } catch (err) {
      console.error("Failed to save favorites:", err);
    }
  }, [favorites, isReady]);

  // ═══════ هل المنتج في المفضلة؟ ═══════
  const isFavorite = useCallback(
    (productId: number) => favorites.some((p) => p.id === productId),
    [favorites]
  );

  // ═══════ إضافة للمفضلة ═══════
  const addFavorite = useCallback((product: Product) => {
    setFavorites((current) => {
      if (current.some((p) => p.id === product.id)) return current;
      return [...current, product];
    });
  }, []);

  // ═══════ إزالة من المفضلة ═══════
  const removeFavorite = useCallback((productId: number) => {
    setFavorites((current) => current.filter((p) => p.id !== productId));
  }, []);

  // ═══════ تبديل (إضافة أو إزالة) ═══════
  const toggleFavorite = useCallback(
    (product: Product) => {
      setFavorites((current) => {
        if (current.some((p) => p.id === product.id)) {
          return current.filter((p) => p.id !== product.id);
        }
        return [...current, product];
      });
    },
    []
  );

  // ═══════ إفراغ الكل ═══════
  const clearFavorites = useCallback(() => {
    setFavorites([]);
  }, []);

  return {
    favorites,
    count: favorites.length,
    isReady,
    isFavorite,
    addFavorite,
    removeFavorite,
    toggleFavorite,
    clearFavorites,
  };
}