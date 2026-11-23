"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Loader2,
  Plus,
  Edit3,
  Trash2,
  X,
  ArrowUp,
  ArrowDown,
  Eye,
  EyeOff,
  ImagePlus,
} from "lucide-react";
import ImageUploader from "@/components/admin/ImageUploader";

type Banner = {
  id: number;
  title: string | null;
  subtitle: string | null;
  buttonText: string | null;
  linkUrl: string | null;
  imageUrl: string;
  mobileImageUrl: string | null;
  order: number;
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
};

type FormState = {
  title: string;
  subtitle: string;
  buttonText: string;
  linkUrl: string;
  image: string[];
  mobileImage: string[];
  isActive: boolean;
  startsAt: string;
  endsAt: string;
};

const EMPTY: FormState = {
  title: "",
  subtitle: "",
  buttonText: "",
  linkUrl: "",
  image: [],
  mobileImage: [],
  isActive: true,
  startsAt: "",
  endsAt: "",
};

function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function statusOf(b: Banner) {
  if (!b.isActive) return { text: "متوقف", cls: "bg-gray-100 text-gray-500" };
  const now = Date.now();
  if (b.startsAt && Date.parse(b.startsAt) > now) return { text: "مجدول", cls: "bg-blue-100 text-blue-700" };
  if (b.endsAt && Date.parse(b.endsAt) < now) return { text: "منتهي", cls: "bg-red-100 text-red-600" };
  return { text: "ظاهر الآن", cls: "bg-green-100 text-green-700" };
}

