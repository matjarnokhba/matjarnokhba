"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type WholesaleCartItem = {
  offerId: number;
  masterVariantId: number;
  masterName: string;
  masterImage: string | null;
  sellerName: string;
  sellerType: string;
  variantAttributes: Array<{ name: string; value: string }>;
  quantity: number;
  unitPrice: number;
  minOrderQty: number;
  maxOrderQty: number | null;
};

const STORAGE_KEY = "wholesale_cart_v1";

interface CartContextValue {
  items: WholesaleCartItem[];
  isHydrated: boolean;
  totalItems: number;
  totalEstimate: number;
  addItem: (item: WholesaleCartItem) => void;
  removeItem: (offerId: number, masterVariantId: number) => void;
  updateQuantity: (
    offerId: number,
    masterVariantId: number,
    qty: number
  ) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

function getKey(item: { offerId: number; masterVariantId: number }): string {
  return `${item.offerId}:${item.masterVariantId}`;
}

export function WholesaleCartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<WholesaleCartItem[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);

  // Hydrate from localStorage
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setItems(
            parsed.filter(
              (x) =>
                x &&
                typeof x.offerId === "number" &&
                typeof x.masterVariantId === "number" &&
                typeof x.quantity === "number"
            )
          );
        }
      }
    } catch {}
    setIsHydrated(true);
  }, []);

  // Persist to localStorage
  useEffect(() => {
    if (!isHydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {}
  }, [items, isHydrated]);

  const addItem = useCallback((item: WholesaleCartItem) => {
    setItems((prev) => {
      const k = getKey(item);
      const existing = prev.find((x) => getKey(x) === k);
      if (existing) {
        // Increment quantity
        return prev.map((x) =>
          getKey(x) === k
            ? { ...x, quantity: x.quantity + item.quantity }
            : x
        );
      }
      return [...prev, item];
    });
  }, []);

  const removeItem = useCallback(
    (offerId: number, masterVariantId: number) => {
      setItems((prev) =>
        prev.filter((x) => getKey(x) !== `${offerId}:${masterVariantId}`)
      );
    },
    []
  );

  const updateQuantity = useCallback(
    (offerId: number, masterVariantId: number, qty: number) => {
      setItems((prev) =>
        prev.map((x) =>
          getKey(x) === `${offerId}:${masterVariantId}`
            ? { ...x, quantity: Math.max(1, qty) }
            : x
        )
      );
    },
    []
  );

  const clear = useCallback(() => setItems([]), []);

  const { totalItems, totalEstimate } = useMemo(() => {
    let count = 0;
    let sum = 0;
    for (const i of items) {
      count += i.quantity;
      sum += i.unitPrice * i.quantity;
    }
    return { totalItems: count, totalEstimate: Math.round(sum * 100) / 100 };
  }, [items]);

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      isHydrated,
      totalItems,
      totalEstimate,
      addItem,
      removeItem,
      updateQuantity,
      clear,
    }),
    [items, isHydrated, totalItems, totalEstimate, addItem, removeItem, updateQuantity, clear]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useWholesaleCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error("useWholesaleCart must be used within <WholesaleCartProvider>");
  }
  return ctx;
}