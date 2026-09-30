"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Star,
  MapPin,
  Package,
  ArrowRight,
  ShieldCheck,
  Store as StoreIcon,
  Calendar,
} from "lucide-react";

import TopBar from "@/components/layout/TopBar";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import BottomNav from "@/components/layout/BottomNav";
import ProductGrid from "@/components/products/ProductGrid";
import CartDrawer from "@/components/cart/CartDrawer";

import { useCart } from "@/lib/hooks/useCart";
import type { Product } from "@/lib/data/products";

type StoreData = {
  id: number;
  storeName: string;
  slug: string;
  description: string | null;
  logo: string | null;
  city: string | null;
  region: string | null;
  isVerified: boolean;
  avgRating: number;
  totalOrders: number;
  productCount: number;
  createdAt: string;
};

type StoreClientProps = {
  store: StoreData;
  products: Product[];
};

export default function StoreClient({ store, products }: StoreClientProps) {
  const [search, setSearch] = useState("");
  const [isCartOpen, setIsCartOpen] = useState(false);

  const {
    items: cartItems,
    totalCount: cartCount,
    subtotal,
    addItem,
    updateQuantity,
    removeItem,
  } = useCart();

  function handleAddToCart(product: Product) {
    addItem(product);
    setIsCartOpen(true);
  }

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-[#f7f6f2] pb-16 text-[#161616] sm:pb-0"
    >
      <TopBar />
      <Header
        search={search}
        onSearchChange={setSearch}
        cartCount={cartCount}
        onCartClick={() => setIsCartOpen(true)}
      />

      {/* Breadcrumb */}
      <div className="border-b border-gray-100 bg-white">
        <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-2 text-xs text-[#6b7280]">
          <Link
            href="/"
            className="flex items-center gap-1 font-bold text-[#ff5c00] hover:underline"
          >
            <ArrowRight className="h-3.5 w-3.5" />
            الرئيسية
          </Link>
          <span>/</span>
          <span>المتاجر</span>
          <span>/</span>
          <span className="truncate">{store.storeName}</span>
        </div>
      </div>

      {/* ═══ Store Hero ═══ */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#0a1a35] via-[#122a4d] to-[#0a1a35]">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-20 left-1/4 h-64 w-64 rounded-full bg-blue-500/20 blur-3xl" />
          <div className="absolute -bottom-20 right-1/4 h-64 w-64 rounded-full bg-yellow-500/10 blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-7xl px-4 py-8 sm:py-10">
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
            {/* Logo */}
            <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-white shadow-2xl sm:h-28 sm:w-28">
              {store.logo ? (
                <img
                  src={store.logo}
                  alt={store.storeName}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-yellow-400 to-amber-500">
                  <span className="text-4xl font-black text-[#0a1a35]">
                    {store.storeName.charAt(0)}
                  </span>
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 text-center sm:text-right">
              <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                <h1 className="text-2xl font-black text-white sm:text-3xl">
                  {store.storeName}
                </h1>
                {store.isVerified && (
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500" title="متجر موثّق">
                    <ShieldCheck className="h-4 w-4 text-white" />
                  </span>
                )}
              </div>

              {store.description && (
                <p className="mt-2 max-w-2xl text-sm leading-6 text-white/80">
                  {store.description}
                </p>
              )}

              {/* Meta */}
              <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-white/70 sm:justify-start">
                {store.city && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" />
                    {store.city}
                    {store.region && ` · ${store.region}`}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Package className="h-3.5 w-3.5" />
                  {store.productCount} منتج
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  انضم{" "}
                  {new Date(store.createdAt).toLocaleDateString("ar-MA", {
                    month: "long",
                    year: "numeric",
                  })}
                </span>
                {store.avgRating > 0 && (
                  <span className="flex items-center gap-1">
                    <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                    <strong className="text-white">
                      {store.avgRating.toFixed(1)}
                    </strong>
                    ({store.totalOrders} مبيع)
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ المنتجات ═══ */}
      <div className="mx-auto max-w-7xl px-4 py-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#b17f3f] sm:text-xs">
              من المتجر
            </span>
            <h2 className="mt-0.5 text-lg font-black sm:text-xl">
              منتجات {store.storeName}
            </h2>
          </div>
          <span className="text-xs text-[#6b7280]">
            {products.length} منتج
          </span>
        </div>

        {products.length === 0 ? (
          <div className="rounded-2xl bg-white p-12 text-center shadow-sm">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-gray-100">
              <StoreIcon className="h-10 w-10 text-gray-400" />
            </div>
            <h3 className="mt-5 text-lg font-black">لا توجد منتجات بعد</h3>
            <p className="mt-2 text-sm text-[#6b7280]">
              هذا المتجر لم يُضف أي منتجات حتى الآن
            </p>
            <Link
              href="/"
              className="mt-6 inline-block rounded-full bg-[#ff5c00] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#e64a00]"
            >
              تصفح متاجر أخرى
            </Link>
          </div>
        ) : (
          <ProductGrid products={products} onAddToCart={handleAddToCart} />
        )}
      </div>

      <Footer />

      <BottomNav
        cartCount={cartCount}
        onCartClick={() => setIsCartOpen(true)}
      />

      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        items={cartItems}
        subtotal={subtotal}
        onQuantityChange={updateQuantity}
        onRemove={removeItem}
      />
    </main>
  );
}