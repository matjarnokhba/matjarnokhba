"use client";

import { useEffect, useState } from "react";
import {
  Loader2,
  Wallet,
  TrendingUp,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowDownToLine,
  Package,
  Calendar,
  Info,
} from "lucide-react";

type Order = {
  id: number;
  orderNumber: string;
  total: string;
  sellerPayout: string | null;
  commission: string | null;
  refundedAmount: string;
  deliveredAt: string | null;
  createdAt: string;
};

type Payout = {
  id: number;
  amount: string;
  currency: string;
  status: string;
  periodStart: string;
  periodEnd: string;
  orderCount: number;
  transactionRef: string | null;
  notes: string | null;
  processedAt: string | null;
  createdAt: string;
};

type Summary = {
  totalEarnings: number;
  totalPaidOut: number;
  pendingPayouts: number;
  availableBalance: number;
  recentEarnings: number;
  monthEarnings: number;
  totalOrdersCount: number;
};

const CURRENCY = "د.م";

const PAYOUT_STATUS: Record<
  string,
  { label: string; color: string; bg: string; icon: any }
> = {
  PENDING: {
    label: "قيد الانتظار",
    color: "text-amber-700",
    bg: "bg-amber-100",
    icon: Clock,
  },
  PROCESSING: {
    label: "قيد التحويل",
    color: "text-blue-700",
    bg: "bg-blue-100",
    icon: Loader2,
  },
  COMPLETED: {
    label: "تم التحويل",
    color: "text-green-700",
    bg: "bg-green-100",
    icon: CheckCircle2,
  },
  FAILED: {
    label: "فشل",
    color: "text-red-700",
    bg: "bg-red-100",
    icon: XCircle,
  },
  CANCELLED: {
    label: "ملغى",
    color: "text-gray-700",
    bg: "bg-gray-100",
    icon: XCircle,
  },
};

