"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Package,
  Building2,
  AlertCircle,
  ShoppingCart,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
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
import type { BuyerBU } from "./types";

function genIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export interface CheckoutContentProps {
  buyerBUs: BuyerBU[];
}

export function CheckoutContent({ buyerBUs }: CheckoutContentProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { items, isHydrated, totalItems, totalEstimate, clear } =
    useWholesaleCart();

  const [buyerBUId, setBuyerBUId] = useState<string>(
    buyerBUs[0]?.id?.toString() ?? ""
  );
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Redirect if empty cart
  useEffect(() => {
    if (isHydrated && items.length === 0) {
      router.replace("/wholesale/cart");
    }
  }, [isHydrated, items.length, router]);

  if (!isHydrated) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  if (items.length === 0) return null;

  if (buyerBUs.length === 0) {
    return (
      <div className="space-y-5">
        <PageHeader title="إتمام الشراء" />
        <Empty
          icon={AlertCircle}
          title="لا يوجد نشاط مؤهل للشراء"
          description="تحتاج نشاطًا تجاريًا بصلاحية WHOLESALE_BUY لتتمكن من إتمام الطلب."
          action={
            <Link href="/wholesale/business-units/new">
              <Button>إنشاء نشاط</Button>
            </Link>
          }
        />
      </div>
    );
  }

  const handleSubmit = async () => {
    if (!buyerBUId) {
      toast("اختر نشاط الشراء", "warning");
      return;
    }
    if (items.length === 0) {
      toast("السلة فارغة", "warning");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/wholesale/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": genIdempotencyKey(),
        },
        body: JSON.stringify({
          buyerBusinessUnitId: parseInt(buyerBUId, 10),
          items: items.map((i) => ({
            offerId: i.offerId,
            masterVariantId: i.masterVariantId,
            quantity: i.quantity,
          })),
          notes: notes.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        toast(data.message || "فشل إنشاء الطلب", "error");
        return;
      }

      clear();
      toast("تم إنشاء طلبك بنجاح", "success");

      const firstId = Array.isArray(data.orderIds) ? data.orderIds[0] : null;
      if (firstId) {
        router.push(`/wholesale/orders/${firstId}`);
      } else {
        router.push("/wholesale/orders");
      }
    } catch {
      toast("حدث خطأ في الاتصال", "error");
    } finally {
      setSubmitting(false);
    }
  };

  // Group items by seller for clarity
  const groups = new Map<string, typeof items>();
  for (const item of items) {
    const key = `${item.sellerName}|${item.sellerType}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  }

  return (
    <div className="space-y-5">
      <Link
        href="/wholesale/cart"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-[#ff5c00]"
      >
        <ArrowRight className="h-4 w-4" />
        العودة للسلة
      </Link>

      <PageHeader
        title="إتمام الشراء"
        description={`${items.length} عرض · ${totalItems} قطعة`}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          {/* Buyer BU */}
          <Card>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-gray-900">
              <Building2 className="h-4 w-4 text-gray-400" />
              الشراء باسم
            </h3>
            <Select
              value={buyerBUId}
              onChange={(e) => setBuyerBUId(e.target.value)}
              options={buyerBUs.map((b) => ({
                value: String(b.id),
                label: `${b.name} (${BU_TYPE_LABEL[b.type] ?? b.type})`,
              }))}
            />
          </Card>

          {/* Items by seller */}
          <Card padding="none">
            <div className="border-b border-gray-100 p-4">
              <h3 className="flex items-center gap-2 text-sm font-bold text-gray-900">
                <Package className="h-4 w-4 text-gray-400" />
                المنتجات ({items.length})
              </h3>
            </div>
            <div className="divide-y divide-gray-100">
              {Array.from(groups.entries()).map(([sellerKey, groupItems]) => {
                const [sellerName, sellerType] = sellerKey.split("|");
                return (
                  <div key={sellerKey}>
                    <div className="bg-gray-50 px-4 py-2 text-xs text-gray-600">
                      <span className="font-medium text-gray-900">
                        {sellerName}
                      </span>
                      {sellerType && (
                        <span className="mr-1">
                          · {BU_TYPE_LABEL[sellerType] ?? sellerType}
                        </span>
                      )}
                    </div>
                    {groupItems.map((item) => (
                      <div
                        key={`${item.offerId}:${item.masterVariantId}`}
                        className="flex items-start gap-3 p-3"
                      >
                        <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded bg-gray-50">
                          {item.masterImage ? (
                            <img
                              src={item.masterImage}
                              alt={item.masterName}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center">
                              <Package className="h-4 w-4 text-gray-300" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {item.masterName}
                          </p>
                          <p className="text-xs text-gray-500">
                            {item.quantity} × {formatMoney(item.unitPrice)} د.م
                          </p>
                        </div>
                        <p className="text-sm font-bold text-gray-900">
                          {formatMoney(item.unitPrice * item.quantity)} د.م
                        </p>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Notes */}
          <Card>
            <h3 className="mb-2 text-sm font-bold text-gray-900">
              ملاحظات (اختياري)
            </h3>
            <Textarea
              placeholder="أي ملاحظات للبائع..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              maxLength={2000}
            />
          </Card>
        </div>

        <div className="lg:sticky lg:top-4 lg:h-fit space-y-4">
          <Card>
            <h3 className="mb-3 text-sm font-bold text-gray-900">
              ملخص الطلب
            </h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-600">عدد العروض</dt>
                <dd className="text-gray-900">{items.length}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-600">إجمالي القطع</dt>
                <dd className="text-gray-900">{totalItems}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-600">عدد الموردين</dt>
                <dd className="text-gray-900">{groups.size}</dd>
              </div>
              <div className="flex justify-between border-t border-gray-200 pt-2">
                <dt className="font-bold text-gray-900">الإجمالي التقديري</dt>
                <dd className="text-lg font-black text-[#ff5c00]">
                  {formatMoney(totalEstimate)} د.م
                </dd>
              </div>
            </dl>

            <div className="mt-3 rounded-lg bg-blue-50 p-2 text-[11px] text-blue-900">
              <AlertCircle className="inline h-3 w-3" /> سيتم إنشاء طلب منفصل
              لكل مورد. الأسعار نهائية عند الإنشاء.
            </div>

            <Button
              fullWidth
              className="mt-3"
              onClick={handleSubmit}
              loading={submitting}
              disabled={buyerBUs.length === 0}
              iconLeft={
                !submitting ? <ShoppingCart className="h-4 w-4" /> : undefined
              }
            >
              تأكيد الطلب
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
}