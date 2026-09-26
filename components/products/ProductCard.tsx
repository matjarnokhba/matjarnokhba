"use client";

import Link from "next/link";
import { Star, Truck, ShoppingCart, Heart } from "lucide-react";
import type { Product } from "@/lib/data/products";
import { CURRENCY } from "@/lib/data/products";
import { getCategoryById } from "@/lib/data/categories";
import { useFavorites } from "@/lib/hooks/useFavorites";

type ProductCardProps = {
  product: Product;
  onAddToCart: (product: Product) => void;
};

export default function ProductCard({
  product,
  onAddToCart,
}: ProductCardProps) {
  const { isFavorite, toggleFavorite } = useFavorites();

  const discountPercent = product.oldPrice
    ? Math.round(((product.oldPrice - product.price) / product.oldPrice) * 100)
    : 0;

  const category = getCategoryById(product.categoryId);
  const mainImage = product.images[0];
  const fav = isFavorite(product.id);

  return (
    <article className="group relative flex flex-col overflow-hidden bg-white sm:rounded-xl sm:border sm:border-gray-100 sm:transition sm:hover:border-[#ff5c00]/30 sm:hover:shadow-lg">
      {/* ═══════ الصورة ═══════ */}
      <Link
        href={`/product/${product.slug}`}
        className="relative block overflow-hidden bg-gray-50"
      >
        <img
          src={mainImage}
          alt={product.name}
          className="aspect-square w-full object-cover transition duration-500 group-hover:scale-105"
        />

        {/* شارة الخصم */}
        {discountPercent > 0 && (
          <span className="absolute left-1.5 top-1.5 rounded bg-[#ff5c00] px-1.5 py-0.5 text-[9px] font-black text-white shadow-sm sm:left-2 sm:top-2 sm:rounded-md sm:px-2 sm:text-[10px]">
            -{discountPercent}%
          </span>
        )}

        {/* شارة badge (سطح المكتب فقط) — تظهر تحت شارة الخصم */}
        {product.badge && (
          <span
            className={`absolute left-1.5 hidden rounded-md bg-[#111827]/85 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur sm:block ${
              discountPercent > 0 ? "top-9" : "top-2"
            }`}
          >
            {product.badge}
          </span>
        )}

        {/* زر القلب */}
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleFavorite(product);
          }}
          className={`absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full shadow-md backdrop-blur transition active:scale-90 sm:right-2 sm:top-2 sm:h-8 sm:w-8 ${
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

        {/* شحن مجاني (سطح المكتب فقط) */}
        {product.freeShipping && (
          <span className="absolute bottom-2 right-2 hidden items-center gap-1 rounded-md bg-green-500/95 px-1.5 py-0.5 text-[9px] font-bold text-white shadow-sm sm:flex">
            <Truck className="h-3 w-3" />
            مجاني
          </span>
        )}

        {/* زر السلة — دائري صغير (الهاتف فقط) */}
        <button
          onClick={(e) => {
            e.preventDefault();
            onAddToCart(product);
          }}
          className="absolute bottom-1.5 right-1.5 flex h-8 w-8 items-center justify-center rounded-full bg-[#ff5c00] text-white shadow-lg transition hover:bg-[#e64a00] active:scale-95 sm:hidden"
          aria-label="أضف للسلة"
        >
          <ShoppingCart className="h-4 w-4" />
        </button>

        {/* زر "أضف للسلة" الكبير (سطح المكتب فقط) */}
        <button
          onClick={(e) => {
            e.preventDefault();
            onAddToCart(product);
          }}
          className="absolute bottom-2 left-2 right-2 hidden translate-y-12 rounded-lg bg-[#ff5c00] py-2 text-xs font-bold text-white opacity-0 shadow-lg transition-all duration-300 hover:bg-[#e64a00] group-hover:translate-y-0 group-hover:opacity-100 sm:block"
        >
          أضف للسلة +
        </button>
      </Link>

      {/* ═══════ التفاصيل ═══════ */}
      <div className="flex flex-1 flex-col p-1.5 sm:p-3">
        {/* اسم المنتج */}
        <Link href={`/product/${product.slug}`}>
          <h3 className="line-clamp-2 min-h-[2rem] text-[11px] font-medium leading-tight text-[#111827] transition hover:text-[#ff5c00] sm:min-h-[2.5rem] sm:text-sm">
            {product.name}
          </h3>
        </Link>

        {/* التقييم + المبيعات — سطر واحد */}
        <div className="mt-1 flex items-center gap-1 text-[9px] text-[#6b7280] sm:mt-1.5 sm:gap-2 sm:text-[11px]">
          <div className="flex items-center gap-0.5">
            <Star className="h-2.5 w-2.5 fill-yellow-400 text-yellow-400 sm:h-3 sm:w-3" />
            <span className="font-bold text-[#111827]">{product.rating}</span>
          </div>
          <span>·</span>
          <span className="truncate">{product.sold} مبيع</span>
        </div>

        {/* السعر */}
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

        {/* التصنيف (سطح المكتب فقط) */}
        {category && (
          <span className="mt-1.5 hidden w-fit rounded bg-gray-100 px-1.5 py-0.5 text-[9px] text-[#6b7280] sm:inline-block">
            {category.name}
          </span>
        )}
      </div>
    </article>
  );
}