"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Factory,
  Globe2,
  Briefcase,
  Package,
  ArrowRight,
  ArrowLeft,
  Check,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { PageHeader } from "@/components/ui/PageHeader";
import { useToast } from "@/lib/hooks/useToast";
import { cn } from "@/lib/ui/cn";

type BusinessType = "FACTORY" | "IMPORTER" | "WHOLESALER" | "DISTRIBUTOR";
type Capability = "RETAIL" | "WHOLESALE_BUY" | "WHOLESALE_SELL";

const TYPES: Array<{
  value: BusinessType;
  label: string;
  description: string;
  icon: typeof Factory;
  defaultCapabilities: Capability[];
}> = [
  {
    value: "FACTORY",
    label: "مصنع",
    description: "أنت مصنّع للمنتج وتعرضه للبيع بالجملة للتجار",
    icon: Factory,
    defaultCapabilities: ["WHOLESALE_SELL"],
  },
  {
    value: "IMPORTER",
    label: "مستورد",
    description: "تستورد منتجات من الخارج وتبيعها بالجملة",
    icon: Globe2,
    defaultCapabilities: ["WHOLESALE_SELL"],
  },
  {
    value: "WHOLESALER",
    label: "شركة / تاجر جملة",
    description: "شركة توزيع أو تاجر جملة يبيع للتجار",
    icon: Briefcase,
    defaultCapabilities: ["WHOLESALE_SELL"],
  },
  {
    value: "DISTRIBUTOR",
    label: "موزع",
    description: "موزع معتمد لمنتجات مصانع وشركات",
    icon: Package,
    defaultCapabilities: ["WHOLESALE_SELL"],
  },
];

const CAPABILITIES: Array<{
  value: Capability;
  label: string;
  description: string;
}> = [
  {
    value: "WHOLESALE_SELL",
    label: "بيع بالجملة",
    description: "اعرض منتجاتك للتجار",
  },
  {
    value: "WHOLESALE_BUY",
    label: "شراء بالجملة",
    description: "اشترِ من تجار الجملة",
  },
  {
    value: "RETAIL",
    label: "بيع بالتجزئة",
    description: "افتح متجر إلكتروني للعملاء",
  },
];

