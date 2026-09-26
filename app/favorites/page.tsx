"use client";

import { useState } from "react";
import Link from "next/link";
import { Heart, ShoppingCart, Trash2, ArrowRight, Package } from "lucide-react";

import TopBar from "@/components/layout/TopBar";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import CartDrawer from "@/components/cart/CartDrawer";

import { useCart } from "@/lib/hooks/useCart";
import { useFavorites } from "@/lib/hooks/useFavorites";
import { CURRENCY } from "@/lib/data/products";

export default function FavoritesPage() {
  const { favorites, removeFavorite, isReady } = useFavorites();
  const {
    items: cartItems,
    totalCount: cartCount,
    subtotal,
    addItem,
    updateQuantity,
    removeItem,
  } = useCart();

  const [isCartOpen, setIsCartOpen] = useState(false);
  const [search, setSearch] = useState("");

  function handleAddToCart(product: any) {
    addItem(product);
    setIsCartOpen(true);
  }

  // ═══════ حالة التحميل ═══════
  if (!isReady) {
    return (
      <main dir="rtl" className="min-h-screen bg-[#f7f6f2] text-[#161616]">
        <TopBar />
        <Header
          search={search}
          onSearchChange={setSearch}
          cartCount={cartCount}
          onCartClick={() => setIsCartOpen(true)}
        />
        <div className="mx-auto max-w-6xl px-4 py-8">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="aspect-square animate-pulse rounded-xl bg-gray-200"
              />
            ))}
          </div>
        </div>
        <Footer />
      </main>
    );
  }

  return (
    <main dir="rtl" className="min-h-screen bg-[#f7f6f2] text-[#161616]">
      <TopBar />
      <Header
        search={search}
        onSearchChange={setSearch}
        cartCount={cartCount}
        onCartClick={() => setIsCartOpen(true)}
      />

      <div className="mx-auto max-w-6xl px-4 py-6">
        {/* العنوان */}
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black">المفضلة</h1>
            {favorites.length > 0 && (
              <p className="mt-1 text-xs text-[#6b7280]">
                {favorites.length} منتج محفوظ
              </p>
            )}
          </div>
          {favorites.length > 0 && (
            <Link
              href="/"
              className="text-xs font-bold text-[#ff5c00] hover:underline"
            >
              ← متابعة التسوق
            </Link>
          )}
        </div>

        {/* حالة فارغة */}
        {favorites.length === 0 ? (
          <div className="rounded-2xl bg-white p-12 text-center shadow-sm">
            <div className="flex justify-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-50">
                <Heart className="h-10 w-10 text-red-400" />
              </div>
            </div>
            <h2 className="mt-5 text-lg font-black">
              لا توجد منتجات في المفضلة
            </h2>
            <p className="mt-2 text-sm text-[#6b7280]">
              احفظ المنتجات التي تعجبك لتعود إليها لاحقاً
            </p>
            <Link
              href="/"
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#ff5c00] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#e64a00]"
            >
              <ArrowRight className="h-4 w-4" />
              ابدأ التسوق
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {favorites.map((product) => {
              const discount = product.oldPrice
                ? Math.round(
                    ((product.oldPrice - product.price) / product.oldPrice) * 100
                  )
                : 0;

              return (
                <div
                  key={product.id}
                  className="group relative overflow-hidden rounded-xl bg-white shadow-sm transition hover:shadow-md"
                >
                  {/* صورة */}
                  <Link href={`/product/${product.slug}`}>
                    <div className="relative aspect-square overflow-hidden bg-gray-100">
                      {product.images[0] ? (
                        <img
                          src={product.images[0]}
                          alt={product.name}
                          className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-gray-300">
                          <Package className="h-12 w-12" />
                        </div>
                      )}

                      {discount > 0 && (
                        <span className="absolute left-2 top-2 rounded bg-[#ff5c00] px-1.5 py-0.5 text-[10px] font-black text-white">
                          -{discount}%
                        </span>
                      )}
                    </div>
                  </Link>

                  {/* زر الإزالة */}
                  <button
                    onClick={() => removeFavorite(product.id)}
                    className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-red-500 shadow-md backdrop-blur transition hover:bg-red-500 hover:text-white"
                    aria-label="إزالة من المفضلة"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>

                  {/* التفاصيل */}
                  <div className="p-2.5">
                    <Link href={`/product/${product.slug}`}>
                      <h3 className="line-clamp-2 min-h-[2.5rem] text-xs font-bold leading-tight transition hover:text-[#ff5c00]">
                        {product.name}
                      </h3>
                    </Link>

                    <div className="mt-1.5 flex items-baseline gap-1">
                      <strong className="text-base font-black text-[#ff5c00]">
                        {product.price}
                      </strong>
                      <span className="text-[10px] font-bold text-[#6b7280]">
                        {CURRENCY}
                      </span>
                      {product.oldPrice && (
                        <del className="text-[10px] text-gray-400">
                          {product.oldPrice}
                        </del>
                      )}
                    </div>

                    <button
                      onClick={() => handleAddToCart(product)}
                      className="mt-2 flex w-full items-center justify-center gap-1 rounded-lg bg-[#ff5c00] py-2 text-[11px] font-bold text-white transition hover:bg-[#e64a00] active:scale-[0.98]"
                    >
                      <ShoppingCart className="h-3 w-3" />
                      أضف للسلة
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Footer />

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