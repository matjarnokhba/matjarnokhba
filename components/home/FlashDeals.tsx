"use client";

import { useEffect, useState } from "react";
import { Flame, Clock, Loader2 } from "lucide-react";
import Link from "next/link";
import { CURRENCY, type Product } from "@/lib/data/products";

function useCountdown() {
  const [timeLeft, setTimeLeft] = useState({
    hours: 0,
    minutes: 0,
    seconds: 0,
  });

  useEffect(() => {
    const endTime = new Date();
    endTime.setHours(23, 59, 59, 999);

    const update = () => {
      const now = new Date();
      const diff = endTime.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeLeft({ hours: 0, minutes: 0, seconds: 0 });
        return;
      }

      setTimeLeft({
        hours: Math.floor(diff / (1000 * 60 * 60)),
        minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((diff % (1000 * 60)) / 1000),
      });
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  return timeLeft;
}

export default function FlashDeals() {
  const { hours, minutes, seconds } = useCountdown();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // ═══ جلب المنتجات من API ═══
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/products");
        const data = await res.json();
        if (data.success) {
          // فلترة: منتجات لها خصم >= 25%
          const withDiscount = (data.products as Product[]).filter((p) => {
            if (!p.oldPrice) return false;
            const discount = ((p.oldPrice - p.price) / p.oldPrice) * 100;
            return discount >= 25;
          });
          setProducts(withDiscount.slice(0, 6));
        }
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const pad = (n: number) => String(n).padStart(2, "0");

  // ═══ لا تُظهر القسم إذا لا توجد منتجات ═══
  if (!loading && products.length === 0) return null;

  return (
    <section className="bg-white py-4 sm:py-6">
      <div className="mx-auto max-w-7xl px-3 sm:px-4">
        {/* الرأس */}
        <div className="mb-3 flex flex-col gap-2 sm:mb-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-red-500 shadow-md sm:h-8 sm:w-8">
              <Flame className="h-3.5 w-3.5 text-white sm:h-4 sm:w-4" />
            </div>
            <h2 className="text-base font-black text-[#111827] sm:text-xl">
              عروض محدودة
            </h2>
          </div>

          {/* العدّاد */}
          <div className="flex items-center gap-2">
            <Clock className="h-3.5 w-3.5 text-[#ff5c00] sm:h-4 sm:w-4" />
            <span className="text-[10px] text-[#6b7280] sm:text-xs">
              ينتهي خلال
            </span>
            <div className="flex items-center gap-0.5 font-mono text-xs font-bold text-[#ff5c00] sm:gap-1 sm:text-sm">
              <span className="rounded bg-red-50 px-1 py-0.5 text-red-600 sm:px-1.5">
                {pad(hours)}
              </span>
              <span>:</span>
              <span className="rounded bg-red-50 px-1 py-0.5 text-red-600 sm:px-1.5">
                {pad(minutes)}
              </span>
              <span>:</span>
              <span className="rounded bg-red-50 px-1 py-0.5 text-red-600 sm:px-1.5">
                {pad(seconds)}
              </span>
            </div>
          </div>
        </div>

        {/* المحتوى */}
        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-[#ff5c00]" />
          </div>
        ) : (
          <div className="no-scrollbar flex gap-2 overflow-x-auto pb-2 sm:gap-3 sm:grid sm:grid-cols-3 sm:gap-4 lg:grid-cols-6">
            {products.map((product) => {
              const discount = product.oldPrice
                ? Math.round(
                    ((product.oldPrice - product.price) / product.oldPrice) * 100
                  )
                : 0;

              return (
                <Link
                  key={product.id}
                  href={`/product/${product.sellerSlug || "unknown"}/${product.slug}`}
                  className="group w-32 shrink-0 sm:w-auto sm:shrink"
                >
                  <div className="relative overflow-hidden rounded-xl bg-gray-50">
                    <img
                      src={product.images[0]}
                      alt={product.name}
                      className="aspect-square w-full object-cover transition duration-500 group-hover:scale-105"
                    />

                    {/* شارة الخصم */}
                    <span className="absolute right-1.5 top-1.5 rounded-full bg-[#ff5c00] px-1.5 py-0.5 text-[9px] font-black text-white shadow-md sm:right-2 sm:top-2 sm:px-2 sm:text-[10px]">
                      -{discount}%
                    </span>

                    {/* شريط التقدم */}
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-200">
                      <div
                        className="h-full bg-gradient-to-r from-[#ff5c00] to-red-500"
                        style={{ width: `${Math.min(discount + 40, 95)}%` }}
                      />
                    </div>
                  </div>

                  {/* السعر */}
                  <div className="mt-1.5">
                    <div className="flex flex-wrap items-baseline gap-1 sm:gap-1.5">
                      <strong className="text-sm font-black text-[#ff5c00] sm:text-base">
                        {product.price}
                      </strong>
                      <span className="text-[9px] text-[#6b7280] sm:text-[10px]">
                        {CURRENCY}
                      </span>
                      {product.oldPrice && (
                        <del className="text-[9px] text-gray-400 sm:text-[10px]">
                          {product.oldPrice}
                        </del>
                      )}
                    </div>
                    <p className="mt-0.5 line-clamp-1 text-[10px] text-[#4b5563] sm:mt-1 sm:text-[11px]">
                      {product.name}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}