export default function AdminBannersPage() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/banners");
      const data = await res.json();
      if (data.success) setBanners(data.banners);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY);
    setError("");
    setShowForm(true);
  }

  function openEdit(b: Banner) {
    setEditingId(b.id);
    setForm({
      title: b.title || "",
      subtitle: b.subtitle || "",
      buttonText: b.buttonText || "",
      linkUrl: b.linkUrl || "",
      image: [b.imageUrl],
      mobileImage: b.mobileImageUrl ? [b.mobileImageUrl] : [],
      isActive: b.isActive,
      startsAt: toLocalInput(b.startsAt),
      endsAt: toLocalInput(b.endsAt),
    });
    setError("");
    setShowForm(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (form.image.length === 0) {
      setError("صورة البانر مطلوبة");
      return;
    }
    setSaving(true);
    try {
      const body = {
        title: form.title.trim() || null,
        subtitle: form.subtitle.trim() || null,
        buttonText: form.buttonText.trim() || null,
        linkUrl: form.linkUrl.trim() || null,
        imageUrl: form.image[0],
        mobileImageUrl: form.mobileImage[0] || null,
        isActive: form.isActive,
        startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null,
        endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
      };
      const res = await fetch(
        editingId ? `/api/admin/banners/${editingId}` : "/api/admin/banners",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.message || "فشل الحفظ");
        return;
      }
      setShowForm(false);
      await load();
    } catch {
      setError("فشل الاتصال");
    } finally {
      setSaving(false);
    }
  }

  async function patch(id: number, payload: Record<string, unknown>) {
    const res = await fetch(`/api/admin/banners/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return res.ok;
  }

  async function toggle(b: Banner) {
    setBusy(true);
    await patch(b.id, { isActive: !b.isActive });
    await load();
    setBusy(false);
  }

  async function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= banners.length) return;
    const list = [...banners];
    [list[i], list[j]] = [list[j], list[i]];
    setBusy(true);
    await Promise.all(
      list.map((b, idx) => (b.order !== idx ? patch(b.id, { order: idx }) : Promise.resolve(true)))
    );
    await load();
    setBusy(false);
  }

  async function remove(b: Banner) {
    if (!window.confirm("حذف هذا البانر نهائياً؟")) return;
    setBusy(true);
    await fetch(`/api/admin/banners/${b.id}`, { method: "DELETE" });
    await load();
    setBusy(false);
  }

  const inputCls =
    "w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-[#ff5c00] focus:bg-white";

  return (
    <div className="p-4 pt-16 lg:p-8 lg:pt-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-gray-900">البانرات</h1>
          <p className="mt-1 text-sm text-gray-500">
            البانرات المتحركة في أعلى الصفحة الرئيسية. المقاس المناسب: 1600×500 (وللجوال 1000×560 اختياري).
          </p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-lg bg-[#ff5c00] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-[#e64a00]"
        >
          <Plus className="h-4 w-4" />
          بانر جديد
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-[#ff5c00]" />
        </div>
      ) : banners.length === 0 ? (
        <div className="rounded-xl bg-white p-10 text-center shadow-sm">
          <ImagePlus className="mx-auto h-12 w-12 text-gray-300" />
          <h3 className="mt-4 text-lg font-black">لا توجد بانرات</h3>
          <p className="mt-1 text-xs text-gray-500">يظهر الآن التصميم الافتراضي في الصفحة الرئيسية.</p>
          <button
            onClick={openCreate}
            className="mt-5 rounded-full bg-[#ff5c00] px-6 py-2.5 text-sm font-bold text-white transition hover:bg-[#e64a00]"
          >
            إضافة أول بانر
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {banners.map((b, i) => {
            const st = statusOf(b);
            return (
              <div key={b.id} className="overflow-hidden rounded-xl bg-white shadow-sm">
                <div className="aspect-[16/5] w-full bg-gray-100">
                  <img
                    src={b.imageUrl}
                    alt={b.title || "بانر"}
                    style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                  />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 p-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-black text-gray-900">
                      {b.title || "(بدون عنوان)"}
                    </div>
                    <div className="mt-0.5 truncate text-[11px] text-gray-500">
                      {b.linkUrl || "بدون رابط"}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${st.cls}`}>
                      {st.text}
                    </span>
                    <button
                      disabled={busy || i === 0}
                      onClick={() => move(i, -1)}
                      aria-label="أعلى"
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-600 transition hover:bg-gray-100 disabled:opacity-30"
                    >
                      <ArrowUp className="h-4 w-4" />
                    </button>
                    <button
                      disabled={busy || i === banners.length - 1}
                      onClick={() => move(i, 1)}
                      aria-label="أسفل"
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-600 transition hover:bg-gray-100 disabled:opacity-30"
                    >
                      <ArrowDown className="h-4 w-4" />
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => toggle(b)}
                      aria-label={b.isActive ? "إيقاف" : "تفعيل"}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-600 transition hover:bg-gray-100 disabled:opacity-50"
                    >
                      {b.isActive ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => openEdit(b)}
                      aria-label="تعديل"
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-blue-600 transition hover:bg-blue-50 disabled:opacity-50"
                    >
                      <Edit3 className="h-4 w-4" />
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => remove(b)}
                      aria-label="حذف"
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-red-500 transition hover:bg-red-50 disabled:opacity-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-black">{editingId ? "تعديل البانر" : "بانر جديد"}</h3>
              <button
                onClick={() => setShowForm(false)}
                disabled={saving}
                className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={save} className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-bold text-gray-700">
                  صورة البانر <span className="text-red-500">*</span>
                </label>
                <ImageUploader
                  value={form.image}
                  onChange={(urls) => setForm({ ...form, image: urls })}
                  maxImages={1}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-gray-700">
                  صورة للجوال (اختيارية)
                </label>
                <ImageUploader
                  value={form.mobileImage}
                  onChange={(urls) => setForm({ ...form, mobileImage: urls })}
                  maxImages={1}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-gray-700">العنوان (اختياري)</label>
                <input
                  className={inputCls}
                  value={form.title}
                  maxLength={120}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-gray-700">النص الفرعي (اختياري)</label>
                <input
                  className={inputCls}
                  value={form.subtitle}
                  maxLength={250}
                  onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-xs font-bold text-gray-700">نص الزر</label>
                  <input
                    className={inputCls}
                    value={form.buttonText}
                    maxLength={40}
                    placeholder="تسوّق الآن"
                    onChange={(e) => setForm({ ...form, buttonText: e.target.value })}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-gray-700">الرابط</label>
                  <input
                    className={inputCls}
                    dir="ltr"
                    value={form.linkUrl}
                    placeholder="/category/shoes"
                    onChange={(e) => setForm({ ...form, linkUrl: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-xs font-bold text-gray-700">يبدأ في</label>
                  <input
                    type="datetime-local"
                    className={inputCls}
                    value={form.startsAt}
                    onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-gray-700">ينتهي في</label>
                  <input
                    type="datetime-local"
                    className={inputCls}
                    value={form.endsAt}
                    onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
                  />
                </div>
              </div>
              <p className="text-[10px] text-gray-400">اترك التاريخين فارغين ليظهر البانر دائماً.</p>

              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300 text-[#ff5c00] focus:ring-[#ff5c00]"
                />
                <span className="text-sm font-bold">مفعّل</span>
              </label>

              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {error}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#ff5c00] py-2.5 text-sm font-bold text-white transition hover:bg-[#e64a00] disabled:opacity-50"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "حفظ"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
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
    </div>
  );
}