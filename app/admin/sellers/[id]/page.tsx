"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  Loader2,
  Store,
  MapPin,
  Mail,
  Phone,
  Calendar,
  Package,
  ShoppingCart,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  ShieldX,
  AlertTriangle,
  ExternalLink,
} from "lucide-react";

type Seller = {
  id: number;
  storeName: string;
  slug: string;
  logo: string | null;
  description: string | null;
  city: string | null;
  region: string | null;
  status: string;
  isVerified: boolean;
  verifiedAt: string | null;
  createdAt: string;
  avgRating: string;
  totalOrders: number;
  totalRevenue: string;
  user: {
    id: number;
    name: string;
    email: string;
    phone: string | null;
    createdAt: string;
  };
  _count: { products: number; orders: number };
};

const STATUS_INFO: Record<
  string,
  { label: string; color: string; bg: string; icon: any }
> = {
  PENDING: {
    label: "بانتظار الموافقة",
    color: "text-amber-700",
    bg: "bg-amber-100",
    icon: AlertTriangle,
  },
  ACTIVE: {
    label: "نشط",
    color: "text-green-700",
    bg: "bg-green-100",
    icon: CheckCircle2,
  },
  SUSPENDED: {
    label: "معلّق",
    color: "text-red-700",
    bg: "bg-red-100",
    icon: ShieldX,
  },
  CLOSED: {
    label: "مغلق",
    color: "text-gray-700",
    bg: "bg-gray-100",
    icon: XCircle,
  },
};

const CURRENCY = "د.م";

