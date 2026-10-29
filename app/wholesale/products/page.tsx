"use client";

import Link from "next/link";
import { ArrowLeft, Package, Construction } from "lucide-react";

export default function WholesaleProductsPage() {
  return (
    <div className="min-h-screen bg-gray-50 p-4 py-12" dir="rtl">
      <div className="mx-auto max-w-md rounded-2xl bg-white p-8 text-center shadow-sm">
        <Link
          href="/wholesale/dashboard"
          className="mb-4 inline-flex items-center gap-1 text-xs font-bold text-gray-500 hover:text-[#ff5c00]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          عودة للوحة
        </Link>
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-orange-50">
          <Package className="h-8 w-8 text-[#ff5c00]" />
        </div>
        <h1 className="mt-4 text-xl font-black text-gray-900">منتجات الجملة</h1>
        <p className="mt-2 text-sm text-gray-500">
          هذه الصفحة قيد التطوير — ستتمكن قريبًا من إضافة منتجاتك وعرضها للتجار
        </p>
        <div className="mt-4 inline-flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <Construction className="h-3.5 w-3.5" />
          المرحلة القادمة: Phase 3
        </div>
      </div>
    </div>
  );
}