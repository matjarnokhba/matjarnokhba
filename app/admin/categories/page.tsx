"use client";

import { useEffect, useState } from "react";
import {
  Loader2,
  Plus,
  Edit3,
  Trash2,
  Package,
  X,
  FolderTree,
  AlertTriangle,
} from "lucide-react";

type Category = {
  id: number;
  name: string;
  slug: string;
  image: string | null;
  parentId: number | null;
  order: number;
  isActive: boolean;
  _count: { products: number };
};

type FormMode = "create" | "edit";

type FormState = {
  name: string;
  slug: string;
  order: number;
  isActive: boolean;
};

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formMode, setFormMode] = useState<FormMode>("create");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>({
    name: "",
    slug: "",
    order: 0,
    isActive: true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function loadData() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/categories");
      const data = await res.json();
      if (data.success) setCategories(data.categories);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function openCreate() {
    setFormMode("create");
    setEditingId(null);
    setForm({ name: "", slug: "", order: 0, isActive: true });
    setError("");
    setShowForm(true);
  }

  function openEdit(cat: Category) {
    setFormMode("edit");
    setEditingId(cat.id);
    setForm({
      name: cat.name,
      slug: cat.slug,
      order: cat.order,
      isActive: cat.isActive,
    });
    setError("");
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!form.name.trim() || form.name.trim().length < 2) {
      setError("اسم التصنيف يجب أن يكون حرفين على الأقل");
      return;
    }
    if (!form.slug.trim()) {
      setError("الرابط (slug) مطلوب");
      return;
    }

    setSaving(true);
    try {
      const url =
        formMode === "create"
          ? "/api/admin/categories"
          : `/api/admin/categories/${editingId}`;

      const method = formMode === "create" ? "POST" : "PATCH";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          slug: form.slug.trim(),
          order: form.order,
          isActive: form.isActive,
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.message || "فشل الحفظ");
        return;
      }

      setShowForm(false);
      await loadData();
    } catch {
      setError("فشل الاتصال");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/categories/${deleteId}`, {
        method: "DELETE",
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        alert(data.message || "فشل الحذف");
        return;
      }

      setDeleteId(null);
      await loadData();
    } catch {
      alert("فشل الاتصال");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="p-4 pt-16 lg:p-8 lg:pt-8">
      {/* رأس */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-gray-900">التصنيفات</h1>
          <p className="mt-1 text-sm text-gray-500">
            إدارة تصنيفات المنتجات
          </p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-lg bg-[#ff5c00] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-[#e64a00]"
        >
          <Plus className="h-4 w-4" />
          تصنيف جديد
        </button>
      </div>

      {/* القائمة */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-[#ff5c00]" />
        </div>
      ) : categories.length === 0 ? (
        <div className="rounded-xl bg-white p-10 text-center shadow-sm">
          <div className="text-5xl">📁</div>
          <h3 className="mt-4 text-lg font-black">لا توجد تصنيفات</h3>
          <button
            onClick={openCreate}
            className="mt-5 rounded-full bg-[#ff5c00] px-6 py-2.5 text-sm font-bold text-white transition hover:bg-[#e64a00]"
          >
            إنشاء أول تصنيف
          </button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((cat) => (
            <div
              key={cat.id}
              className="rounded-xl bg-white p-4 shadow-sm transition hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100">
                    <FolderTree className="h-5 w-5 text-[#ff5c00]" />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-black text-gray-900">
                      {cat.name}
                    </div>
                    <div className="mt-0.5 truncate font-mono text-[10px] text-gray-500">
                      {cat.slug}
                    </div>
                  </div>
                </div>

                <div className="flex gap-1">
                  <button
                    onClick={() => openEdit(cat)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-blue-600 transition hover:bg-blue-50"
                    aria-label="تعديل"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setDeleteId(cat.id)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-red-500 transition hover:bg-red-50"
                    aria-label="حذف"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3">
                <div className="flex items-center gap-1 text-[11px] text-gray-500">
                  <Package className="h-3 w-3" />
                  {cat._count.products} منتج
                </div>

                <span
                  className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                    cat.isActive
                      ? "bg-green-100 text-green-700"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {cat.isActive ? "مفعّل" : "معطّل"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ═══ Modal النموذج ═══ */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-5">
          <div className="w-full max-w-md rounded-2xl bg-white p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-black">
                {formMode === "create" ? "تصنيف جديد" : "تعديل التصنيف"}
              </h3>
              <button
                onClick={() => setShowForm(false)}
                disabled={saving}
                className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 disabled:opacity-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-bold text-gray-700">
                  الاسم <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="مثال: ملابس رجالية"
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-[#ff5c00] focus:bg-white"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-gray-700">
                  الرابط (slug) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: e.target.value })}
                  placeholder="men-clothing"
                  dir="ltr"
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 font-mono text-xs outline-none focus:border-[#ff5c00] focus:bg-white"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-gray-700">
                  الترتيب
                </label>
                <input
                  type="number"
                  value={form.order}
                  onChange={(e) =>
                    setForm({ ...form, order: Number(e.target.value) || 0 })
                  }
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-[#ff5c00] focus:bg-white"
                />
              </div>

              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) =>
                    setForm({ ...form, isActive: e.target.checked })
                  }
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
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "حفظ"
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  disabled={saving}
                  className="rounded-lg border border-gray-200 px-5 py-2.5 text-sm font-bold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══ Modal تأكيد الحذف ═══ */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-5">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
              <AlertTriangle className="h-7 w-7 text-red-600" />
            </div>
            <h3 className="mt-4 text-lg font-black">تأكيد الحذف</h3>
            <p className="mt-2 text-sm text-gray-600">
              سيتم تعطيل التصنيف (Soft Delete).
              <br />
              <span className="text-xs text-gray-400">
                لا يمكن الحذف إذا كان فيه منتجات.
              </span>
            </p>
            <div className="mt-6 flex gap-2">
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-500 py-2.5 text-sm font-bold text-white transition hover:bg-red-600 disabled:opacity-50"
              >
                {deleting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                نعم، احذف
              </button>
              <button
                onClick={() => setDeleteId(null)}
                disabled={deleting}
                className="flex-1 rounded-lg border border-gray-200 py-2.5 text-sm font-bold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
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