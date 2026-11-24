"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Flame, Loader2 } from "lucide-react";

type Row = {
  id: number;
  title: string;
  startsAt: string;
  endsAt: string;
  qty: number;
  discount: number;
  platformSubsidy: number;
  sellerBorne: number;
  settledSubsidy: number;
  pendingSubsidy: number;
};

const money = (n: number) => `${(Math.round(n * 100) / 100).toFixed(2)} د.م`;
const day = (iso: string) => new Date(iso).toLocaleDateString("ar-MA", { day: "numeric", month: "short", year: "numeric" });

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-xl bg-white p-3 text-center shadow-sm">
      <div className="text-[11px] text-gray-500">{label}</div>
      <div className={`mt-0.5 text-base font-black ${tone ?? "text-gray-900"}`}>{value}</div>
    </div>
  );
}

export default function AdminFlashReportPage() {
  const [sales, setSales] = useState<Row[]>([]);
  const [total, setTotal] = useState<Omit<Row, "id" | "title" | "startsAt" | "endsAt"> | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/flash-sales/report", { cache: "no-store" });
        const j = await res.json();
        setSales(j.sales ?? j.data?.sales ?? []);
        setTotal(j.total ?? j.data?.total ?? null);
      } catch {
        setErr("تعذر تحميل التقرير");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="mx-auto max-w-4xl space-y-4" dir="rtl">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Flame className="h-5 w-5 text-[#ff5c00]" />
          <h1 className="text-xl font-black text-gray-900">تقرير دعم العروض المحدودة</h1>
        </div>
        <Link
          href="/admin/flash-sales"
          className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50"
        >
          <ArrowRight className="h-3.5 w-3.5" /> الحملات
        </Link>
      </div>
      <p className="text-xs leading-5 text-gray-500">
        «دعم المنصة» هو جزء الخصم الذي تتحمله المنصة وتدفعه للتاجر. يُسوّى عند التسليم، وما لم يُسلَّم بعد يظهر «بانتظار التسوية».
        البنود الملغاة أو المرفوضة لا تُحتسب.
      </p>
      {err && <div className="rounded-lg bg-red-50 p-3 text-xs text-red-700">{err}</div>}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-7 w-7 animate-spin text-[#ff5c00]" />
        </div>
      ) : (
        <>
          {total && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              <Stat label="قطع بيعت" value={String(total.qty)} />
              <Stat label="إجمالي الخصم" value={money(total.discount)} />
              <Stat label="تتحمله المنصة" value={money(total.platformSubsidy)} tone="text-red-600" />
              <Stat label="يتحمله التجّار" value={money(total.sellerBorne)} tone="text-amber-600" />
              <Stat label="سُوّي فعلاً" value={money(total.settledSubsidy)} tone="text-green-600" />
              <Stat label="بانتظار التسوية" value={money(total.pendingSubsidy)} />
            </div>
          )}

          {sales.length === 0 ? (
            <div className="rounded-xl bg-white p-10 text-center text-sm text-gray-500 shadow-sm">لا توجد حملات بعد.</div>
          ) : (
            <div className="space-y-2">
              {sales.map((s) => (
                <div key={s.id} className="rounded-xl bg-white p-4 shadow-sm">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="text-sm font-black">{s.title}</h3>
                    <span className="text-[11px] text-gray-500">
                      {day(s.startsAt)} → {day(s.endsAt)}
                    </span>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-center sm:grid-cols-5">
                    <div>
                      <div className="text-[10px] text-gray-500">قطع بيعت</div>
                      <div className="text-sm font-black">{s.qty}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-gray-500">إجمالي الخصم</div>
                      <div className="text-sm font-black">{money(s.discount)}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-gray-500">تتحمله المنصة</div>
                      <div className="text-sm font-black text-red-600">{money(s.platformSubsidy)}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-gray-500">يتحمله التجّار</div>
                      <div className="text-sm font-black text-amber-600">{money(s.sellerBorne)}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-gray-500">بانتظار التسوية</div>
                      <div className="text-sm font-black">{money(s.pendingSubsidy)}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}