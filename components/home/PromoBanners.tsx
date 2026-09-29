"use client";

import { motion } from "framer-motion";
import { Gift, Truck } from "lucide-react";

export default function PromoBanners() {
  return (
    <section className="mx-auto max-w-7xl px-3 py-2 sm:px-5 sm:py-4">
      <div className="grid grid-cols-2 gap-2 sm:gap-4">
        {/* ═══ كوبون 15% ═══ */}
        <motion.div
          whileHover={{ scale: 1.02, y: -2 }}
          className="relative flex h-16 items-center gap-2 overflow-hidden rounded-xl bg-gradient-to-br from-[#b17f3f] to-[#8a5f28] px-2.5 text-white shadow-md sm:h-24 sm:px-4"
        >
          {/* أيقونة */}
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/20 sm:h-10 sm:w-10">
            <Gift className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>

          {/* النص */}
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-black leading-tight sm:text-sm">
              خصم 15%
            </div>
            <div className="text-[8px] text-white/80 sm:text-[11px]">
              على أول طلب
            </div>
            <div className="mt-0.5 inline-block rounded bg-white/20 px-1 py-0.5 font-mono text-[8px] font-bold sm:text-[10px]">
              WELCOME15
            </div>
          </div>

          {/* إيموجي خلفي */}
          <div className="absolute -bottom-3 -left-3 text-4xl opacity-10 select-none sm:text-6xl">
            🎁
          </div>
        </motion.div>

        {/* ═══ شحن مجاني ═══ */}
        <motion.div
          whileHover={{ scale: 1.02, y: -2 }}
          className="relative flex h-16 items-center gap-2 overflow-hidden rounded-xl bg-gradient-to-br from-[#191a18] to-[#2a2a28] px-2.5 text-white shadow-md sm:h-24 sm:px-4"
        >
          {/* أيقونة */}
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#c69b5e]/30 sm:h-10 sm:w-10">
            <Truck className="h-4 w-4 text-[#c69b5e] sm:h-5 sm:w-5" />
          </div>

          {/* النص */}
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-black leading-tight sm:text-sm">
              شحن مجاني
            </div>
            <div className="text-[8px] text-white/70 sm:text-[11px]">
              300 د.م+
            </div>
            <div className="mt-0.5 text-[8px] font-bold text-[#c69b5e] sm:text-[10px]">
              24-48 ساعة
            </div>
          </div>

          {/* إيموجي خلفي */}
          <div className="absolute -bottom-3 -left-3 text-4xl opacity-10 select-none sm:text-6xl">
            🚚
          </div>
        </motion.div>
      </div>
    </section>
  );
}