"use client";

import { Banknote, Truck, BadgeCheck, RotateCcw } from "lucide-react";

// شريط الثقة: يعرض مزايا المتجر في أربع بطاقات (عدّل النصوص من هنا)
const ITEMS = [
  {
    icon: Banknote,
    title: "الدفع عند الاستلام",
    desc: "ادفع بعد أن تستلم طلبك",
  },
  {
    icon: Truck,
    title: "توصيل لجميع المدن",
    desc: "شحن سريع إلى باب بيتك",
  },
  {
    icon: BadgeCheck,
    title: "جودة مضمونة",
    desc: "منتجات من تجّار موثوقين",
  },
  {
    icon: RotateCcw,
    title: "إرجاع سهل",
    desc: "تواصل معنا وسنساعدك",
  },
];

export default function PromoBanners() {
  return (
    <section className="mx-auto max-w-7xl px-3 py-3 sm:px-5 sm:py-5">
      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        {ITEMS.map(({ icon: Icon, title, desc }) => (
          <div
            key={title}
            className="flex items-center gap-2.5 rounded-xl border border-gray-100 bg-white px-3 py-3 shadow-sm transition hover:border-[#ff5c00]/30 hover:shadow-md sm:gap-3 sm:px-4 sm:py-4"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#fff4ed] text-[#ff5c00] sm:h-11 sm:w-11">
              <Icon className="h-[18px] w-[18px] sm:h-5 sm:w-5" strokeWidth={2.2} />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-black leading-tight text-[#161616] sm:text-sm">
                {title}
              </div>
              <div className="mt-0.5 text-[9px] leading-snug text-gray-500 sm:text-xs">
                {desc}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}