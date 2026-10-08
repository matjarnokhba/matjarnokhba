"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Star, Truck, ShoppingCart, Heart, Share2, Check } from "lucide-react";
import type { Product } from "@/lib/data/products";
import { CURRENCY } from "@/lib/data/products";
import { useFavorites } from "@/lib/hooks/useFavorites";

type ProductCardProps = {
  product: Product;
  onAddToCart: (product: Product) => void;
};

export default function ProductCard({
  product,
  onAddToCart,
}: ProductCardProps) {
  const router = useRouter();
  const { isFavorite, toggleFavorite } = useFavorites();
  const [shared, setShared] = useState(false);

  const discountPercent = product.oldPrice
    ? Math.round(((product.oldPrice - product.price) / product.oldPrice) * 100)
    : 0;

  const mainImage = product.images[0];
  const fav = isFavorite(product.id);

  const productUrl = `/product/${product.sellerSlug || "unknown"}/${product.slug}`;

  function handleAddToCart(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    if (product.hasOptions) {
      router.push(productUrl);
    } else {
      onAddToCart(product);
    }
  }

  async function handleShare(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    const fullUrl = `${window.location.origin}${productUrl}`;
    const shareData = {
      title: product.name,
      text: `شاهد هذا المنتج: ${product.name}`,
      url: fullUrl,
    };

    try {
      // Web Share API (الهاتف)
      if (navigator.share) {
        await navigator.share(shareData);
        setShared(true);
        setTimeout(() => setShared(false), 2000);
        return;
      }

      // Fallback: نسخ الرابط
      await navigator.clipboard.writeText(fullUrl);
      setShared(true);
      setTimeout(() => setShared(false), 2000);
    } catch (err) {
      // المستخدم أغلق النافذة — لا نفعل شيئاً
      if ((err as Error)?.name !== "AbortError") {
        console.error(err);
      }
    }
  }

  return (
    <article className="group relative flex flex-col overflow-hidden bg-white sm:rounded-xl sm:border sm:border-gray-100 sm:transition sm:hover:border-[#ff5c00]/30 sm:hover:shadow-lg">
      <Link
        href={productUrl}
        className="relative block overflow-hidden bg-gray-50"
      >
        <img
          src={mainImage}
          alt={product.name}
          className="aspect-square w-full object-cover transition duration-500 group-hover:scale-105"
        />

        {discountPercent > 0 && (
          <span className="absolute left-1.5 top-1.5 rounded bg-[#ff5c00] px-1.5 py-0.5 text-[9px] font-black text-white shadow-sm sm:left-2 sm:top-2 sm:rounded-md sm:px-2 sm:text-[10px]">
            -{discountPercent}%
          </span>
        )}

        {product.badge && (
          <span
            className={`absolute left-1.5 hidden rounded-md bg-[#111827]/85 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur sm:block ${
              discountPercent > 0 ? "top-9" : "top-2"
            }`}
          >
            {product.badge}
          </span>
        )}

        {product.hasOptions && (
          <span className="absolute bottom-1.5 left-1.5 rounded-md bg-white/95 px-1.5 py-0.5 text-[9px] font-bold text-[#111827] shadow-sm backdrop-blur sm:bottom-2 sm:left-2 sm:text-[10px]">
            خيارات متعددة
          </span>
        )}

        {/* ═══ أزرار الصورة (قلب + مشاركة) ═══ */}
        <div className="absolute right-1.5 top-1.5 flex flex-col gap-1.5 sm:right-2 sm:top-2">
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              toggleFavorite(product);
            }}
            className={`flex h-7 w-7 items-center justify-center rounded-full shadow-md backdrop-blur transition active:scale-90 sm:h-8 sm:w-8 ${
              fav
                ? "bg-red-500 text-white"
                : "bg-white/90 text-[#111827] hover:bg-white"
            }`}
            aria-label="المفضلة"
          >
            <Heart
              className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${fav ? "fill-current" : ""}`}
            />
          </button>

          <button
            onClick={handleShare}
            className={`flex h-7 w-7 items-center justify-center rounded-full shadow-md backdrop-blur transition active:scale-90 sm:h-8 sm:w-8 ${
              shared
                ? "bg-green-500 text-white"
                : "bg-white/90 text-[#111827] hover:bg-white"
            }`}
            aria-label="مشاركة"
          >
            {shared ? (
              <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            ) : (
              <Share2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            )}
          </button>
        </div>

        {product.freeShipping && (
          <span className="absolute bottom-2 right-2 hidden items-center gap-1 rounded-md bg-green-500/95 px-1.5 py-0.5 text-[9px] font-bold text-white shadow-sm sm:flex">
            <Truck className="h-3 w-3" />
            مجاني
          </span>
        )}

        <button
          onClick={handleAddToCart}
          className="absolute bottom-1.5 right-1.5 flex h-8 w-8 items-center justify-center rounded-full bg-[#ff5c00] text-white shadow-lg transition hover:bg-[#e64a00] active:scale-95 sm:hidden"
          aria-label="أضف للسلة"
        >
          <ShoppingCart className="h-4 w-4" />
        </button>

        <button
          onClick={handleAddToCart}
          className="absolute bottom-2 left-2 right-2 hidden translate-y-12 rounded-lg bg-[#ff5c00] py-2 text-xs font-bold text-white opacity-0 shadow-lg transition-all duration-300 hover:bg-[#e64a00] group-hover:translate-y-0 group-hover:opacity-100 sm:block"
        >
          {product.hasOptions ? "اختر الخيارات" : "أضف للسلة +"}
        </button>
      </Link>

      <div className="flex flex-1 flex-col p-1.5 sm:p-3">
        <Link href={productUrl}>
          <h3 className="line-clamp-2 min-h-[2rem] text-[11px] font-medium leading-tight text-[#111827] transition hover:text-[#ff5c00] sm:min-h-[2.5rem] sm:text-sm">
            {product.name}
          </h3>
        </Link>

        {product.sellerName && (
          <div className="mt-0.5 truncate text-[9px] text-gray-400 sm:text-[10px]">
            {product.sellerName}
          </div>
        )}

        <div className="mt-1 flex items-center gap-1 text-[9px] text-[#6b7280] sm:mt-1.5 sm:gap-2 sm:text-[11px]">
          <div className="flex items-center gap-0.5">
            <Star className="h-2.5 w-2.5 fill-yellow-400 text-yellow-400 sm:h-3 sm:w-3" />
            <span className="font-bold text-[#111827]">{product.rating}</span>
          </div>
          <span>·</span>
          <span className="truncate">{product.sold} مبيع</span>
        </div>

        <div className="mt-1 flex flex-wrap items-baseline gap-1 sm:mt-2 sm:gap-1.5">
          <strong className="text-sm font-black text-[#ff5c00] sm:text-base">
            {product.price}
          </strong>
          <span className="text-[9px] text-[#6b7280] sm:text-[10px]">
            {CURRENCY}
          </span>
          {product.oldPrice && (
            <del className="text-[10px] text-gray-400 sm:text-[11px]">
              {product.oldPrice}
            </del>
          )}
        </div>
      </div>
    </article>
  );
}