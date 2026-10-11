"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Loader2,
  QrCode,
  Package,
  Store,
  MapPin,
  UserPlus,
  X,
  Check,
  AlertCircle,
  Filter,
  Search,
  Undo2,
  CheckSquare,
  Square,
  Truck,
} from "lucide-react";

type Task = {
  orderId: number;
  orderNumber: string;
  seller: {
    id: number;
    storeName: string;
    city: string | null;
    region: string | null;
  };
  pickupCity: string | null;
  deliveryCity: string | null;
  deliveryDistrict: string | null;
  itemsCount: number;
  status: string;
  readyAt: string | null;
  assignedCollectorId: number | null;
  assignedCollectorName: string | null;
  assignedCollectorPhone: string | null;
  assignedAt: string | null;
};

type Collector = {
  id: number;
  name: string;
  phone: string | null;
  email: string;
  activeCount: number;
};

type StatusFilter = "ALL" | "UNASSIGNED" | "ASSIGNED";
type SortBy = "DATE_ASC" | "DATE_DESC" | "CITY" | "SELLER";

export default function WarehouseDashboard() {
  const [ready, setReady] = useState<Task[]>([]);
  const [incoming, setIncoming] = useState<Task[]>([]);
  const [received, setReceived] = useState<Task[]>([]);
  const [verified, setVerified] = useState<Task[]>([]);
  const [collectors, setCollectors] = useState<Collector[]>([]);
  const [loading, setLoading] = useState(true);

  // ═══ Filters ═══
  const [searchQuery, setSearchQuery] = useState("");
  const [cityFilter, setCityFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [sortBy, setSortBy] = useState<SortBy>("DATE_ASC");
  const [showFilters, setShowFilters] = useState(false);

  // ═══ Selection ═══
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<number>>(
    new Set()
  );

  // ═══ Modals ═══
  const [assignModal, setAssignModal] = useState<{
    orderIds: number[];
    context: "single" | "bulk";
    currentCollectorName?: string;
  } | null>(null);
  const [selectedCollector, setSelectedCollector] = useState<number | null>(
    null
  );
  const [assigning, setAssigning] = useState(false);

  const [unassignModal, setUnassignModal] = useState<Task | null>(null);
  const [unassigning, setUnassigning] = useState(false);

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

  // ═══ Cleanup selection on filter change ═══
  useEffect(() => {
    setSelectedOrderIds(new Set());
  }, [cityFilter, statusFilter, searchQuery]);

  // ═══ Available cities (from pickup + delivery) ═══
  const availableCities = useMemo(() => {
    const set = new Set<string>();
    ready.forEach((t) => {
      if (t.pickupCity) set.add(t.pickupCity);
      if (t.deliveryCity) set.add(t.deliveryCity);
    });
    return Array.from(set).sort();
  }, [ready]);

  // ═══ Filtered + Sorted ready list ═══
  const filteredReady = useMemo(() => {
    let list = [...ready];

    if (statusFilter === "UNASSIGNED") {
      list = list.filter((t) => t.assignedCollectorId === null);
    } else if (statusFilter === "ASSIGNED") {
      list = list.filter((t) => t.assignedCollectorId !== null);
    }

    if (cityFilter !== "ALL") {
      list = list.filter(
        (t) =>
          t.pickupCity === cityFilter || t.deliveryCity === cityFilter
      );
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (t) =>
          t.orderNumber.toLowerCase().includes(q) ||
          t.seller.storeName.toLowerCase().includes(q)
      );
    }

    switch (sortBy) {
      case "DATE_ASC":
        list.sort(
          (a, b) =>
            new Date(a.readyAt || 0).getTime() -
            new Date(b.readyAt || 0).getTime()
        );
        break;
      case "DATE_DESC":
        list.sort(
          (a, b) =>
            new Date(b.readyAt || 0).getTime() -
            new Date(a.readyAt || 0).getTime()
        );
        break;
      case "CITY":
        list.sort((a, b) =>
          (a.pickupCity || "").localeCompare(b.pickupCity || "")
        );
        break;
      case "SELLER":
        list.sort((a, b) =>
          a.seller.storeName.localeCompare(b.seller.storeName)
        );
        break;
    }

    return list;
  }, [ready, statusFilter, cityFilter, searchQuery, sortBy]);

  // ═══ Selection handlers ═══
  function toggleSelect(orderId: number) {
    setSelectedOrderIds((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });
  }

  function selectAll() {
    setSelectedOrderIds(
      new Set(filteredReady.map((t) => t.orderId))
    );
  }

  function clearSelection() {
    setSelectedOrderIds(new Set());
  }

  // ═══ Assign ═══
  async function handleAssign() {
    if (!assignModal || !selectedCollector) return;
    setAssigning(true);

    try {
      if (assignModal.context === "single") {
        const res = await fetch(
          `/api/warehouse/orders/${assignModal.orderIds[0]}/assign-collector`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ collectorId: selectedCollector }),
          }
        );
        const data = await res.json();

        if (!res.ok || !data.success) {
          setMessage({ type: "error", text: data.message || "فشل الإسناد" });
          return;
        }
        setMessage({
          type: "success",
          text: `✅ تم إسناد الطلب إلى ${data.collectorName}`,
        });
      } else {
        const res = await fetch(
          "/api/warehouse/orders/bulk-assign",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              orderIds: assignModal.orderIds,
              collectorId: selectedCollector,
            }),
          }
        );
        const data = await res.json();

        if (!res.ok || !data.success) {
          setMessage({ type: "error", text: data.message || "فشل الإسناد" });
          return;
        }
        setMessage({
          type: "success",
          text: `✅ تم إسناد ${data.assignedCount} طرد إلى ${data.collectorName}`,
        });
      }

      setAssignModal(null);
      setSelectedCollector(null);
      setSelectedOrderIds(new Set());
      await load();
      setTimeout(() => setMessage(null), 3000);
    } catch {
      setMessage({ type: "error", text: "فشل الاتصال" });
    } finally {
      setAssigning(false);
    }
  }

  // ═══ Unassign ═══
  async function handleUnassign() {
    if (!unassignModal) return;
    setUnassigning(true);

    try {
      const res = await fetch(
        `/api/warehouse/orders/${unassignModal.orderId}/unassign-collector`,
        { method: "POST" }
      );
      const data = await res.json();

      if (!res.ok || !data.success) {
        setMessage({ type: "error", text: data.message || "فشل التراجع" });
        return;
      }

      setMessage({
        type: "success",
        text: `✅ تم إلغاء إسناد الطلب ${data.orderNumber}`,
      });
      setUnassignModal(null);
      await load();
      setTimeout(() => setMessage(null), 3000);
    } catch {
      setMessage({ type: "error", text: "فشل الاتصال" });
    } finally {
      setUnassigning(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-teal-600" />
      </div>
    );
  }

  const unassignedCount = ready.filter(
    (t) => t.assignedCollectorId === null
  ).length;
  const assignedCount = ready.filter(
    (t) => t.assignedCollectorId !== null
  ).length;

  return (
    <div className="p-4 pt-16 lg:p-8 lg:pt-8">
      {/* ═══ Header ═══ */}
      <div className="mb-6">
        <h1 className="text-2xl font-black text-gray-900">لوحة المستودع</h1>
        <p className="mt-1 text-sm text-gray-500">
          {unassignedCount} غير مُسند · {assignedCount} مُسند ·{" "}
          {incoming.length} في الطريق · {received.length} بانتظار الفحص ·{" "}
          {verified.length} جاهز للشحن
        </p>
      </div>

      {/* ═══ Quick actions ═══ */}
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

      {/* ═══════════════════════════════════════════ */}
      {/* جاهز للجمع — القسم الرئيسي */}
      {/* ═══════════════════════════════════════════ */}
      <div className="mb-6 rounded-2xl border-2 border-amber-200 bg-amber-50 p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-amber-700" />
            <h2 className="text-base font-black text-amber-900">
              ⚡ طلبات جاهزة للجمع ({filteredReady.length})
            </h2>
          </div>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition ${
              showFilters
                ? "bg-amber-700 text-white"
                : "bg-white text-amber-700 hover:bg-amber-100"
            }`}
          >
            <Filter className="h-3.5 w-3.5" />
            فرز
          </button>
        </div>

        {/* ═══ Filters Panel ═══ */}
        {showFilters && (
          <div className="mb-4 space-y-3 rounded-xl border border-amber-200 bg-white p-3">
            {/* Search */}
            <div className="relative">
              <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث برقم الطلب أو اسم التاجر..."
                className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pr-10 pl-3 text-xs outline-none focus:border-amber-500 focus:bg-white"
              />
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {/* City filter */}
              <select
                value={cityFilter}
                onChange={(e) => setCityFilter(e.target.value)}
                className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-bold outline-none focus:border-amber-500"
              >
                <option value="ALL">🌍 كل المدن</option>
                {availableCities.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>

              {/* Status filter */}
              <select
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value as StatusFilter)
                }
                className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-bold outline-none focus:border-amber-500"
              >
                <option value="ALL">📋 الكل</option>
                <option value="UNASSIGNED">🔴 غير مُسند</option>
                <option value="ASSIGNED">🟢 مُسند</option>
              </select>

              {/* Sort */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortBy)}
                className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-bold outline-none focus:border-amber-500"
              >
                <option value="DATE_ASC">⏰ الأقدم أولًا</option>
                <option value="DATE_DESC">⏰ الأحدث أولًا</option>
                <option value="CITY">🏙️ حسب المدينة</option>
                <option value="SELLER">🏪 حسب التاجر</option>
              </select>
            </div>
          </div>
        )}

        {/* ═══ Bulk actions ═══ */}
        {selectedOrderIds.size > 0 && (
          <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border-2 border-teal-300 bg-teal-50 p-3">
            <div className="text-xs font-black text-teal-900">
              ✓ {selectedOrderIds.size} مُحدد
            </div>
            <button
              onClick={() =>
                setAssignModal({
                  orderIds: Array.from(selectedOrderIds),
                  context: "bulk",
                })
              }
              className="flex items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-2 text-xs font-bold text-white hover:bg-teal-700"
            >
              <UserPlus className="h-3.5 w-3.5" />
              إسناد جماعي
            </button>
            <button
              onClick={clearSelection}
              className="rounded-lg border border-teal-300 bg-white px-3 py-2 text-xs font-bold text-teal-700 hover:bg-teal-50"
            >
              إلغاء التحديد
            </button>
          </div>
        )}

        {/* ═══ Select all row ═══ */}
        {filteredReady.length > 0 && (
          <div className="mb-2 flex items-center gap-2 px-1">
            <button
              onClick={
                selectedOrderIds.size === filteredReady.length
                  ? clearSelection
                  : selectAll
              }
              className="flex items-center gap-1.5 text-[11px] font-bold text-amber-900 hover:text-amber-700"
            >
              {selectedOrderIds.size === filteredReady.length ? (
                <CheckSquare className="h-3.5 w-3.5" />
              ) : (
                <Square className="h-3.5 w-3.5" />
              )}
              تحديد الكل
            </button>
          </div>
        )}

        {/* ═══ Ready list ═══ */}
        {filteredReady.length === 0 ? (
          <div className="rounded-xl bg-white py-8 text-center text-xs text-gray-500">
            {ready.length === 0
              ? "لا توجد طلبات جاهزة للجمع حاليًا"
              : "لا نتائج مطابقة للفرز"}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredReady.map((t) => {
              const isSelected = selectedOrderIds.has(t.orderId);
              const isAssigned = t.assignedCollectorId !== null;

              return (
                <div
                  key={t.orderId}
                  className={`flex flex-wrap items-start gap-3 rounded-xl border-2 bg-white p-3 shadow-sm transition ${
                    isSelected
                      ? "border-teal-500"
                      : isAssigned
                        ? "border-green-200"
                        : "border-gray-100"
                  }`}
                >
                  {/* Checkbox */}
                  <button
                    onClick={() => toggleSelect(t.orderId)}
                    className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center"
                  >
                    {isSelected ? (
                      <CheckSquare className="h-5 w-5 text-teal-600" />
                    ) : (
                      <Square className="h-5 w-5 text-gray-400" />
                    )}
                  </button>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-black">
                        {t.orderNumber}
                      </span>
                      {isAssigned ? (
                        <span className="rounded-full bg-green-100 px-2 py-0.5 text-[9px] font-bold text-green-700">
                          🟢 مُسند
                        </span>
                      ) : (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-[9px] font-bold text-red-700">
                          🔴 غير مُسند
                        </span>
                      )}
                    </div>

                    <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-gray-500">
                      <span className="flex items-center gap-1">
                        <Store className="h-3 w-3" />
                        {t.seller.storeName}
                      </span>
                      {t.pickupCity && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          استلام: {t.pickupCity}
                        </span>
                      )}
                      {t.deliveryCity && t.deliveryCity !== t.pickupCity && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          توصيل: {t.deliveryCity}
                        </span>
                      )}
                      <span>{t.itemsCount} منتج</span>
                    </div>

                    {isAssigned && t.assignedCollectorName && (
                      <div className="mt-1 flex items-center gap-1 text-[11px] font-bold text-green-700">
                        <UserPlus className="h-3 w-3" />
                        {t.assignedCollectorName}
                        {t.assignedCollectorPhone && (
                          <span dir="ltr" className="text-gray-500">
                            · {t.assignedCollectorPhone}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex shrink-0 gap-1.5">
                    {!isAssigned ? (
                      <button
                        onClick={() =>
                          setAssignModal({
                            orderIds: [t.orderId],
                            context: "single",
                          })
                        }
                        className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-amber-700"
                      >
                        <UserPlus className="h-3.5 w-3.5" />
                        إسناد
                      </button>
                    ) : (
                      <button
                        onClick={() => setUnassignModal(t)}
                        className="flex items-center gap-1.5 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs font-bold text-red-700 transition hover:bg-red-100"
                      >
                        <Undo2 className="h-3.5 w-3.5" />
                        تراجع
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════ */}
      {/* أعمدة أخرى */}
      {/* ═══════════════════════════════════════════ */}
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

      {/* ═══════════════════════════════════════════ */}
      {/* Modal: إسناد */}
      {/* ═══════════════════════════════════════════ */}
      {assignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-black">
                {assignModal.context === "bulk"
                  ? `إسناد ${assignModal.orderIds.length} طرد`
                  : "إسناد جامع"}
              </h3>
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

            <div className="mb-4">
              <div className="mb-2 text-xs font-bold text-gray-700">
                اختر جامعًا
              </div>
              {collectors.length === 0 ? (
                <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
                  ⚠️ لا يوجد جامعون. أنشئ جامعًا من{" "}
                  <span className="font-bold">/admin/users/new</span>
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

      {/* ═══════════════════════════════════════════ */}
      {/* Modal: تراجع */}
      {/* ═══════════════════════════════════════════ */}
      {unassignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
              <Undo2 className="h-7 w-7 text-red-600" />
            </div>
            <h3 className="mt-4 text-lg font-black">تأكيد التراجع</h3>
            <p className="mt-2 text-sm text-gray-600">
              سيتم إلغاء إسناد الطلب{" "}
              <strong className="font-mono">{unassignModal.orderNumber}</strong>{" "}
              من{" "}
              <strong>{unassignModal.assignedCollectorName}</strong>.
            </p>
            <p className="mt-2 text-[11px] text-gray-500">
              يمكن التراجع فقط قبل أن يستلم الجامع الطرد.
            </p>

            <div className="mt-6 flex gap-2">
              <button
                onClick={handleUnassign}
                disabled={unassigning}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-600 py-2.5 text-sm font-bold text-white transition hover:bg-red-700 disabled:opacity-50"
              >
                {unassigning ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Undo2 className="h-4 w-4" />
                )}
                تأكيد التراجع
              </button>
              <button
                onClick={() => setUnassignModal(null)}
                disabled={unassigning}
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
              {t.pickupCity && (
                <div className="mt-0.5 flex items-center gap-1 text-[10px] text-gray-500">
                  <MapPin className="h-3 w-3" />
                  {t.pickupCity}
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