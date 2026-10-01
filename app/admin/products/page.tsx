import Link from "next/link";
import { prisma } from "@/lib/prisma";
import {
  Package,
  Plus,
  Edit,
  AlertTriangle,
  Sparkles,
  Clock,
  CheckCircle2,
  XCircle,
  Store,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminProductsPage() {
  const products = await prisma.product.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: "desc" },
    include: {
      seller: { select: { storeName: true, slug: true } },
      category: { select: { name: true } },
      images: { where: { isMain: true }, take: 1 },
      variants: {
        where: { isDefault: true },
        include: { inventory: { select: { quantity: true } } },
      },
      editLogs: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  // ═══ عدّادات ═══
  const pendingCount = products.filter((p) => p.status === "DRAFT").length;

  return (
    <div className="p-4 pt-16 lg:p-8 lg:pt-8">
      {/* ═══ Header ═══ */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-900 lg:text-3xl">
            المنتجات
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {products.length} منتج
            {pendingCount > 0 && (
              <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                {pendingCount} بانتظار الموافقة
              </span>
            )}
          </p>
        </div>

        <div className="flex gap-2">
          {pendingCount > 0 && (
            <Link
              href="/admin/products/pending"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm font-bold text-amber-700 transition hover:bg-amber-100"
            >
              <Clock className="h-4 w-4" />
              المراجعة ({pendingCount})
            </Link>
          )}
          <Link
            href="/admin/products/new"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#ff5c00] px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#e64a00]"
          >
            <Plus className="h-4 w-4" />
            إضافة منتج
          </Link>
        </div>
      </div>

      {/* ═══ القائمة ═══ */}
      {products.length === 0 ? (
        <div className="rounded-xl bg-white p-12 text-center shadow-sm">
          <Package className="mx-auto h-12 w-12 text-gray-300" />
          <h3 className="mt-3 text-base font-bold text-gray-700">
            لا توجد منتجات
          </h3>
          <Link
            href="/admin/products/new"
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#ff5c00] px-4 py-2 text-xs font-bold text-white"
          >
            <Plus className="h-3.5 w-3.5" />
            إضافة أول منتج
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500">
                <tr>
                  <th className="px-4 py-3 text-right font-bold">الصورة</th>
                  <th className="px-4 py-3 text-right font-bold">الاسم</th>
                  <th className="px-4 py-3 text-right font-bold">التاجر</th>
                  <th className="px-4 py-3 text-right font-bold">التصنيف</th>
                  <th className="px-4 py-3 text-right font-bold">السعر</th>
                  <th className="px-4 py-3 text-right font-bold">المخزون</th>
                  <th className="px-4 py-3 text-right font-bold">الحالة</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {products.map((product) => {
                  const variant = product.variants[0];
                  const stock = variant?.inventory?.quantity ?? 0;
                  const imageUrl = product.images[0]?.url;
                  const lowStock = stock <= 5;
                  const lastEdit = product.editLogs[0];

                  // ═══ تحديد النوع ═══
                  const isDraft = product.status === "DRAFT";
                  const isNew = isDraft && !lastEdit;
                  const isEdited = isDraft && !!lastEdit;
                  const hasPriceWarning =
                    lastEdit?.reason?.includes("السعر") || false;

                  return (
                    <tr key={product.id} className="transition hover:bg-gray-50">
                      {/* صورة */}
                      <td className="px-4 py-3">
                        <div className="h-12 w-12 overflow-hidden rounded-lg bg-gray-100">
                          {imageUrl ? (
                            <img
                              src={imageUrl}
                              alt={product.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-gray-300">
                              <Package className="h-5 w-5" />
                            </div>
                          )}
                        </div>
                      </td>

                      {/* الاسم + الشارات */}
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-bold text-gray-900">
                            {product.name}
                          </span>

                          {/* 🆕 منتج جديد */}
                          {isNew && (
                            <span
                              className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[9px] font-black text-blue-700"
                              title="منتج جديد بانتظار الموافقة"
                            >
                              <Sparkles className="h-3 w-3" />
                              جديد
                            </span>
                          )}

                          {/* ✏️ منتج مُعدَّل */}
                          {isEdited && !hasPriceWarning && (
                            <span
                              className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-black text-amber-700"
                              title="منتج مُعدَّل بانتظار الموافقة"
                            >
                              <Edit className="h-3 w-3" />
                              مُعدَّل
                            </span>
                          )}

                          {/* ⚠️ تعديل سعر خارج الحدود */}
                          {hasPriceWarning && (
                            <span
                              className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[9px] font-black text-red-700"
                              title={lastEdit?.reason || "تعديل سعر"}
                            >
                              <AlertTriangle className="h-3 w-3" />
                              سعر!
                            </span>
                          )}
                        </div>

                        {product.brand && (
                          <div className="text-[11px] text-gray-500">
                            {product.brand}
                          </div>
                        )}

                        {/* عدد التغييرات */}
                        {isEdited && lastEdit && (
                          <div className="mt-0.5 text-[10px] text-amber-600">
                            {Array.isArray(lastEdit.changedFields)
                              ? `${(lastEdit.changedFields as any[]).length} تغيير`
                              : ""}
                          </div>
                        )}
                      </td>

                      {/* التاجر */}
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 text-[11px] text-gray-600">
                          <Store className="h-3 w-3" />
                          {product.seller?.storeName || "—"}
                        </span>
                      </td>

                      {/* التصنيف */}
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-600">
                        {product.category?.name}
                      </td>

                      {/* السعر */}
                      <td className="whitespace-nowrap px-4 py-3 font-black text-[#ff5c00]">
                        {variant ? Number(variant.price) : 0} د.م
                      </td>

                      {/* المخزون */}
                      <td className="whitespace-nowrap px-4 py-3">
                        {lowStock ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-black text-red-600">
                            <AlertTriangle className="h-3 w-3" />
                            {stock}
                          </span>
                        ) : (
                          <span className="rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-black text-green-600">
                            {stock}
                          </span>
                        )}
                      </td>

                      {/* الحالة */}
                      <td className="whitespace-nowrap px-4 py-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                            product.status === "ACTIVE"
                              ? "bg-green-100 text-green-700"
                              : product.status === "DRAFT"
                                ? "bg-yellow-100 text-yellow-700"
                                : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {product.status === "ACTIVE"
                            ? "نشط"
                            : product.status === "DRAFT"
                              ? "مسودة"
                              : "معطل"}
                        </span>
                      </td>

                      {/* تعديل */}
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/products/${product.id}`}
                          className="inline-flex items-center gap-1 rounded-lg bg-[#fff4ed] px-3 py-1.5 text-[11px] font-bold text-[#ff5c00] transition hover:bg-[#ffe7d5]"
                        >
                          <Edit className="h-3 w-3" />
                          تعديل
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}