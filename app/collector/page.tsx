"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Loader2,
  QrCode,
  Package,
  MapPin,
  Store,
  ChevronLeft,
  Truck,
  Send,
  CheckCircle2,
} from "lucide-react";

type Task = {
  orderId: number;
  orderNumber: string;
  seller: { id: number; storeName: string; city: string | null };
  itemsCount: number;
  status: string;
  readyAt: string | null;
};

type ActiveBatch = {
  id: number;
  batchNumber: string;
  itemsCount: number;
  totalOrders: number;
  departedAt: string;
  preview: string;
};

export default function CollectorDashboard() {
  const [ready, setReady] = useState<Task[]>([]);
  const [collected, setCollected] = useState<Task[]>([]);
  const [activeBatch, setActiveBatch] = useState<ActiveBatch | null>(null);
  const [loading, setLoading] = useState(true);
  const [departing, setDeparting] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  async function load() {
    try {
      const [tasksRes, activeRes] = await Promise.all([
        fetch("/api/collector/tasks"),
        fetch("/api/collector/batches/active"),
      ]);

      const tasksData = await tasksRes.json();
      const activeData = await activeRes.json();

      if (tasksData.success) {
        const all = tasksData.tasks || [];
        setReady(all.filter((t: Task) => t.status === "READY_FOR_COLLECTION"));
        setCollected(all.filter((t: Task) => t.status === "COLLECTED"));
      }

      if (activeData.success && activeData.hasActiveBatch) {
        setActiveBatch(activeData.batch);
      } else {
        setActiveBatch(null);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  // ═══ تجميع المُستلم حسب التاجر ═══
  const collectedBySeller = useMemo(() => {
    const map = new Map<
      string,
      { seller: Task["seller"]; items: Task[]; totalItems: number }
    >();

    for (const t of collected) {
      const key = t.seller.id.toString();
      if (!map.has(key)) {
        map.set(key, {
          seller: t.seller,
          items: [],
          totalItems: 0,
        });
      }
      const entry = map.get(key)!;
      entry.items.push(t);
      entry.totalItems += t.itemsCount;
    }

    return Array.from(map.values());
  }, [collected]);

  async function handleDepart() {
    if (collected.length === 0) return;

    setDeparting(true);
    setMessage(null);

    try {
      const res = await fetch("/api/collector/batches/depart", {
        method: "POST",
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setMessage({
          type: "error",
          text: data.message || "فشل إنشاء الدفعة",
        });
        return;
      }

      setMessage({
        type: "success",
        text: `✅ تم إنشاء دفعة ${data.batchNumber} — ${data.itemsCount} طرد`,
      });

      await load();

      setTimeout(() => {
        window.location.href = "/collector/batch";
      }, 1200);
    } catch {
      setMessage({ type: "error", text: "فشل الاتصال" });
    } finally {
      setDeparting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-purple-600" />
      </div>
    );
  }

  return (
    <div className="p-4 pt-16 lg:p-8 lg:pt-8">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-gray-900">لوحة الجمع</h1>
        <p className="mt-1 text-sm text-gray-500">
          {ready.length} جاهز للاستلام · {collected.length} تم استلامه
        </p>
      </div>

      {/* ═══ Active Batch Banner ═══ */}
      {activeBatch && (
        <Link
          href="/collector/batch"
          className="mb-6 block rounded-2xl border-2 border-blue-300 bg-gradient-to-l from-blue-50 to-indigo-50 p-5 shadow-sm transition hover:shadow-md"
        >
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-md">
              <Truck className="h-7 w-7" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-base font-black text-blue-900">
                  دفعة نشطة
                </span>
                <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-bold text-white">
                  🚚 في الطريق
                </span>
              </div>
              <div className="mt-1 font-mono text-sm font-bold text-blue-800">
                {activeBatch.batchNumber}
              </div>
              <div className="mt-1 text-[11px] text-blue-700">
                {activeBatch.itemsCount} طرد من {activeBatch.totalOrders} طلب —
                أظهر QR للمستودع
              </div>
            </div>
            <ChevronLeft className="h-5 w-5 shrink-0 text-blue-400" />
          </div>
        </Link>
      )}

      {message && (
        <div
          className={`mb-4 rounded-xl px-4 py-3 text-sm font-bold ${
            message.type === "success"
              ? "bg-green-50 text-green-700"
              : "bg-red-50 text-red-700"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* ═══ Quick actions ═══ */}
      {!activeBatch && (
        <div className="mb-6 grid grid-cols-2 gap-3">
          <Link
            href="/collector/scan"
            className="flex flex-col items-center gap-2 rounded-2xl bg-gradient-to-br from-purple-600 to-purple-800 p-6 text-white shadow-lg transition hover:shadow-xl"
          >
            <QrCode className="h-8 w-8" />
            <span className="text-sm font-black">مسح الطرود</span>
          </Link>
          <Link
            href="/collector/tasks"
            className="flex flex-col items-center gap-2 rounded-2xl bg-white p-6 text-gray-900 shadow-md transition hover:shadow-lg"
          >
            <Package className="h-8 w-8 text-purple-600" />
            <span className="text-sm font-black">كل المهام</span>
          </Link>
        </div>
      )}

      {/* ═══ Collected by Seller — القسم الرئيسي ═══ */}
      {!activeBatch && collectedBySeller.length > 0 && (
        <div className="mb-6 rounded-2xl border-2 border-teal-300 bg-teal-50 p-5">
          <div className="mb-4 flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-100">
              <Package className="h-5 w-5 text-teal-700" />
            </div>
            <div className="flex-1">
              <div className="text-base font-black text-teal-900">
                الطرود المستلمة ({collected.length})
              </div>
              <p className="mt-1 text-xs text-teal-700">
                من {collectedBySeller.length} تاجر — بانتظار الانطلاق للمستودع
              </p>
            </div>
          </div>

          {/* Per seller groups */}
          <div className="space-y-3">
            {collectedBySeller.map((group) => (
              <div
                key={group.seller.id}
                className="rounded-xl border border-teal-200 bg-white p-3"
              >
                <div className="mb-2 flex items-center gap-2">
                  <Store className="h-4 w-4 text-teal-600" />
                  <div className="flex-1">
                    <div className="text-xs font-black text-teal-900">
                      {group.seller.storeName}
                    </div>
                    {group.seller.city && (
                      <div className="flex items-center gap-1 text-[10px] text-gray-500">
                        <MapPin className="h-2.5 w-2.5" />
                        {group.seller.city}
                      </div>
                    )}
                  </div>
                  <span className="flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700">
                    <CheckCircle2 className="h-3 w-3" />
                    {group.items.length === 1
                      ? `استلمت الطرد`
                      : `استلمت ${group.items.length} طرود`}
                  </span>
                </div>

                <div className="space-y-1">
                  {group.items.map((item) => (
                    <div
                      key={item.orderId}
                      className="flex items-center gap-2 rounded-lg bg-gray-50 px-2 py-1.5 text-[10px]"
                    >
                      <Package className="h-3 w-3 shrink-0 text-teal-600" />
                      <span className="font-mono font-bold">
                        {item.orderNumber}
                      </span>
                      <span className="text-gray-500">
                        · {item.itemsCount} منتج
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Depart button */}
          <button
            onClick={handleDepart}
            disabled={departing}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-teal-600 py-4 text-sm font-bold text-white shadow-sm transition hover:bg-teal-700 disabled:opacity-50"
          >
            {departing ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
            انطلاق إلى المستودع ({collected.length} طرد)
          </button>
        </div>
      )}

      {/* ═══ Ready for collection ═══ */}
      <h2 className="mb-3 text-base font-black">
        {ready.length > 0 ? "جاهز للاستلام" : "لا يوجد جاهز للاستلام"}
      </h2>

      {ready.length === 0 ? (
        <div className="rounded-xl bg-white p-12 text-center shadow-sm">
          <div className="text-5xl">📦</div>
          <p className="mt-3 text-sm text-gray-500">
            {collected.length > 0
              ? "كل ما تم إسناده إليك مُستلم — انطلق للمستودع"
              : "لا توجد طرود مُسندة إليك حالياً"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {ready.map((t) => (
            <Link
              key={t.orderId}
              href={`/collector/scan`}
              className="block rounded-xl bg-white p-4 shadow-sm transition hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-black text-gray-900">
                      {t.orderNumber}
                    </span>
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                      جاهز
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-1 text-xs text-gray-500">
                    <Store className="h-3 w-3" />
                    {t.seller.storeName}
                  </div>
                  {t.seller.city && (
                    <div className="mt-0.5 flex items-center gap-1 text-[11px] text-gray-500">
                      <MapPin className="h-3 w-3" />
                      {t.seller.city}
                    </div>
                  )}
                  <div className="mt-1 text-[11px] text-gray-500">
                    {t.itemsCount} منتج
                  </div>
                </div>
                <ChevronLeft className="h-4 w-4 shrink-0 text-gray-300" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}