"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Loader2,
  Package,
  CheckCircle2,
  XCircle,
  Store,
  ExternalLink,
  Sparkles,
  Edit3,
  AlertCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

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
  image: string | null;
  categoryName: string;
  price: number;
  stock: number;
  createdAt: string;
  updatedAt: string;
  isNew: boolean;
  seller: { id: number; storeName: string; slug: string };
  lastEdit: EditLog | null;
};

const CURRENCY = "د.م";

// ═══ حقول حساسة — تُبرز في العرض ═══
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
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

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

  async function handleAction(
    productId: number,
    action: "approve" | "reject"
  ) {
    setActionId(productId);
    try {
      const res = await fetch(`/api/admin/products/${productId}/approve`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        alert(data.message || "فشل الإجراء");
        return;
      }

      await loadData();
    } catch {
      alert("فشل الاتصال");
    } finally {
      setActionId(null);
    }
  }

  function toggleExpand(id: number) {
    setExpanded((prev) => {
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
          <p className="mt-2 text-sm text-gray-500">
            كل المنتجات تمت مراجعتها
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {products.map((product) => {
            const isExpanded = expanded.has(product.id);
            const hasChanges =
              product.lastEdit &&
              Array.isArray(product.lastEdit.changedFields) &&
              product.lastEdit.changedFields.length > 0;

            return (
              <div
                key={product.id}
                className="overflow-hidden rounded-xl bg-white shadow-sm"
              >
                {/* ═══ Header ═══ */}
                <div className="p-4">
                  <div className="flex flex-wrap items-center gap-4">
                    {/* صورة */}
                    <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-gray-100">
                      {product.image ? (
                        <img
                          src={product.image}
                          alt={product.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-gray-300">
                          <Package className="h-6 w-6" />
                        </div>
                      )}
                    </div>

                    {/* معلومات */}
                    <div className="min-w-0 flex-1">
                      {/* شارة النوع */}
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

                      <div className="text-sm font-black text-gray-900">
                        {product.name}
                      </div>

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
                          المخزون: <strong>{product.stock}</strong>
                        </span>
                      </div>
                    </div>

                    {/* السعر */}
                    <div className="shrink-0 text-left">
                      <div className="text-lg font-black text-[#ff5c00]">
                        {product.price}
                      </div>
                      <div className="text-[10px] text-gray-500">
                        {CURRENCY}
                      </div>
                    </div>

                    {/* أزرار */}
                    <div className="flex shrink-0 gap-2">
                      <button
                        onClick={() => handleAction(product.id, "approve")}
                        disabled={actionId === product.id}
                        className="flex items-center gap-1 rounded-lg bg-green-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-green-700 disabled:opacity-50"
                      >
                        {actionId === product.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        )}
                        موافقة
                      </button>
                      <button
                        onClick={() => handleAction(product.id, "reject")}
                        disabled={actionId === product.id}
                        className="flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-600 transition hover:bg-red-100 disabled:opacity-50"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        رفض
                      </button>
                    </div>
                  </div>
                </div>

                {/* ═══ التغييرات ═══ */}
                {hasChanges && (
                  <div className="border-t border-gray-100 bg-amber-50/50">
                    <button
                      onClick={() => toggleExpand(product.id)}
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
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4 text-amber-600" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-amber-600" />
                      )}
                    </button>

                    {isExpanded && (
                      <div className="border-t border-amber-200 bg-white px-4 py-3">
                        <div className="overflow-hidden rounded-lg border border-gray-200">
                          <table className="w-full text-xs">
                            <thead className="bg-gray-50 text-gray-600">
                              <tr>
                                <th className="px-3 py-2 text-right font-bold">
                                  الحقل
                                </th>
                                <th className="px-3 py-2 text-right font-bold">
                                  القيمة القديمة
                                </th>
                                <th className="px-3 py-2 text-right font-bold">
                                  القيمة الجديدة
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {product.lastEdit!.changedFields.map(
                                (field: string) => {
                                  const oldVal =
                                    product.lastEdit!.oldValues[field];
                                  const newVal =
                                    product.lastEdit!.newValues[field];
                                  const isSensitive =
                                    SENSITIVE_FIELDS.has(field);

                                  return (
                                    <tr
                                      key={field}
                                      className="border-t border-gray-100"
                                    >
                                      <td className="px-3 py-2 font-bold">
                                        <span
                                          className={
                                            isSensitive
                                              ? "text-amber-700"
                                              : "text-gray-600"
                                          }
                                        >
                                          {field}
                                          {isSensitive && " ⚠️"}
                                        </span>
                                      </td>
                                      <td className="px-3 py-2 text-gray-600">
                                        {renderValue(oldVal)}
                                      </td>
                                      <td className="px-3 py-2 font-bold text-gray-900">
                                        {renderValue(newVal)}
                                      </td>
                                    </tr>
                                  );
                                }
                              )}
                            </tbody>
                          </table>
                        </div>

                        <div className="mt-2 text-[10px] text-gray-400">
                          {new Date(
                            product.lastEdit!.createdAt
                          ).toLocaleDateString("ar-MA", {
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
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
    </div>
  );
}

// ═══ عرض القيم (نصوص، أرقام، صور، arrays) ═══
function renderValue(value: any): React.ReactNode {
  if (value === null || value === undefined) {
    return <span className="text-gray-400">—</span>;
  }

  if (typeof value === "boolean") {
    return value ? "نعم" : "لا";
  }

  if (typeof value === "number") {
    return value.toString();
  }

  if (typeof value === "string") {
    // صور؟
    if (value.startsWith("http")) {
      return (
        <img
          src={value}
          alt=""
          className="h-10 w-10 rounded object-cover"
        />
      );
    }
    return value.length > 60 ? value.slice(0, 60) + "..." : value;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return "—";
    // صور؟
    if (typeof value[0] === "string" && value[0].startsWith("http")) {
      return (
        <div className="flex gap-1">
          {value.slice(0, 3).map((url, i) => (
            <img
              key={i}
              src={url}
              alt=""
              className="h-10 w-10 rounded object-cover"
            />
          ))}
          {value.length > 3 && (
            <span className="text-gray-400">+{value.length - 3}</span>
          )}
        </div>
      );
    }
    return value.join(", ");
  }

  return JSON.stringify(value);
}