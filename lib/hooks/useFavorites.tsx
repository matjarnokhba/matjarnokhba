"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import type { Product } from "@/lib/data/products";

type FavoritesContextValue = {
  favorites: Product[];
  count: number;
  isReady: boolean;
  isFavorite: (productId: number) => boolean;
  addFavorite: (product: Product) => Promise<void>;
  removeFavorite: (productId: number) => Promise<void>;
  toggleFavorite: (product: Product) => Promise<void>;
  clearFavorites: () => void;
  refresh: () => Promise<void>;
};

const FavoritesContext = createContext<FavoritesContextValue | null>(null);

export function FavoritesProvider(props: { children: React.ReactNode }) {
  const router = useRouter();
  const [favorites, setFavorites] = useState<Product[]>([]);
  const [isReady, setIsReady] = useState(false);
  const [userId, setUserId] = useState<number | null>(null);
  const pendingRef = useRef<Set<number>>(new Set());

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/favorites", { cache: "no-store" });
      if (res.status === 401) {
        setUserId(null);
        setFavorites([]);
        return;
      }
      const data = await res.json();
      if (data.success) {
        setFavorites(data.products || []);
        setUserId(data.userId || null);
      }
    } catch (err) {
      console.error("Favorites load failed:", err);
    } finally {
      setIsReady(true);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    function handleAuthChanged() {
      setIsReady(false);
      setFavorites([]);
      setUserId(null);
      load();
    }
    window.addEventListener("nokhba:auth-changed", handleAuthChanged);
    return () => {
      window.removeEventListener("nokhba:auth-changed", handleAuthChanged);
    };
  }, [load]);

  const isFavorite = useCallback(
    (productId: number) => favorites.some((p) => p.id === productId),
    [favorites]
  );

  const addFavorite = useCallback(
    async (product: Product) => {
      if (!userId) {
        router.push("/login");
        return;
      }
      if (pendingRef.current.has(product.id)) return;
      if (favorites.some((p) => p.id === product.id)) return;

      setFavorites((cur) =>
        cur.some((p) => p.id === product.id) ? cur : [product, ...cur]
      );
      pendingRef.current.add(product.id);

      try {
        const res = await fetch("/api/favorites", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productId: product.id }),
        });
        if (!res.ok) {
          setFavorites((cur) => cur.filter((p) => p.id !== product.id));
        }
      } catch {
        setFavorites((cur) => cur.filter((p) => p.id !== product.id));
      } finally {
        pendingRef.current.delete(product.id);
      }
    },
    [userId, favorites, router]
  );

  const removeFavorite = useCallback(
    async (productId: number) => {
      if (!userId) return;
      if (pendingRef.current.has(productId)) return;

      const snapshot = favorites;
      setFavorites((cur) => cur.filter((p) => p.id !== productId));
      pendingRef.current.add(productId);

      try {
        const res = await fetch(`/api/favorites/${productId}`, {
          method: "DELETE",
        });
        if (!res.ok) {
          setFavorites(snapshot);
        }
      } catch {
        setFavorites(snapshot);
      } finally {
        pendingRef.current.delete(productId);
      }
    },
    [userId, favorites]
  );

  const toggleFavorite = useCallback(
    async (product: Product) => {
      if (favorites.some((p) => p.id === product.id)) {
        await removeFavorite(product.id);
      } else {
        await addFavorite(product);
      }
    },
    [favorites, addFavorite, removeFavorite]
  );

  const clearFavorites = useCallback(() => {
    setFavorites([]);
  }, []);

  const refresh = useCallback(async () => {
    await load();
  }, [load]);

  const value: FavoritesContextValue = {
    favorites,
    count: favorites.length,
    isReady,
    isFavorite,
    addFavorite,
    removeFavorite,
    toggleFavorite,
    clearFavorites,
    refresh,
  };

  return (
    <FavoritesContext.Provider value={value}>
      {props.children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites(): FavoritesContextValue {
  const ctx = useContext(FavoritesContext);
  if (!ctx) {
    throw new Error("useFavorites must be used within FavoritesProvider");
  }
  return ctx;
}