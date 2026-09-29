"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ShoppingCart,
  ShieldCheck,
  Truck,
  BadgeCheck,
  ChevronLeft,
  Shirt,
  Smartphone,
} from "lucide-react";

// ═══════ الصور ═══════
const FASHION_IMAGES = {
  hoodie:
    "https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=400&q=80",
  hoodie2:
    "https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?w=400&q=80",
  shoes:
    "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&q=80",
  cap:
    "https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=400&q=80",
  jeans:
    "https://images.unsplash.com/photo-1542272604-787c3835535d?w=400&q=80",
  stack:
    "https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?w=400&q=80",
};

const ELECTRONICS_IMAGES = {
  iphone:
    "https://images.unsplash.com/photo-1592286927505-1def25115558?w=400&q=80",
  iphone2:
    "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=400&q=80",
  airpods:
    "https://images.unsplash.com/photo-1600294037681-c80b4cb5b434?w=400&q=80",
  headphones:
    "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&q=80",
  watch:
    "https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=400&q=80",
  speaker:
    "https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=400&q=80",
};

// ═══════ Variants ═══════
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
};

const fadeUp = {
  hidden: { opacity: 0, y: 15 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

// ═══════ Animations للأشياء الطائرة ═══════
const floatAnimation = (delay = 0, range = 6) => ({
  y: [0, -range, 0],
  transition: {
    duration: 4 + delay,
    repeat: Infinity,
    ease: "easeInOut" as const,
    delay,
  },
});

export default function Hero() {
  return (
    <section className="relative overflow-hidden bg-[#0a1a35]">
      {/* ═══════ خلفية متدرجة + موجات ═══════ */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#081428] via-[#0a1a35] to-[#0d2347]" />

      {/* موجة صفراء يسار */}
      <div
        className="pointer-events-none absolute -left-40 top-0 bottom-0 w-[55%] opacity-90"
        style={{
          background:
            "radial-gradient(ellipse at left center, rgba(251,191,36,0.85) 0%, rgba(251,191,36,0.4) 40%, transparent 70%)",
        }}
      />
      {/* موجة زرقاء يمين */}
      <div
        className="pointer-events-none absolute -right-40 top-0 bottom-0 w-[55%] opacity-90"
        style={{
          background:
            "radial-gradient(ellipse at right center, rgba(37,99,235,0.75) 0%, rgba(37,99,235,0.3) 40%, transparent 70%)",
        }}
      />

      {/* شرائط متحركة خفيفة */}
      <motion.div
        className="pointer-events-none absolute inset-0 opacity-20"
        style={{
          background:
            "repeating-linear-gradient(45deg, rgba(255,255,255,0.05) 0px, rgba(255,255,255,0.05) 2px, transparent 2px, transparent 20px)",
        }}
        animate={{ backgroundPositionX: ["0px", "40px"] }}
        transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
      />

      {/* ═══════ المحتوى ═══════ */}
      <div className="relative z-10 mx-auto max-w-7xl px-2 py-2 sm:px-4 sm:py-3 lg:py-5">
        <div className="grid grid-cols-12 items-center gap-1 sm:gap-2">
          {/* ═══════ اليسار: الملابس ═══════ */}
          <Link
            href="/category/men-clothing"
            className="group col-span-3 block"
          >
            <div className="relative h-28 overflow-hidden sm:h-32 lg:h-[130px]">
              {/* شارة أعلى */}
              <motion.div
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3, duration: 0.5 }}
                className="absolute left-0 top-0 z-20 flex items-center gap-0.5 rounded-md bg-yellow-400 px-1 py-0.5 shadow-lg sm:gap-1 sm:rounded-lg sm:px-2 sm:py-1"
              >
                <Shirt className="h-2.5 w-2.5 text-[#0a1a35] sm:h-3 sm:w-3" />
                <span className="text-[7px] font-black text-[#0a1a35] sm:text-[10px]">
                  أزياء عصرية
                </span>
              </motion.div>

              {/* هودي أسود */}
              <motion.img
                animate={floatAnimation(0, 5)}
                src={FASHION_IMAGES.hoodie}
                alt="هودي أسود"
                className="absolute right-0 top-6 h-16 w-12 rounded-md object-cover shadow-xl sm:right-2 sm:top-2 sm:h-24 sm:w-20 sm:rounded-lg sm:shadow-2xl"
              />
              {/* هودي بيج */}
              <motion.img
                animate={floatAnimation(0.3, 6)}
                src={FASHION_IMAGES.hoodie2}
                alt="هودي بيج"
                className="absolute right-8 top-8 h-14 w-10 rounded-md object-cover shadow-xl sm:right-14 sm:top-4 sm:h-20 sm:w-16 sm:rounded-lg sm:shadow-2xl"
              />
              {/* حذاء */}
              <motion.img
                animate={floatAnimation(0.5, 7)}
                src={FASHION_IMAGES.shoes}
                alt="حذاء"
                className="absolute bottom-0 left-0 h-10 w-16 rounded-md object-cover shadow-xl sm:left-2 sm:h-16 sm:w-24 sm:rounded-lg sm:shadow-2xl"
              />
              {/* كاب — يظهر من sm */}
              <motion.img
                animate={floatAnimation(0.7, 5)}
                src={FASHION_IMAGES.cap}
                alt="كاب"
                className="absolute bottom-2 right-2 hidden h-12 w-12 rounded-full object-cover shadow-xl sm:block sm:h-14 sm:w-14 sm:shadow-2xl"
              />
              {/* ملابس مكدسة — sm */}
              <motion.img
                animate={floatAnimation(0.9, 6)}
                src={FASHION_IMAGES.stack}
                alt="ملابس"
                className="absolute bottom-0 left-16 hidden h-10 w-12 rounded-md object-cover shadow-xl sm:block sm:h-12 sm:w-14 sm:rounded-lg sm:shadow-2xl"
              />

              {/* Overlay عند Hover */}
              <div className="absolute inset-0 rounded-md bg-yellow-400/0 transition-all group-hover:bg-yellow-400/10 sm:rounded-lg" />
            </div>
          </Link>

          {/* ═══════ الوسط ═══════ */}
          <motion.div
            className="col-span-6 flex flex-col items-center text-center"
            initial="hidden"
            animate="visible"
            variants={containerVariants}
          >
            {/* الشعار */}
            <motion.div
              variants={fadeUp}
              className="flex items-center gap-1 sm:gap-2"
            >
              <motion.div
                className="relative h-7 w-7 sm:h-9 sm:w-9 lg:h-10 lg:w-10"
                animate={{ rotate: [0, 3, -3, 0] }}
                transition={{
                  duration: 5,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              >
                <div className="absolute inset-0 rounded-lg bg-yellow-400 shadow-md sm:shadow-lg" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-sm font-black text-[#0a1a35] sm:text-lg lg:text-xl">
                    ن
                  </span>
                </div>
              </motion.div>
              <div className="text-right leading-none">
                <div className="text-[11px] font-black text-white sm:text-base lg:text-lg">
                  Matjar <span className="text-yellow-400">Nokhba</span>
                </div>
                <div className="mt-0.5 flex items-center gap-1 sm:gap-1.5">
                  <div className="h-px w-3 bg-yellow-400/50 sm:w-6" />
                  <span className="text-[7px] text-white/70 sm:text-[10px]">
                    متجر نخبة
                  </span>
                  <div className="h-px w-3 bg-yellow-400/50 sm:w-6" />
                </div>
              </div>
            </motion.div>

            {/* العنوان */}
            <motion.h1
              variants={fadeUp}
              className="mt-1.5 text-[13px] font-black leading-tight text-white sm:text-2xl lg:text-4xl"
            >
              كل ما تحتاجه{" "}
              <span className="text-yellow-400">في مكان واحد</span>
            </motion.h1>

            {/* الشارات الثلاث — sm: على سطر واحد، lg: كامل */}
            <motion.div
              variants={fadeUp}
              className="mt-1.5 hidden items-center justify-center gap-2 sm:flex sm:gap-3 lg:gap-4"
            >
              <div className="flex items-center gap-1">
                <div className="flex h-4 w-4 items-center justify-center rounded-full bg-yellow-400 lg:h-5 lg:w-5">
                  <BadgeCheck className="h-2.5 w-2.5 text-[#0a1a35] lg:h-3 lg:w-3" />
                </div>
                <div className="text-right leading-tight">
                  <div className="text-[8px] font-black text-white sm:text-[10px]">
                    جودة مضمونة
                  </div>
                  <div className="text-[6px] text-white/60 sm:text-[8px]">
                    100%
                  </div>
                </div>
              </div>

              <div className="h-5 w-px bg-white/20" />

              <div className="flex items-center gap-1">
                <div className="flex h-4 w-4 items-center justify-center rounded-full bg-yellow-400 lg:h-5 lg:w-5">
                  <Truck className="h-2.5 w-2.5 text-[#0a1a35] lg:h-3 lg:w-3" />
                </div>
                <div className="text-right leading-tight">
                  <div className="text-[8px] font-black text-white sm:text-[10px]">
                    توصيل سريع
                  </div>
                  <div className="text-[6px] text-white/60 sm:text-[8px]">
                    جميع المدن
                  </div>
                </div>
              </div>

              <div className="hidden h-5 w-px bg-white/20 lg:block" />

              <div className="hidden items-center gap-1 lg:flex">
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-yellow-400">
                  <ShieldCheck className="h-3 w-3 text-[#0a1a35]" />
                </div>
                <div className="text-right leading-tight">
                  <div className="text-[10px] font-black text-white">
                    دفع آمن
                  </div>
                  <div className="text-[8px] text-white/60">
                    عند الاستلام
                  </div>
                </div>
              </div>
            </motion.div>

            {/* زر تسوق الآن */}
            <motion.div variants={fadeUp} className="mt-1.5 sm:mt-2.5">
              <Link href="/#products">
                <motion.button
                  whileHover={{ scale: 1.06, y: -2 }}
                  whileTap={{ scale: 0.95 }}
                  className="group relative inline-flex items-center gap-1 overflow-hidden rounded-full bg-yellow-400 px-3 py-1.5 text-[10px] font-black text-[#0a1a35] shadow-md transition-shadow hover:shadow-yellow-400/60 sm:gap-2 sm:px-5 sm:py-2 sm:text-xs lg:px-6 lg:py-2.5 lg:text-sm lg:shadow-xl"
                >
                  <motion.span
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent"
                    animate={{ x: ["-100%", "200%"] }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeInOut",
                      repeatDelay: 1,
                    }}
                  />
                  <ShoppingCart className="relative h-3 w-3 sm:h-3.5 sm:w-3.5 lg:h-4 lg:w-4" />
                  <span className="relative">تسوق الآن</span>
                  <ChevronLeft className="relative hidden h-3.5 w-3.5 transition-transform group-hover:-translate-x-1 sm:block lg:h-4 lg:w-4" />
                </motion.button>
              </Link>
            </motion.div>
          </motion.div>

          {/* ═══════ اليمين: الإلكترونيات ═══════ */}
          <Link
            href="/category/electronics"
            className="group col-span-3 block"
          >
            <div className="relative h-28 overflow-hidden sm:h-32 lg:h-[130px]">
              {/* شارة أعلى */}
              <motion.div
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3, duration: 0.5 }}
                className="absolute right-0 top-0 z-20 flex items-center gap-0.5 rounded-md bg-blue-500 px-1 py-0.5 shadow-lg sm:gap-1 sm:rounded-lg sm:px-2 sm:py-1"
              >
                <Smartphone className="h-2.5 w-2.5 text-white sm:h-3 sm:w-3" />
                <span className="text-[7px] font-black text-white sm:text-[10px]">
                  إلكترونيات
                </span>
              </motion.div>

              {/* iPhone كبير */}
              <motion.img
                animate={floatAnimation(0.2, 6)}
                src={ELECTRONICS_IMAGES.iphone}
                alt="آيفون"
                className="absolute left-0 top-6 h-16 w-10 rounded-md object-cover shadow-xl sm:left-0 sm:top-2 sm:h-24 sm:w-14 sm:rounded-lg sm:shadow-2xl"
              />
              {/* iPhone ثاني */}
              <motion.img
                animate={floatAnimation(0.4, 5)}
                src={ELECTRONICS_IMAGES.iphone2}
                alt="هاتف"
                className="absolute left-8 top-8 h-14 w-10 rounded-md object-cover shadow-xl sm:left-14 sm:top-4 sm:h-20 sm:w-14 sm:rounded-lg sm:shadow-2xl"
              />
              {/* AirPods */}
              <motion.img
                animate={floatAnimation(0.6, 7)}
                src={ELECTRONICS_IMAGES.airpods}
                alt="AirPods"
                className="absolute bottom-0 left-0 h-10 w-10 rounded-md object-cover shadow-xl sm:left-2 sm:h-14 sm:w-14 sm:rounded-lg sm:shadow-2xl"
              />
              {/* سماعات كبيرة */}
              <motion.img
                animate={floatAnimation(0.8, 6)}
                src={ELECTRONICS_IMAGES.headphones}
                alt="سماعات"
                className="absolute bottom-0 right-0 h-14 w-12 rounded-md object-cover shadow-xl sm:bottom-0 sm:right-2 sm:h-20 sm:w-16 sm:rounded-lg sm:shadow-2xl"
              />
              {/* ساعة — sm */}
              <motion.img
                animate={floatAnimation(1, 5)}
                src={ELECTRONICS_IMAGES.watch}
                alt="ساعة"
                className="absolute right-12 top-2 hidden h-12 w-12 rounded-full object-cover shadow-xl sm:block sm:h-14 sm:w-14 sm:shadow-2xl"
              />
              {/* JBL سبيكر — sm */}
              <motion.img
                animate={floatAnimation(1.2, 6)}
                src={ELECTRONICS_IMAGES.speaker}
                alt="JBL"
                className="absolute bottom-2 right-12 hidden h-10 w-12 rounded-md object-cover shadow-xl sm:block sm:h-12 sm:w-16 sm:rounded-lg sm:shadow-2xl"
              />

              {/* Overlay عند Hover */}
              <div className="absolute inset-0 rounded-md bg-blue-500/0 transition-all group-hover:bg-blue-500/10 sm:rounded-lg" />
            </div>
          </Link>
        </div>
      </div>
    </section>
  );
}