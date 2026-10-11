"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Loader2,
  QrCode,
  Package,
  Truck,
  Store,
  MapPin,
  UserPlus,
  X,
  Check,
  AlertCircle,
} from "lucide-react";

type Task = {
  orderId: number;
  orderNumber: string;
  seller: { id: number; storeName: string; city: string | null };
  itemsCount: number;
  status: string;
  readyAt: string | null;
  assignedCollectorId: number | null;
  assignedAt: string | null;
};

type Collector = {
  id: number;
  name: string;
  phone: string | null;
  email: string;
  activeCount: number;
};

export default function WarehouseDashboard() {
  const [ready, setReady] = useState<Task[]>([]);
  const [incoming, setIncoming] = useState<Task[]>([]);
  const [received, setReceived] = useState<Task[]>([]);
  const [verified, setVerified] = useState<Task[]>([]);
  const [collectors, setCollectors] = useState<Collector[]>([]);
  const [loading, setLoading] = useState(true);
  const [assignModal, setAssignModal] = useState<Task | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [selectedCollector, setSelectedCollector] = useState<number | null>(null);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  async function load() {
    try {
      const [tasksRes, collectorsRes] = await Promise.all([
        fetch("/api/warehouse/tasks"),
        fetch("/api/warehouse/collectors"),
      ]);

      const tasksData = await tasksRes.json();
      const collectorsData = await collectorsRes.json();

      if (tasksData.success) {
        setReady(tasksData.readyForCollection || []);
        setIncoming(tasksData.incoming || []);
        setReceived(tasksData.received || []);
        setVerified(tasksData.ready || []);
      }

      if (collectorsData.success) {
        setCollectors(collectorsData.collectors || []);
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

  async function handleAssign() {
    if (!assignModal || !selectedCollector) return;
    setAssigning(true);

    try {
      const res = await fetch(
        `/api/warehouse/orders/${assignModal.orderId}/assign-collector`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ collectorId: selectedCollector }),
        }
      );
      const data = await res.json();

      if (!res.ok || !data.success) {
        setMessage({
          type: "error",
          text: data.message || "فشل الإسناد",
        });
        return;
      }

      setMessage({
        type: "success",
        text: `✅ تم إسناد الطلب إلى ${data.collectorName}`,
      });
      setAssignModal(null);
      setSelectedCollector(null);
      await load();

      setTimeout(() => setMessage(null), 3000);
    } catch {
      setMessage({ type: "error", text: "فشل الاتصال" });
    } finally {
      setAssigning(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-teal-600" />
      </div>
    );
  }

  return (
    <div className="p-4 pt-16 lg:p-8 lg:pt-8">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-gray-900">لوحة المستودع</h1>
        <p className="mt-1 text-sm text-gray-500">
          {ready.length} جاهز للجمع · {incoming.length} في الطريق ·{" "}
          {received.length} بانتظار الفحص · {verified.length} جاهز للشحن
        </p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3">
        <Link
          href="/warehouse/scan"
          className="flex flex-col items-center gap-2 rounded-2xl bg-gradient-to-br from-teal-600 to-teal-800 p-6 text-white shadow-lg transition hover:shadow-xl"
        >
          <QrCode className="h-8 w-8" />
          <span className="text-sm font-black">مسح QR</span>
        </Link>
        <Link
          href="/warehouse/receipts"
          className="flex flex-col items-center gap-2 rounded-2xl bg-white p-6 text-gray-900 shadow-md transition hover:shadow-lg"
        >
          <Package className="h-8 w-8 text-teal-600" />
          <span className="text-sm font-black">الاستلامات</span>
        </Link>
      </div>

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

      {/* ═══ جاهز للجمع ═══ */}
      {ready.length > 0 && (
        <div className="mb-6 rounded-2xl border-2 border-amber-200 bg-amber-50 p-5">
          <div className="mb-3 flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-amber-700" />
            <h2 className="text-base font-black text-amber-900">
              ⚡ طلبات جاهزة للجمع ({ready.length})
            </h2>
          </div>
          <p className="mb-3 text-xs text-amber-800">
            هذه الطلبات جهّزها التجار وتنتظر إسناد جامع.
          </p>

          <div className="space-y-2">
            {ready.map((t) => (
              <div
                key={t.orderId}
                className="flex flex-wrap items-center gap-3 rounded-xl bg-white p-3 shadow-sm"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-mono text-sm font-black">
                    {t.orderNumber}
                  </div>
                  <div className="mt-0.5 flex items-center gap-1 text-[11px] text-gray-500">
                    <Store className="h-3 w-3" />
                    {t.seller.storeName}
                  </div>
                  {t.seller.city && (
                    <div className="mt-0.5 flex items-center gap-1 text-[11px] text-gray-500">
                      <MapPin className="h-3 w-3" />
                      {t.seller.city}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => {
                    setAssignModal(t);
                    setSelectedCollector(null);
                  }}
                  className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-amber-700"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  إسناد جامع
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ أعمدة ═══ */}
      <div className="grid gap-5 lg:grid-cols-3">
        <TaskColumn
          title="🚚 في الطريق للمستودع"
          count={incoming.length}
          colorClass="text-blue-700"
          items={incoming}
          emptyText="لا توجد طرود في الطريق"
        />
        <TaskColumn
          title="📥 بانتظار الفحص"
          count={received.length}
          colorClass="text-amber-700"
          items={received}
          emptyText="لا توجد استلامات حديثة"
        />
        <TaskColumn
          title="✅ جاهز للشحن"
          count={verified.length}
          colorClass="text-green-700"
          items={verified}
          emptyText="لا توجد طرود جاهزة"
        />
      </div>

      {/* ═══ Modal إسناد ═══ */}
      {assignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-black">إسناد جامع</h3>
              <button
                onClick={() => {
                  setAssignModal(null);
                  setSelectedCollector(null);
                }}
                className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-gray-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mb-4 rounded-xl bg-gray-50 p-3">
              <div className="text-xs text-gray-500">الطلب</div>
              <div className="mt-1 font-mono text-sm font-black">
                {assignModal.orderNumber}
              </div>
              <div className="mt-1 text-[11px] text-gray-500">
                من: {assignModal.seller.storeName}
                {assignModal.seller.city && ` — ${assignModal.seller.city}`}
              </div>
            </div>

            <div className="mb-4">
              <div className="mb-2 text-xs font-bold text-gray-700">
                اختر جامعًا
              </div>
              {collectors.length === 0 ? (
                <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
                  ⚠️ لا يوجد جامعون. أنشئ جامعًا من
                  <span className="font-bold"> /admin/users/new</span>
                </div>
              ) : (
                <div className="max-h-60 space-y-2 overflow-y-auto">
                  {collectors.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setSelectedCollector(c.id)}
                      className={`flex w-full items-center gap-3 rounded-xl border-2 p-3 text-right transition ${
                        selectedCollector === c.id
                          ? "border-teal-600 bg-teal-50"
                          : "border-gray-200 bg-white hover:border-gray-300"
                      }`}
                    >
                      <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-black text-white ${
                          selectedCollector === c.id
                            ? "bg-teal-600"
                            : "bg-gray-400"
                        }`}
                      >
                        {c.name.charAt(0)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-bold">{c.name}</div>
                        <div className="text-[10px] text-gray-500">
                          {c.activeCount} مهمة نشطة
                        </div>
                      </div>
                      {selectedCollector === c.id && (
                        <Check className="h-4 w-4 text-teal-600" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleAssign}
                disabled={
                  !selectedCollector || assigning || collectors.length === 0
                }
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-teal-600 py-2.5 text-sm font-bold text-white transition hover:bg-teal-700 disabled:opacity-50"
              >
                {assigning ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                تأكيد الإسناد
              </button>
              <button
                onClick={() => {
                  setAssignModal(null);
                  setSelectedCollector(null);
                }}
                disabled={assigning}
                className="flex-1 rounded-lg border border-gray-200 py-2.5 text-sm font-bold text-gray-700"
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

function TaskColumn({
  title,
  count,
  colorClass,
  items,
  emptyText,
}: {
  title: string;
  count: number;
  colorClass: string;
  items: Task[];
  emptyText: string;
}) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className={`text-sm font-black ${colorClass}`}>{title}</h2>
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-600">
          {count}
        </span>
      </div>

      {items.length === 0 ? (
        <div className="rounded-lg bg-gray-50 py-6 text-center text-[11px] text-gray-500">
          {emptyText}
        </div>
      ) : (
        <div className="max-h-[400px] space-y-2 overflow-y-auto">
          {items.slice(0, 10).map((t) => (
            <div
              key={t.orderId}
              className="rounded-lg border border-gray-100 p-3"
            >
              <div className="font-mono text-xs font-black">
                {t.orderNumber}
              </div>
              <div className="mt-1 flex items-center gap-1 text-[10px] text-gray-500">
                <Store className="h-3 w-3" />
                {t.seller.storeName}
              </div>
              {t.seller.city && (
                <div className="mt-0.5 flex items-center gap-1 text-[10px] text-gray-500">
                  <MapPin className="h-3 w-3" />
                  {t.seller.city}
                </div>
              )}
              <div className="mt-1 text-[10px] text-gray-500">
                {t.itemsCount} منتج
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}