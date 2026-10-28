"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Loader2,
  Package,
  CheckCircle2,
  XCircle,
  Store,
  Sparkles,
  Edit3,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  X,
  Image as ImageIcon,
  Info,
  Truck,
} from "lucide-react";

const CURRENCY = "د.م";

type Variant = {
  id: number;
  price: number;
  barcode: string | null;
  isDefault: boolean;
  stock: number;
  options: string[];
};

type EditLog = {
  id: number;
  changedFields: string[];
  oldValues: Record<string, any>;
  newValues: Record<string, any>;
  requiresReapproval: boolean;
  reason: string | null;
  createdAt: string;
};

type PendingProduct = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  brand: string | null;
  badge: string | null;
  originCountry: string | null;
  videoUrl: string | null;
  minOrderQty: number;
  maxOrderQty: number | null;
  freeShipping: boolean;
  productType: string;
  unit: string;
  weightGrams: number | null;
  lengthCm: number | null;
  widthCm: number | null;
  heightCm: number | null;
  salePrice: number | null;
  categoryName: string;
  images: string[];
  variants: Variant[];
  totalStock: number;
  minPrice: number;
  createdAt: string;
  updatedAt: string;
  isNew: boolean;
  seller: { id: number; storeName: string; slug: string };
  lastEdit: EditLog | null;
};

const SENSITIVE_FIELDS = new Set([
  "الاسم",
  "الرابط",
  "الوصف",
  "الصور",
  "الماركة",
  "الشارة",
  "التصنيف",
  "السعر",
]);

