"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Package, Loader2 } from "lucide-react";

import TopBar from "@/components/layout/TopBar";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import BottomNav from "@/components/layout/BottomNav";
import ProductGrid from "@/components/products/ProductGrid";
import CartDrawer from "@/components/cart/CartDrawer";

import { useCart } from "@/lib/hooks/useCart";

type Category = {
  id: number;
  name: string;
  slug: string;
};

type SortBy = "newest" | "price-low" | "price-high" | "rating" | "sold";

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

export default function CategoryPage() {
  const params = useParams();
  const slug = params.slug as string;

  const [category, setCategory] = useState<Category | null>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortBy>("newest");
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

  // ═══════ جلب التصنيف + المنتجات ═══════
  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [catRes, prodRes] = await Promise.all([
          fetch("/api/categories"),
          fetch(`/api/products?category=${slug}`),
        ]);

        const catData = await catRes.json();
        const prodData = await prodRes.json();

        if (catData.success) {
          const found = catData.categories.find(
            (c: Category) => c.slug === slug
          );
          if (!found) {
            setError("التصنيف غير موجود");
            setLoading(false);
            return;
          }
          setCategory(found);
        }

        if (prodData.success) {
          setProducts(prodData.products);
        } else {
          setError("فشل تحميل المنتجات");
        }
      } catch (err) {
        console.error(err);
        setError("فشل الاتصال بالخادم");
      } finally {
        setLoading(false);
      }
    }

    if (slug) load();
  }, [slug]);

  // ═══════ الترتيب ═══════
  const sortedProducts = useMemo(() => {
    const sorted = [...products];
    if (sortBy === "price-low") return sorted.sort((a, b) => a.price - b.price);
    if (sortBy === "price-high") return sorted.sort((a, b) => b.price - a.price);
    if (sortBy === "rating") return sorted.sort((a, b) => b.rating - a.rating);
    if (sortBy === "sold") return sorted.sort((a, b) => b.sold - a.sold);
    return sorted; // newest — API يرجع desc
  }, [products, sortBy]);

  function handleAddToCart(product: any) {
    addItem(product);
    setIsCartOpen(true);
  }

  const categoryMeta = category
    ? CATEGORY_ICONS[category.slug] || { icon: "🛍️", color: "#6b7280" }
    : null;

  return (
    <main dir="rtl" className="min-h-screen bg-[#f7f6f2] pb-16 text-[#161616] sm:pb-0">
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
          <span>{category?.name || "..."}</span>
        </div>
      </div>

      {/* التحميل */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="h-10 w-10 animate-spin text-[#ff5c00]" />
          <p className="mt-3 text-sm text-[#6b7280]">جاري التحميل...</p>
        </div>
      ) : error ? (
        <div className="mx-auto flex max-w-lg flex-col items-center px-4 py-20 text-center">
          <div className="text-6xl">😕</div>
          <h1 className="mt-4 text-2xl font-black">{error}</h1>
          <Link
            href="/"
            className="mt-6 rounded-full bg-[#ff5c00] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#e64a00]"
          >
            العودة للرئيسية
          </Link>
        </div>
      ) : (
        <div className="mx-auto max-w-7xl px-4 py-6">
          {/* رأس التصنيف */}
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              {categoryMeta && (
                <div
                  className="flex h-14 w-14 items-center justify-center rounded-full text-2xl shadow-sm"
                  style={{ backgroundColor: `${categoryMeta.color}20` }}
                >
                  <span>{categoryMeta.icon}</span>
                </div>
              )}
              <div>
                <h1 className="text-2xl font-black">{category?.name}</h1>
                <p className="mt-0.5 text-xs text-[#6b7280]">
                  {sortedProducts.length} منتج متاح
                </p>
              </div>
            </div>

            {/* الترتيب */}
            <select
              aria-label="ترتيب المنتجات"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortBy)}
              className="rounded-full border border-gray-200 bg-white px-4 py-2.5 text-sm font-bold outline-none focus:border-[#ff5c00]"
            >
              <option value="newest">الأحدث</option>
              <option value="sold">الأكثر مبيعاً</option>
              <option value="rating">الأعلى تقييماً</option>
              <option value="price-low">السعر: الأقل أولاً</option>
              <option value="price-high">السعر: الأعلى أولاً</option>
            </select>
          </div>

          {/* المنتجات */}
          {sortedProducts.length === 0 ? (
            <div className="rounded-2xl bg-white p-12 text-center shadow-sm">
              <div className="flex justify-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gray-100">
                  <Package className="h-10 w-10 text-gray-400" />
                </div>
              </div>
              <h2 className="mt-5 text-lg font-black">لا توجد منتجات</h2>
              <p className="mt-2 text-sm text-[#6b7280]">
                لا توجد منتجات في هذا التصنيف حالياً
              </p>
              <Link
                href="/"
                className="mt-6 inline-block rounded-full bg-[#ff5c00] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#e64a00]"
              >
                تصفح منتجات أخرى
              </Link>
            </div>
          ) : (
            <ProductGrid
              products={sortedProducts}
              onAddToCart={handleAddToCart}
            />
          )}
        </div>
      )}

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