export default function AdminSellerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const sellerId = params.id as string;

  const [seller, setSeller] = useState<Seller | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState<
    null | "suspend" | "close"
  >(null);

  async function loadData() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/sellers/${sellerId}`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.message || "التاجر غير موجود");
        return;
      }
      setSeller(data.seller);
    } catch {
      setError("فشل الاتصال");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (sellerId) loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sellerId]);

  async function handleAction(
    action: "approve" | "suspend" | "activate" | "close" | "verify"
  ) {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/sellers/${sellerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        alert(data.message || "فشل الإجراء");
        return;
      }

      setShowConfirm(null);
      await loadData();
    } catch {
      alert("فشل الاتصال");
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-[#ff5c00]" />
      </div>
    );
  }

  if (error || !seller) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
        <AlertTriangle className="h-12 w-12 text-red-500" />
        <h1 className="mt-4 text-xl font-black">{error}</h1>
        <Link
          href="/admin/sellers"
          className="mt-6 rounded-full bg-[#ff5c00] px-6 py-2.5 text-sm font-bold text-white"
        >
          عودة إلى التجار
        </Link>
      </div>
    );
  }

  const info = STATUS_INFO[seller.status];
  const Icon = info.icon;

  return (
    <div className="p-4 pt-16 lg:p-8 lg:pt-8">
      <Link
        href="/admin/sellers"
        className="mb-4 inline-flex items-center gap-1 text-xs font-bold text-gray-500 transition hover:text-[#ff5c00]"
      >
        <ArrowRight className="h-3.5 w-3.5" />
        رجوع إلى التجار
      </Link>

      {/* ═══ رأس ═══ */}
      <div className="rounded-xl bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start gap-4">
          <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-gray-100">
            {seller.logo ? (
              <img
                src={seller.logo}
                alt={seller.storeName}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-yellow-400 to-amber-500 text-2xl font-black text-[#0a1a35]">
                {seller.storeName.charAt(0)}
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-black text-gray-900">
                {seller.storeName}
              </h1>
              {seller.isVerified && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500" title="موثّق">
                  <ShieldCheck className="h-3.5 w-3.5 text-white" />
                </span>
              )}
              <span
                className={`flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${info.bg} ${info.color}`}
              >
                <Icon className="h-3 w-3" />
                {info.label}
              </span>
            </div>

            <div className="mt-1 font-mono text-xs text-gray-500">
              /store/{seller.slug}
            </div>

            <Link
              href={`/store/${seller.slug}`}
              target="_blank"
              className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-[#ff5c00] hover:underline"
            >
              <ExternalLink className="h-3 w-3" />
              عرض صفحة المتجر
            </Link>
          </div>
        </div>
      </div>

      {/* ═══ الإحصائيات ═══ */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          icon={Package}
          label="المنتجات"
          value={String(seller._count.products)}
          color="bg-orange-100 text-[#ff5c00]"
        />
        <StatCard
          icon={ShoppingCart}
          label="الطلبات"
          value={String(seller._count.orders)}
          color="bg-blue-100 text-blue-600"
        />
        <StatCard
          icon={Store}
          label="الإيرادات"
          value={`${Number(seller.totalRevenue).toFixed(0)} ${CURRENCY}`}
          color="bg-green-100 text-green-600"
        />
        <StatCard
          icon={CheckCircle2}
          label="التقييم"
          value={Number(seller.avgRating).toFixed(1)}
          color="bg-purple-100 text-purple-600"
        />
      </div>

      {/* ═══ معلومات المالك ═══ */}
      <div className="mt-4 rounded-xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-black">معلومات صاحب المتجر</h2>
        <div className="space-y-2 text-sm">
          <Row icon={Store} label={seller.user.name} />
          <Row icon={Mail} label={seller.user.email} dir="ltr" />
          {seller.user.phone && (
            <Row icon={Phone} label={seller.user.phone} dir="ltr" />
          )}
          {seller.city && (
            <Row
              icon={MapPin}
              label={`${seller.city}${seller.region ? " · " + seller.region : ""}`}
            />
          )}
          <Row
            icon={Calendar}
            label={`انضم: ${new Date(seller.createdAt).toLocaleDateString("ar-MA", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}`}
          />
        </div>
      </div>

      {/* ═══ الوصف ═══ */}
      {seller.description && (
        <div className="mt-4 rounded-xl bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-black">وصف المتجر</h2>
          <p className="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700">
            {seller.description}
          </p>
        </div>
      )}

      {/* ═══ الإجراءات ═══ */}
      <div className="mt-4 rounded-xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-black">الإجراءات</h2>

        <div className="flex flex-wrap gap-2">
          {/* PENDING → موافقة أو رفض */}
          {seller.status === "PENDING" && (
            <>
              <ActionButton
                onClick={() => handleAction("approve")}
                loading={actionLoading}
                color="bg-green-600 hover:bg-green-700"
                icon={CheckCircle2}
                label="موافقة وتفعيل"
              />
              <ActionButton
                onClick={() => setShowConfirm("suspend")}
                color="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200"
                icon={XCircle}
                label="رفض الطلب"
                loading={false}
              />
            </>
          )}

          {/* ACTIVE → تعليق أو توثيق */}
          {seller.status === "ACTIVE" && (
            <>
              {!seller.isVerified && (
                <ActionButton
                  onClick={() => handleAction("verify")}
                  loading={actionLoading}
                  color="bg-blue-600 hover:bg-blue-700"
                  icon={ShieldCheck}
                  label="توثيق المتجر"
                />
              )}
              <ActionButton
                onClick={() => setShowConfirm("suspend")}
                color="bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200"
                icon={AlertTriangle}
                label="تعليق المتجر"
                loading={false}
              />
            </>
          )}

          {/* SUSPENDED → تفعيل أو إغلاق */}
          {seller.status === "SUSPENDED" && (
            <>
              <ActionButton
                onClick={() => handleAction("activate")}
                loading={actionLoading}
                color="bg-green-600 hover:bg-green-700"
                icon={CheckCircle2}
                label="إعادة التفعيل"
              />
              <ActionButton
                onClick={() => setShowConfirm("close")}
                color="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200"
                icon={XCircle}
                label="إغلاق نهائي"
                loading={false}
              />
            </>
          )}

          {/* CLOSED → لا إجراءات */}
          {seller.status === "CLOSED" && (
            <p className="text-sm text-gray-500">
              هذا المتجر مغلق نهائياً — لا توجد إجراءات متاحة.
            </p>
          )}
        </div>
      </div>

      {/* ═══ Modal تأكيد ═══ */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-5">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100">
              <AlertTriangle className="h-7 w-7 text-amber-600" />
            </div>
            <h3 className="mt-4 text-lg font-black">
              {showConfirm === "close" ? "إغلاق نهائي" : "تأكيد التعليق"}
            </h3>
            <p className="mt-2 text-sm text-gray-600">
              {showConfirm === "close"
                ? "سيتم إغلاق المتجر نهائياً ولا يمكن التراجع."
                : "سيتم تعليق المتجر مؤقتاً. يمكنك إعادة تفعيله لاحقاً."}
            </p>

            <div className="mt-6 flex gap-2">
              <button
                onClick={() =>
                  handleAction(showConfirm === "close" ? "close" : "suspend")
                }
                disabled={actionLoading}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-500 py-2.5 text-sm font-bold text-white transition hover:bg-red-600 disabled:opacity-50"
              >
                {actionLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : null}
                تأكيد
              </button>
              <button
                onClick={() => setShowConfirm(null)}
                disabled={actionLoading}
                className="flex-1 rounded-lg border border-gray-200 py-2.5 text-sm font-bold text-gray-700 transition hover:bg-gray-50"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══ Components ═══
function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: any;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="rounded-xl bg-white p-3 shadow-sm">
      <div
        className={`flex h-8 w-8 items-center justify-center rounded-full ${color}`}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="mt-2 text-lg font-black text-gray-900">{value}</div>
      <div className="text-[10px] text-gray-500">{label}</div>
    </div>
  );
}

function Row({
  icon: Icon,
  label,
  dir,
}: {
  icon: any;
  label: string;
  dir?: "ltr" | "rtl";
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-4 w-4 shrink-0 text-gray-400" />
      <span dir={dir} className="font-bold text-gray-700">
        {label}
      </span>
    </div>
  );
}

function ActionButton({
  onClick,
  loading,
  color,
  icon: Icon,
  label,
}: {
  onClick: () => void;
  loading: boolean;
  color: string;
  icon: any;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold text-white transition disabled:opacity-50 ${color}`}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Icon className="h-4 w-4" />
      )}
      {label}
    </button>
  );
}