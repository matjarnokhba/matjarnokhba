"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  ArrowLeft,
  Check,
  Building2,
  Package,
  AlertCircle,
  Loader2,
  Plus,
  Tag,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/ui/PageHeader";
import { useToast } from "@/lib/hooks/useToast";
import { cn } from "@/lib/ui/cn";
import { CLAIM_TYPE_LABEL, BU_TYPE_LABEL } from "./types";

type Step = 1 | 2 | 3;

type BUProp = {
  id: number;
  name: string;
  type: string;
  capabilities: string[];
  verificationStatus: string;
};

type MasterProp = {
  id: number;
  name: string;
  brand: string | null;
  images: string[];
  barcode: string | null;
  categoryName: string;
  variantCount: number;
};

type MasterDetail = {
  id: number;
  name: string;
  brand: string | null;
  description: string | null;
  images: string[];
  variants: Array<{
    id: number;
    sku: string | null;
    barcode: string | null;
    attributes: Array<{ name: string; value: string }>;
    isDefault: boolean;
  }>;
};

const CLAIM_OPTIONS = [
  {
    value: "MANUFACTURER" as const,
    label: "مصنّع",
    desc: "أنت المصنّع الفعلي للمنتج",
  },
  {
    value: "DISTRIBUTOR" as const,
    label: "موزع معتمد",
    desc: "موزع معتمد من المصنع",
  },
  {
    value: "IMPORTER" as const,
    label: "مستورد",
    desc: "استوردت المنتج بنفسك",
  },
  {
    value: "RESELLER" as const,
    label: "بائع تجزئة",
    desc: "بائع تجزئة يبيع بالجملة",
  },
];

export interface CreateOfferWizardProps {
  businessUnits: BUProp[];
  masters: MasterProp[];
  initialBusinessUnitId: string;
}

