"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ShoppingBasket,
  ArrowLeft,
  Trash2,
  Package,
  Plus,
  Minus,
  AlertCircle,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Empty } from "@/components/ui/Empty";
import { PageHeader } from "@/components/ui/PageHeader";
import { Spinner } from "@/components/ui/Spinner";
import { useWholesaleCart } from "@/lib/hooks/useWholesaleCart";
import { useToast } from "@/lib/hooks/useToast";
import {
  formatMoney,
  BU_TYPE_LABEL,
} from "@/components/wholesale/offers/types";

export function CartContent() {
  const router = useRouter();
  const { toast } = useToast();
  const { items, isHydrated, totalItems, totalEstimate, updateQuantity, removeItem, clear } =
    useWholesaleCart();

  if (!isHydrated) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size="lg" label="جارٍ التحميل..." />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="space-y-5">
        <PageHeader
          title="السلة"
          description="منتجاتك المختارة للشراء بالجملة"
        />
        <Empty
          icon={ShoppingBasket}
          title="السلة فارغة"
          description="تصفّح سوق الجملة وأضف منتجات إلى سلتك."
          action={
            <Link href="/wholesale/marketplace">
              <Button iconLeft={<Package className="h-4 w-4" />}>
                تصفّح السوق
              </Button>
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="السلة"
        description={`${items.length} عرض · ${totalItems} قطعة`}
        action={
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (confirm("هل تريد إفراغ السلة؟")) {
                clear();
                toast("تم إفراغ السلة", "success");
              }
            }}
          >
            إفراغ
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-3">
          {items.map((item) => (
            <Card key={`${item.offerId}:${item.masterVariantId}`}>
              <div className="flex gap-3">
                <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg bg-gray-50">
                  {item.masterImage ? (
                    <img
                      src={item.masterImage}
                      alt={item.masterName}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <Package className="h-6 w-6 text-gray-300" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="mb-1 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link
                        href={`/wholesale/marketplace/${item.offerId}`}
                        className="truncate font-semibold text-gray-900 hover:text-[#ff5c00]"
                      >
                        {item.masterName}
                      </Link>
                      <p className="text-xs text-gray-500">
                        {item.sellerName}
                        {item.sellerType && (
                          <span className="mr-1">
                            · {BU_TYPE_LABEL[item.sellerType] ?? item.sellerType}
                          </span>
                        )}
                      </p>
                      {item.variantAttributes.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {item.variantAttributes.map((a, i) => (
                            <span
                              key={i}
                              className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-600"
                            >
                              {a.name}: {a.value}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        removeItem(item.offerId, item.masterVariantId);
                        toast("تم حذف المنتج", "success");
                      }}
                      className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                      aria-label="حذف"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="mt-2 flex flex-wrap items-end justify-between gap-2">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          updateQuantity(
                            item.offerId,
                            item.masterVariantId,
                            Math.max(item.minOrderQty, item.quantity - 1)
                          )
                        }
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-40"
                        disabled={item.quantity <= item.minOrderQty}
                        aria-label="تقليل"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <input
                        type="number"
                        min={item.minOrderQty}
                        max={item.maxOrderQty ?? undefined}
                        value={item.quantity}
                        onChange={(e) => {
                          const v = parseInt(e.target.value, 10);
                          if (!isNaN(v)) {
                            updateQuantity(
                              item.offerId,
                              item.masterVariantId,
                              Math.max(item.minOrderQty, v)
                            );
                          }
                        }}
                        className="h-8 w-16 rounded-lg border border-gray-300 text-center text-sm"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          updateQuantity(
                            item.offerId,
                            item.masterVariantId,
                            item.quantity + 1
                          )
                        }
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-300 hover:bg-gray-50"
                        aria-label="زيادة"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-gray-500">
                        {formatMoney(item.unitPrice)} د.م × {item.quantity}
                      </p>
                      <p className="text-base font-black text-[#ff5c00]">
                        {formatMoney(item.unitPrice * item.quantity)} د.م
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>

        <div className="lg:sticky lg:top-4 lg:h-fit space-y-4">
          <Card>
            <h3 className="mb-3 text-sm font-bold text-gray-900">
              ملخص السلة
            </h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-600">عدد العروض</dt>
                <dd className="font-medium text-gray-900">{items.length}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-600">إجمالي القطع</dt>
                <dd className="font-medium text-gray-900">{totalItems}</dd>
              </div>
              <div className="flex justify-between border-t border-gray-200 pt-2">
                <dt className="font-bold text-gray-900">الإجمالي التقديري</dt>
                <dd className="text-lg font-black text-[#ff5c00]">
                  {formatMoney(totalEstimate)} د.م
                </dd>
              </div>
            </dl>

            <div className="mt-3 rounded-lg bg-blue-50 p-2 text-[11px] text-blue-900">
              <AlertCircle className="inline h-3 w-3" /> الأسعار نهائية عند
              إنشاء الطلب. قد تختلف قليلًا حسب شرائح الأسعار على الخادم.
            </div>

            <Button
              fullWidth
              className="mt-3"
              onClick={() => router.push("/wholesale/checkout")}
              iconRight={<ArrowLeft className="h-4 w-4" />}
            >
              إتمام الشراء
            </Button>
          </Card>

          <Link
            href="/wholesale/marketplace"
            className="flex items-center justify-center gap-1 text-sm text-gray-500 hover:text-[#ff5c00]"
          >
            <ArrowRight className="h-4 w-4" />
            متابعة التسوق
          </Link>
        </div>
      </div>
    </div>
  );
}