"use client";

import { useState, useEffect, useMemo } from "react";
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
  Store,
} from "lucide-react";

import TopBar from "@/components/layout/TopBar";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import ProductActionBar from "@/components/products/ProductActionBar";
import ProductGrid from "@/components/products/ProductGrid";
import CartDrawer from "@/components/cart/CartDrawer";

import { CURRENCY, type Product } from "@/lib/data/products";
import { useCart } from "@/lib/hooks/useCart";
import { useFavorites } from "@/lib/hooks/useFavorites";

// ═══════ الأنواع ═══════
type FullOption = {
  id: number;
  categoryAttributeId: number | null;
  name: string;
  type: string;
  order: number;
  values: Array<{
    id: number;
    value: string;
    colorHex: string | null;
    order: number;
  }>;
};

type FullVariant = {
  id: number;
  sku: string;
  price: number;
  oldPrice: number | null;
  stock: number;
  available: number;
  isDefault: boolean;
  optionsHash: string;
  optionValueIds: number[];
  optionValueLabels: string[];
};

type FullProduct = {
  id: number;
  sellerId: number;
  sellerSlug: string;
  sellerName: string;
  name: string;
  slug: string;
  description: string;
  brand?: string;
  badge?: string;
  rating: number;
  reviews: number;
  sold: number;
  freeShipping: boolean;
  categoryId: string;
  categoryName: string;
  images: string[];
  options: FullOption[];
  variants: FullVariant[];
};