export default function NewBusinessUnitPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [step, setStep] = useState<1 | 2>(1);
  const [submitting, setSubmitting] = useState(false);

  // Step 1
  const [type, setType] = useState<BusinessType>("FACTORY");
  const [name, setName] = useState("");

  // Step 2
  const [capabilities, setCapabilities] = useState<Capability[]>([
    "WHOLESALE_SELL",
  ]);
  const [description, setDescription] = useState("");
  const [legalEntity, setLegalEntity] = useState({
    name: "",
    registrationNumber: "",
    taxId: "",
  });
  const [showLegal, setShowLegal] = useState(false);

  const handleSelectType = (t: BusinessType) => {
    setType(t);
    const def = TYPES.find((x) => x.value === t)?.defaultCapabilities ?? [
      "WHOLESALE_SELL",
    ];
    setCapabilities(def);
  };

  const toggleCapability = (cap: Capability) => {
    setCapabilities((prev) =>
      prev.includes(cap) ? prev.filter((c) => c !== cap) : [...prev, cap]
    );
  };

  const canGoNext = name.trim().length >= 2;
  const canSubmit = capabilities.length > 0;

  const handleSubmit = async () => {
    if (!canSubmit || submitting) return;

    setSubmitting(true);
    try {
      const idempotencyKey =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

      const body: Record<string, any> = {
        name: name.trim(),
        type,
        capabilities,
      };
      if (description.trim()) body.description = description.trim();

      if (
        showLegal &&
        (legalEntity.name.trim() ||
          legalEntity.registrationNumber.trim() ||
          legalEntity.taxId.trim())
      ) {
        body.legalEntity = {
          name: legalEntity.name.trim() || name.trim(),
          ...(legalEntity.registrationNumber.trim()
            ? { registrationNumber: legalEntity.registrationNumber.trim() }
            : {}),
          ...(legalEntity.taxId.trim()
            ? { taxId: legalEntity.taxId.trim() }
            : {}),
        };
      }

      const res = await fetch("/api/wholesale/business-units", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        toast(data.message || "تعذّر إنشاء النشاط التجاري", "error");
        return;
      }

      toast("تم إنشاء النشاط التجاري بنجاح", "success");
      router.push(`/wholesale/business-units/${data.businessUnitId}`);
    } catch (err) {
      toast("حدث خطأ في الاتصال", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="إضافة نشاط تجاري جديد"
        description="خطوتان فقط لإنشاء نشاطك"
        breadcrumbs={
          <Link
            href="/wholesale"
            className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-[#ff5c00]"
          >
            <ArrowRight className="h-4 w-4" />
            العودة للرئيسية
          </Link>
        }
      />

      {/* Progress */}
      <div className="flex items-center gap-2">
        <div
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold",
            step >= 1 ? "bg-[#ff5c00] text-white" : "bg-gray-200 text-gray-500"
          )}
        >
          {step > 1 ? <Check className="h-4 w-4" /> : "1"}
        </div>
        <div className="h-1 flex-1 rounded bg-gray-200">
          <div
            className={cn(
              "h-full rounded bg-[#ff5c00] transition-all",
              step === 1 ? "w-0" : "w-full"
            )}
          />
        </div>
        <div
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold",
            step >= 2 ? "bg-[#ff5c00] text-white" : "bg-gray-200 text-gray-500"
          )}
        >
          2
        </div>
      </div>

      {/* Step 1 */}
      {step === 1 && (
        <Card>
          <h2 className="mb-1 text-lg font-bold text-gray-900">
            ما نوع نشاطك التجاري؟
          </h2>
          <p className="mb-5 text-sm text-gray-500">
            اختر النوع الذي يصف نشاطك بدقة.
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            {TYPES.map((t) => {
              const Icon = t.icon;
              const selected = type === t.value;
              return (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => handleSelectType(t.value)}
                  className={cn(
                    "rounded-lg border-2 p-4 text-right transition-all",
                    selected
                      ? "border-[#ff5c00] bg-orange-50"
                      : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                  )}
                >
                  <div className="mb-2 flex items-center gap-2">
                    <Icon
                      className={cn(
                        "h-5 w-5",
                        selected ? "text-[#ff5c00]" : "text-gray-400"
                      )}
                    />
                    <span className="font-bold text-gray-900">{t.label}</span>
                    {selected && (
                      <Check className="mr-auto h-4 w-4 text-[#ff5c00]" />
                    )}
                  </div>
                  <p className="text-xs text-gray-500">{t.description}</p>
                </button>
              );
            })}
          </div>

          <div className="mt-5">
            <Input
              label="اسم النشاط التجاري"
              placeholder="مثال: مصنع النور للملابس"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={200}
              required
              hint="الاسم الذي سيظهر للتجار في المنصة"
            />
          </div>

          <div className="mt-6 flex justify-end">
            <Button
              onClick={() => setStep(2)}
              disabled={!canGoNext}
              iconRight={<ArrowLeft className="h-4 w-4" />}
            >
              التالي
            </Button>
          </div>
        </Card>
      )}

      {/* Step 2 */}
      {step === 2 && (
        <>
          <Card>
            <h2 className="mb-1 text-lg font-bold text-gray-900">
              صلاحيات النشاط
            </h2>
            <p className="mb-4 text-sm text-gray-500">
              اختر ما يمكن لهذا النشاط القيام به على المنصة.
            </p>

            <div className="space-y-2">
              {CAPABILITIES.map((cap) => {
                const selected = capabilities.includes(cap.value);
                return (
                  <button
                    key={cap.value}
                    type="button"
                    onClick={() => toggleCapability(cap.value)}
                    className={cn(
                      "flex w-full items-center justify-between rounded-lg border-2 p-3 text-right transition-all",
                      selected
                        ? "border-[#ff5c00] bg-orange-50"
                        : "border-gray-200 hover:border-gray-300"
                    )}
                  >
                    <div>
                      <p className="font-semibold text-gray-900">{cap.label}</p>
                      <p className="text-xs text-gray-500">{cap.description}</p>
                    </div>
                    <div
                      className={cn(
                        "flex h-5 w-5 items-center justify-center rounded border-2",
                        selected
                          ? "border-[#ff5c00] bg-[#ff5c00]"
                          : "border-gray-300"
                      )}
                    >
                      {selected && <Check className="h-3 w-3 text-white" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </Card>

          <Card>
            <h2 className="mb-1 text-lg font-bold text-gray-900">
              تفاصيل إضافية
            </h2>
            <p className="mb-4 text-sm text-gray-500">
              اختياري — يمكنك إضافتها لاحقًا.
            </p>

            <Textarea
              label="وصف النشاط"
              placeholder="تعريف مختصر بنشاطك التجاري وما يميّزه"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={2000}
              rows={3}
            />

            <div className="mt-4">
              <button
                type="button"
                onClick={() => setShowLegal(!showLegal)}
                className="text-sm font-medium text-[#ff5c00] hover:underline"
              >
                {showLegal
                  ? "− إخفاء المعلومات القانونية"
                  : "+ إضافة معلومات قانونية (اختياري)"}
              </button>
            </div>

            {showLegal && (
              <div className="mt-3 space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
                <Input
                  label="الاسم القانوني للكيان"
                  placeholder="شركة النور ش.م.م"
                  value={legalEntity.name}
                  onChange={(e) =>
                    setLegalEntity({ ...legalEntity, name: e.target.value })
                  }
                />
                <Input
                  label="رقم السجل التجاري"
                  placeholder="123456789"
                  value={legalEntity.registrationNumber}
                  onChange={(e) =>
                    setLegalEntity({
                      ...legalEntity,
                      registrationNumber: e.target.value,
                    })
                  }
                  hint="يساعد على توثيق حسابك بشكل أسرع"
                />
                <Input
                  label="الرقم الضريبي (IF)"
                  placeholder="12345678"
                  value={legalEntity.taxId}
                  onChange={(e) =>
                    setLegalEntity({
                      ...legalEntity,
                      taxId: e.target.value,
                    })
                  }
                />
              </div>
            )}
          </Card>

          {!canSubmit && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <AlertCircle className="inline h-4 w-4" /> يجب اختيار صلاحية
              واحدة على الأقل.
            </div>
          )}

          <div className="flex justify-between gap-3">
            <Button
              variant="outline"
              onClick={() => setStep(1)}
              iconLeft={<ArrowRight className="h-4 w-4" />}
              disabled={submitting}
            >
              السابق
            </Button>
            <Button
              onClick={handleSubmit}
              loading={submitting}
              disabled={!canSubmit}
              iconRight={
                !submitting ? <Check className="h-4 w-4" /> : undefined
              }
            >
              إنشاء النشاط
            </Button>
          </div>
        </>
      )}
    </div>
  );
}