export default function SellerPayoutsPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/seller/payouts");
        const data = await res.json();
        if (!res.ok || !data.success) {
          setError(data.message || "فشل التحميل");
          return;
        }
        setSummary(data.summary);
        setOrders(data.recentOrders);
        setPayouts(data.payouts);
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

  if (error || !summary) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
        <AlertTriangle className="h-12 w-12 text-red-500" />
        <h1 className="mt-4 text-xl font-black">{error}</h1>
      </div>
    );
  }

  return (
    <div className="p-4 pt-16 lg:p-8 lg:pt-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-black text-gray-900">المدفوعات</h1>
        <p className="mt-1 text-sm text-gray-500">
          أرباحك و تسوياتك المالية
        </p>
      </div>

      {/* ═══ بطاقة الرصيد الرئيسية ═══ */}
      <div className="mb-5 rounded-2xl bg-gradient-to-br from-[#0a1a35] via-[#122a4d] to-[#0a1a35] p-6 text-white shadow-lg">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm text-white/70">
              <Wallet className="h-4 w-4" />
              الرصيد المتاح
            </div>
            <div className="mt-2 text-4xl font-black">
              {summary.availableBalance.toFixed(2)}
              <span className="ml-2 text-lg text-white/60">{CURRENCY}</span>
            </div>
            <div className="mt-2 text-xs text-white/60">
              يتم التحويل يدوياً شهرياً إلى حسابك البنكي
            </div>
          </div>

          <div className="flex gap-2">
            <div className="rounded-xl bg-white/10 px-4 py-2 backdrop-blur">
              <div className="text-[10px] text-white/70">هذا الشهر</div>
              <div className="text-lg font-black">
                {summary.monthEarnings.toFixed(0)}
                <span className="ml-1 text-xs">د.م</span>
              </div>
            </div>
            <div className="rounded-xl bg-white/10 px-4 py-2 backdrop-blur">
              <div className="text-[10px] text-white/70">آخر 30 يوم</div>
              <div className="text-lg font-black">
                {summary.recentEarnings.toFixed(0)}
                <span className="ml-1 text-xs">د.م</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ الإحصائيات ═══ */}
      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={TrendingUp}
          label="إجمالي الأرباح"
          value={summary.totalEarnings.toFixed(0)}
          suffix={CURRENCY}
          color="bg-green-100 text-green-600"
        />
        <StatCard
          icon={CheckCircle2}
          label="تم تحويلها"
          value={summary.totalPaidOut.toFixed(0)}
          suffix={CURRENCY}
          color="bg-blue-100 text-blue-600"
        />
        <StatCard
          icon={Clock}
          label="قيد التحويل"
          value={summary.pendingPayouts.toFixed(0)}
          suffix={CURRENCY}
          color="bg-amber-100 text-amber-600"
        />
        <StatCard
          icon={Package}
          label="إجمالي الطلبات المُسلَّمة"
          value={summary.totalOrdersCount.toString()}
          color="bg-purple-100 text-purple-600"
        />
      </div>

      {/* ═══ ملاحظة ═══ */}
      <div className="mb-5 flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
        <div className="flex-1 text-sm">
          <div className="font-black text-blue-900">
            كيف تعمل التحويلات؟
          </div>
          <div className="mt-1 text-xs text-blue-700 leading-6">
            • يتم حساب أرباحك من كل طلب عند التسليم (DELIVERED).
            <br />
            • الإدارة تُحوّل الرصيد إلى حسابك البنكي شهرياً.
            <br />
            • يجب إضافة حساب بنكي أولاً لتتمكن من استقبال التحويلات.
          </div>
        </div>
      </div>

      {/* ═══ Payouts السابقة ═══ */}
      {payouts.length > 0 && (
        <div className="mb-5 rounded-xl bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-black">سجل التحويلات</h2>

          <div className="space-y-3">
            {payouts.map((p) => {
              const info = PAYOUT_STATUS[p.status] || PAYOUT_STATUS.PENDING;
              const Icon = info.icon;
              return (
                <div
                  key={p.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-100 bg-gray-50 p-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-black text-gray-900">
                        #{p.id}
                      </span>
                      <span
                        className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${info.bg} ${info.color}`}
                      >
                        <Icon className="h-3 w-3" />
                        {info.label}
                      </span>
                    </div>
                    <div className="mt-1 text-[11px] text-gray-500">
                      {new Date(p.periodStart).toLocaleDateString("ar-MA", {
                        day: "numeric",
                        month: "short",
                      })}{" "}
                      →{" "}
                      {new Date(p.periodEnd).toLocaleDateString("ar-MA", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                      {" · "}
                      {p.orderCount} طلب
                    </div>
                    {p.transactionRef && (
                      <div className="mt-0.5 text-[10px] text-gray-400 font-mono">
                        مرجع: {p.transactionRef}
                      </div>
                    )}
                  </div>

                  <div className="text-left">
                    <div className="text-lg font-black text-[#ff5c00]">
                      {Number(p.amount).toFixed(2)}
                    </div>
                    <div className="text-[10px] text-gray-500">
                      {p.currency}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══ الطلبات المسلّمة (آخر 20) ═══ */}
      {orders.length > 0 && (
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-black">
            الأرباح حسب الطلب (آخر 20)
          </h2>

          <div className="space-y-2">
            {orders.map((o) => {
              const payout = o.sellerPayout
                ? Number(o.sellerPayout)
                : Number(o.total);
              const commission = o.commission ? Number(o.commission) : 0;

              return (
                <div
                  key={o.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-100 p-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-gray-900">
                        {o.orderNumber}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-[10px] text-gray-500">
                      <Calendar className="h-3 w-3" />
                      {o.deliveredAt
                        ? new Date(o.deliveredAt).toLocaleDateString("ar-MA", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })
                        : "—"}
                      {commission > 0 && (
                        <>
                          <span>·</span>
                          <span>عمولة: {commission.toFixed(2)} د.م</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="text-left">
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      <ArrowDownToLine className="h-3 w-3" />
                      <span className="text-base font-black text-green-600">
                        +{payout.toFixed(2)}
                      </span>
                      <span className="text-[10px]">{CURRENCY}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══ إذا لا يوجد شيء ═══ */}
      {orders.length === 0 && payouts.length === 0 && (
        <div className="rounded-xl bg-white p-12 text-center shadow-sm">
          <Wallet className="mx-auto h-12 w-12 text-gray-300" />
          <h3 className="mt-4 text-lg font-black">لا توجد أرباح بعد</h3>
          <p className="mt-2 text-sm text-gray-500">
            ستظهر أرباحك هنا بعد تسليم أول طلب
          </p>
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
      <div
        className={`flex h-10 w-10 items-center justify-center rounded-full ${color}`}
      >
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