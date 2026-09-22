"use client";

import { motion } from "framer-motion";
import Link from "next/link";

type LogoProps = {
  size?: "sm" | "md" | "lg";
  asLink?: boolean;
};

const SIZES = {
  sm: { icon: 34, matjar: "text-[9px]", nokhba: "text-sm", letter: "text-base" },
  md: { icon: 44, matjar: "text-[10px]", nokhba: "text-lg", letter: "text-xl" },
  lg: { icon: 56, matjar: "text-xs", nokhba: "text-2xl", letter: "text-2xl" },
};

export default function Logo({ size = "md", asLink = true }: LogoProps) {
  const s = SIZES[size];

  const content = (
    <div className="flex items-center gap-3">
      {/* ═══════ الأيقونة ═══════ */}
      <div
        className="relative shrink-0"
        style={{ width: s.icon, height: s.icon }}
      >
        {/* الهالة الملو​نة الدو​ارة */}
        <motion.div
          className="absolute inset-0 rounded-2xl"
          style={{
            background:
              "conic-gradient(from 0deg, #6d28d9, #8b5cf6, #ff5c00, #f59e0b, #8b5cf6, #6d28d9)",
          }}
          animate={{ rotate: 360 }}
          transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
        />

        {/* الدائرة الداخلية البيضاء */}
        <div className="absolute inset-[3px] rounded-xl bg-white" />

        {/* الحرف "ن" */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className={`${s.letter} bg-gradient-to-br from-purple-600 to-orange-500 bg-clip-text font-black text-transparent`}
          >
            ن
          </span>
        </div>
      </div>

      {/* ═══════ النص ═══════ */}
      <div className="leading-none">
        <div
          className={`${s.matjar} font-bold tracking-[0.25em] text-gray-400`}
        >
          MATJAR
        </div>
        <div
          className={`${s.nokhba} mt-1 bg-gradient-to-r from-purple-600 to-orange-500 bg-clip-text font-black text-transparent`}
        >
          NOKHBA
        </div>
      </div>
    </div>
  );

  if (asLink) {
    return <Link href="/">{content}</Link>;
  }

  return content;
}