export default function AdminPendingProductsPage() {
  const [products, setProducts] = useState<PendingProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<number | null>(null);
  const [expandedChanges, setExpandedChanges] = useState<Set<number>>(new Set());
  const [reviewProduct, setReviewProduct] = useState<PendingProduct | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [reviewAction, setReviewAction] = useState<"approve" | "reject">("approve");

  async function loadData() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/products/pending");
      const data = await res.json();
      if (data.success) setProducts(data.products);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function openReview(p: PendingProduct, action: "approve" | "reject") {
    setReviewProduct(p);
    setReviewAction(action);
    setReviewNote("");
  }

  async function submitReview() {
    if (!reviewProduct) return;
    setActionId(reviewProduct.id);
    try {
      const res = await fetch(`/api/admin/products/${reviewProduct.id}/approve`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: reviewAction,
          note: reviewNote.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        alert(data.message || "فشل الإجراء");
        return;
      }
      setReviewProduct(null);
      await loadData();
    } catch {
      alert("فشل الاتصال");
    } finally {
      setActionId(null);
    }
  }

  function toggleChanges(id: number) {
    setExpandedChanges((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="p-4 pt-16 lg:p-8 lg:pt-8">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-gray-900">
          منتجات بانتظار الموافقة
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          راجع منتجات التجار — الجديدة والمُعدَّلة
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-[#ff5c00]" />
        </div>
      ) : products.length === 0 ? (
        <div className="rounded-xl bg-white p-12 text-center shadow-sm">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
            <CheckCircle2 className="h-10 w-10 text-green-600" />
          </div>
          <h3 className="mt-5 text-lg font-black">لا توجد منتجات معلّقة</h3>
          <p className="mt-2 text-sm text-gray-500">كل المنتجات تمت مراجعتها</p>
        </div>
      ) : (
        <div className="space-y-4">
          {products.map((product) => {
            const hasChanges =
              product.lastEdit &&
              Array.isArray(product.lastEdit.changedFields) &&
              product.lastEdit.changedFields.length > 0;
            const isChangesOpen = expandedChanges.has(product.id);

            return (
              <div
                key={product.id}
                className="overflow-hidden rounded-xl bg-white shadow-sm"
              >
                <div className="p-4">
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-gray-100">
                      {product.images[0] ? (
                        <img
                          src={product.images[0]}
                          alt={product.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-gray-300">
                          <Package className="h-6 w-6" />
                        </div>
                      )}
                      {product.images.length > 1 && (
                        <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-center text-[9px] font-bold text-white">
                          +{product.images.length - 1}
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        {product.isNew ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                            <Sparkles className="h-3 w-3" />
                            منتج جديد
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                            <Edit3 className="h-3 w-3" />
                            منتج مُعدَّل
                          </span>
                        )}
                      </div>

                      <div className="text-sm font-black text-gray-900">{product.name}</div>

                      <Link
                        href={`/store/${product.seller.slug}`}
                        target="_blank"
                        className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:underline"
                      >
                        <Store className="h-3 w-3" />
                        {product.seller.storeName}
                      </Link>

                      <div className="mt-1 flex flex-wrap items-center gap-3 text-[10px] text-gray-500">
                        <span>{product.categoryName}</span>
                        <span>·</span>
                        <span>
                          المخزون الكلي: <strong>{product.totalStock}</strong>
                          {product.variants.length > 1 && (
                            <span className="text-gray-400">
                              {" "}
                              ({product.variants.length} متغير)
                            </span>
                          )}
                        </span>
                      </div>
                    </div>

                    <div className="shrink-0 text-left">
                      <div className="text-lg font-black text-[#ff5c00]">
                        {product.minPrice.toFixed(2)}
                      </div>
                      <div className="text-[10px] text-gray-500">{CURRENCY}</div>
                    </div>

                    <div className="flex shrink-0 gap-2">
                      <button
                        onClick={() => openReview(product, "approve")}
                        disabled={actionId === product.id}
                        className="flex items-center gap-1 rounded-lg bg-green-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-green-700 disabled:opacity-50"
                      >
                        {actionId === product.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        )}
                        مراجعة
                      </button>
                    </div>
                  </div>
                </div>

                {hasChanges && (
                  <div className="border-t border-gray-100 bg-amber-50/50">
                    <button
                      onClick={() => toggleChanges(product.id)}
                      className="flex w-full items-center justify-between px-4 py-3 text-right transition hover:bg-amber-50"
                    >
                      <div className="flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-amber-600" />
                        <span className="text-xs font-bold text-amber-800">
                          {product.lastEdit!.changedFields.length} تغيير
                          {product.lastEdit!.reason && (
                            <span className="ml-2 text-[10px] font-normal text-amber-700">
                              · {product.lastEdit!.reason}
                            </span>
                          )}
                        </span>
                      </div>
                      {isChangesOpen ? (
                        <ChevronUp className="h-4 w-4 text-amber-600" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-amber-600" />
                      )}
                    </button>

                    {isChangesOpen && (
                      <div className="border-t border-amber-200 bg-white px-4 py-3">
                        <div className="overflow-hidden rounded-lg border border-gray-200">
                          <table className="w-full text-xs">
                            <thead className="bg-gray-50 text-gray-600">
                              <tr>
                                <th className="px-3 py-2 text-right font-bold">الحقل</th>
                                <th className="px-3 py-2 text-right font-bold">القيمة القديمة</th>
                                <th className="px-3 py-2 text-right font-bold">القيمة الجديدة</th>
                              </tr>
                            </thead>
                            <tbody>
                              {product.lastEdit!.changedFields.map((field: string) => {
                                const oldVal = product.lastEdit!.oldValues[field];
                                const newVal = product.lastEdit!.newValues[field];
                                const isSensitive = SENSITIVE_FIELDS.has(field);
                                return (
                                  <tr key={field} className="border-t border-gray-100">
                                    <td className="px-3 py-2 font-bold">
                                      <span className={isSensitive ? "text-amber-700" : "text-gray-600"}>
                                        {field}
                                        {isSensitive && " ⚠️"}
                                      </span>
                                    </td>
                                    <td className="px-3 py-2 text-gray-600">{renderValue(oldVal)}</td>
                                    <td className="px-3 py-2 font-bold text-gray-900">{renderValue(newVal)}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Review Modal */}
      {reviewProduct && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4"
          onClick={() => setReviewProduct(null)}
        >
          <div
            className="my-8 w-full max-w-3xl rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-100 p-4">
              <div>
                <h2 className="text-lg font-black text-gray-900">{reviewProduct.name}</h2>
                <p className="mt-0.5 text-xs text-gray-500">
                  {reviewProduct.categoryName} · {reviewProduct.seller.storeName}
                </p>
              </div>
              <button
                onClick={() => setReviewProduct(null)}
                className="rounded-full p-1.5 hover:bg-gray-100"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            {/* Body */}
            <div className="max-h-[60vh] overflow-y-auto p-4 space-y-4">
              {/* Gallery */}
              {reviewProduct.images.length > 0 && (
                <div>
                  <h3 className="mb-2 flex items-center gap-2 text-xs font-black text-gray-700">
                    <ImageIcon className="h-3.5 w-3.5" />
                    الصور ({reviewProduct.images.length})
                  </h3>
                  <div className="grid grid-cols-4 gap-2">
                    {reviewProduct.images.map((url, i) => (
                      <a
                        key={i}
                        href={url}
                        target="_blank"
                        className="aspect-square overflow-hidden rounded-lg bg-gray-100 hover:opacity-80"
                      >
                        <img src={url} alt="" className="h-full w-full object-cover" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Info */}
              <div className="rounded-lg border border-gray-200 p-3">
                <h3 className="mb-2 flex items-center gap-2 text-xs font-black text-gray-700">
                  <Info className="h-3.5 w-3.5" />
                  المعلومات
                </h3>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                  <div>
                    <dt className="text-gray-500">الرابط</dt>
                    <dd className="font-mono text-[10px] text-gray-700" dir="ltr">
                      /{reviewProduct.slug}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">الفئة</dt>
                    <dd className="font-bold text-gray-900">{reviewProduct.categoryName}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">الماركة</dt>
                    <dd className="font-bold text-gray-900">{reviewProduct.brand || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">الشارة</dt>
                    <dd className="font-bold text-gray-900">{reviewProduct.badge || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">بلد المنشأ</dt>
                    <dd className="font-bold text-gray-900">{reviewProduct.originCountry || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">نوع المنتج</dt>
                    <dd className="font-bold text-gray-900">{reviewProduct.productType}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">الحد الأدنى</dt>
                    <dd className="font-bold text-gray-900">{reviewProduct.minOrderQty}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">الحد الأقصى</dt>
                    <dd className="font-bold text-gray-900">{reviewProduct.maxOrderQty || "—"}</dd>
                  </div>
                  {reviewProduct.videoUrl && (
                    <div className="col-span-2">
                      <dt className="text-gray-500">الفيديو</dt>
                      <dd>
                        <a
                          href={reviewProduct.videoUrl}
                          target="_blank"
                          className="text-blue-600 hover:underline"
                          dir="ltr"
                        >
                          {reviewProduct.videoUrl}
                        </a>
                      </dd>
                    </div>
                  )}
                </dl>
                {reviewProduct.description && (
                  <div className="mt-3 border-t border-gray-100 pt-2">
                    <dt className="text-[10px] text-gray-500">الوصف</dt>
                    <dd className="mt-1 whitespace-pre-wrap text-xs text-gray-700">
                      {reviewProduct.description}
                    </dd>
                  </div>
                )}
              </div>

              {/* Variants */}
              <div className="rounded-lg border border-gray-200 p-3">
                <h3 className="mb-2 flex items-center gap-2 text-xs font-black text-gray-700">
                  <Package className="h-3.5 w-3.5" />
                  المتغيرات ({reviewProduct.variants.length}) — المخزون الكلي: {reviewProduct.totalStock}
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-2 py-1.5 text-right font-bold text-gray-600">#</th>
                        <th className="px-2 py-1.5 text-right font-bold text-gray-600">التركيبة</th>
                        <th className="px-2 py-1.5 text-right font-bold text-gray-600">السعر</th>
                        <th className="px-2 py-1.5 text-right font-bold text-gray-600">المخزون</th>
                        <th className="px-2 py-1.5 text-right font-bold text-gray-600">الباركود</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {reviewProduct.variants.map((v, i) => (
                        <tr key={v.id}>
                          <td className="px-2 py-1.5 text-gray-400">{i + 1}</td>
                          <td className="px-2 py-1.5 text-gray-700">
                            {v.options.length > 0 ? v.options.join(" / ") : "افتراضي"}
                          </td>
                          <td className="px-2 py-1.5 font-bold text-gray-900">
                            {v.price.toFixed(2)} {CURRENCY}
                          </td>
                          <td className="px-2 py-1.5 text-gray-700">{v.stock}</td>
                          <td className="px-2 py-1.5 font-mono text-[10px] text-gray-500" dir="ltr">
                            {v.barcode || "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {reviewProduct.freeShipping && (
                <div className="flex items-center gap-2 rounded-lg bg-green-50 p-2 text-xs font-bold text-green-700">
                  <Truck className="h-4 w-4" />
                  شحن مجاني
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="border-t border-gray-100 p-4 space-y-3">
              <div>
                <label className="mb-1 block text-xs font-bold text-gray-700">
                  ملاحظة (اختياري — تظهر للتاجر)
                </label>
                <textarea
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                  rows={2}
                  maxLength={500}
                  placeholder={reviewAction === "reject" ? "سبب الرفض..." : "ملاحظة للتاجر..."}
                  className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#ff5c00]"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setReviewAction("reject");
                    submitReview();
                  }}
                  disabled={actionId !== null}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg border-2 border-red-200 bg-red-50 py-2.5 text-sm font-bold text-red-700 transition hover:bg-red-100 disabled:opacity-50"
                >
                  <XCircle className="h-4 w-4" />
                  رفض
                </button>
                <button
                  onClick={() => {
                    setReviewAction("approve");
                    submitReview();
                  }}
                  disabled={actionId !== null}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-green-600 py-2.5 text-sm font-bold text-white transition hover:bg-green-700 disabled:opacity-50"
                >
                  {actionId !== null ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  موافقة
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function renderValue(value: any): React.ReactNode {
  if (value === null || value === undefined) return <span className="text-gray-400">—</span>;
  if (typeof value === "boolean") return value ? "نعم" : "لا";
  if (typeof value === "number") return value.toString();
  if (typeof value === "string") {
    if (value.startsWith("http")) {
      return <img src={value} alt="" className="h-10 w-10 rounded object-cover" />;
    }
    return value.length > 60 ? value.slice(0, 60) + "..." : value;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return "—";
    if (typeof value[0] === "string" && value[0].startsWith("http")) {
      return (
        <div className="flex gap-1">
          {value.slice(0, 3).map((url, i) => (
            <img key={i} src={url} alt="" className="h-10 w-10 rounded object-cover" />
          ))}
          {value.length > 3 && <span className="text-gray-400">+{value.length - 3}</span>}
        </div>
      );
    }
    return value.join(", ");
  }
  return JSON.stringify(value);
}