"use client";

import { useEffect, useState } from "react";
import { Flame, Clock } from "lucide-react";
import Link from "next/link";
import { PRODUCTS, CURRENCY } from "@/lib/data/products";

// منتجات بخصومات قوية (أكثر من 25%)
const flashProducts = PRODUCTS.filter((p) => {
  if (!p.oldPrice) return false;
  const discount = ((p.oldPrice - p.price) / p.oldPrice) * 100;
  return discount >= 25;
}).slice(0, 6);

function useCountdown() {
  const [timeLeft, setTimeLeft] = useState({
    hours: 0,
    minutes: 0,
    seconds: 0,
  });

  useEffect(() => {
    // ينتهي في منتصف الليل (24 ساعة من الآن)
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

  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <section className="bg-white py-6">
      <div className="mx-auto max-w-7xl px-4">
        {/* الرأس */}
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-red-500 shadow-md">
              <Flame className="h-4 w-4 text-white" />
            </div>
            <h2 className="text-lg font-black text-[#111827] sm:text-xl">
              عروض محدودة
            </h2>
          </div>

          {/* العد​اد */}
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-[#ff5c00]" />
            <span className="text-xs text-[#6b7280]">ينتهي خلال</span>
            <div className="flex items-center gap-1 font-mono text-sm font-bold text-[#ff5c00]">
              <span className="rounded bg-red-50 px-1.5 py-0.5 text-red-600">
                {pad(hours)}
              </span>
              <span>:</span>
              <span className="rounded bg-red-50 px-1.5 py-0.5 text-red-600">
                {pad(minutes)}
              </span>
              <span>:</span>
              <span className="rounded bg-red-50 px-1.5 py-0.5 text-red-600">
                {pad(seconds)}
              </span>
            </div>
          </div>
        </div>

        {/* الشبكة الأفقية */}
        <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar sm:grid sm:grid-cols-3 sm:gap-4 lg:grid-cols-6">
          {flashProducts.map((product) => {
            const discount = product.oldPrice
              ? Math.round(
                  ((product.oldPrice - product.price) / product.oldPrice) * 100
                )
              : 0;

            return (
              <Link
                key={product.id}
                href={`#product-${product.id}`}
                className="group w-40 shrink-0 sm:w-auto sm:shrink"
              >
                <div className="relative overflow-hidden rounded-xl bg-gray-50">
                  {/* صورة */}
                  <img
                    src={product.images[0]}
                    alt={product.name}
                    className="aspect-square w-full object-cover transition duration-500 group-hover:scale-105"
                  />

                  {/* شارة الخصم */}
                  <span className="absolute right-2 top-2 rounded-full bg-[#ff5c00] px-2 py-0.5 text-[10px] font-black text-white shadow-md">
                    -{discount}%
                  </span>

                  {/* شريط تقدم (محاكاة) */}
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-200">
                    <div
                      className="h-full bg-gradient-to-r from-[#ff5c00] to-red-500"
                      style={{ width: `${Math.min(discount + 40, 95)}%` }}
                    />
                  </div>
                </div>

                {/* السعر */}
                <div className="mt-2">
                  <div className="flex items-baseline gap-1.5">
                    <strong className="text-base font-black text-[#ff5c00]">
                      {product.price}
                    </strong>
                    <span className="text-[10px] text-[#6b7280]">{CURRENCY}</span>
                    {product.oldPrice && (
                      <del className="text-[10px] text-gray-400">
                        {product.oldPrice}
                      </del>
                    )}
                  </div>
                  <p className="mt-1 line-clamp-1 text-[11px] text-[#4b5563]">
                    {product.name}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}