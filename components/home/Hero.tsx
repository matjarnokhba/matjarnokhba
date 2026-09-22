"use client";

import Link from "next/link";
import { ShoppingBag, Zap } from "lucide-react";

export default function Hero() {
  return (
    <section className="bg-gradient-to-bl from-[#6d28d9] via-[#7c3aed] to-[#4c1d95] px-4 py-8 sm:py-12 lg:py-16">
      <div className="mx-auto grid max-w-7xl items-center gap-8 lg:grid-cols-2">
        {/* النص */}
        <div className="order-2 text-center lg:order-1 lg:text-right">
          {/* شارة صغيرة */}
          <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-xs font-bold text-white backdrop-blur">
            <Zap className="h-3.5 w-3.5 text-yellow-300" />
            <span>عروض خاصة — حتى 70%</span>
          </span>

          {/* العنوان الرئيسي */}
          <h1 className="mt-4 text-3xl font-black leading-tight text-white sm:text-4xl lg:text-5xl">
            أحدث المنتجات
            <br />
            <span className="text-yellow-300">بأفضل الأسعار</span>
          </h1>

          {/* الوصف */}
          <p className="mt-3 text-sm text-white/80 sm:text-base">
            كل ما تحتاجه في مكان واحد — ملابس، إلكترونيات، منزل، جمال، والمزيد.
          </p>

          {/* زر CTA */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
            <Link
              href="#products"
              className="inline-flex items-center gap-2 rounded-full bg-yellow-400 px-6 py-3 text-sm font-bold text-[#111827] shadow-lg transition hover:bg-yellow-300 hover:shadow-xl"
            >
              <ShoppingBag className="h-4 w-4" />
              تسوق الآن
            </Link>

            <span className="text-xs text-white/70">
              🚚 شحن مجاني فوق 300 د.م
            </span>
          </div>
        </div>

        {/* شبكة الصور */}
        <div className="order-1 lg:order-2">
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <img
              src="https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=500&q=80"
              alt="هودي"
              className="h-40 w-full rounded-2xl object-cover shadow-2xl sm:h-56"
            />
            <img
              src="https://images.unsplash.com/photo-1524805444758-089113d48a6d?w=500&q=80"
              alt="ساعة"
              className="h-40 w-full rounded-2xl object-cover shadow-2xl sm:h-56"
            />
            <img
              src="https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=500&q=80"
              alt="حقيبة"
              className="col-span-2 h-40 w-full rounded-2xl object-cover shadow-2xl sm:h-56"
            />
          </div>
        </div>
      </div>
    </section>
  );
}