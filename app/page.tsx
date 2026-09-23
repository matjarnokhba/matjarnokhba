"use client";

import { useEffect, useMemo, useState } from "react";
import { type Product } from "@/lib/data/products";
import { type Category, type CategoryId } from "@/lib/data/categories";

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

// ═══════════════════════════════════════════
// أنواع
// ═══════════════════════════════════════════
type SortBy = "featured" | "price-low" | "price-high" | "rating";

type ApiCategory = {
  id: number;
  name: string;
  slug: string;
  order: number;
};

// تحويل تصنيفات API → شكل categories المستخدم في UI
const CATEGORY_ICONS: Record<string, { icon: string; color: string }> = {
  "men-clothing": { icon: "👔", color: "#3b82f6" },
  "women-clothing": { icon: "👗", color: "#ec4899" },
  "kids-clothing": { icon: "👶", color: "#f59e0b" },
  shoes: { icon: "👟", color: "#10b981" },
  bags: { icon: "👜", color: "#8b5cf6" },
  watches: { icon: "⌚", color: "#0ea5e9" },
  jewelry: { icon: "💎", color: "#f43f5e" },
  perfumes: { icon: "🌸", color: "#d946ef" },
  beauty: { icon: "💄", color: "#fb7185" },
  phones: { icon: "📱", color: "#22c55e" },
  electronics: { icon: "💻", color: "#6366f1" },
  "home-kitchen": { icon: "🏠", color: "#eab308" },
  tools: { icon: "🔧", color: "#64748b" },
  sports: { icon: "⚽", color: "#14b8a6" },
  toys: { icon: "🎮", color: "#a855f7" },
  books: { icon: "📚", color: "#7c3aed" },
};

export default function Home() {
  // ═══════════════════════════════════════════
  // State
  // ═══════════════════════════════════════════
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<ApiCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeCategoryId, setActiveCategoryId] = useState<CategoryId | "all">("all");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>("featured");
  const [isCartOpen, setIsCartOpen] = useState(false);

  const {
    items: cartItems,
    totalCount: cartCount,
    subtotal,
    addItem,
    updateQuantity,
    removeItem,
  } = useCart();

  // ═══════════════════════════════════════════
  // جلب البيانات من API
  // ═══════════════════════════════════════════
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [productsRes, categoriesRes] = await Promise.all([
          fetch("/api/products"),
          fetch("/api/categories"),
        ]);

        const productsData = await productsRes.json();
        const categoriesData = await categoriesRes.json();

        if (productsData.success) {
          setProducts(productsData.products);
        } else {
          setError(productsData.message || "فشل تحميل المنتجات");
        }

        if (categoriesData.success) {
          setCategories(categoriesData.categories);
        }
      } catch (err) {
        console.error(err);
        setError("فشل الاتصال بالخادم");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  // ═══════════════════════════════════════════
  // تحويل التصنيفات لشكل UI
  // ═══════════════════════════════════════════
  const uiCategories: Category[] = useMemo(
    () =>
      categories.map((cat) => {
        const meta = CATEGORY_ICONS[cat.slug] || {
          icon: "🛍️",
          color: "#6b7280",
        };
        return {
          id: cat.slug as CategoryId,
          name: cat.name,
          slug: cat.slug,
          icon: meta.icon,
          color: meta.color,
          order: cat.order,
        };
      }),
    [categories]
  );

  // ═══════════════════════════════════════════
  // الفلترة والترتيب
  // ═══════════════════════════════════════════
  const filteredProducts = useMemo(() => {
    let result = products;

    // فلترة البحث
    const q = search.trim().toLowerCase();
    if (q) {
      result = result.filter((p) => {
        const text = `${p.name} ${p.brand || ""} ${p.categoryName || ""}`.toLowerCase();
        return text.includes(q);
      });
    }

    // فلترة التصنيف
    if (activeCategoryId !== "all") {
      result = result.filter((p) => p.categoryId === activeCategoryId);
    }

    // الترتيب
    return [...result].sort((a, b) => {
      if (sortBy === "price-low") return a.price - b.price;
      if (sortBy === "price-high") return b.price - a.price;
      if (sortBy === "rating") return b.rating - a.rating;
      return b.sold - a.sold;
    });
  }, [products, activeCategoryId, search, sortBy]);

  // ═══════════════════════════════════════════
  // المنتجات المميزة (الأكثر مبيعاً)
  // ═══════════════════════════════════════════
  const featuredProducts = useMemo(
    () => [...products].sort((a, b) => b.sold - a.sold).slice(0, 8),
    [products]
  );

  // ═══════════════════════════════════════════
  // الأحداث
  // ═══════════════════════════════════════════
  function handleAddToCart(product: Product) {
    addItem(product);
    setIsCartOpen(true);
  }

  function handleCategoryChange(id: CategoryId | "all") {
    setActiveCategoryId(id);
    document.getElementById("products")?.scrollIntoView({ behavior: "smooth" });
  }

  // ═══════════════════════════════════════════
  // العرض
  // ═══════════════════════════════════════════
  return (
    <main
      dir="rtl"
      className="min-h-screen bg-[#f7f6f2] pb-12 text-[#161616] sm:pb-0"
    >
      <TopBar />

      <Header
        search={search}
        onSearchChange={setSearch}
        cartCount={cartCount}
        onCartClick={() => setIsCartOpen(true)}
      />

      <Navigation
        categories={uiCategories}
        activeCategoryId={activeCategoryId}
        onCategoryChange={handleCategoryChange}
      />

      <Hero />

      <CategoryGrid
        categories={uiCategories}
        activeCategoryId={activeCategoryId}
        onCategoryClick={handleCategoryChange}
      />

      <PromoBanners />

      <FlashDeals />

      {/* ═══════ منتجات مميزة ═══════ */}
      {!loading && !error && featuredProducts.length > 0 && (
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
            </div>

            <ProductGrid
              products={featuredProducts}
              onAddToCart={handleAddToCart}
            />
          </div>
        </section>
      )}

      {/* ═══════ كل المنتجات ═══════ */}
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
                {loading
                  ? "جاري التحميل..."
                  : `${filteredProducts.length} منتج متاح الآن`}
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
            {loading ? (
              <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
                {[...Array(10)].map((_, i) => (
                  <div
                    key={i}
                    className="aspect-square animate-pulse rounded-xl bg-gray-200"
                  />
                ))}
              </div>
            ) : error ? (
              <div className="py-20 text-center">
                <div className="text-5xl">⚠️</div>
                <h3 className="mt-4 text-lg font-bold">{error}</h3>
                <button
                  onClick={() => window.location.reload()}
                  className="mt-4 rounded-full bg-[#ff5c00] px-6 py-2 text-sm font-bold text-white"
                >
                  إعادة المحاولة
                </button>
              </div>
            ) : (
              <ProductGrid
                products={filteredProducts}
                onAddToCart={handleAddToCart}
              />
            )}
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