export default function ProductClient() {
  const params = useParams();
  const router = useRouter();
  const sellerSlug = params.sellerSlug as string;
  const productSlug = params.productSlug as string;

  const [product, setProduct] = useState<FullProduct | null>(null);
  const [related, setRelated] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [reviews, setReviews] = useState<any[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [search, setSearch] = useState("");

  // خريطة: optionId → valueId
  const [selectedOptions, setSelectedOptions] = useState<
    Record<number, number>
  >({});

  const {
    items: cartItems,
    totalCount: cartCount,
    subtotal,
    addItem,
    updateQuantity,
    removeItem,
  } = useCart();

  const { isFavorite, toggleFavorite } = useFavorites();

  // ═══ جلب المنتج (full=1) ═══
  useEffect(() => {
    async function loadProduct() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/products/${productSlug}?seller=${sellerSlug}&full=1`
        );
        const data = await res.json();

        if (!data.success) {
          setError(data.message || "المنتج غير موجود");
          return;
        }

        const p: FullProduct = data.product;
        setProduct(p);

        // ═══ تهيئة القيم المختارة من defaultVariant ═══
        const dv = p.variants.find((v) => v.isDefault) || p.variants[0];
        if (dv && p.options.length > 0) {
          const init: Record<number, number> = {};
          // اربط كل option بقيمته في defaultVariant
          for (const opt of p.options) {
            const match = opt.values.find((v) =>
              dv.optionValueIds.includes(v.id)
            );
            if (match) init[opt.id] = match.id;
          }
          setSelectedOptions(init);
        }

        // ═══ منتجات مشابهة ═══
        if (p.categoryId) {
          const rRes = await fetch(`/api/products?category=${p.categoryId}`);
          const rData = await rRes.json();
          if (rData.success) {
            setRelated(
              rData.products.filter((rp: Product) => rp.id !== p.id).slice(0, 8)
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

    if (productSlug && sellerSlug) loadProduct();
  }, [productSlug, sellerSlug]);

  // ═══ المراجعات ═══
  useEffect(() => {
    async function loadReviews() {
      if (!product) return;
      try {
        const res = await fetch(`/api/reviews?productId=${product.id}`);
        const data = await res.json();
        if (data.success) setReviews(data.reviews);
      } catch {
        // silent
      }
    }
    loadReviews();
  }, [product]);

  // ═══ الـvariant النشط ═══
  const activeVariant = useMemo(() => {
    if (!product) return null;
    if (product.options.length === 0) {
      return product.variants[0] || null;
    }
    // هل كل options مختارة؟
    const allSelected = product.options.every(
      (o) => selectedOptions[o.id] !== undefined
    );
    if (!allSelected) return null;

    const selectedIds = product.options
      .map((o) => selectedOptions[o.id])
      .sort((a, b) => a - b);

    return (
      product.variants.find((v) => {
        const vIds = [...v.optionValueIds].sort((a, b) => a - b);
        if (vIds.length !== selectedIds.length) return false;
        return vIds.every((id, i) => id === selectedIds[i]);
      }) || null
    );
  }, [product, selectedOptions]);

  // ═══ السعر المعروض ═══
  const displayPrice = activeVariant?.price ?? product?.variants[0]?.price ?? 0;
  const displayOldPrice =
    activeVariant?.oldPrice ?? product?.variants[0]?.oldPrice ?? null;
  const displayStock = activeVariant?.available ?? 0;

  const discountPercent =
    displayOldPrice && displayOldPrice > displayPrice
      ? Math.round(
          ((displayOldPrice - displayPrice) / displayOldPrice) * 100
        )
      : 0;

  // ═══ اختيار قيمة ═══
  function selectOptionValue(optionId: number, valueId: number) {
    setSelectedOptions((prev) => ({ ...prev, [optionId]: valueId }));
    setQuantity(1);
  }

  // ═══ هل قيمة معينة متاحة؟ (لها variant بمخزون) ═══
  function isValueAvailable(optionId: number, valueId: number): boolean {
    if (!product) return false;
    // نبني خريطة كاملة للاختيار مع هذه القيمة
    const tentative = { ...selectedOptions, [optionId]: valueId };
    const allSelected = product.options.every(
      (o) => tentative[o.id] !== undefined
    );
    if (!allSelected) {
      // حتى لو ناقص، افحص لو هناك variant بهذه القيمة بمخزون
      return product.variants.some(
        (v) =>
          v.available > 0 &&
          v.optionValueIds.includes(valueId) &&
          product.options
            .filter((o) => o.id !== optionId)
            .every(
              (o) =>
                tentative[o.id] === undefined ||
                v.optionValueIds.includes(tentative[o.id])
            )
      );
    }
    const selectedIds = product.options
      .map((o) => tentative[o.id])
      .sort((a, b) => a - b);
    const variant = product.variants.find((v) => {
      const vIds = [...v.optionValueIds].sort((a, b) => a - b);
      if (vIds.length !== selectedIds.length) return false;
      return vIds.every((id, i) => id === selectedIds[i]);
    });
    return !!variant && variant.available > 0;
  }

  // ═══ إضافة للسلة ═══
  function handleAddToCart() {
    if (!product || !activeVariant) return;
    if (activeVariant.available < quantity) return;

    const variantLabel = activeVariant.optionValueLabels.join(" / ");

    // ابحث عن selectedColor/selectedSize للعرض
    let selectedColor: string | undefined;
    let selectedSize: string | undefined;
    for (const opt of product.options) {
      const valId = selectedOptions[opt.id];
      const val = opt.values.find((v) => v.id === valId);
      if (!val) continue;
      if (opt.type === "color") selectedColor = val.value;
      if (opt.name.includes("مقاس") || opt.name.toLowerCase().includes("size"))
        selectedSize = val.value;
    }

    // نبني كائن Product متوافق مع CartItem
    const cartProduct: any = {
      id: product.id,
      name: product.name,
      slug: product.slug,
      description: product.description,
      brand: product.brand,
      badge: product.badge,
      rating: product.rating,
      reviews: product.reviews,
      sold: product.sold,
      freeShipping: product.freeShipping,
      categoryId: product.categoryId,
      categoryName: product.categoryName,
      price: activeVariant.price,
      oldPrice: activeVariant.oldPrice || undefined,
      images: product.images,
      stock: activeVariant.available,
      sellerSlug: product.sellerSlug,
      sellerName: product.sellerName,
      sellerId: product.sellerId,
    };

    addItem(cartProduct, {
      variantId: activeVariant.id,
      variantLabel,
      quantity,
      stockSnapshot: activeVariant.available,
      selectedColor,
      selectedSize,
    });

    setIsCartOpen(true);
  }

  function handleRelatedAddToCart(p: Product) {
    if (!p.variantId) return;
    addItem(p, {
      variantId: p.variantId,
      variantLabel: "",
      quantity: 1,
      stockSnapshot: p.stock,
    });
    setIsCartOpen(true);
  }

  // ═══ التحميل ═══
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

  const hasNextImage = selectedImage < product.images.length - 1;
  const hasPrevImage = selectedImage > 0;
  const canAdd = activeVariant && activeVariant.available >= quantity;

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
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 px-4 py-2 text-xs text-[#6b7280]">
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
          {product.sellerSlug && (
            <>
              <span>/</span>
              <Link
                href={`/store/${product.sellerSlug}`}
                className="hover:text-[#ff5c00]"
              >
                {product.sellerName}
              </Link>
            </>
          )}
        </div>
      </div>

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
                  onClick={() => toggleFavorite(product as any)}
                  className={`absolute bottom-3 left-3 flex h-10 w-10 items-center justify-center rounded-full shadow-lg transition ${
                    isFavorite(product.id)
                      ? "bg-red-500 text-white"
                      : "bg-white text-[#111827]"
                  }`}
                  aria-label="المفضلة"
                >
                  <Heart
                    className={`h-5 w-5 ${isFavorite(product.id) ? "fill-current" : ""}`}
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
                      <img
                        src={img}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* التفاصيل */}
          <div className="flex flex-col gap-3">
            {product.sellerSlug && (
              <Link
                href={`/store/${product.sellerSlug}`}
                className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs font-bold text-gray-700 transition hover:text-[#ff5c00]"
              >
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-yellow-400 to-amber-500">
                  <Store className="h-3 w-3 text-white" />
                </div>
                <span>من متجر</span>
                <span className="font-black">{product.sellerName}</span>
                <ChevronLeft className="ml-auto h-3.5 w-3.5" />
              </Link>
            )}

            <div className="flex flex-wrap items-center gap-2">
              {product.categoryName && (
                <span className="rounded-full bg-[#fff4ed] px-3 py-1 text-xs font-bold text-[#ff5c00]">
                  {product.categoryName}
                </span>
              )}
              {product.brand && (
                <span className="text-xs text-[#6b7280]">
                  بواسطة{" "}
                  <strong className="text-[#111827]">{product.brand}</strong>
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
                {displayPrice}
              </strong>
              <span className="text-xs font-bold text-[#6b7280]">
                {CURRENCY}
              </span>
              {displayOldPrice && (
                <del className="text-sm text-gray-400">
                  {displayOldPrice} {CURRENCY}
                </del>
              )}
              {discountPercent > 0 && (
                <span className="rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-bold text-red-600">
                  وفّر {discountPercent}%
                </span>
              )}
            </div>

            {/* ═══ الخصائص الديناميكية ═══ */}
            {product.options.map((opt) => {
              const selectedValueId = selectedOptions[opt.id];
              const isColor = opt.type === "color";

              return (
                <div key={opt.id} className="rounded-lg bg-white px-3 py-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-black text-gray-700">
                      {opt.name}:
                      {selectedValueId && (
                        <span className="mr-1 text-[#ff5c00]">
                          {
                            opt.values.find((v) => v.id === selectedValueId)
                              ?.value
                          }
                        </span>
                      )}
                    </span>
                  </div>

                  {isColor ? (
                    <div className="flex flex-wrap gap-2">
                      {opt.values.map((v) => {
                        const sel = selectedValueId === v.id;
                        const available = isValueAvailable(opt.id, v.id);
                        const isLight =
                          v.colorHex === "#FFFFFF" ||
                          v.colorHex === "#F5F5DC" ||
                          v.colorHex === "#FFFDD0";
                        return (
                          <button
                            key={v.id}
                            onClick={() => selectOptionValue(opt.id, v.id)}
                            title={v.value}
                            className={`relative flex items-center gap-2 rounded-full border-2 py-1 pl-3 pr-1 transition ${
                              sel
                                ? "border-[#ff5c00] bg-[#fff4ed]"
                                : "border-gray-200 bg-white hover:border-gray-300"
                            } ${!available ? "opacity-40" : ""}`}
                          >
                            <span
                              className={`h-5 w-5 rounded-full border ${
                                isLight
                                  ? "border-gray-300"
                                  : "border-transparent"
                              } ${!available ? "grayscale" : ""}`}
                              style={{
                                backgroundColor: v.colorHex || "#ccc",
                              }}
                            />
                            <span className="text-xs font-bold text-gray-700">
                              {v.value}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {opt.values.map((v) => {
                        const sel = selectedValueId === v.id;
                        const available = isValueAvailable(opt.id, v.id);
                        return (
                          <button
                            key={v.id}
                            onClick={() => selectOptionValue(opt.id, v.id)}
                            disabled={!available}
                            className={`min-w-[48px] rounded-lg border-2 px-3 py-1.5 text-xs font-bold transition ${
                              sel
                                ? "border-[#ff5c00] bg-[#ff5c00] text-white"
                                : available
                                  ? "border-gray-200 bg-white text-gray-700 hover:border-[#ff5c00]"
                                  : "border-gray-100 bg-gray-50 text-gray-300 line-through"
                            }`}
                          >
                            {v.value}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

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
                  onClick={() =>
                    setQuantity(Math.min(displayStock || 99, quantity + 1))
                  }
                  className="flex h-7 w-7 items-center justify-center transition hover:bg-gray-50"
                  aria-label="زيادة"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
              <span
                className={`text-[10px] ${
                  displayStock > 0 ? "text-[#6b7280]" : "text-red-500"
                }`}
              >
                {displayStock > 0
                  ? `${displayStock} متاح في المخزون`
                  : "غير متوفر"}
              </span>
            </div>

            {/* أزرار سطح المكتب */}
            <div className="hidden gap-2 sm:flex">
              <button
                onClick={handleAddToCart}
                disabled={!canAdd}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#ff5c00] py-3 text-sm font-bold text-white shadow-md transition hover:bg-[#e64a00] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ShoppingCart className="h-4 w-4" />
                {!activeVariant
                  ? "اختر الخصائص"
                  : activeVariant.available === 0
                    ? "غير متوفر"
                    : "أضف إلى السلة"}
              </button>
              <button
                onClick={() => toggleFavorite(product as any)}
                className={`flex h-11 w-11 items-center justify-center rounded-lg border transition ${
                  isFavorite(product.id)
                    ? "border-red-500 bg-red-50 text-red-500"
                    : "border-gray-200 text-[#111827] hover:border-gray-300"
                }`}
                aria-label="المفضلة"
              >
                <Heart
                  className={`h-5 w-5 ${isFavorite(product.id) ? "fill-current" : ""}`}
                />
              </button>
            </div>

            {/* معلومات */}
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-2 rounded-lg bg-white px-2.5 py-2">
                <Truck className="h-4 w-4 shrink-0 text-green-600" />
                <div className="min-w-0">
                  <strong className="block truncate text-[10px] font-bold">
                    {product.freeShipping ? "شحن مجاني" : "شحن سريع"}
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
          <p className="text-xs leading-7 text-[#4b5563]">
            {product.description}
          </p>
        </section>

        {/* التقييمات */}
        <section className="mt-4 rounded-lg bg-white p-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-black">التقييمات</h2>
            <span className="text-xs text-[#6b7280]">
              {reviews.length} مراجعة
            </span>
          </div>

          {reviews.length === 0 ? (
            <div className="py-8 text-center">
              <div className="text-4xl">💬</div>
              <p className="mt-2 text-sm text-[#6b7280]">
                لا توجد مراجعات بعد. كن أول من يقيّم!
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {reviews.map((review) => (
                <div
                  key={review.id}
                  className="border-b border-gray-50 pb-3 last:border-0"
                >
                  <div className="flex items-start gap-2">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-600 to-orange-500 text-xs font-black text-white">
                      {review.user?.name?.charAt(0) || "؟"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold">
                          {review.user?.name || "مستخدم"}
                        </span>
                        <span className="text-[10px] text-[#6b7280]">
                          {new Date(review.createdAt).toLocaleDateString(
                            "ar-MA",
                            { day: "numeric", month: "short", year: "numeric" }
                          )}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-0.5">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            className={`h-3 w-3 ${
                              i < review.rating
                                ? "fill-yellow-400 text-yellow-400"
                                : "text-gray-300"
                            }`}
                          />
                        ))}
                      </div>
                      {review.comment && (
                        <p className="mt-1.5 text-xs leading-6 text-[#4b5563]">
                          {review.comment}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* منتجات مشابهة */}
        {related.length > 0 && (
          <section className="mt-5">
            <h2 className="mb-3 text-base font-black sm:text-lg">
              منتجات مشابهة
            </h2>
            <ProductGrid
              products={related}
              onAddToCart={handleRelatedAddToCart}
            />
          </section>
        )}
      </div>

      <Footer />

      <ProductActionBar
        onAddToCart={handleAddToCart}
        onBuyNow={() => {
          if (!canAdd) return;
          handleAddToCart();
          router.push("/checkout");
        }}
        disabled={!canAdd}
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