"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  Loader2,
  MapPin,
  Store,
  UserCheck,
  Truck,
  Check,
  X,
  Plus,
  Trash2,
  Users,
  AlertCircle,
} from "lucide-react";

export default function ZoneDetailPage() {
  const params = useParams();
  const zoneId = params.id as string;

  const [zone, setZone] = useState<any>(null);
  const [candidates, setCandidates] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showAddModal, setShowAddModal] = useState<
    "SELLER" | "COLLECTOR" | "DELIVERY" | null
  >(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  async function load() {
    try {
      const res = await fetch(`/api/admin/zones/${zoneId}`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.message || "فشل التحميل");
        return;
      }
      setZone(data.zone);
      setCandidates(data.candidates || {});
    } catch {
      setError("فشل الاتصال");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (zoneId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoneId]);

  async function handleAssign(
    action: "assign" | "unassign",
    targetType: "SELLER" | "COLLECTOR" | "DELIVERY",
    ids: number[]
  ) {
    if (ids.length === 0) return;
    setSubmitting(true);
    setMessage(null);

    try {
      const res = await fetch(`/api/admin/zones/${zoneId}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, targetType, targetIds: ids }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setMessage({ type: "error", text: data.message || "فشل الإجراء" });
        return;
      }

      setMessage({
        type: "success",
        text: action === "assign"
          ? `✅ تم إسناد ${data.affected} عنصر`
          : `✅ تم إلغاء إسناد ${data.affected} عنصر`,
      });
      setShowAddModal(null);
      setSelectedIds(new Set());
      await load();
      setTimeout(() => setMessage(null), 2500);
    } catch {
      setMessage({ type: "error", text: "فشل الاتصال" });
    } finally {
      setSubmitting(false);
    }
  }

  function toggleSelect(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-[#ff5c00]" />
      </div>
    );
  }

  if (error || !zone) {
    return (
      <div className="p-4 pt-16 lg:p-8 lg:pt-8">
        <div className="rounded-xl bg-red-50 p-8 text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-red-500" />
          <h2 className="mt-3 text-lg font-black">{error}</h2>
          <Link
            href="/admin/zones"
            className="mt-6 inline-block rounded-full bg-[#ff5c00] px-6 py-2.5 text-sm font-bold text-white"
          >
            العودة
          </Link>
        </div>
      </div>
    );
  }

  const isCollection = zone.type === "COLLECTION";

  return (
    <div className="p-4 pt-16 lg:p-8 lg:pt-8">
      <Link
        href="/admin/zones"
        className="mb-4 inline-flex items-center gap-1 text-xs font-bold text-gray-500 transition hover:text-[#ff5c00]"
      >
        <ArrowRight className="h-3.5 w-3.5" />
        رجوع للمناطق
      </Link>

      {/* Header */}
      <div
        className={`rounded-2xl p-5 text-white shadow-md ${
          isCollection
            ? "bg-gradient-to-br from-teal-600 to-teal-800"
            : "bg-gradient-to-br from-indigo-600 to-indigo-800"
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold">
                {isCollection ? "🏪 جمع" : "🚚 توصيل"}
              </span>
              <span className="font-mono text-[11px] opacity-90">
                {zone.code}
              </span>
            </div>
            <h1 className="mt-2 text-xl font-black">{zone.name}</h1>
            <div className="mt-1 flex items-center gap-1 text-xs opacity-90">
              <MapPin className="h-3 w-3" />
              {zone.city}
            </div>
            {zone.districts.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {zone.districts.map((d: string, i: number) => (
                  <span
                    key={i}
                    className="rounded-full bg-white/20 px-2 py-0.5 text-[10px]"
                  >
                    {d}
                  </span>
                ))}
              </div>
            )}
          </div>
          {!zone.isActive && (
            <span className="rounded-full bg-red-500 px-3 py-1 text-[10px] font-bold">
              معطّلة
            </span>
          )}
        </div>
      </div>

      {message && (
        <div
          className={`mt-4 rounded-xl px-4 py-3 text-sm font-bold ${
            message.type === "success"
              ? "bg-green-50 text-green-700"
              : "bg-red-50 text-red-700"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Collection: Sellers + Collectors */}
      {isCollection && (
        <>
          {/* Sellers */}
          <div className="mt-4 rounded-2xl bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-black">
                <Store className="h-4 w-4 text-teal-600" />
                التجار ({zone.sellers.length})
              </h2>
              <button
                onClick={() => {
                  setShowAddModal("SELLER");
                  setSelectedIds(new Set());
                }}
                className="flex items-center gap-1 rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-teal-700"
              >
                <Plus className="h-3.5 w-3.5" />
                إضافة
              </button>
            </div>

            {zone.sellers.length === 0 ? (
              <div className="rounded-lg bg-gray-50 py-6 text-center text-xs text-gray-500">
                لا يوجد تجار مُسندون
              </div>
            ) : (
              <div className="space-y-2">
                {zone.sellers.map((s: any) => (
                  <div
                    key={s.id}
                    className="flex items-center gap-3 rounded-lg border border-gray-100 p-2.5"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-100 text-sm font-black text-teal-700">
                      {s.storeName.charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold">{s.storeName}</div>
                      <div className="text-[10px] text-gray-500">
                        {s.user?.name} · {s.city || "—"}
                      </div>
                    </div>
                    <button
                      onClick={() => handleAssign("unassign", "SELLER", [s.id])}
                      disabled={submitting}
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-red-500 hover:bg-red-50 disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Collectors */}
          <div className="mt-4 rounded-2xl bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-black">
                <UserCheck className="h-4 w-4 text-purple-600" />
                الجامعون ({zone.collectors.length})
              </h2>
              <button
                onClick={() => {
                  setShowAddModal("COLLECTOR");
                  setSelectedIds(new Set());
                }}
                className="flex items-center gap-1 rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-purple-700"
              >
                <Plus className="h-3.5 w-3.5" />
                إضافة
              </button>
            </div>

            {zone.collectors.length === 0 ? (
              <div className="rounded-lg bg-gray-50 py-6 text-center text-xs text-gray-500">
                لا يوجد جامعون مُسندون
              </div>
            ) : (
              <div className="space-y-2">
                {zone.collectors.map((c: any) => (
                  <div
                    key={c.id}
                    className="flex items-center gap-3 rounded-lg border border-gray-100 p-2.5"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-purple-100 text-sm font-black text-purple-700">
                      {c.name.charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold">{c.name}</div>
                      <div className="text-[10px] text-gray-500" dir="ltr">
                        {c.phone || c.email}
                      </div>
                    </div>
                    <button
                      onClick={() =>
                        handleAssign("unassign", "COLLECTOR", [c.id])
                      }
                      disabled={submitting}
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-red-500 hover:bg-red-50 disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Delivery: Drivers */}
      {!isCollection && (
        <div className="mt-4 rounded-2xl bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-black">
              <Truck className="h-4 w-4 text-indigo-600" />
              السائقون ({zone.deliveryPersons.length})
            </h2>
            <button
              onClick={() => {
                setShowAddModal("DELIVERY");
                setSelectedIds(new Set());
              }}
              className="flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-700"
            >
              <Plus className="h-3.5 w-3.5" />
              إضافة
            </button>
          </div>

          {zone.deliveryPersons.length === 0 ? (
            <div className="rounded-lg bg-gray-50 py-6 text-center text-xs text-gray-500">
              لا يوجد سائقون مُسندون
            </div>
          ) : (
            <div className="space-y-2">
              {zone.deliveryPersons.map((d: any) => (
                <div
                  key={d.id}
                  className="flex items-center gap-3 rounded-lg border border-gray-100 p-2.5"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-100 text-sm font-black text-indigo-700">
                    {d.user.name.charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold">{d.user.name}</div>
                    <div className="text-[10px] text-gray-500">
                      📍 {d.city} · {d.user.phone || "—"}
                    </div>
                  </div>
                  <button
                    onClick={() =>
                      handleAssign("unassign", "DELIVERY", [d.id])
                    }
                    disabled={submitting}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-red-500 hover:bg-red-50 disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-black">
                {showAddModal === "SELLER"
                  ? "إضافة تجار"
                  : showAddModal === "COLLECTOR"
                    ? "إضافة جامعين"
                    : "إضافة سائقين"}
              </h3>
              <button
                onClick={() => setShowAddModal(null)}
                className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-gray-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <AddCandidatesList
              type={showAddModal}
              candidates={candidates}
              selectedIds={selectedIds}
              onToggle={toggleSelect}
            />

            <div className="mt-4 flex gap-2">
              <button
                onClick={() =>
                  handleAssign("assign", showAddModal, Array.from(selectedIds))
                }
                disabled={submitting || selectedIds.size === 0}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#ff5c00] py-2.5 text-sm font-bold text-white transition hover:bg-[#e64a00] disabled:opacity-50"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                إسناد ({selectedIds.size})
              </button>
              <button
                onClick={() => setShowAddModal(null)}
                disabled={submitting}
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

function AddCandidatesList({
  type,
  candidates,
  selectedIds,
  onToggle,
}: {
  type: "SELLER" | "COLLECTOR" | "DELIVERY";
  candidates: any;
  selectedIds: Set<number>;
  onToggle: (id: number) => void;
}) {
  let list: any[] = [];
  if (type === "SELLER") list = candidates.sellers || [];
  else if (type === "COLLECTOR") list = candidates.collectors || [];
  else list = candidates.drivers || [];

  if (list.length === 0) {
    return (
      <div className="rounded-lg bg-amber-50 p-4 text-center text-xs text-amber-800">
        لا يوجد مرشحون متاحون
      </div>
    );
  }

  return (
    <div className="max-h-72 space-y-2 overflow-y-auto">
      {list.map((item) => {
        const selected = selectedIds.has(item.id);
        const label =
          type === "SELLER"
            ? item.storeName
            : type === "COLLECTOR"
              ? item.name
              : item.user?.name || "—";
        const sub =
          type === "SELLER"
            ? item.user?.name
            : type === "COLLECTOR"
              ? item.email
              : item.user?.email;

        return (
          <button
            key={item.id}
            onClick={() => onToggle(item.id)}
            className={`flex w-full items-center gap-3 rounded-xl border-2 p-3 text-right transition ${
              selected
                ? "border-[#ff5c00] bg-[#fff4ed]"
                : "border-gray-200 bg-white hover:border-gray-300"
            }`}
          >
            <div
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-black ${
                selected
                  ? "bg-[#ff5c00] text-white"
                  : "bg-gray-100 text-gray-600"
              }`}
            >
              {label.charAt(0)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold">{label}</div>
              {sub && (
                <div className="truncate text-[10px] text-gray-500">
                  {sub}
                </div>
              )}
            </div>
            {selected && <Check className="h-4 w-4 text-[#ff5c00]" />}
          </button>
        );
      })}
    </div>
  );
}