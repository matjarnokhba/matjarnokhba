"use client";

import { useEffect, useState } from "react";
import { Flame, Clock } from "lucide-react";
import Link from "next/link";
import { CURRENCY, type Product } from "@/lib/data/products";

type DealProduct = Product & { quantityLimit: number | null; soldCount: number };
type SaleInfo = {
  id: number;
  title: string;
  subtitle: string | null;
  endsAt: string;
  showCountdown: boolean;
  showProgress: boolean;
};

function useCountdown(endsAt: string | null) {
  const [left, setLeft] = useState({ d: 0, h: 0, m: 0, s: 0, done: false });

  useEffect(() => {
    if (!endsAt) return;
    const end = Date.parse(endsAt);
    const tick = () => {
      const diff = end - Date.now();
      if (diff <= 0) {
        setLeft({ d: 0, h: 0, m: 0, s: 0, done: true });
        return;
      }
      setLeft({
        d: Math.floor(diff / 86400000),
        h: Math.floor((diff % 86400000) / 3600000),
        m: Math.floor((diff % 3600000) / 60000),
        s: Math.floor((diff % 60000) / 1000),
        done: false,
      });
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [endsAt]);

  return left;
}

export default function FlashDeals() {
  const [sale, setSale] = useState<SaleInfo | null>(null);
  const [products, setProducts] = useState<DealProduct[]>([]);
  const left = useCountdown(sale?.endsAt ?? null);

  useEffect(() => {
    let alive = true;
    fetch("/api/flash-sales/active")
      .then((r) => r.json())
      .then((d) => {
        if (!alive || !d.success || !d.sale) return;
        setSale(d.sale);
        setProducts(d.products);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  // لا حملة فعّالة (أو انتهت): لا يظهر القسم
  if (!sale || products.length === 0 || left.done) return null;

  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <section className="bg-white py-4 sm:py-6">
      <div className="mx-auto max-w-7xl px-3 sm:px-4">
        <div className="mb-3 flex flex-col gap-2 sm:mb-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-red-500 shadow-md sm:h-8 sm:w-8">
              <Flame className="h-3.5 w-3.5 text-white sm:h-4 sm:w-4" />
            </div>
            <div>
              <h2 className="text-base font-black text-[#111827] sm:text-xl">{sale.title}</h2>
              {sale.subtitle && (
                <p className="text-[10px] text-[#6b7280] sm:text-xs">{sale.subtitle}</p>
              )}
            </div>
          </div>

          {sale.showCountdown && (
            <div className="flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 text-[#ff5c00] sm:h-4 sm:w-4" />
              <span className="text-[10px] text-[#6b7280] sm:text-xs">ينتهي خلال</span>
              <div className="flex items-center gap-0.5 font-mono text-xs font-bold text-[#ff5c00] sm:gap-1 sm:text-sm">
                {left.d > 0 && (
                  <>
                    <span className="rounded bg-red-50 px-1 py-0.5 text-red-600 sm:px-1.5">
                      {left.d} يوم
                    </span>
                    <span>:</span>
                  </>
                )}
                <span className="rounded bg-red-50 px-1 py-0.5 text-red-600 sm:px-1.5">{pad(left.h)}</span>
                <span>:</span>
                <span className="rounded bg-red-50 px-1 py-0.5 text-red-600 sm:px-1.5">{pad(left.m)}</span>
                <span>:</span>
                <span className="rounded bg-red-50 px-1 py-0.5 text-red-600 sm:px-1.5">{pad(left.s)}</span>
              </div>
            </div>
          )}
        </div>

        <div className="no-scrollbar flex gap-2 overflow-x-auto pb-2 sm:grid sm:grid-cols-3 sm:gap-4 lg:grid-cols-6">
          {products.map((product) => {
            const discount =
              product.oldPrice && product.oldPrice > product.price
                ? Math.round(((product.oldPrice - product.price) / product.oldPrice) * 100)
                : 0;
            const pct =
              sale.showProgress && product.quantityLimit
                ? Math.min(100, Math.round((product.soldCount / product.quantityLimit) * 100))
                : null;

            return (
              <Link
                key={product.id}
                href={product.sellerSlug ? `/product/${product.sellerSlug}/${product.slug}` : "#"}
                className="group w-32 shrink-0 sm:w-auto sm:shrink"
              >
                <div className="relative overflow-hidden rounded-xl bg-gray-50">
                  <img
                    src={product.images[0]}
                    alt={product.name}
                    className="aspect-square w-full object-cover transition duration-500 group-hover:scale-105"
                  />
                  {discount > 0 && (
                    <span className="absolute right-1.5 top-1.5 rounded-full bg-[#ff5c00] px-1.5 py-0.5 text-[9px] font-black text-white shadow-md sm:right-2 sm:top-2 sm:px-2 sm:text-[10px]">
                      -{discount}%
                    </span>
                  )}
                  {pct !== null && (
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-200">
                      <div
                        className="h-full bg-gradient-to-r from-[#ff5c00] to-red-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  )}
                </div>

                <div className="mt-1.5">
                  <div className="flex flex-wrap items-baseline gap-1 sm:gap-1.5">
                    <strong className="text-sm font-black text-[#ff5c00] sm:text-base">{product.price}</strong>
                    <span className="text-[9px] text-[#6b7280] sm:text-[10px]">{CURRENCY}</span>
                    {product.oldPrice && product.oldPrice > product.price && (
                      <del className="text-[9px] text-gray-400 sm:text-[10px]">{product.oldPrice}</del>
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
      </div>
    </section>
  );
}