"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  Star,
  Truck,
  RotateCcw,
  Heart,
  ShoppingCart,
  Minus,
  Plus,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

import TopBar from "@/components/layout/TopBar";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import ProductActionBar from "@/components/products/ProductActionBar";
import ProductGrid from "@/components/products/ProductGrid";

import {
  CURRENCY,
  FREE_SHIPPING_THRESHOLD,
  type Product,
} from "@/lib/data/products";
import { useCart } from "@/lib/hooks/useCart";

export default function ProductPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  // ═══════ State ═══════
  const [product, setProduct] = useState<Product | null>(null);
  const [related, setRelated] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedImage, setSelectedImage] = useState(0);
  const [selectedColor, setSelectedColor] = useState<string | undefined>();
  const [selectedSize, setSelectedSize] = useState<string | undefined>();
  const [quantity, setQuantity] = useState(1);
  const [isFavorite, setIsFavorite] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [search, setSearch] = useState("");

  const {
    items: cartItems,
    totalCount: cartCount,
    subtotal,
    addItem,
    updateQuantity,
    removeItem,
  } = useCart();

  // ═══════ جلب المنتج من API ═══════
  useEffect(() => {
    async function loadProduct() {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`/api/products/${slug}`);
        const data = await res.json();

        if (!data.success) {
          setError(data.message || "المنتج غير موجود");
          setLoading(false);
          return;
        }

        const p: Product = data.product;
        setProduct(p);
        setSelectedColor(p.colors?.[0]);
        setSelectedSize(p.sizes?.[0]);

        // جلب منتجات مشابهة
        if (p.categoryId) {
          const relatedRes = await fetch(
            `/api/products?category=${p.categoryId}`
          );
          const relatedData = await relatedRes.json();
          if (relatedData.success) {
            setRelated(
              relatedData.products.filter((rp: Product) => rp.id !== p.id).slice(0, 8)
            );
          }
        }
      } catch (err) {
        console.error(err);
        setError("فشل الاتصال بالخادم");
      } finally {
        setLoading(false);
      }
    }

    if (slug) loadProduct();
  }, [slug]);

  // ═══════ إضافة للسلة ═══════
  function handleAddToCart() {
    if (!product) return;
    addItem(product, quantity, selectedColor, selectedSize);
    setIsCartOpen(true);
  }

  function handleRelatedAddToCart(p: Product) {
    addItem(p);
    setIsCartOpen(true);
  }

  // ═══════ العرض: التحميل ═══════
  if (loading) {
    return (
      <main dir="rtl" className="min-h-screen bg-[#f7f6f2] text-[#161616]">
        <TopBar />
        <Header
          search={search}
          onSearchChange={setSearch}
          cartCount={cartCount}
          onCartClick={() => setIsCartOpen(true)}
        />
        <div className="mx-auto max-w-7xl px-3 py-6">
          <div className="grid gap-6 lg:grid-cols-2 lg:gap-10">
            <div className="aspect-square animate-pulse rounded-2xl bg-gray-200" />
            <div className="space-y-4">
              <div className="h-8 animate-pulse rounded bg-gray-200" />
              <div className="h-6 w-2/3 animate-pulse rounded bg-gray-200" />
              <div className="h-12 animate-pulse rounded bg-gray-200" />
              <div className="h-32 animate-pulse rounded bg-gray-200" />
            </div>
          </div>
        </div>
      </main>
    );
  }

  // ═══════ العرض: خطأ ═══════
  if (error || !product) {
    return (
      <main dir="rtl" className="min-h-screen bg-[#f7f6f2] text-[#161616]">
        <TopBar />
        <Header
          search={search}
          onSearchChange={setSearch}
          cartCount={cartCount}
          onCartClick={() => setIsCartOpen(true)}
        />
        <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
          <div className="text-6xl">😕</div>
          <h1 className="mt-4 text-2xl font-black">
            {error || "المنتج غير موجود"}
          </h1>
          <p className="mt-2 text-sm text-[#6b7280]">
            ربما تم حذفه أو الرابط غير صحيح.
          </p>
          <Link
            href="/"
            className="mt-6 rounded-full bg-[#ff5c00] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#e64a00]"
          >
            العودة للرئيسية
          </Link>
        </div>
        <Footer />
      </main>
    );
  }

  // ═══════ حسابات ═══════
  const discountPercent = product.oldPrice
    ? Math.round(
        ((product.oldPrice - product.price) / product.oldPrice) * 100
      )
    : 0;

  const hasNextImage = selectedImage < product.images.length - 1;
  const hasPrevImage = selectedImage > 0;

  // ═══════ العرض الرئيسي ═══════
  return (
    <main
      dir="rtl"
      className="min-h-screen bg-[#f7f6f2] pb-24 text-[#161616] sm:pb-0"
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
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1 font-bold text-[#ff5c00] hover:underline"
          >
            <ArrowRight className="h-3.5 w-3.5" />
            رجوع
          </button>
          <span>/</span>
          <Link href="/" className="hover:text-[#ff5c00]">
            الرئيسية
          </Link>
          {product.categoryName && (
            <>
              <span>/</span>
              <span>{product.categoryName}</span>
            </>
          )}
        </div>
      </div>

      {/* المحتوى */}
      <div className="mx-auto max-w-7xl px-3 py-3 lg:px-4 lg:py-6">
        <div className="grid gap-4 lg:grid-cols-2 lg:gap-8">
          {/* معرض الصور */}
          <div className="lg:sticky lg:top-24 lg:self-start">
            <div className="relative overflow-hidden rounded-2xl bg-white">
              <div className="relative aspect-square overflow-hidden bg-gray-50">
                <img
                  src={product.images[selectedImage]}
                  alt={product.name}
                  className="h-full w-full object-cover"
                />

                {discountPercent > 0 && (
                  <span className="absolute left-3 top-3 rounded-md bg-[#ff5c00] px-2.5 py-1 text-xs font-black text-white shadow-md">
                    -{discountPercent}%
                  </span>
                )}
                {product.badge && (
                  <span className="absolute right-3 top-3 rounded-md bg-[#111827]/85 px-2.5 py-1 text-xs font-bold text-white backdrop-blur">
                    {product.badge}
                  </span>
                )}

                <button
                  onClick={() => setIsFavorite(!isFavorite)}
                  className={`absolute bottom-3 left-3 flex h-10 w-10 items-center justify-center rounded-full shadow-lg transition ${
                    isFavorite ? "bg-red-500 text-white" : "bg-white text-[#111827]"
                  }`}
                  aria-label="المفضلة"
                >
                  <Heart
                    className={`h-5 w-5 ${isFavorite ? "fill-current" : ""}`}
                  />
                </button>

                {product.images.length > 1 && (
                  <>
                    {hasPrevImage && (
                      <button
                        onClick={() => setSelectedImage(selectedImage - 1)}
                        className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 shadow-md backdrop-blur transition hover:bg-white"
                        aria-label="السابق"
                      >
                        <ChevronRight className="h-5 w-5" />
                      </button>
                    )}
                    {hasNextImage && (
                      <button
                        onClick={() => setSelectedImage(selectedImage + 1)}
                        className="absolute left-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 shadow-md backdrop-blur transition hover:bg-white"
                        aria-label="التالي"
                      >
                        <ChevronLeft className="h-5 w-5" />
                      </button>
                    )}
                  </>
                )}
              </div>

              {product.images.length > 1 && (
                <div className="flex gap-2 overflow-x-auto p-2">
                  {product.images.map((img, i) => (
                    <button
                      key={i}
                      onClick={() => setSelectedImage(i)}
                      className={`h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 transition ${
                        selectedImage === i
                          ? "border-[#ff5c00]"
                          : "border-transparent opacity-60 hover:opacity-100"
                      }`}
                    >
                      <img src={img} alt="" className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* التفاصيل */}
          <div className="flex flex-col gap-3">
            {/* التصنيف + الماركة */}
            <div className="flex flex-wrap items-center gap-2">
              {product.categoryName && (
                <span className="rounded-full bg-[#fff4ed] px-3 py-1 text-xs font-bold text-[#ff5c00]">
                  {product.categoryName}
                </span>
              )}
              {product.brand && (
                <span className="text-xs text-[#6b7280]">
                  بواسطة <strong className="text-[#111827]">{product.brand}</strong>
                </span>
              )}
            </div>

            <h1 className="text-lg font-black leading-tight text-[#111827] lg:text-2xl">
              {product.name}
            </h1>

            <div className="flex items-center gap-3 text-sm">
              <div className="flex items-center gap-1">
                <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                <strong className="text-[#111827]">{product.rating}</strong>
              </div>
              <span className="text-[#6b7280]">· {product.reviews} مراجعة</span>
              <span className="text-[#6b7280]">· {product.sold} مبيع</span>
            </div>

            {/* السعر */}
            <div className="flex flex-wrap items-baseline gap-2 rounded-lg bg-white px-3 py-2">
              <strong className="text-2xl font-black text-[#ff5c00]">
                {product.price}
              </strong>
              <span className="text-xs font-bold text-[#6b7280]">{CURRENCY}</span>
              {product.oldPrice && (
                <del className="text-sm text-gray-400">
                  {product.oldPrice} {CURRENCY}
                </del>
              )}
              {discountPercent > 0 && (
                <span className="rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-bold text-red-600">
                  وفّر {discountPercent}%
                </span>
              )}
            </div>

            {/* الألوان */}
            {product.colors && product.colors.length > 0 && (
              <div className="rounded-lg bg-white px-3 py-2.5">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-bold">اللون:</span>
                  <span className="text-[10px] text-[#6b7280]">
                    {selectedColor ? "مُحدد" : "اختر"}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {product.colors.map((color) => (
                    <button
                      key={color}
                      onClick={() => setSelectedColor(color)}
                      className={`flex h-8 w-8 items-center justify-center rounded-full border-2 transition ${
                        selectedColor === color
                          ? "border-[#ff5c00] ring-2 ring-[#ff5c00]/20"
                          : "border-gray-200"
                      }`}
                      style={{ backgroundColor: color }}
                      aria-label={`لون ${color}`}
                    >
                      {selectedColor === color && (
                        <div className="h-2.5 w-2.5 rounded-full bg-white mix-blend-difference" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* المقاسات */}
            {product.sizes && product.sizes.length > 0 && (
              <div className="rounded-lg bg-white px-3 py-2.5">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-bold">المقاس:</span>
                  <span className="text-[10px] text-[#6b7280]">
                    {selectedSize ? "مُحدد" : "اختر"}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {product.sizes.map((size) => (
                    <button
                      key={size}
                      onClick={() => setSelectedSize(size)}
                      className={`min-w-[2.5rem] rounded-md border px-2 py-1 text-xs font-bold transition ${
                        selectedSize === size
                          ? "border-[#ff5c00] bg-[#fff4ed] text-[#ff5c00]"
                          : "border-gray-200 text-[#111827] hover:border-gray-300"
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* الكمية */}
            <div className="flex items-center gap-3 rounded-lg bg-white px-3 py-2.5">
              <span className="text-xs font-bold">الكمية:</span>
              <div className="flex items-center overflow-hidden rounded-full border border-gray-200">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="flex h-7 w-7 items-center justify-center transition hover:bg-gray-50"
                  aria-label="تقليل"
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <span className="min-w-[2.5rem] border-x border-gray-200 py-1 text-center text-sm font-bold">
                  {quantity}
                </span>
                <button
                  onClick={() => setQuantity(quantity + 1)}
                  className="flex h-7 w-7 items-center justify-center transition hover:bg-gray-50"
                  aria-label="زيادة"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
              <span className="text-[10px] text-[#6b7280]">
                {product.stock} متاح في المخزون
              </span>
            </div>

            {/* زر أضف للسلة (سطح المكتب) */}
            <div className="hidden gap-2 sm:flex">
              <button
                onClick={handleAddToCart}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#ff5c00] py-3 text-sm font-bold text-white shadow-md transition hover:bg-[#e64a00] active:scale-[0.98]"
              >
                <ShoppingCart className="h-4 w-4" />
                أضف إلى السلة
              </button>
              <button
                onClick={() => setIsFavorite(!isFavorite)}
                className={`flex h-11 w-11 items-center justify-center rounded-lg border transition ${
                  isFavorite
                    ? "border-red-500 bg-red-50 text-red-500"
                    : "border-gray-200 text-[#111827] hover:border-gray-300"
                }`}
                aria-label="المفضلة"
              >
                <Heart className={`h-5 w-5 ${isFavorite ? "fill-current" : ""}`} />
              </button>
            </div>

            {/* معلومات */}
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-2 rounded-lg bg-white px-2.5 py-2">
                <Truck className="h-4 w-4 shrink-0 text-green-600" />
                <div className="min-w-0">
                  <strong className="block truncate text-[10px] font-bold">
                    {product.freeShipping
                      ? "شحن مجاني"
                      : `شحن مجاني 300+`}
                  </strong>
                  <span className="block truncate text-[9px] text-[#6b7280]">
                    24-48 ساعة
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-lg bg-white px-2.5 py-2">
                <RotateCcw className="h-4 w-4 shrink-0 text-blue-600" />
                <div className="min-w-0">
                  <strong className="block truncate text-[10px] font-bold">
                    استبدال سهل
                  </strong>
                  <span className="block truncate text-[9px] text-[#6b7280]">
                    14 يوم
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-lg bg-white px-2.5 py-2">
                <ShieldCheck className="h-4 w-4 shrink-0 text-purple-600" />
                <div className="min-w-0">
                  <strong className="block truncate text-[10px] font-bold">
                    ضمان الأصالة
                  </strong>
                  <span className="block truncate text-[9px] text-[#6b7280]">
                    100% أصلي
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-lg bg-white px-2.5 py-2">
                <span className="shrink-0 text-base">💵</span>
                <div className="min-w-0">
                  <strong className="block truncate text-[10px] font-bold">
                    دفع عند الاستلام
                  </strong>
                  <span className="block truncate text-[9px] text-[#6b7280]">
                    كل المغرب
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* الوصف */}
        <section className="mt-5 rounded-lg bg-white p-4">
          <h2 className="mb-2 text-base font-black">الوصف</h2>
          <p className="text-xs leading-7 text-[#4b5563]">{product.description}</p>
        </section>

        {/* التقييمات */}
        <section className="mt-4 rounded-lg bg-white p-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-black">التقييمات</h2>
            <span className="text-xs text-[#6b7280]">
              {product.reviews} مراجعة
            </span>
          </div>

          <div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-8">
            <div className="text-center">
              <div className="text-3xl font-black text-[#ff5c00]">
                {product.rating}
              </div>
              <div className="mt-1 flex items-center justify-center gap-0.5">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className={`h-4 w-4 ${
                      i < Math.round(product.rating)
                        ? "fill-yellow-400 text-yellow-400"
                        : "text-gray-300"
                    }`}
                  />
                ))}
              </div>
              <span className="mt-1 block text-xs text-[#6b7280]">
                من {product.reviews} مراجعة
              </span>
            </div>

            <div className="flex-1 space-y-1.5">
              {[5, 4, 3, 2, 1].map((stars) => {
                const percent =
                  stars === 5 ? 68 : stars === 4 ? 22 : stars === 3 ? 7 : stars === 2 ? 2 : 1;
                return (
                  <div key={stars} className="flex items-center gap-2 text-xs">
                    <span className="flex w-8 items-center gap-0.5 font-bold">
                      {stars}
                      <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                    </span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                      <div
                        className="h-full bg-yellow-400"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                    <span className="w-10 text-left text-[#6b7280]">{percent}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* منتجات مشابهة */}
        {related.length > 0 && (
          <section className="mt-5">
            <div className="mb-3 flex items-end justify-between">
              <h2 className="text-base font-black sm:text-lg">منتجات مشابهة</h2>
            </div>
            <ProductGrid products={related} onAddToCart={handleRelatedAddToCart} />
          </section>
        )}
      </div>

      <Footer />

      <ProductActionBar
        onAddToCart={handleAddToCart}
        onBuyNow={() => {
          handleAddToCart();
          router.push("/checkout");
        }}
      />
    </main>
  );
}