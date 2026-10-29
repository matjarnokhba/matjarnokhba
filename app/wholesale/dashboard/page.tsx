"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Loader2, Package, Warehouse, ShoppingBag, AlertCircle, CheckCircle2,
  Clock, MapPin, ArrowLeft, Plus, FileText,
} from "lucide-react";

type Supplier = {
  id: number;
  displayName: string;
  slug: string;
  activityType: string;
  description: string;
  city: string;
  region: string;
  logo: string;
  isVerified: boolean;
  status: string;
  counts: { sources: number; products: number; orders: number };
};

const ACTIVITY_LABEL: Record<string, string> = {
  COMPANY: "شركة تجارية",
  WORKSHOP: "ورشة",
  FACTORY: "معمل / مصنع",
  WAREHOUSE: "مخزن",
  SHOP: "محل تجاري",
  DISTRIBUTOR: "موزع / مورد",
  INDEPENDENT: "صاحب جملة مستقل",
};

const STATUS_INFO: Record<string, { label: string; bg: string; color: string; icon: any }> = {
  PENDING: { label: "بانتظار الموافقة", bg: "bg-amber-50", color: "text-amber-700", icon: Clock },
  ACTIVE: { label: "نشط", bg: "bg-green-50", color: "text-green-700", icon: CheckCircle2 },
  SUSPENDED: { label: "موقوف", bg: "bg-red-50", color: "text-red-700", icon: AlertCircle },
  CLOSED: { label: "مغلق", bg: "bg-gray-50", color: "text-gray-700", icon: AlertCircle },
};

export default function WholesaleDashboardPage() {
  const router = useRouter();
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [loading, setLoading] = useState(true);
  const [notRegistered, setNotRegistered] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/wholesale/me");
        if (res.status === 401) {
          router.push("/login?next=/wholesale/dashboard");
          return;
        }
        const data = await res.json();
        if (data.success && data.supplier) {
          setSupplier(data.supplier);
        } else {
          setNotRegistered(true);
        }
      } catch {
        setNotRegistered(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#ff5c00]" />
      </div>
    );
  }

  if (notRegistered) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 py-12" dir="rtl">
        <div className="mx-auto max-w-md rounded-2xl bg-white p-8 text-center shadow-sm">
          <ShoppingBag className="mx-auto h-12 w-12 text-gray-300" />
          <h2 className="mt-4 text-lg font-black text-gray-900">ليس لديك حساب جملة</h2>
          <p className="mt-2 text-sm text-gray-500">
            افتح حسابًا الآن وابدأ البيع بالجملة للتجار
          </p>
          <Link
            href="/wholesale/register"
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[#ff5c00] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#e64a00]"
          >
            <Plus className="h-4 w-4" />
            افتح حساب جملة
          </Link>
        </div>
      </div>
    );
  }

  if (!supplier) return null;

  const statusInfo = STATUS_INFO[supplier.status] || STATUS_INFO.PENDING;
  const StatusIcon = statusInfo.icon;

  return (
    <div className="min-h-screen bg-gray-50 p-4 py-8" dir="rtl">
      <div className="mx-auto max-w-4xl">
        <Link
          href="/"
          className="mb-4 inline-flex items-center gap-1 text-xs font-bold text-gray-500 hover:text-[#ff5c00]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          عودة للمتجر
        </Link>

        <div className="mb-6 rounded-2xl bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black text-gray-900">
                  {supplier.displayName}
                </h1>
                {supplier.isVerified && (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-[10px] font-black text-white">
                    ✓
                  </span>
                )}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                <span>{ACTIVITY_LABEL[supplier.activityType] || supplier.activityType}</span>
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {supplier.city}
                  {supplier.region && ` - ${supplier.region}`}
                </span>
              </div>
            </div>
            <div className={`flex items-center gap-1.5 rounded-full ${statusInfo.bg} ${statusInfo.color} px-3 py-1 text-xs font-bold`}>
              <StatusIcon className="h-3.5 w-3.5" />
              {statusInfo.label}
            </div>
          </div>

          {supplier.description && (
            <p className="mt-3 text-sm text-gray-600">{supplier.description}</p>
          )}

          {supplier.status === "PENDING" && (
            <div className="mt-4 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
              <strong>حسابك قيد المراجعة.</strong> سيتم إشعارك عند الموافقة. لا يمكنك إضافة منتجات قبل الموافقة.
            </div>
          )}
          {supplier.status === "SUSPENDED" && (
            <div className="mt-4 rounded-lg bg-red-50 p-3 text-xs text-red-800">
              <strong>حسابك موقوف مؤقتًا.</strong> تواصل مع الإدارة لمعرفة السبب.
            </div>
          )}
        </div>

        <div className="mb-6 grid grid-cols-3 gap-3">
          <div className="rounded-xl bg-white p-4 shadow-sm">
            <Warehouse className="h-5 w-5 text-[#ff5c00]" />
            <div className="mt-2 text-2xl font-black">{supplier.counts.sources}</div>
            <div className="text-[11px] text-gray-500">المصادر</div>
          </div>
          <div className="rounded-xl bg-white p-4 shadow-sm">
            <Package className="h-5 w-5 text-[#ff5c00]" />
            <div className="mt-2 text-2xl font-black">{supplier.counts.products}</div>
            <div className="text-[11px] text-gray-500">المنتجات</div>
          </div>
          <div className="rounded-xl bg-white p-4 shadow-sm">
            <ShoppingBag className="h-5 w-5 text-[#ff5c00]" />
            <div className="mt-2 text-2xl font-black">{supplier.counts.orders}</div>
            <div className="text-[11px] text-gray-500">الطلبات</div>
          </div>
        </div>

        <div className="space-y-3">
          <Link
            href="/wholesale/sources"
            className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm transition hover:bg-gray-50"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-50">
                <Warehouse className="h-5 w-5 text-[#ff5c00]" />
              </div>
              <div>
                <div className="text-sm font-bold">إدارة المصادر</div>
                <div className="text-[11px] text-gray-500">
                  أضف شركات، ورشات، مخازن تابعة لك
                </div>
              </div>
            </div>
            <ArrowLeft className="h-4 w-4 text-gray-400" />
          </Link>

          <Link
            href="/wholesale/products"
            className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm transition hover:bg-gray-50"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-50">
                <Package className="h-5 w-5 text-[#ff5c00]" />
              </div>
              <div>
                <div className="text-sm font-bold">منتجات الجملة</div>
                <div className="text-[11px] text-gray-500">
                  إضافة وإدارة المنتجات المعروضة للتجار
                </div>
              </div>
            </div>
            <ArrowLeft className="h-4 w-4 text-gray-400" />
          </Link>

          <Link
            href="/wholesale/orders"
            className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm transition hover:bg-gray-50"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-50">
                <FileText className="h-5 w-5 text-[#ff5c00]" />
              </div>
              <div>
                <div className="text-sm font-bold">الطلبات الواردة</div>
                <div className="text-[11px] text-gray-500">
                  طلبات التجار التي تحتاج قبولك أو رفضك
                </div>
              </div>
            </div>
            <ArrowLeft className="h-4 w-4 text-gray-400" />
          </Link>
        </div>
      </div>
    </div>
  );
}