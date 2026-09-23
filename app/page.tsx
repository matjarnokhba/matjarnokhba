"use client";

import { useMemo, useState } from "react";
import {
  PRODUCTS,
  getFeaturedProducts,
  searchProducts,
  type Product,
  type CartItem,
} from "@/lib/data/products";
import { CATEGORIES, type CategoryId } from "@/lib/data/categories";

import TopBar from "@/components/layout/TopBar";
import Header from "@/components/layout/Header";
import Navigation from "@/components/layout/Navigation";
import Footer from "@/components/layout/Footer";
import BottomNav from "@/components/layout/BottomNav";

import Hero from "@/components/home/Hero";
import CategoryGrid from "@/components/home/CategoryGrid";
import PromoBanners from "@/components/home/PromoBanners";
import FlashDeals from "@/components/home/FlashDeals";

import ProductGrid from "@/components/products/ProductGrid";
import CartDrawer from "@/components/cart/CartDrawer";
import { useCart } from "@/lib/hooks/useCart";

type SortBy = "featured" | "price-low" | "price-high" | "rating";

export default function Home() {
  const [activeCategoryId, setActiveCategoryId] = useState<CategoryId | "all">("all");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>("featured");
  const [isCartOpen, setIsCartOpen] = useState(false);
  const { items: cartItems, totalCount: cartCount, subtotal, addItem, updateQuantity, removeItem } = useCart();

  const filteredProducts = useMemo(() => {
    let result = search.trim() ? searchProducts(search) : PRODUCTS;

    if (activeCategoryId !== "all") {
      result = result.filter((p) => p.categoryId === activeCategoryId);
    }

    return [...result].sort((a, b) => {
      if (sortBy === "price-low") return a.price - b.price;
      if (sortBy === "price-high") return b.price - a.price;
      if (sortBy === "rating") return b.rating - a.rating;
      return b.sold - a.sold;
    });
  }, [activeCategoryId, search, sortBy]);

  const featuredProducts = useMemo(() => getFeaturedProducts(8), []);

  function handleAddToCart(product: Product) {
    addItem(product);
    setIsCartOpen(true);
  }

  function handleCategoryChange(id: CategoryId | "all") {
    setActiveCategoryId(id);
    document.getElementById("products")?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <main dir="rtl" className="min-h-screen bg-[#f7f6f2] pb-12 text-[#161616] sm:pb-0">
      <TopBar />

      <Header
        search={search}
        onSearchChange={setSearch}
        cartCount={cartCount}
        onCartClick={() => setIsCartOpen(true)}
      />

      <Navigation
        categories={CATEGORIES}
        activeCategoryId={activeCategoryId}
        onCategoryChange={handleCategoryChange}
      />

      <Hero />

      <CategoryGrid
        categories={CATEGORIES}
        activeCategoryId={activeCategoryId}
        onCategoryClick={handleCategoryChange}
      />

      <PromoBanners />

      <FlashDeals />

      <section className="bg-white px-2 py-14 sm:px-5">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 flex items-end justify-between">
            <div>
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-[#b17f3f]">
                الأكثر طلباً
              </span>
              <h2 className="mt-2 text-2xl font-black sm:text-3xl">
                منتجات مميزة
              </h2>
            </div>
            <span className="text-xs text-[#b17f3f]">عرض الكل ←</span>
          </div>

          <ProductGrid
            products={featuredProducts}
            onAddToCart={handleAddToCart}
          />
        </div>
      </section>

      <section id="products" className="bg-[#f7f6f2] px-2 py-16 sm:px-5">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div>
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-[#b17f3f]">
                كل المنتجات
              </span>
              <h2 className="mt-2 text-3xl font-black sm:text-4xl">
                اختر ما يشبهك
              </h2>
              <p className="mt-2 text-sm text-[#918d84]">
                {filteredProducts.length} منتج متاح الآن
              </p>
            </div>

            <select
              aria-label="ترتيب المنتجات"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortBy)}
              className="rounded-full border border-black/10 bg-white px-4 py-2.5 text-sm font-bold outline-none"
            >
              <option value="featured">ترتيب: مميز</option>
              <option value="rating">الأعلى تقييمًا</option>
              <option value="price-low">السعر: الأقل</option>
              <option value="price-high">السعر: الأعلى</option>
            </select>
          </div>

          <div className="mt-10">
            <ProductGrid
              products={filteredProducts}
              onAddToCart={handleAddToCart}
            />
          </div>
        </div>
      </section>

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