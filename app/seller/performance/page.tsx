"use client";

import { useEffect, useState } from "react";
import {
  Loader2,
  TrendingUp,
  TrendingDown,
  Package,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Star,
  Clock,
  Wallet,
  AlertTriangle,
  Award,
} from "lucide-react";

type Performance = {
  seller: {
    totalOrders: number;
    totalRevenue: string;
    totalCommission: string;
    acceptanceRate: string;
    cancellationRate: string;
    codRejectionRate: string;
    returnRate: string;
    avgRating: string;
    avgProcessingHours: string;
    lastPerformanceUpdate: string | null;
    createdAt: string;
  };
  recent: {
    NEW: number;
    PROCESSING: number;
    SHIPPED: number;
    DELIVERED: number;
    CANCELLED: number;
    RETURNED: number;
    total: number;
  };
  monthly: Record<string, { revenue: number; orders: number }>;
};

const CURRENCY = "د.م";

export default function SellerPerformancePage() {
  const [data, setData] = useState<Performance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/seller/performance");
        const json = await res.json();
        if (!res.ok || !json.success) {
          setError(json.message || "فشل التحميل");
          return;
        }
        setData(json);
      } catch {
        setError("فشل الاتصال");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-[#ff5c00]" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
        <AlertTriangle className="h-12 w-12 text-red-500" />
        <h1 className="mt-4 text-xl font-black">{error}</h1>
      </div>
    );
  }

  const { seller, recent, monthly } = data;

  // ═══ تحويل البيانات ═══
  const acceptance = Number(seller.acceptanceRate) * 100;
  const cancellation = Number(seller.cancellationRate) * 100;
  const codRejection = Number(seller.codRejectionRate) * 100;
  const returnRate = Number(seller.returnRate) * 100;
  const avgRating = Number(seller.avgRating);
  const avgProcessing = Number(seller.avgProcessingHours);
  const totalRevenue = Number(seller.totalRevenue);

  // ═══ ترتيب الإيرادات الشهرية ═══
  const monthKeys = Object.keys(monthly).sort().reverse();
  const maxRevenue = Math.max(
    1,
    ...Object.values(monthly).map((m) => m.revenue)
  );

  // ═══ مؤشر الجودة العام ═══
  const qualityScore = Math.round(
    (acceptance * 0.3 +
      (100 - cancellation) * 0.2 +
      (avgRating / 5) * 100 * 0.3 +
      (100 - returnRate) * 0.2) /
      1
  );

  const qualityGrade =
    qualityScore >= 90
      ? { label: "ممتاز", color: "text-green-600", bg: "bg-green-100", icon: Award }
      : qualityScore >= 75
        ? { label: "جيد جداً", color: "text-blue-600", bg: "bg-blue-100", icon: TrendingUp }
        : qualityScore >= 60
          ? { label: "جيد", color: "text-amber-600", bg: "bg-amber-100", icon: TrendingUp }
          : { label: "يحتاج تحسين", color: "text-red-600", bg: "bg-red-100", icon: TrendingDown };

  const GradeIcon = qualityGrade.icon;

  return (
    <div className="p-4 pt-16 lg:p-8 lg:pt-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-black text-gray-900">أدائي</h1>
        <p className="mt-1 text-sm text-gray-500">
          مؤشرات أداء متجرك على المنصة
        </p>
      </div>

      {/* ═══ الجودة العامة ═══ */}
      <div className="mb-5 rounded-2xl bg-gradient-to-br from-[#0a1a35] via-[#122a4d] to-[#0a1a35] p-6 text-white shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-sm text-white/70">مؤشر الجودة العام</div>
            <div className="mt-1 text-4xl font-black">{qualityScore}<span className="text-2xl">/100</span></div>
            <div className="mt-1 text-sm text-white/80">
              بناءً على قبول الطلبات، التقييمات، والإرجاع
            </div>
          </div>

          <div
            className={`flex items-center gap-2 rounded-full ${qualityGrade.bg} px-5 py-3`}
          >
            <GradeIcon className={`h-6 w-6 ${qualityGrade.color}`} />
            <span className={`text-lg font-black ${qualityGrade.color}`}>
              {qualityGrade.label}
            </span>
          </div>
        </div>
      </div>

      {/* ═══ الإحصائيات الرئيسية ═══ */}
      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Package}
          label="إجمالي الطلبات"
          value={seller.totalOrders.toString()}
          color="bg-orange-100 text-[#ff5c00]"
        />
        <StatCard
          icon={Wallet}
          label="إجمالي الإيرادات"
          value={`${totalRevenue.toFixed(0)}`}
          suffix={CURRENCY}
          color="bg-green-100 text-green-600"
        />
        <StatCard
          icon={Star}
          label="متوسط التقييم"
          value={avgRating.toFixed(2)}
          suffix="⭐"
          color="bg-yellow-100 text-yellow-600"
        />
        <StatCard
          icon={Clock}
          label="متوسط التجهيز"
          value={avgProcessing.toFixed(1)}
          suffix="ساعة"
          color="bg-blue-100 text-blue-600"
        />
      </div>

      {/* ═══ معدلات الأداء ═══ */}
      <div className="mb-5 rounded-xl bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-black">معدلات الأداء</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <RateBar
            label="معدل قبول الطلبات"
            value={acceptance}
            color="bg-green-500"
            icon={CheckCircle2}
            description="نسبة الطلبات التي قبلتها"
            good={acceptance >= 90}
          />
          <RateBar
            label="معدل إلغاء الطلبات"
            value={cancellation}
            color="bg-red-500"
            icon={XCircle}
            description="نسبة الطلبات الملغاة"
            invert
            good={cancellation <= 5}
          />
          <RateBar
            label="نسبة رفض COD"
            value={codRejection}
            color="bg-amber-500"
            icon={AlertTriangle}
            description="الطلبات المرفوضة عند التسليم"
            invert
            good={codRejection <= 10}
          />
          <RateBar
            label="معدل الإرجاع"
            value={returnRate}
            color="bg-purple-500"
            icon={RotateCcw}
            description="نسبة المنتجات المُرجعة"
            invert
            good={returnRate <= 10}
          />
        </div>
      </div>

      {/* ═══ الطلبات (آخر 30 يوم) ═══ */}
      <div className="mb-5 rounded-xl bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-black">الطلبات — آخر 30 يوم</h2>

        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          <MiniStat label="جديدة" value={recent.NEW} color="text-blue-600" />
          <MiniStat label="قيد التجهيز" value={recent.PROCESSING} color="text-amber-600" />
          <MiniStat label="تم الشحن" value={recent.SHIPPED} color="text-purple-600" />
          <MiniStat label="تم التوصيل" value={recent.DELIVERED} color="text-green-600" />
          <MiniStat label="ملغاة" value={recent.CANCELLED} color="text-red-600" />
          <MiniStat label="مرتجعة" value={recent.RETURNED} color="text-gray-600" />
        </div>
      </div>

      {/* ═══ الإيرادات الشهرية ═══ */}
      {monthKeys.length > 0 && (
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-black">الإيرادات الشهرية</h2>

          <div className="space-y-2">
            {monthKeys.map((key) => {
              const m = monthly[key];
              const percent = (m.revenue / maxRevenue) * 100;
              const [year, month] = key.split("-");
              const monthName = new Date(
                parseInt(year),
                parseInt(month) - 1
              ).toLocaleDateString("ar-MA", { month: "long" });
              return (
                <div key={key} className="flex items-center gap-3 text-xs">
                  <div className="w-24 shrink-0 font-bold text-gray-700">
                    {monthName}
                  </div>
                  <div className="h-6 flex-1 overflow-hidden rounded-lg bg-gray-100">
                    <div
                      className="flex h-full items-center justify-end bg-gradient-to-l from-[#ff5c00] to-[#ff8a3d] px-2"
                      style={{ width: `${Math.max(percent, 15)}%` }}
                    >
                      <span className="text-[10px] font-bold text-white">
                        {m.revenue.toFixed(0)}
                      </span>
                    </div>
                  </div>
                  <div className="w-16 shrink-0 text-left text-[10px] text-gray-500">
                    {m.orders} طلب
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══ آخر تحديث ═══ */}
      {seller.lastPerformanceUpdate && (
        <div className="mt-4 text-center text-[10px] text-gray-400">
          آخر تحديث:{" "}
          {new Date(seller.lastPerformanceUpdate).toLocaleDateString("ar-MA", {
            day: "numeric",
            month: "long",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
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
  suffix,
  color,
}: {
  icon: any;
  label: string;
  value: string;
  suffix?: string;
  color: string;
}) {
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <div className={`flex h-10 w-10 items-center justify-center rounded-full ${color}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="mt-2 flex items-baseline gap-1">
        <span className="text-2xl font-black text-gray-900">{value}</span>
        {suffix && <span className="text-xs text-gray-500">{suffix}</span>}
      </div>
      <div className="mt-0.5 text-xs text-gray-500">{label}</div>
    </div>
  );
}

function RateBar({
  label,
  value,
  color,
  icon: Icon,
  description,
  invert = false,
  good,
}: {
  label: string;
  value: number;
  color: string;
  icon: any;
  description: string;
  invert?: boolean;
  good: boolean;
}) {
  return (
    <div>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-gray-500" />
          <div>
            <div className="text-xs font-black text-gray-900">{label}</div>
            <div className="text-[10px] text-gray-400">{description}</div>
          </div>
        </div>
        <div
          className={`text-lg font-black ${good ? "text-green-600" : "text-amber-600"}`}
        >
          {value.toFixed(1)}%
        </div>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-100">
        <div
          className={`h-full ${color} transition-all`}
          style={{ width: `${Math.min(value, 100)}%` }}
        />
      </div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="rounded-lg bg-gray-50 p-3 text-center">
      <div className={`text-xl font-black ${color}`}>{value}</div>
      <div className="mt-0.5 text-[10px] text-gray-500">{label}</div>
    </div>
  );
}