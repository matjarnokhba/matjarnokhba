"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Loader2,
  Plus,
  Edit3,
  Trash2,
  X,
  Copy,
  Flame,
  Package,
  Clock,
  Search,
  ArrowUp,
  ArrowDown,
} from "lucide-react";

type Sale = {
  id: number;
  title: string;
  subtitle: string | null;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
  showCountdown: boolean;
  showProgress: boolean;
  items: { id: number; productId: number; order: number }[];
};

type Prod = { id: number; name: string; price: number; oldPrice?: number; images: string[] };

type FormState = {
  title: string;
  subtitle: string;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
  showCountdown: boolean;
};

function toLocalInput(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function fmt(iso: string) {
  return new Date(iso).toLocaleString("ar-MA", { dateStyle: "medium", timeStyle: "short" });
}

function statusOf(s: Sale) {
  const now = Date.now();
  if (!s.isActive) return { text: "متوقفة", cls: "bg-gray-100 text-gray-500" };
  if (Date.parse(s.startsAt) > now) return { text: "مجدولة", cls: "bg-blue-100 text-blue-700" };
  if (Date.parse(s.endsAt) < now) return { text: "منتهية", cls: "bg-red-100 text-red-600" };
  return { text: "جارية الآن", cls: "bg-green-100 text-green-700" };
}

async function call(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  let data: any = {};
  try {
    data = await res.json();
  } catch {}
  return { ok: res.ok && data.success !== false, data };
}

export default function AdminFlashSalesPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [products, setProducts] = useState<Prod[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [form, setForm] = useState<FormState | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [itemsFor, setItemsFor] = useState<Sale | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [q, setQ] = useState("");
  const [itemsError, setItemsError] = useState("");

  const load = useCallback(async () => {
    try {
      const [s, p] = await Promise.all([
        fetch("/api/admin/flash-sales").then((r) => r.json()),
        fetch("/api/products").then((r) => r.json()),
      ]);
      if (s.success) setSales(s.sales);
      if (p.success) setProducts(p.products);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const prodMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  // ───── الحملة ─────
  function openCreate() {
    const now = new Date();
    setEditingId(null);
    setForm({
      title: "عروض محدودة",
      subtitle: "",
      startsAt: toLocalInput(now),
      endsAt: toLocalInput(new Date(now.getTime() + 24 * 3600 * 1000)),
      isActive: true,
      showCountdown: true,
    });
    setError("");
  }

  function openEdit(s: Sale) {
    setEditingId(s.id);
    setForm({
      title: s.title,
      subtitle: s.subtitle || "",
      startsAt: toLocalInput(new Date(s.startsAt)),
      endsAt: toLocalInput(new Date(s.endsAt)),
      isActive: s.isActive,
      showCountdown: s.showCountdown,
    });
    setError("");
  }

  function setDuration(hours: number) {
    if (!form) return;
    const base = form.startsAt ? new Date(form.startsAt) : new Date();
    setForm({ ...form, endsAt: toLocalInput(new Date(base.getTime() + hours * 3600 * 1000)) });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setError("");
    if (!form.title.trim()) return setError("العنوان مطلوب");
    if (!form.startsAt || !form.endsAt) return setError("حدّد وقت البداية والنهاية");
    setSaving(true);
    const r = await call(
      editingId ? `/api/admin/flash-sales/${editingId}` : "/api/admin/flash-sales",
      editingId ? "PATCH" : "POST",
      {
        title: form.title.trim(),
        subtitle: form.subtitle.trim() || null,
        startsAt: new Date(form.startsAt).toISOString(),
        endsAt: new Date(form.endsAt).toISOString(),
        isActive: form.isActive,
        showCountdown: form.showCountdown,
      }
    );
    setSaving(false);
    if (!r.ok) return setError(r.data.message || "فشل الحفظ");
    setForm(null);
    await load();
    // حملة جديدة: افتح مباشرة نافذة إضافة المنتجات
    if (!editingId && r.data.sale) {
      const created: Sale = { ...r.data.sale, items: [] };
      setItemsFor(created);
      setSelected([]);
      setQ("");
      setItemsError("");
    }
  }

  async function act(fn: () => Promise<{ ok: boolean; data: any }>) {
    setBusy(true);
    const r = await fn();
    if (!r.ok) window.alert(r.data.message || "فشلت العملية");
    await load();
    setBusy(false);
  }

  const toggle = (s: Sale) => act(() => call(`/api/admin/flash-sales/${s.id}`, "PATCH", { isActive: !s.isActive }));
  const duplicate = (s: Sale) => act(() => call(`/api/admin/flash-sales/${s.id}/duplicate`, "POST"));
  const endNow = (s: Sale) => {
    if (!window.confirm("إنهاء الحملة الآن؟ سيختفي القسم من الرئيسية فوراً.")) return;
    return act(() => call(`/api/admin/flash-sales/${s.id}/end`, "POST"));
  };
  const remove = (s: Sale) => {
    if (!window.confirm("حذف الحملة ومنتجاتها نهائياً؟")) return;
    return act(() => call(`/api/admin/flash-sales/${s.id}`, "DELETE"));
  };

  // ───── المنتجات ─────
  function openItems(s: Sale) {
    setItemsFor(s);
    setSelected([...s.items].sort((a, b) => a.order - b.order).map((i) => i.productId));
    setQ("");
    setItemsError("");
  }

  function moveSel(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= selected.length) return;
    const arr = [...selected];
    [arr[i], arr[j]] = [arr[j], arr[i]];
    setSelected(arr);
  }

  async function saveItems() {
    if (!itemsFor) return;
    setSaving(true);
    setItemsError("");
    const r = await call(`/api/admin/flash-sales/${itemsFor.id}/items`, "PUT", { productIds: selected });
    setSaving(false);
    if (!r.ok) return setItemsError(r.data.message || "فشل الحفظ");
    setItemsFor(null);
    await load();
  }

  const results = products
    .filter((p) => !selected.includes(p.id) && (!q.trim() || p.name.toLowerCase().includes(q.trim().toLowerCase())))
    .slice(0, 30);

  const inputCls =
    "w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-[#ff5c00] focus:bg-white";

  return (
    <div className="p-4 pt-16 lg:p-8 lg:pt-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-gray-900">العروض المحدودة</h1>
          <p className="mt-1 text-sm text-gray-500">
            حملات تظهر في الرئيسية بعدّاد حقيقي. يظهر قسم واحد فقط: الحملة الجارية التي تنتهي أولاً.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-lg bg-[#ff5c00] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-[#e64a00]"
        >
          <Plus className="h-4 w-4" />
          حملة جديدة
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-[#ff5c00]" />
        </div>
      ) : sales.length === 0 ? (
        <div className="rounded-xl bg-white p-10 text-center shadow-sm">
          <Flame className="mx-auto h-12 w-12 text-gray-300" />
          <h3 className="mt-4 text-lg font-black">لا توجد حملات</h3>
          <p className="mt-1 text-xs text-gray-500">لا يظهر قسم «عروض محدودة» في الرئيسية حتى تنشئ حملة.</p>
          <button
            onClick={openCreate}
            className="mt-5 rounded-full bg-[#ff5c00] px-6 py-2.5 text-sm font-bold text-white transition hover:bg-[#e64a00]"
          >
            إنشاء أول حملة
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {sales.map((s) => {
            const st = statusOf(s);
            return (
              <div key={s.id} className="rounded-xl bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate text-base font-black text-gray-900">{s.title}</h3>
                      <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${st.cls}`}>{st.text}</span>
                    </div>
                    {s.subtitle && <p className="mt-0.5 text-xs text-gray-500">{s.subtitle}</p>}
                    <p className="mt-1.5 text-[11px] text-gray-500">
                      من {fmt(s.startsAt)} — إلى {fmt(s.endsAt)}
                    </p>
                  </div>
                  <label className="flex cursor-pointer items-center gap-1.5 text-xs font-bold">
                    <input
                      type="checkbox"
                      checked={s.isActive}
                      disabled={busy}
                      onChange={() => toggle(s)}
                      className="h-4 w-4 rounded border-gray-300 text-[#ff5c00] focus:ring-[#ff5c00]"
                    />
                    مفعّلة
                  </label>
                </div>

                {s.items.length > 0 && (
                  <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1">
                    {s.items.map((i) => {
                      const p = prodMap.get(i.productId);
                      return (
                        <div key={i.id} className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-gray-100">
                          {p?.images?.[0] && (
                            <img
                              src={p.images[0]}
                              alt={p.name}
                              style={{ width: "100%", height: "100%", objectFit: "cover" }}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3">
                  <button
                    onClick={() => openItems(s)}
                    disabled={busy}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-orange-50 px-3 py-2 text-xs font-bold text-[#ff5c00] transition hover:bg-orange-100 disabled:opacity-50"
                  >
                    <Package className="h-3.5 w-3.5" />
                    المنتجات ({s.items.length})
                  </button>
                  <button
                    onClick={() => openEdit(s)}
                    disabled={busy}
                    className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold text-blue-600 transition hover:bg-blue-50 disabled:opacity-50"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                    تعديل
                  </button>
                  <button
                    onClick={() => duplicate(s)}
                    disabled={busy}
                    className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold text-gray-600 transition hover:bg-gray-100 disabled:opacity-50"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    نسخ
                  </button>
                  <button
                    onClick={() => endNow(s)}
                    disabled={busy}
                    className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold text-amber-600 transition hover:bg-amber-50 disabled:opacity-50"
                  >
                    <Clock className="h-3.5 w-3.5" />
                    إنهاء الآن
                  </button>
                  <button
                    onClick={() => remove(s)}
                    disabled={busy}
                    className="mr-auto inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold text-red-500 transition hover:bg-red-50 disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    حذف
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ═══ نموذج الحملة ═══ */}
      {form && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-black">{editingId ? "تعديل الحملة" : "حملة جديدة"}</h3>
              <button
                onClick={() => setForm(null)}
                disabled={saving}
                className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={save} className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-bold text-gray-700">
                  العنوان <span className="text-red-500">*</span>
                </label>
                <input
                  className={inputCls}
                  value={form.title}
                  maxLength={80}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-gray-700">نص فرعي (اختياري)</label>
                <input
                  className={inputCls}
                  value={form.subtitle}
                  maxLength={200}
                  placeholder="مثال: خصومات نهاية الأسبوع"
                  onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-xs font-bold text-gray-700">تبدأ في</label>
                  <input
                    type="datetime-local"
                    className={inputCls}
                    value={form.startsAt}
                    onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-gray-700">تنتهي في</label>
                  <input
                    type="datetime-local"
                    className={inputCls}
                    value={form.endsAt}
                    onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {[
                  ["6 ساعات", 6],
                  ["24 ساعة", 24],
                  ["3 أيام", 72],
                  ["7 أيام", 168],
                ].map(([label, h]) => (
                  <button
                    key={String(label)}
                    type="button"
                    onClick={() => setDuration(Number(h))}
                    className="rounded-full border border-gray-200 px-3 py-1 text-[11px] font-bold text-gray-600 transition hover:border-[#ff5c00] hover:text-[#ff5c00]"
                  >
                    {label}
                  </button>
                ))}
              </div>
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.showCountdown}
                  onChange={(e) => setForm({ ...form, showCountdown: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300 text-[#ff5c00] focus:ring-[#ff5c00]"
                />
                <span className="text-sm font-bold">إظهار العدّاد التنازلي</span>
              </label>
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300 text-[#ff5c00] focus:ring-[#ff5c00]"
                />
                <span className="text-sm font-bold">مفعّلة</span>
              </label>
              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>
              )}
              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#ff5c00] py-2.5 text-sm font-bold text-white transition hover:bg-[#e64a00] disabled:opacity-50"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editingId ? "حفظ" : "حفظ وإضافة المنتجات"}
                </button>
                <button
                  type="button"
                  onClick={() => setForm(null)}
                  disabled={saving}
                  className="rounded-lg border border-gray-200 px-5 py-2.5 text-sm font-bold text-gray-700 transition hover:bg-gray-50"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══ منتجات الحملة ═══ */}
      {itemsFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="flex max-h-[92vh] w-full max-w-lg flex-col rounded-2xl bg-white">
            <div className="flex items-center justify-between border-b border-gray-100 p-4">
              <h3 className="text-base font-black">منتجات: {itemsFor.title}</h3>
              <button
                onClick={() => setItemsFor(null)}
                disabled={saving}
                className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto p-4">
              <div>
                <div className="mb-2 text-xs font-bold text-gray-700">
                  المنتجات المختارة ({selected.length}/24) — بترتيب ظهورها
                </div>
                {selected.length === 0 ? (
                  <p className="rounded-lg bg-gray-50 p-3 text-center text-xs text-gray-500">لم تختر أي منتج بعد.</p>
                ) : (
                  <div className="space-y-1.5">
                    {selected.map((id, i) => {
                      const p = prodMap.get(id);
                      return (
                        <div key={id} className="flex items-center gap-2 rounded-lg border border-gray-100 p-1.5">
                          <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md bg-gray-100">
                            {p?.images?.[0] && (
                              <img
                                src={p.images[0]}
                                alt=""
                                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                              />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-xs font-bold">{p?.name || `منتج #${id} (غير ظاهر في المتجر)`}</div>
                            {p && <div className="text-[10px] text-gray-500">{p.price} د.م</div>}
                          </div>
                          <button
                            type="button"
                            disabled={i === 0}
                            onClick={() => moveSel(i, -1)}
                            className="flex h-7 w-7 items-center justify-center rounded text-gray-500 hover:bg-gray-100 disabled:opacity-30"
                          >
                            <ArrowUp className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={i === selected.length - 1}
                            onClick={() => moveSel(i, 1)}
                            className="flex h-7 w-7 items-center justify-center rounded text-gray-500 hover:bg-gray-100 disabled:opacity-30"
                          >
                            <ArrowDown className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setSelected(selected.filter((x) => x !== id))}
                            className="flex h-7 w-7 items-center justify-center rounded text-red-500 hover:bg-red-50"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div>
                <div className="relative mb-2">
                  <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    className={inputCls + " pr-9"}
                    placeholder="ابحث عن منتج لإضافته..."
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  {results.length === 0 ? (
                    <p className="p-3 text-center text-xs text-gray-500">لا نتائج.</p>
                  ) : (
                    results.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        disabled={selected.length >= 24}
                        onClick={() => setSelected([...selected, p.id])}
                        className="flex w-full items-center gap-2 rounded-lg border border-gray-100 p-1.5 text-right transition hover:border-[#ff5c00]/40 hover:bg-orange-50/40 disabled:opacity-50"
                      >
                        <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md bg-gray-100">
                          {p.images?.[0] && (
                            <img
                              src={p.images[0]}
                              alt=""
                              style={{ width: "100%", height: "100%", objectFit: "cover" }}
                            />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-xs font-bold">{p.name}</div>
                          <div className="text-[10px] text-gray-500">
                            {p.price} د.م{p.oldPrice ? ` (قبل: ${p.oldPrice})` : ""}
                          </div>
                        </div>
                        <Plus className="h-4 w-4 shrink-0 text-[#ff5c00]" />
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="border-t border-gray-100 p-4">
              {itemsError && (
                <div className="mb-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {itemsError}
                </div>
              )}
              <div className="flex gap-2">
                <button
                  onClick={saveItems}
                  disabled={saving}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#ff5c00] py-2.5 text-sm font-bold text-white transition hover:bg-[#e64a00] disabled:opacity-50"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "حفظ المنتجات"}
                </button>
                <button
                  onClick={() => setItemsFor(null)}
                  disabled={saving}
                  className="rounded-lg border border-gray-200 px-5 py-2.5 text-sm font-bold text-gray-700 transition hover:bg-gray-50"
                >
                  إغلاق
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}