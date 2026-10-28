"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save, ArrowRight, ArrowLeft, AlertCircle, CheckCircle2, AlertTriangle } from "lucide-react";
import WizardStepper from "./WizardStepper";
import StepCategory from "./StepCategory";
import StepBasicInfo from "./StepBasicInfo";
import StepPriceStock from "./StepPriceStock";
import StepReview from "./StepReview";
import { INITIAL_FORM, generateSlug } from "./types";
import type { Attribute, Category, ProductFormData, WizardStep } from "./types";

type Props = {
  mode?: "create" | "edit";
  role?: "seller" | "admin";
  productId?: number;
  initialData?: Partial<ProductFormData>;
  apiUrl?: string;
  returnUrl?: string;
  hasVariants?: boolean;
  productStatus?: string;
};

export default function ProductWizard({
  mode = "create",
  role = "seller",
  productId,
  initialData,
  apiUrl = "/api/seller/products",
  returnUrl = "/seller/products",
  hasVariants = false,
  productStatus,
}: Props) {
  const router = useRouter();
  const isEdit = mode === "edit";

  const [step, setStep] = useState<WizardStep>(isEdit ? 2 : 1);
  const [completed, setCompleted] = useState<WizardStep[]>(
    isEdit ? [1, 2, 3] : []
  );

  const [form, setForm] = useState<ProductFormData>({
    ...INITIAL_FORM,
    ...initialData,
  });
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCats, setLoadingCats] = useState(true);
  const [attributes, setAttributes] = useState<Attribute[]>([]);
  const [loadingAttrs, setLoadingAttrs] = useState(false);

  const [error, setError] = useState("");
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/seller/categories");
        const data = await res.json();
        if (data.success) setCategories(data.categories);
      } finally {
        setLoadingCats(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!form.categoryId || form.categoryId < 1) {
      setAttributes([]);
      return;
    }
    (async () => {
      setLoadingAttrs(true);
      try {
        const res = await fetch(`/api/seller/categories/${form.categoryId}/attributes`);
        const data = await res.json();
        if (data.success) {
          setAttributes(data.attributes);
          if (!isEdit) {
            setForm((f) => ({ ...f, selectedValues: {}, variantData: {} }));
          }
        }
      } finally {
        setLoadingAttrs(false);
      }
    })();
  }, [form.categoryId, isEdit]);

  function update<K extends keyof ProductFormData>(field: K, value: ProductFormData[K]) {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "name" && (!prev.slug || prev.slug === generateSlug(prev.name))) {
        next.slug = generateSlug(value as string);
      }
      return next;
    });
  }

  function selectCategory(cat: Category) {
    if (isEdit) return;
    if (cat.id < 1) {
      update("categoryId", null);
      update("categoryName", "");
      update("categorySlug", "");
      return;
    }
    update("categoryId", cat.id);
    update("categoryName", cat.name);
    update("categorySlug", cat.slug);
  }

  function validateStep(s: WizardStep): string | null {
    if (s === 1) {
      if (!form.categoryId) return "اختر فئة فرعية للمتابعة";
      return null;
    }
    if (s === 2) {
      if (!form.name.trim() || form.name.trim().length < 2) return "اسم المنتج مطلوب";
      if (!isEdit && !form.slug.trim()) return "الرابط (slug) مطلوب";
      if (form.imageUrls.length === 0) return "أضف صورة واحدة على الأقل";
      return null;
    }
    if (s === 3) {
      // Edit + variants: check each variant
      if (isEdit && hasVariants && form.existingVariants) {
        for (let i = 0; i < form.existingVariants.length; i++) {
          const v = form.existingVariants[i];
          if (!v.price || v.price <= 0) {
            return `المتغير #${i + 1}: السعر مطلوب`;
          }
          if (v.stock < 0) {
            return `المتغير #${i + 1}: المخزون لا يمكن أن يكون سالبًا`;
          }
          if (v.stock < v.reservedQuantity) {
            return `المتغير #${i + 1}: لا يمكن تخفيض المخزون تحت الكمية المحجوزة (${v.reservedQuantity})`;
          }
        }
        return null;
      }

      // Base pricing
      if (!form.price || Number(form.price) <= 0) return "السعر مطلوب";
      if (isEdit && form.reservedQuantity > 0 && Number(form.stock) < form.reservedQuantity) {
        return `لا يمكن تخفيض المخزون إلى ${form.stock}. هناك ${form.reservedQuantity} قطعة محجوزة لطلبات حالية.`;
      }
      return null;
    }
    return null;
  }

  function nextStep() {
    setError("");
    setErrorCode(null);
    const err = validateStep(step);
    if (err) { setError(err); return; }
    setCompleted((c) => Array.from(new Set([...c, step])));
    if (step < 4) setStep((step + 1) as WizardStep);
  }

  function prevStep() {
    setError("");
    setErrorCode(null);
    if (step > 1) setStep((step - 1) as WizardStep);
  }

  function goToStep(s: WizardStep) {
    if (s < step || completed.includes(s)) {
      setError("");
      setErrorCode(null);
      setStep(s);
    }
  }

  async function submit() {
    setError("");
    setErrorCode(null);
    setSuccessMsg("");
    for (const s of [1, 2, 3] as WizardStep[]) {
      const err = validateStep(s);
      if (err) { setStep(s); setError(err); return; }
    }

    setSubmitting(true);
    try {
      const basePayload: Record<string, unknown> = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        brand: form.brand.trim() || null,
        badge: form.badge.trim() || null,
        categoryId: form.categoryId,
        freeShipping: form.freeShipping,
        imageUrls: form.imageUrls,
        originCountry: form.originCountry.trim() || null,
        videoUrl: form.videoUrl.trim() || null,
        minOrderQty: form.minOrderQty ? Number(form.minOrderQty) : 1,
        maxOrderQty: form.maxOrderQty ? Number(form.maxOrderQty) : null,
      };

      let payload: Record<string, unknown>;
      let url: string;
      let method: "POST" | "PATCH";

      if (isEdit) {
        payload = { ...basePayload };
        if (form.expectedUpdatedAt) {
          payload.expectedUpdatedAt = form.expectedUpdatedAt;
        }
        if (hasVariants && form.existingVariants) {
          payload.variants = form.existingVariants.map((v) => ({
            id: v.id,
            price: v.price,
            stock: v.stock,
            barcode: v.barcode || null,
          }));
        } else {
          payload.price = Number(form.price);
          payload.oldPrice = form.oldPrice ? Number(form.oldPrice) : null;
          payload.stock = Number(form.stock) || 0;
          payload.barcode = form.barcode.trim() || null;
        }
        url = `${apiUrl}/${productId}`;
        method = "PATCH";
      } else {
        payload = {
          ...basePayload,
          slug: form.slug.trim(),
          price: Number(form.price),
          oldPrice: form.oldPrice ? Number(form.oldPrice) : null,
          stock: Number(form.stock) || 0,
          barcode: form.barcode.trim() || null,
          selectedValues: form.selectedValues,
          variantData: form.variantData,
        };
        url = apiUrl;
        method = "POST";
      }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      // Handle 409 stale version
      if (res.status === 409 || data.code === "STALE_VERSION") {
        setError(
          "⚠️ المنتج تم تعديله في مكان آخر. أعد تحميل الصفحة لرؤية آخر تغييرات ثم أعد المحاولة."
        );
        setErrorCode("STALE_VERSION");
        return;
      }

      if (!res.ok || !data.success) {
        setError(data.message || "فشل حفظ المنتج");
        return;
      }

      // Success with re-approval
      if (isEdit && data.product?.requiresReapproval) {
        setSuccessMsg(
          "✅ تم الحفظ. لأنك عدّلت حقلًا حساسًا على منتج منشور، أعيد إلى \"قيد المراجعة\"."
        );
        setTimeout(() => {
          router.push(returnUrl);
          router.refresh();
        }, 2000);
        return;
      }

      // Normal success
      router.push(returnUrl);
      router.refresh();
    } catch {
      setError("فشل الاتصال بالخادم");
    } finally {
      setSubmitting(false);
    }
  }

  const category = useMemo(
    () => categories.find((c) => c.id === form.categoryId) || null,
    [categories, form.categoryId]
  );

  return (
    <div className="mx-auto w-full max-w-4xl" dir="rtl">
      <WizardStepper current={step} completed={completed} onStepClick={goToStep} />

      <div className="rounded-2xl bg-white p-5 shadow-sm">
        {step === 1 && (
          <StepCategory
            categories={categories}
            loading={loadingCats}
            selectedId={form.categoryId}
            onSelect={selectCategory}
            readOnly={isEdit}
          />
        )}

        {step === 2 && (
          <StepBasicInfo
            form={form}
            update={update}
            categoryName={category?.name || form.categoryName}
            isEdit={isEdit}
          />
        )}

        {step === 3 && (
          <StepPriceStock
            form={form}
            update={update}
            attributes={attributes}
            loading={loadingAttrs}
            isEdit={isEdit}
            productStatus={productStatus}
          />
        )}

        {step === 4 && (
          <StepReview
            form={form}
            attributes={attributes}
            categoryName={category?.name || form.categoryName}
          />
        )}

        {error && (
          <div
            className={`mt-4 flex items-start gap-2 rounded-lg border px-4 py-3 text-sm ${
              errorCode === "STALE_VERSION"
                ? "border-amber-300 bg-amber-50 text-amber-800"
                : "border-red-200 bg-red-50 text-red-700"
            }`}
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-800">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        <div className="mt-6 flex items-center justify-between gap-3 border-t border-gray-100 pt-4">
          <button
            type="button"
            onClick={prevStep}
            disabled={step === 1}
            className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-5 py-2.5 text-sm font-bold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ArrowRight className="h-4 w-4" />
            السابق
          </button>

          {step < 4 ? (
            <button
              type="button"
              onClick={nextStep}
              className="flex items-center gap-2 rounded-lg bg-[#ff5c00] px-6 py-2.5 text-sm font-bold text-white transition hover:bg-[#e64a00]"
            >
              التالي
              <ArrowLeft className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={submit}
              disabled={submitting}
              className="flex items-center gap-2 rounded-lg bg-green-600 px-6 py-2.5 text-sm font-bold text-white transition hover:bg-green-700 disabled:opacity-50"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {isEdit ? "حفظ التعديلات" : "حفظ المنتج"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}