"use client";

import { MapPin, Coins, Globe, Package, HelpCircle } from "lucide-react";

export default function TopBar() {
  return (
    <div className="bg-[#ff5c00] px-4 py-1 text-[10px] text-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
        {/* اليسار */}
        <div className="flex items-center gap-3 sm:gap-5">
          <button className="flex items-center gap-1 transition hover:opacity-80">
            <MapPin className="h-3 w-3" />
            <span className="hidden sm:inline">المقر:</span>
            <span className="font-bold">المغرب</span>
          </button>

          <span className="text-white/30">|</span>

          <button className="flex items-center gap-1 transition hover:opacity-80">
            <Coins className="h-3 w-3" />
            <span className="font-bold">MAD</span>
          </button>
        </div>

        {/* اليمين */}
        <div className="flex items-center gap-3 sm:gap-5">
          <button className="hidden items-center gap-1 transition hover:opacity-80 sm:flex">
            <Globe className="h-3 w-3" />
            <span>العربية</span>
          </button>

          <button className="hidden items-center gap-1 transition hover:opacity-80 sm:flex">
            <Package className="h-3 w-3" />
            <span>تتبع الطلب</span>
          </button>

          <button className="flex items-center gap-1 transition hover:opacity-80">
            <HelpCircle className="h-3 w-3" />
            <span className="hidden sm:inline">مساعدة</span>
          </button>
        </div>
      </div>
    </div>
  );
}