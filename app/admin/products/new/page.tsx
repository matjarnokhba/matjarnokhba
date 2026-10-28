import Link from "next/link";
import { ArrowRight } from "lucide-react";
import ProductWizard from "@/components/seller/product-wizard/ProductWizard";

export default function NewAdminProductPage() {
  return (
    <div className="w-full max-w-full overflow-x-hidden px-3 pb-8 pt-16 sm:px-4 lg:px-8 lg:pt-8">
      <Link
        href="/admin/products"
        className="mb-4 inline-flex items-center gap-1 text-xs font-bold text-gray-500 transition hover:text-[#ff5c00]"
      >
        <ArrowRight className="h-3.5 w-3.5" />
        رجوع إلى المنتجات
      </Link>

      <div className="mb-6">
        <h1 className="text-2xl font-black text-gray-900">إضافة منتج جديد</h1>
        <p className="mt-1 text-sm text-gray-500">
          سيُنشأ المنتج مباشرة بحالة نشطة (بدون مراجعة)
        </p>
      </div>

      <ProductWizard
        mode="create"
        role="admin"
        apiUrl="/api/admin/products"
        returnUrl="/admin/products"
      />
    </div>
  );
}