export function CreateOfferWizard({
  businessUnits,
  masters,
  initialBusinessUnitId,
}: CreateOfferWizardProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [step, setStep] = useState<Step>(1);
  const [submitting, setSubmitting] = useState(false);

  // Step 1: BU + Master
  const [buId, setBuId] = useState(
    initialBusinessUnitId || (businessUnits[0]?.id?.toString() ?? "")
  );
  const [masterId, setMasterId] = useState("");

  // Step 2: Pricing
  const [wholesalePrice, setWholesalePrice] = useState("");
  const [minOrderQty, setMinOrderQty] = useState("10");
  const [maxOrderQty, setMaxOrderQty] = useState("");

  // Step 3: Claim + notes
  const [claimType, setClaimType] = useState<string>("MANUFACTURER");
  const [claimProofUrl, setClaimProofUrl] = useState("");
  const [claimNotes, setClaimNotes] = useState("");
  const [notes, setNotes] = useState("");

  // Master detail
  const [masterDetail, setMasterDetail] = useState<MasterDetail | null>(null);
  const [loadingMaster, setLoadingMaster] = useState(false);

  // Auto-pick BU if only one
  useEffect(() => {
    if (!buId && businessUnits.length === 1) {
      setBuId(String(businessUnits[0].id));
    }
  }, [buId, businessUnits]);

  // Fetch master details
  useEffect(() => {
    if (!masterId) {
      setMasterDetail(null);
      return;
    }
    setLoadingMaster(true);
    (async () => {
      try {
        const res = await fetch(
          `/api/wholesale/master-products/${masterId}`
        );
        const data = await res.json();
        if (data.success && data.master) {
          setMasterDetail({
            id: data.master.id,
            name: data.master.name,
            brand: data.master.brand,
            description: data.master.description,
            images: data.master.images as string[],
            variants: data.master.variants.map((v: any) => ({
              id: v.id,
              sku: v.sku,
              barcode: v.barcode,
              attributes:
                (v.attributes as Array<{ name: string; value: string }>) ?? [],
              isDefault: v.isDefault,
            })),
          });
        }
      } catch {
        toast("فشل تحميل المنتج", "error");
      } finally {
        setLoadingMaster(false);
      }
    })();
  }, [masterId, toast]);

  // Validation
  const step1Valid = !!buId && !!masterId;
  const wholesalePriceNum = parseFloat(wholesalePrice);
  const minOrderQtyNum = parseInt(minOrderQty, 10);
  const maxOrderQtyNum = maxOrderQty ? parseInt(maxOrderQty, 10) : null;
  const step2Valid =
    !isNaN(wholesalePriceNum) &&
    wholesalePriceNum > 0 &&
    !isNaN(minOrderQtyNum) &&
    minOrderQtyNum >= 1 &&
    (maxOrderQty === "" ||
      (!isNaN(maxOrderQtyNum as number) &&
        (maxOrderQtyNum as number) >= minOrderQtyNum));
  const step3Valid = !!claimType;

  const selectedBU = businessUnits.find((b) => String(b.id) === buId);
  const selectedMaster = masters.find((m) => String(m.id) === masterId);

  const handleSubmit = async () => {
    if (submitting) return;
    if (!step1Valid || !step2Valid || !step3Valid) {
      toast("يرجى إكمال جميع الخطوات", "warning");
      return;
    }
    if (!masterDetail || masterDetail.variants.length === 0) {
      toast("المنتج قيد التحميل، انتظر قليلًا", "warning");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        masterId: parseInt(masterId, 10),
        wholesalePrice: wholesalePriceNum,
        minOrderQty: minOrderQtyNum,
        maxOrderQty: maxOrderQtyNum,
        claimType,
        claimProofUrl: claimProofUrl.trim() || null,
        claimNotes: claimNotes.trim() || null,
        notes: notes.trim() || null,
        variants: masterDetail.variants.map((v) => ({
          masterVariantId: v.id,
          tiers: [
            {
              minQty: minOrderQtyNum,
              maxQty: maxOrderQtyNum,
              unitPrice: wholesalePriceNum,
            },
          ],
        })),
      };

      const res = await fetch(
        `/api/wholesale/business-units/${buId}/offers`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": crypto.randomUUID(),
          },
          body: JSON.stringify(payload),
        }
      );

      const data = await res.json();
      if (!res.ok || !data.success) {
        toast(data.message || "فشل إنشاء العرض", "error");
        return;
      }

      toast("تم إنشاء العرض بنجاح", "success");
      router.push(`/wholesale/offers/${data.offerId}`);
    } catch {
      toast("حدث خطأ في الاتصال", "error");
    } finally {
      setSubmitting(false);
    }
  };

  // ═══ Guard: no BUs ═══
  if (businessUnits.length === 0) {
    return (
      <div className="mx-auto max-w-2xl space-y-5">
        <PageHeader
          title="إضافة عرض جملة جديد"
          breadcrumbs={
            <Link
              href="/wholesale/offers"
              className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-[#ff5c00]"
            >
              <ArrowRight className="h-4 w-4" />
              العودة للعروض
            </Link>
          }
        />
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center">
          <Building2 className="mx-auto mb-3 h-10 w-10 text-amber-600" />
          <h3 className="text-base font-bold text-amber-900">
            لا يوجد نشاط مؤهل لبيع الجملة
          </h3>
          <p className="mt-1 text-sm text-amber-800">
            أنشئ نشاطًا تجاريًا بصلاحية "بيع بالجملة" أولًا، أو أضف هذه
            الصلاحية لنشاط موجود.
          </p>
          <div className="mt-4">
            <Link href="/wholesale/business-units/new">
              <Button>إنشاء نشاط تجاري</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <PageHeader
        title="إضافة عرض جملة جديد"
        description="اعرض منتجًا أصليًا للتجار الموثقين — يمكنك تعديل السعر والكميات لاحقًا"
        breadcrumbs={
          <Link
            href="/wholesale/offers"
            className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-[#ff5c00]"
          >
            <ArrowRight className="h-4 w-4" />
            العودة للعروض
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
                {n === 1 && "الاختيار"}
                {n === 2 && "التسعير"}
                {n === 3 && "المطالبة والمراجعة"}
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

      {/* ═══ Step 1: BU + Master ═══ */}
      {step === 1 && (
        <>
          <Card>
            <h2 className="mb-1 text-lg font-bold text-gray-900">
              النشاط التجاري
            </h2>
            <p className="mb-4 text-sm text-gray-500">
              اختر النشاط الذي سيعرض المنتج بالجملة
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {businessUnits.map((b) => {
                const selected = buId === String(b.id);
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setBuId(String(b.id))}
                    className={cn(
                      "rounded-lg border-2 p-3 text-right transition-all",
                      selected
                        ? "border-[#ff5c00] bg-orange-50"
                        : "border-gray-200 hover:border-gray-300"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Building2
                        className={cn(
                          "h-4 w-4",
                          selected ? "text-[#ff5c00]" : "text-gray-400"
                        )}
                      />
                      <span className="flex-1 font-bold text-gray-900">
                        {b.name}
                      </span>
                      {selected && (
                        <Check className="h-4 w-4 text-[#ff5c00]" />
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1">
                      <span className="text-xs text-gray-500">
                        {BU_TYPE_LABEL[b.type] ?? b.type}
                      </span>
                      {b.verificationStatus === "VERIFIED" && (
                        <Badge variant="green" size="sm">
                          موثق
                        </Badge>
                      )}
                      {b.verificationStatus === "PENDING" && (
                        <Badge variant="yellow" size="sm">
                          قيد التحقق
                        </Badge>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </Card>

          {buId && (
            <Card>
              <h2 className="mb-1 text-lg font-bold text-gray-900">
                المنتج الأصلي
              </h2>
              <p className="mb-4 text-sm text-gray-500">
                اختر منتجًا من منتجاتك المعتمدة (ACTIVE فقط)
              </p>

              {masters.length === 0 ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                  <p className="flex items-center gap-2 font-semibold text-amber-900">
                    <AlertCircle className="h-4 w-4" />
                    لا توجد منتجات معتمدة
                  </p>
                  <p className="mt-1 text-sm text-amber-800">
                    أضف منتجًا أصليًا وانتظر اعتماده من فريق المراجعة قبل
                    إنشاء عرض جملة.
                  </p>
                  <div className="mt-3">
                    <Link href="/wholesale/master-products/new">
                      <Button size="sm" iconLeft={<Plus className="h-4 w-4" />}>
                        إضافة منتج أصلي
                      </Button>
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {masters.map((m) => {
                    const selected = masterId === String(m.id);
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setMasterId(String(m.id))}
                        className={cn(
                          "flex items-center gap-3 rounded-lg border-2 p-2 text-right transition-all",
                          selected
                            ? "border-[#ff5c00] bg-orange-50"
                            : "border-gray-200 hover:border-gray-300"
                        )}
                      >
                        <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg bg-gray-50">
                          {m.images[0] ? (
                            <img
                              src={m.images[0]}
                              alt={m.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center">
                              <Package className="h-6 w-6 text-gray-300" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="truncate text-sm font-bold text-gray-900">
                            {m.name}
                          </p>
                          <p className="truncate text-xs text-gray-500">
                            {m.brand || "—"} · {m.variantCount} متغير
                          </p>
                        </div>
                        {selected && (
                          <Check className="h-4 w-4 flex-shrink-0 text-[#ff5c00]" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </Card>
          )}

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

      {/* ═══ Step 2: Pricing ═══ */}
      {step === 2 && (
        <>
          <Card>
            <h2 className="mb-1 text-lg font-bold text-gray-900">
              الأسعار والكميات
            </h2>
            <p className="mb-4 text-sm text-gray-500">
              سيُطبق نفس السعر والكميات على كل متغيرات المنتج
            </p>

            <div className="grid gap-4 sm:grid-cols-3">
              <Input
                label="سعر الجملة (د.م/قطعة)"
                type="number"
                min="0.01"
                step="0.01"
                value={wholesalePrice}
                onChange={(e) => setWholesalePrice(e.target.value)}
                placeholder="50"
                required
              />
              <Input
                label="الحد الأدنى للطلب"
                type="number"
                min="1"
                value={minOrderQty}
                onChange={(e) => setMinOrderQty(e.target.value)}
                required
              />
              <Input
                label="الحد الأقصى (اختياري)"
                type="number"
                min="1"
                value={maxOrderQty}
                onChange={(e) => setMaxOrderQty(e.target.value)}
                placeholder="بلا حد"
                hint="اتركه فارغًا لبلا حد"
              />
            </div>

            <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">
              <AlertCircle className="inline h-3.5 w-3.5" />
              <span className="mr-1">
                يمكنك إضافة شرائح أسعار متعددة (خصومات على الكميات) لاحقًا
                من صفحة العرض بعد الإنشاء.
              </span>
            </div>
          </Card>

          {loadingMaster && (
            <Card>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                جارٍ تحميل المتغيرات...
              </div>
            </Card>
          )}

          {masterDetail && !loadingMaster && (
            <Card>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-900">
                  معاينة المتغيرات ({masterDetail.variants.length})
                </h3>
                <Badge variant="gray">
                  <Tag className="h-3 w-3" />
                  {masterDetail.name}
                </Badge>
              </div>
              <div className="space-y-1.5">
                {masterDetail.variants.map((v, i) => (
                  <div
                    key={v.id}
                    className="flex items-center justify-between rounded bg-gray-50 px-3 py-2 text-xs"
                  >
                    <div className="flex flex-wrap items-center gap-1">
                      <span className="text-gray-400">#{i + 1}</span>
                      {v.attributes.length === 0 ? (
                        <span className="text-gray-500">افتراضي</span>
                      ) : (
                        v.attributes.map((a, ai) => (
                          <span
                            key={ai}
                            className="rounded bg-white px-1.5 py-0.5"
                          >
                            {a.name}: {a.value}
                          </span>
                        ))
                      )}
                    </div>
                    <span className="font-mono text-gray-400">
                      {v.sku || "—"}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}

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

      {/* ═══ Step 3: Claim + Review ═══ */}
      {step === 3 && (
        <>
          <Card>
            <h2 className="mb-1 text-lg font-bold text-gray-900">
              المطالبة
            </h2>
            <p className="mb-4 text-sm text-gray-500">
              ما علاقتك بالمنتج؟ يُساعد التجار على الثقة بك.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {CLAIM_OPTIONS.map((c) => {
                const selected = claimType === c.value;
                return (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setClaimType(c.value)}
                    className={cn(
                      "rounded-lg border-2 p-3 text-right transition-all",
                      selected
                        ? "border-[#ff5c00] bg-orange-50"
                        : "border-gray-200 hover:border-gray-300"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className="flex-1 font-bold text-gray-900">
                        {c.label}
                      </span>
                      {selected && (
                        <Check className="h-4 w-4 text-[#ff5c00]" />
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-gray-500">{c.desc}</p>
                  </button>
                );
              })}
            </div>

            <div className="mt-4 space-y-3">
              <Input
                label="رابط إثبات المطالبة (اختياري)"
                placeholder="https://example.com/proof.pdf"
                value={claimProofUrl}
                onChange={(e) => setClaimProofUrl(e.target.value)}
                hint="شهادة المصنع، صورة المنتج، أو أي إثبات"
              />
              <Textarea
                label="ملاحظات المطالبة (اختياري)"
                value={claimNotes}
                onChange={(e) => setClaimNotes(e.target.value)}
                rows={2}
                maxLength={2000}
              />
              <Textarea
                label="ملاحظات عامة على العرض (اختياري)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                maxLength={2000}
                hint="ستظهر للتجار في صفحة العرض"
              />
            </div>
          </Card>

          <Card>
            <h2 className="mb-3 text-lg font-bold text-gray-900">المراجعة</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                <dt className="text-gray-500">النشاط التجاري</dt>
                <dd className="font-medium text-gray-900">
                  {selectedBU?.name}
                </dd>
              </div>
              <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                <dt className="text-gray-500">المنتج الأصلي</dt>
                <dd className="font-medium text-gray-900">
                  {selectedMaster?.name}
                </dd>
              </div>
              <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                <dt className="text-gray-500">سعر الجملة</dt>
                <dd className="font-bold text-[#ff5c00]">
                  {wholesalePriceNum} د.م/قطعة
                </dd>
              </div>
              <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                <dt className="text-gray-500">الحد الأدنى للطلب</dt>
                <dd className="text-gray-900">{minOrderQtyNum} قطعة</dd>
              </div>
              {maxOrderQtyNum && (
                <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                  <dt className="text-gray-500">الحد الأقصى</dt>
                  <dd className="text-gray-900">{maxOrderQtyNum} قطعة</dd>
                </div>
              )}
              <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                <dt className="text-gray-500">نوع المطالبة</dt>
                <dd className="text-gray-900">
                  {CLAIM_TYPE_LABEL[claimType] ?? claimType}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-gray-500">عدد المتغيرات</dt>
                <dd className="text-gray-900">
                  {masterDetail?.variants.length ?? 0}
                </dd>
              </div>
            </dl>

            <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">
              <AlertCircle className="inline h-3.5 w-3.5" />
              <span className="mr-1">
                قد يحتاج العرض لمراجعة من فريقنا قبل النشر (حسب مستوى توثيق
                نشاطك). ستصلك إشعار عند الاعتماد.
              </span>
            </div>
          </Card>

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
              disabled={!step3Valid || !masterDetail}
              iconRight={
                !submitting ? <Check className="h-4 w-4" /> : undefined
              }
            >
              إنشاء العرض
            </Button>
          </div>
        </>
      )}
    </div>
  );
}