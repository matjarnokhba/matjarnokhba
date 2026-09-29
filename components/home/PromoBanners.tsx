"use client";

import { motion } from "framer-motion";
import { Gift, Truck } from "lucide-react";

export default function PromoBanners() {
  return (
    <section className="mx-auto max-w-7xl px-3 py-3 sm:px-5 sm:py-4">
      <div className="grid grid-cols-2 gap-2 sm:gap-4">
        {/* ═══ كوبون 15% ═══ */}
        <motion.div
          whileHover={{ scale: 1.02, y: -2 }}
          className="relative overflow-hidden rounded-xl bg-gradient-to-br from-[#b17f3f] to-[#8a5f28] p-2.5 text-white shadow-md sm:p-4"
        >
          <div className="relative z-10">
            {/* الشارة */}
            <div className="flex items-center gap-1">
              <div className="flex h-4 w-4 items-center justify-center rounded-full bg-white/20 sm:h-5 sm:w-5">
                <Gift className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
              </div>
              <span className="text-[8px] font-black uppercase tracking-wider text-white/90 sm:text-[10px]">
                عرض محدود
              </span>
            </div>

            {/* العنوان */}
            <h3 className="mt-1 text-sm font-black leading-tight sm:text-lg">
              خصم 15%
            </h3>

            {/* الوصف */}
            <p className="mt-0.5 text-[9px] text-white/80 sm:text-xs">
              على أول طلب
            </p>

            {/* الكود */}
            <div className="mt-1.5 inline-flex items-center gap-1 rounded bg-white/20 px-1.5 py-0.5 backdrop-blur sm:mt-2 sm:px-2 sm:py-1">
              <span className="text-[8px] text-white/70 sm:text-[9px]">
                الكود:
              </span>
              <span className="font-mono text-[9px] font-black sm:text-[11px]">
                WELCOME15
              </span>
            </div>
          </div>

          {/* إيموجي خلفي */}
          <div className="absolute -bottom-2 -left-2 text-5xl opacity-10 select-none sm:-bottom-4 sm:-left-4 sm:text-7xl">
            🎁
          </div>
        </motion.div>

        {/* ═══ شحن مجاني ═══ */}
        <motion.div
          whileHover={{ scale: 1.02, y: -2 }}
          className="relative overflow-hidden rounded-xl bg-gradient-to-br from-[#191a18] to-[#2a2a28] p-2.5 text-white shadow-md sm:p-4"
        >
          <div className="relative z-10">
            {/* الشارة */}
            <div className="flex items-center gap-1">
              <div className="flex h-4 w-4 items-center justify-center rounded-full bg-[#c69b5e]/30 sm:h-5 sm:w-5">
                <Truck className="h-2.5 w-2.5 text-[#c69b5e] sm:h-3 sm:w-3" />
              </div>
              <span className="text-[8px] font-black uppercase tracking-wider text-[#c69b5e] sm:text-[10px]">
                لكل المدن
              </span>
            </div>

            {/* العنوان */}
            <h3 className="mt-1 text-sm font-black leading-tight sm:text-lg">
              شحن مجاني
            </h3>

            {/* الوصف */}
            <p className="mt-0.5 text-[9px] text-white/70 sm:text-xs">
              للطلبات 300 د.م+
            </p>

            {/* ميزة */}
            <div className="mt-1.5 inline-flex items-center gap-1 text-[9px] font-bold text-[#c69b5e] sm:mt-2 sm:text-[11px]">
              🚚 توصيل 24-48 ساعة
            </div>
          </div>

          {/* إيموجي خلفي */}
          <div className="absolute -bottom-2 -left-2 text-5xl opacity-10 select-none sm:-bottom-4 sm:-left-4 sm:text-7xl">
            🚚
          </div>
        </motion.div>
      </div>
    </section>
  );
}