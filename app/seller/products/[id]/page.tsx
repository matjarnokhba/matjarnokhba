"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  Loader2,
  Package,
  Save,
  Trash2,
  AlertTriangle,
  AlertCircle,
} from "lucide-react";
import ImageUploader from "@/components/admin/ImageUploader";

type Category = { id: number; name: string };

export default function EditSellerProductPage() {
  const params = useParams();
  const router = useRouter();
  const productId = params.id as string;

  const [categories, setCategories] = useState<Category[]>([]);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [brand, setBrand] = useState("");
  const [badge, setBadge] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [price, setPrice] = useState("");
  const [oldPrice, setOldPrice] = useState("");
  const [stock, setStock] = useState("0");
  const [freeShipping, setFreeShipping] = useState(false);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [status, setStatus] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [showDelete, setShowDelete] = useState(false);

  // ═══ جلب البيانات ═══
  useEffect(() => {
    async function load() {
      try {
        const [prodRes, catRes] = await Promise.all([
          fetch(`/api/seller/products/${productId}`),
          fetch("/api/seller/categories"),
        ]);

        const prodData = await prodRes.json();
        const catData = await catRes.json();

        if (!prodRes.ok || !prodData.success) {
          setError(prodData.message || "المنتج غير موجود");
          return;
        }

        const p = prodData.product;
        setName(p.name);
        setSlug(p.slug);
        setDescription(p.description);
        setBrand(p.brand);
        setBadge(p.badge);
        setCategoryId(String(p.categoryId));
        setPrice(String(p.price));
        setOldPrice(p.oldPrice ? String(p.oldPrice) : "");
        setStock(String(p.stock));
        setFreeShipping(p.freeShipping);
        setImageUrls(p.imageUrls);
        setStatus(p.status);

        if (catData.success) setCategories(catData.categories);
      } catch {
        setError("فشل الاتصال بالخادم");
      } finally {
        setLoading(false);
      }
    }
    if (productId) load();
  }, [productId]);

  function generateSlug(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
      .slice(0, 100);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!name.trim() || name.trim().length < 2) {
      setError("اسم المنتج مطلوب (حرفين على الأقل)");
      return;
    }
    if (!slug.trim()) {
      setError("الرابط (slug) مطلوب");
      return;
    }
    if (!categoryId) {
      setError("اختر التصنيف");
      return;
    }
    if (!price || Number(price) <= 0) {
      setError("السعر مطلوب");
      return;
    }
    if (imageUrls.length === 0) {
      setError("أضف صورة واحدة على الأقل");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/seller/products/${productId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          slug: slug.trim(),
          description: description.trim() || null,
          brand: brand.trim() || null,
          badge: badge.trim() || null,
          categoryId: Number(categoryId),
          price: Number(price),
          oldPrice: oldPrice ? Number(oldPrice) : null,
          stock: Number(stock) || 0,
          freeShipping,
          imageUrls,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.message || "فشل الحفظ");
        return;
      }

      router.push("/seller/products");
      router.refresh();
    } catch {
      setError("فشل الاتصال بالخادم");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/seller/products/${productId}`, {
        method: "DELETE",
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        alert(data.message || "فشل الحذف");
        return;
      }

      router.push("/seller/products");
      router.refresh();
    } catch {
      alert("فشل الاتصال بالخادم");
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-[#ff5c00]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
        <AlertTriangle className="h-12 w-12 text-red-500" />
        <h1 className="mt-4 text-xl font-black">{error}</h1>
        <Link
          href="/seller/products"
          className="mt-6 rounded-full bg-[#ff5c00] px-6 py-2.5 text-sm font-bold text-white"
        >
          عودة إلى منتجاتي
        </Link>
      </div>
    );
  }

  return (
    <div className="p-4 pt-16 lg:p-8 lg:pt-8">
      <Link
        href="/seller/products"
        className="mb-4 inline-flex items-center gap-1 text-xs font-bold text-gray-500 transition hover:text-[#ff5c00]"
      >
        <ArrowRight className="h-3.5 w-3.5" />
        رجوع إلى منتجاتي
      </Link>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-gray-900">تعديل المنتج</h1>
          <p className="mt-1 text-sm text-gray-500">{name}</p>
        </div>
        <button
          onClick={() => setShowDelete(true)}
          className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-xs font-bold text-red-600 transition hover:bg-red-100"
        >
          <Trash2 className="h-3.5 w-3.5" />
          حذف المنتج
        </button>
      </div>

      <form onSubmit={handleSubmit} className="max-w-3xl">
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <div className="rounded-xl bg-white p-5 shadow-sm">
              <h2 className="mb-4 flex items-center gap-2 text-sm font-black">
                <Package className="h-4 w-4 text-[#ff5c00]" />
                معلومات المنتج
              </h2>

              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-bold text-gray-700">
                    اسم المنتج <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
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
                    value={slug}
                    onChange={(e) => setSlug(generateSlug(e.target.value))}
                    dir="ltr"
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 font-mono text-xs outline-none focus:border-[#ff5c00] focus:bg-white"
                    required
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-bold text-gray-700">
                    الوصف
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    className="w-full resize-none rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-[#ff5c00] focus:bg-white"
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-bold text-gray-700">
                      الماركة
                    </label>
                    <input
                      type="text"
                      value={brand}
                      onChange={(e) => setBrand(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-[#ff5c00] focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-bold text-gray-700">
                      شارة المنتج
                    </label>
                    <input
                      type="text"
                      value={badge}
                      onChange={(e) => setBadge(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-[#ff5c00] focus:bg-white"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-xl bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-sm font-black">السعر والمخزون</h2>

              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-bold text-gray-700">
                    السعر <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    min="0"
                    step="0.01"
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-[#ff5c00] focus:bg-white"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-gray-700">
                    السعر القديم
                  </label>
                  <input
                    type="number"
                    value={oldPrice}
                    onChange={(e) => setOldPrice(e.target.value)}
                    min="0"
                    step="0.01"
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-[#ff5c00] focus:bg-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-gray-700">
                    المخزون
                  </label>
                  <input
                    type="number"
                    value={stock}
                    onChange={(e) => setStock(e.target.value)}
                    min="0"
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-[#ff5c00] focus:bg-white"
                  />
                </div>
              </div>

              <label className="mt-3 flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={freeShipping}
                  onChange={(e) => setFreeShipping(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-[#ff5c00] focus:ring-[#ff5c00]"
                />
                <span className="text-xs font-bold text-gray-700">
                  شحن مجاني لهذا المنتج
                </span>
              </label>
            </div>
          </div>

          <div className="space-y-4 lg:col-span-1">
            <div className="rounded-xl bg-white p-5 shadow-sm">
              <h2 className="mb-3 text-sm font-black">التصنيف</h2>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-[#ff5c00] focus:bg-white"
                required
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="rounded-xl bg-white p-5 shadow-sm">
              <h2 className="mb-3 text-sm font-black">صور المنتج</h2>
              <ImageUploader
                value={imageUrls}
                onChange={(urls) => setImageUrls(urls)}
              />
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="mt-6 flex gap-3">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-[#ff5c00] px-6 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#e64a00] disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            حفظ التغييرات
          </button>
          <Link
            href="/seller/products"
            className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-6 py-3 text-sm font-bold text-gray-700 transition hover:bg-gray-50"
          >
            إلغاء
          </Link>
        </div>
      </form>

      {/* ═══ Modal الحذف ═══ */}
      {showDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-5">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
              <AlertTriangle className="h-7 w-7 text-red-600" />
            </div>
            <h3 className="mt-4 text-lg font-black">تأكيد الحذف</h3>
            <p className="mt-2 text-sm text-gray-600">
              هل أنت متأكد من حذف "{name}"؟
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
                onClick={() => setShowDelete(false)}
                disabled={deleting}
                className="flex-1 rounded-lg border border-gray-200 py-2.5 text-sm font-bold text-gray-700 transition hover:bg-gray-50"
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