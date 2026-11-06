"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  ArrowLeft,
  Check,
  RotateCcw,
  AlertCircle,
  Package,
  Building2,
  Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/ui/PageHeader";
import { useToast } from "@/lib/hooks/useToast";
import { cn } from "@/lib/ui/cn";
import {
  BU_TYPE_LABEL,
  formatDate,
  formatMoney,
} from "./types";

type Step = 1 | 2 | 3;

type BUOption = {
  id: number;
  name: string;
  type: string;
};

type OrderItem = {
  id: number;
  productName: string;
  variantAttributes: Array<{ name: string; value: string }>;
  unitPrice: number;
  quantity: number;
  quantityRemaining: number;
};

type OrderOption = {
  id: number;
  orderNumber: string;
  sellerBusinessUnitId: number;
  sellerName: string;
  sellerType: string;
  total: number;
  deliveredAt: string | null;
  hasActiveReturn: boolean;
  items: OrderItem[];
};

export interface CreateReturnWizardProps {
  businessUnits: BUOption[];
  orders: OrderOption[];
  initialOrderId: string;
}

export function CreateReturnWizard({
  businessUnits,
  orders,
  initialOrderId,
}: CreateReturnWizardProps) {
  const router = useRouter();
  const { toast } = useToast();

  const initialOrder = initialOrderId
    ? orders.find((o) => String(o.id) === initialOrderId)
    : null;

  const [step, setStep] = useState<Step>(initialOrder ? 2 : 1);
  const [submitting, setSubmitting] = useState(false);

  // Step 1
  const [buId, setBuId] = useState(
    initialOrder
      ? String(
          businessUnits.find(
            (b) =>
              b.id ===
              (orders.find((o) => o.id === initialOrder.id)?.sellerBusinessUnitId
                ? businessUnits[0].id
                : businessUnits[0].id)
          )?.id ?? businessUnits[0]?.id ?? ""
        )
      : businessUnits[0]?.id?.toString() ?? ""
  );
  const [orderId, setOrderId] = useState<string>(
    initialOrder ? String(initialOrder.id) : ""
  );

  // Step 2
  const [quantities, setQuantities] = useState<Record<number, string>>({});
  const [reason, setReason] = useState("");

  // Filter orders by BU (buyer BU — need to fetch order → buyer BU mapping)
  // Since server doesn't send buyerBusinessUnitId, let's add it
  // Actually — orders are filtered by user's BUs on server, so all shown
  // Simplify: don't filter by BU in client; server already filtered

  // Selected order
  const selectedOrder = orders.find((o) => String(o.id) === orderId);

  // Initialize quantities when order selected
  useEffect(() => {
    if (selectedOrder) {
      const initial: Record<number, string> = {};
      for (const item of selectedOrder.items) {
        initial[item.id] = String(item.quantityRemaining);
      }
      setQuantities(initial);
    }
  }, [selectedOrder?.id]);

  // Computed totals
  const totalRequestedQty = useMemo(() => {
    if (!selectedOrder) return 0;
    let sum = 0;
    for (const item of selectedOrder.items) {
      const qty = parseInt(quantities[item.id] ?? "0", 10);
      if (!isNaN(qty) && qty > 0) sum += qty;
    }
    return sum;
  }, [selectedOrder, quantities]);

  const expectedRefund = useMemo(() => {
    if (!selectedOrder) return 0;
    let sum = 0;
    for (const item of selectedOrder.items) {
      const qty = parseInt(quantities[item.id] ?? "0", 10);
      if (!isNaN(qty) && qty > 0) sum += qty * item.unitPrice;
    }
    return Math.round(sum * 100) / 100;
  }, [selectedOrder, quantities]);

  // Validation
  const step1Valid = !!selectedOrder && !selectedOrder.hasActiveReturn;
  const step2Valid = totalRequestedQty > 0 && reason.trim().length >= 3;
  const step3Valid = step2Valid;

  const handleSubmit = async () => {
    if (submitting || !selectedOrder) return;

    // Validate each quantity
    const items: Array<{
      originalOrderItemId: number;
      quantityRequested: number;
    }> = [];
    for (const item of selectedOrder.items) {
      const raw = quantities[item.id] ?? "0";
      const qty = parseInt(raw, 10);
      if (isNaN(qty) || qty < 0) {
        toast(`كمية غير صحيحة للبند "${item.productName}"`, "warning");
        return;
      }
      if (qty > item.quantityRemaining) {
        toast(
          `الكمية (${qty}) تتجاوز المتبقي (${item.quantityRemaining}) للبند "${item.productName}"`,
          "warning"
        );
        return;
      }
      if (qty > 0) {
        items.push({
          originalOrderItemId: item.id,
          quantityRequested: qty,
        });
      }
    }

    if (items.length === 0) {
      toast("اختر كمية واحدة على الأقل", "warning");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/wholesale/returns", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify({
          orderId: selectedOrder.id,
          reason: reason.trim(),
          expectedRefundAmount: expectedRefund,
          items,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        toast(data.message || "فشل إنشاء طلب الإرجاع", "error");
        return;
      }

      toast("تم إرسال طلب الإرجاع بنجاح", "success");
      router.push(`/wholesale/returns/${data.returnId}`);
    } catch {
      toast("حدث خطأ في الاتصال", "error");
    } finally {
      setSubmitting(false);
    }
  };

  // Guard: no BUs
  if (businessUnits.length === 0) {
    return (
      <div className="mx-auto max-w-2xl space-y-5">
        <PageHeader
          title="طلب إرجاع جديد"
          breadcrumbs={
            <Link
              href="/wholesale/returns"
              className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-[#ff5c00]"
            >
              <ArrowRight className="h-4 w-4" />
              العودة للمرتجعات
            </Link>
          }
        />
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center">
          <Building2 className="mx-auto mb-3 h-10 w-10 text-amber-600" />
          <h3 className="text-base font-bold text-amber-900">
            لا توجد أنشطة تجارية
          </h3>
          <p className="mt-1 text-sm text-amber-800">
            أنشئ نشاطًا تجاريًا أولًا لتتمكن من طلب إرجاع.
          </p>
        </div>
      </div>
    );
  }

  // Guard: no returnable orders
  if (orders.length === 0) {
    return (
      <div className="mx-auto max-w-2xl space-y-5">
        <PageHeader
          title="طلب إرجاع جديد"
          breadcrumbs={
            <Link
              href="/wholesale/returns"
              className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-[#ff5c00]"
            >
              <ArrowRight className="h-4 w-4" />
              العودة للمرتجعات
            </Link>
          }
        />
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-6 text-center">
          <RotateCcw className="mx-auto mb-3 h-10 w-10 text-blue-600" />
          <h3 className="text-base font-bold text-blue-900">
            لا توجد طلبات قابلة للإرجاع
          </h3>
          <p className="mt-1 text-sm text-blue-800">
            يمكنك الإرجاع فقط من الطلبات المستلمة (DELIVERED) مع وجود منتجات
            متبقية لم تُرجع بعد.
          </p>
          <div className="mt-4">
            <Link href="/wholesale/orders">
              <Button variant="outline">عرض طلباتي</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <PageHeader
        title="طلب إرجاع جديد"
        description="اختر الطلب والمنتجات، وحدد السبب"
        breadcrumbs={
          <Link
            href="/wholesale/returns"
            className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-[#ff5c00]"
          >
            <ArrowRight className="h-4 w-4" />
            العودة للمرتجعات
          </Link>
        }
      />

      {/* Progress */}
      <div className="flex items-center gap-2">
        {[1, 2, 3].map((n) => {
          const isDone = step > n;
          const isActive = step === n;
          return (
            <div key={n} className="flex flex-1 items-center gap-2">
              <div
                className={cn(
                  "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold",
                  isDone || isActive
                    ? "bg-[#ff5c00] text-white"
                    : "bg-gray-200 text-gray-500"
                )}
              >
                {isDone ? <Check className="h-4 w-4" /> : n}
              </div>
              <span
                className={cn(
                  "hidden text-xs sm:block",
                  isActive ? "font-semibold text-gray-900" : "text-gray-500"
                )}
              >
                {n === 1 && "اختيار الطلب"}
                {n === 2 && "المنتجات والكميات"}
                {n === 3 && "المراجعة"}
              </span>
              {n < 3 && (
                <div className="h-0.5 flex-1 bg-gray-200">
                  <div
                    className={cn(
                      "h-full bg-[#ff5c00] transition-all",
                      step > n ? "w-full" : "w-0"
                    )}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Step 1: Order */}
      {step === 1 && (
        <>
          <Card>
            <h2 className="mb-1 text-lg font-bold text-gray-900">
              اختر الطلب
            </h2>
            <p className="mb-4 text-sm text-gray-500">
              فقط الطلبات المستلمة ذات البنود المتبقية
            </p>

            <div className="space-y-2">
              {orders.map((o) => {
                const selected = orderId === String(o.id);
                const disabled = o.hasActiveReturn;
                return (
                  <button
                    key={o.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                      if (disabled) return;
                      setOrderId(String(o.id));
                    }}
                    className={cn(
                      "w-full rounded-lg border-2 p-3 text-right transition-all",
                      disabled
                        ? "cursor-not-allowed border-gray-200 bg-gray-50 opacity-60"
                        : selected
                        ? "border-[#ff5c00] bg-orange-50"
                        : "border-gray-200 hover:border-gray-300"
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-bold text-gray-900">
                            {o.orderNumber}
                          </span>
                          {o.hasActiveReturn && (
                            <Badge variant="yellow" size="sm">
                              <AlertCircle className="h-3 w-3" />
                              إرجاع نشط
                            </Badge>
                          )}
                          {selected && !disabled && (
                            <Check className="h-4 w-4 text-[#ff5c00]" />
                          )}
                        </div>
                        <p className="mt-1 text-sm text-gray-700">
                          البائع: {o.sellerName}{" "}
                          {o.sellerType && `(${BU_TYPE_LABEL[o.sellerType]})`}
                        </p>
                        {o.deliveredAt && (
                          <p className="mt-0.5 flex items-center gap-1 text-xs text-gray-500">
                            <Calendar className="h-3 w-3" />
                            استُلم في {formatDate(o.deliveredAt)}
                          </p>
                        )}
                        <p className="mt-1 text-xs text-gray-500">
                          {o.items.length} بند قابل للإرجاع ·{" "}
                          {formatMoney(o.total)} د.م
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </Card>

          <div className="flex justify-end">
            <Button
              onClick={() => setStep(2)}
              disabled={!step1Valid}
              iconRight={<ArrowLeft className="h-4 w-4" />}
            >
              التالي
            </Button>
          </div>
        </>
      )}

      {/* Step 2: Quantities + reason */}
      {step === 2 && selectedOrder && (
        <>
          <Card>
            <h2 className="mb-1 text-lg font-bold text-gray-900">
              المنتجات والكميات
            </h2>
            <p className="mb-4 text-sm text-gray-500">
              حدد كمية كل منتج تريد إرجاعه
            </p>

            <div className="space-y-3">
              {selectedOrder.items.map((item) => {
                const qty = parseInt(quantities[item.id] ?? "0", 10);
                const lineTotal = (!isNaN(qty) ? qty : 0) * item.unitPrice;
                return (
                  <div
                    key={item.id}
                    className="rounded-lg border border-gray-200 p-3"
                  >
                    <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900">
                          {item.productName}
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
                        <p className="mt-1 text-xs text-gray-500">
                          {formatMoney(item.unitPrice)} د.م/قطعة · المتبقي:{" "}
                          {item.quantityRemaining}
                        </p>
                      </div>
                      <div className="text-right">
                        {lineTotal > 0 && (
                          <p className="text-xs font-bold text-[#ff5c00]">
                            {formatMoney(lineTotal)} د.م
                          </p>
                        )}
                      </div>
                    </div>
                    <Input
                      type="number"
                      min="0"
                      max={String(item.quantityRemaining)}
                      value={quantities[item.id] ?? ""}
                      onChange={(e) =>
                        setQuantities({
                          ...quantities,
                          [item.id]: e.target.value,
                        })
                      }
                      hint={`الحد الأقصى: ${item.quantityRemaining}`}
                    />
                  </div>
                );
              })}
            </div>
          </Card>

          <Card>
            <h3 className="mb-3 text-sm font-bold text-gray-900">
              سبب الإرجاع
            </h3>
            <Textarea
              placeholder="اشرح سبب الإرجاع (مطلوب، 3 أحرف على الأقل)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              maxLength={500}
              hint={`${reason.length}/500`}
              required
            />
          </Card>

          <div className="flex justify-between gap-2">
            <Button
              variant="outline"
              onClick={() => setStep(1)}
              iconLeft={<ArrowRight className="h-4 w-4" />}
            >
              السابق
            </Button>
            <Button
              onClick={() => setStep(3)}
              disabled={!step2Valid}
              iconRight={<ArrowLeft className="h-4 w-4" />}
            >
              التالي
            </Button>
          </div>
        </>
      )}

      {/* Step 3: Review */}
      {step === 3 && selectedOrder && (
        <>
          <Card>
            <h2 className="mb-3 text-lg font-bold text-gray-900">المراجعة</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between border-b border-gray-100 pb-2">
                <dt className="text-gray-500">الطلب</dt>
                <dd className="font-mono font-medium text-gray-900">
                  {selectedOrder.orderNumber}
                </dd>
              </div>
              <div className="flex justify-between border-b border-gray-100 pb-2">
                <dt className="text-gray-500">البائع</dt>
                <dd className="font-medium text-gray-900">
                  {selectedOrder.sellerName}
                </dd>
              </div>
              <div className="flex justify-between border-b border-gray-100 pb-2">
                <dt className="text-gray-500">إجمالي القطع المطلوب إرجاعها</dt>
                <dd className="font-bold text-gray-900">
                  {totalRequestedQty}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">المبلغ المتوقع</dt>
                <dd className="text-lg font-black text-[#ff5c00]">
                  {formatMoney(expectedRefund)} د.م
                </dd>
              </div>
            </dl>
          </Card>

          <Card>
            <h3 className="mb-2 text-sm font-bold text-gray-900">
              المنتجات
            </h3>
            <div className="space-y-1">
              {selectedOrder.items
                .filter((i) => parseInt(quantities[i.id] ?? "0", 10) > 0)
                .map((item) => {
                  const qty = parseInt(quantities[item.id] ?? "0", 10);
                  return (
                    <div
                      key={item.id}
                      className="flex items-center justify-between rounded bg-gray-50 px-3 py-2 text-xs"
                    >
                      <span className="text-gray-900">{item.productName}</span>
                      <span className="font-bold text-gray-700">
                        {qty} × {formatMoney(item.unitPrice)} ={" "}
                        {formatMoney(qty * item.unitPrice)} د.م
                      </span>
                    </div>
                  );
                })}
            </div>
          </Card>

          <Card>
            <h3 className="mb-2 text-sm font-bold text-gray-900">السبب</h3>
            <p className="whitespace-pre-wrap text-sm text-gray-700">
              {reason}
            </p>
          </Card>

          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">
            <AlertCircle className="inline h-3.5 w-3.5" /> سيُرسل الطلب للبائع
            للمراجعة. عند القبول، ستُرسل المنتجات ثم تُفحص قبل الاسترداد.
          </div>

          <div className="flex justify-between gap-2">
            <Button
              variant="outline"
              onClick={() => setStep(2)}
              iconLeft={<ArrowRight className="h-4 w-4" />}
              disabled={submitting}
            >
              السابق
            </Button>
            <Button
              onClick={handleSubmit}
              loading={submitting}
              disabled={!step3Valid}
              iconRight={
                !submitting ? <Check className="h-4 w-4" /> : undefined
              }
            >
              إرسال طلب الإرجاع
            </Button>
          </div>
        </>
      )}
    </div>
  );
}