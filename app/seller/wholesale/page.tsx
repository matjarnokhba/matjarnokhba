import { redirect } from "next/navigation";
import Link from "next/link";
import { SessionService } from "@/services/session.service";
import {
  Warehouse, Package, FileText, ArrowLeft, Plus, Settings,
  Clock, Building2,
} from "lucide-react";

export default async function SellerWholesalePage() {
  const current = await SessionService.getCurrent();
  if (!current || !current.user.seller) redirect("/login");

  const supplier = current.user.wholesaleSupplier;

  if (!supplier) {
    return (
      <div className="p-4 pt-16 lg:p-8 lg:pt-8" dir="rtl">
        <div className="mx-auto max-w-md rounded-2xl bg-white p-8 text-center shadow-sm">
          <Building2 className="mx-auto h-12 w-12 text-gray-300" />
          <h2 className="mt-4 text-lg font-black text-gray-900">ليس لديك حساب جملة</h2>
          <p className="mt-2 text-sm text-gray-500">افتح حساب بيع بالجملة وابدأ البيع للتجار الآخرين</p>
          <Link href="/wholesale/register" className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[#ff5c00] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#e64a00]">
            <Plus className="h-4 w-4" /> افتح حساب جملة
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 pt-16 lg:p-8 lg:pt-8" dir="rtl">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black">بوابة البيع بالجملة</h1>
            <p className="mt-1 text-sm text-gray-500">{supplier.displayName}</p>
          </div>
          <Link href="/wholesale/dashboard" className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50">
            لوحة الجملة <ArrowLeft className="h-3.5 w-3.5" />
          </Link>
        </div>

        {supplier.status === "PENDING" && (
          <div className="mb-6 flex items-start gap-2 rounded-xl bg-amber-50 p-4 text-xs text-amber-800">
            <Clock className="mt-0.5 h-4 w-4 shrink-0" />
            <div><strong>حسابك قيد المراجعة.</strong> يمكنك استكشاف الصفحات، لكن إضافة العروض ستُفعَّل بعد الموافقة.</div>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <Link href="/seller/wholesale/offers" className="flex items-center gap-4 rounded-xl bg-white p-5 shadow-sm transition hover:shadow-md">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-orange-50"><Package className="h-6 w-6 text-[#ff5c00]" /></div>
            <div className="min-w-0 flex-1"><div className="text-sm font-black">عروضي</div><div className="text-xs text-gray-500">إدارة المنتجات المعروضة للبيع بالجملة</div></div>
          </Link>
          <Link href="/seller/wholesale/orders" className="flex items-center gap-4 rounded-xl bg-white p-5 shadow-sm transition hover:shadow-md">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-orange-50"><FileText className="h-6 w-6 text-[#ff5c00]" /></div>
            <div className="min-w-0 flex-1"><div className="text-sm font-black">الطلبات الواردة</div><div className="text-xs text-gray-500">قبول / رفض طلبات التجار</div></div>
          </Link>
          <Link href="/wholesale/sources" className="flex items-center gap-4 rounded-xl bg-white p-5 shadow-sm transition hover:shadow-md">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-orange-50"><Warehouse className="h-6 w-6 text-[#ff5c00]" /></div>
            <div className="min-w-0 flex-1"><div className="text-sm font-black">المصادر</div><div className="text-xs text-gray-500">إدارة المخازن والورشات والمواقع</div></div>
          </Link>
          <Link href="/wholesale/dashboard" className="flex items-center gap-4 rounded-xl bg-white p-5 shadow-sm transition hover:shadow-md">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-orange-50"><Settings className="h-6 w-6 text-[#ff5c00]" /></div>
            <div className="min-w-0 flex-1"><div className="text-sm font-black">ملف الحساب</div><div className="text-xs text-gray-500">الحالة، الإحصائيات، البيانات</div></div>
          </Link>
        </div>
      </div>
    </div>
  );
}