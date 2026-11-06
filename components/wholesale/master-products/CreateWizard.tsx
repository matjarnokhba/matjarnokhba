"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  ArrowLeft,
  Check,
  Plus,
  Trash2,
  Image as ImageIcon,
  Barcode,
  Package,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { PageHeader } from "@/components/ui/PageHeader";
import { useToast } from "@/lib/hooks/useToast";
import { cn } from "@/lib/ui/cn";

type Category = { id: number; name: string; slug: string };

type Attr = { name: string; value: string };

type Variant = {
  key: string;
  attributes: Attr[];
  sku: string;
  barcode: string;
  qrCode: string;
  isDefault: boolean;
};

type Step = 1 | 2 | 3 | 4;

const STEP_LABELS = ["المعلومات", "الصور والمعرفات", "المتغيرات", "المراجعة"];

function makeDefaultVariant(): Variant {
  return {
    key: Math.random().toString(36).slice(2),
    attributes: [],
    sku: "",
    barcode: "",
    qrCode: "",
    isDefault: true,
  };
}

export function CreateWizard() {
  const router = useRouter();
  const { toast } = useToast();

  const [step, setStep] = useState<Step>(1);
  const [submitting, setSubmitting] = useState(false);

  // Categories
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);

  // Step 1
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");

  // Step 2
  const [imageUrls, setImageUrls] = useState<string[]>([""]);
  const [barcode, setBarcode] = useState("");
  const [qrCode, setQrCode] = useState("");
  const [lookupStatus, setLookupStatus] = useState<
    "idle" | "loading" | "found" | "not_found" | "error"
  >("idle");
  const [lookupMessage, setLookupMessage] = useState("");

  // Step 3
  const [variants, setVariants] = useState<Variant[]>([makeDefaultVariant()]);

  // Load categories
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/wholesale/master-products/categories");
        const data = await res.json();
        if (data.success && Array.isArray(data.categories)) {
          setCategories(data.categories);
        }
      } catch {
        toast("فشل تحميل الفئات", "error");
      } finally {
        setLoadingCategories(false);
      }
    })();
  }, [toast]);

  // ═══ Step 1 validation ═══
  const step1Valid = name.trim().length >= 2 && categoryId !== "";

  // ═══ Step 2 validation ═══
  const validImages = imageUrls.filter((u) => u.trim().length > 0);
  const step2Valid = validImages.length >= 1;

  // ═══ Step 3 validation ═══
  const step3Valid = variants.length > 0;

  // ═══ Barcode lookup ═══
  const handleLookup = async () => {
    if (barcode.trim().length < 3) {
      toast("أدخل 3 أحرف على الأقل للباركود", "warning");
      return;
    }
    setLookupStatus("loading");
    setLookupMessage("");
    try {
      const res = await fetch("/api/wholesale/master-products/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: barcode.trim(),
          codeType: "barcode",
        }),
      });
      const data = await res.json();
      if (!data.success) {
        setLookupStatus("error");
        setLookupMessage(data.message || "فشل البحث");
        return;
      }
      if (data.lookup?.found) {
        setLookupStatus("found");
        setLookupMessage(
          `الباركود مسجل مسبقًا للمنتج "${data.lookup.master?.name ?? "?"}"`
        );
      } else {
        setLookupStatus("not_found");
        setLookupMessage("الباركود متاح — لم يُسجل مسبقًا");
      }
    } catch {
      setLookupStatus("error");
      setLookupMessage("خطأ في الاتصال");
    }
  };

  // ═══ Variant management ═══
  const addVariant = () => {
    setVariants((prev) => {
      const isFirst = prev.length === 0;
      return [
        ...prev,
        {
          key: Math.random().toString(36).slice(2),
          attributes: [{ name: "", value: "" }],
          sku: "",
          barcode: "",
          qrCode: "",
          isDefault: isFirst,
        },
      ];
    });
  };

  const removeVariant = (key: string) => {
    setVariants((prev) => {
      const filtered = prev.filter((v) => v.key !== key);
      // Ensure at least one default
      if (filtered.length > 0 && !filtered.some((v) => v.isDefault)) {
        filtered[0].isDefault = true;
      }
      return filtered;
    });
  };

  const setDefaultVariant = (key: string) => {
    setVariants((prev) =>
      prev.map((v) => ({ ...v, isDefault: v.key === key }))
    );
  };

  const updateVariant = (key: string, patch: Partial<Variant>) => {
    setVariants((prev) =>
      prev.map((v) => (v.key === key ? { ...v, ...patch } : v))
    );
  };

  const addAttr = (variantKey: string) => {
    setVariants((prev) =>
      prev.map((v) => {
        if (v.key !== variantKey) return v;
        if (v.attributes.length >= 20) return v;
        return { ...v, attributes: [...v.attributes, { name: "", value: "" }] };
      })
    );
  };

  const updateAttr = (
    variantKey: string,
    index: number,
    patch: Partial<Attr>
  ) => {
    setVariants((prev) =>
      prev.map((v) => {
        if (v.key !== variantKey) return v;
        const attrs = v.attributes.map((a, i) =>
          i === index ? { ...a, ...patch } : a
        );
        return { ...v, attributes: attrs };
      })
    );
  };

  const removeAttr = (variantKey: string, index: number) => {
    setVariants((prev) =>
      prev.map((v) => {
        if (v.key !== variantKey) return v;
        return { ...v, attributes: v.attributes.filter((_, i) => i !== index) };
      })
    );
  };

  // ═══ Submit ═══
  const handleSubmit = async () => {
    if (submitting) return;
    if (!step1Valid || !step2Valid || !step3Valid) {
      toast("يرجى إكمال جميع الخطوات", "warning");
      return;
    }

    // Prepare payload
    const payload = {
      name: name.trim(),
      brand: brand.trim() || null,
      description: description.trim() || null,
      categoryId: parseInt(categoryId, 10),
      images: validImages.map((u) => u.trim()),
      barcode: barcode.trim() || null,
      qrCode: qrCode.trim() || null,
      variants: variants.map((v) => ({
        sku: v.sku.trim() || null,
        barcode: v.barcode.trim() || null,
        qrCode: v.qrCode.trim() || null,
        attributes: v.attributes
          .filter((a) => a.name.trim() && a.value.trim())
          .map((a) => ({ name: a.name.trim(), value: a.value.trim() })),
        isDefault: v.isDefault,
      })),
    };

    setSubmitting(true);
    try {
      const res = await fetch("/api/wholesale/master-products", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast(data.message || "فشل إنشاء المنتج", "error");
        return;
      }
      toast("تم إرسال المنتج للمراجعة بنجاح", "success");
      router.push(`/wholesale/master-products/${data.masterId}`);
    } catch {
      toast("حدث خطأ في الاتصال", "error");
    } finally {
      setSubmitting(false);
    }
  };

  // ═══ Render ═══
  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <PageHeader
        title="إضافة منتج أصلي جديد"
        description="هوية المنتج تُشارك بين كل التجار — يُحدد كل تاجر سعره ومخزونه بشكل مستقل"
        breadcrumbs={
          <Link
            href="/wholesale/master-products"
            className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-[#ff5c00]"
          >
            <ArrowRight className="h-4 w-4" />
            العودة للمنتجات
          </Link>
        }
      />

      {/* Progress */}
      <div className="flex items-center gap-1">
        {STEP_LABELS.map((label, idx) => {
          const stepNum = (idx + 1) as Step;
          const isActive = step === stepNum;
          const isDone = step > stepNum;
          return (
            <div key={label} className="flex flex-1 items-center gap-1">
              <div
                className={cn(
                  "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold",
                  isDone
                    ? "bg-[#ff5c00] text-white"
                    : isActive
                    ? "bg-[#ff5c00] text-white"
                    : "bg-gray-200 text-gray-500"
                )}
              >
                {isDone ? <Check className="h-4 w-4" /> : stepNum}
              </div>
              <span
                className={cn(
                  "hidden text-xs sm:block truncate",
                  isActive ? "font-semibold text-gray-900" : "text-gray-500"
                )}
              >
                {label}
              </span>
              {idx < STEP_LABELS.length - 1 && (
                <div className="h-0.5 flex-1 bg-gray-200">
                  <div
                    className={cn(
                      "h-full bg-[#ff5c00] transition-all",
                      step > stepNum ? "w-full" : "w-0"
                    )}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Step 1 */}
      {step === 1 && (
        <Card>
          <h2 className="mb-4 text-lg font-bold text-gray-900">
            المعلومات الأساسية
          </h2>
          <div className="space-y-4">
            <Input
              label="اسم المنتج"
              placeholder="مثال: قميص رجالي قطن"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={200}
              required
            />
            <Input
              label="العلامة التجارية (اختياري)"
              placeholder="مثال: Nike"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              maxLength={80}
            />
            <Textarea
              label="الوصف (اختياري)"
              placeholder="وصف تفصيلي للمنتج"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={2000}
              rows={3}
              hint={`${description.length}/2000`}
            />
            {loadingCategories ? (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" /> جارٍ تحميل الفئات...
              </div>
            ) : (
              <Select
                label="الفئة"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                placeholder="اختر فئة"
                required
                options={[
                  { value: "", label: "— اختر فئة —", disabled: true },
                  ...categories.map((c) => ({
                    value: String(c.id),
                    label: c.name,
                  })),
                ]}
              />
            )}
          </div>
          <div className="mt-5 flex justify-end">
            <Button
              onClick={() => setStep(2)}
              disabled={!step1Valid}
              iconRight={<ArrowLeft className="h-4 w-4" />}
            >
              التالي
            </Button>
          </div>
        </Card>
      )}

      {/* Step 2 */}
      {step === 2 && (
        <Card>
          <h2 className="mb-4 text-lg font-bold text-gray-900">
            الصور والمعرفات
          </h2>
          <div className="space-y-5">
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-gray-700">
                <ImageIcon className="h-4 w-4" />
                صور المنتج (روابط)
              </p>
              <div className="space-y-2">
                {imageUrls.map((url, i) => (
                  <div key={i} className="flex gap-2">
                    <Input
                      placeholder="https://example.com/image.jpg"
                      value={url}
                      onChange={(e) => {
                        const next = [...imageUrls];
                        next[i] = e.target.value;
                        setImageUrls(next);
                      }}
                      fullWidth
                    />
                    {imageUrls.length > 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setImageUrls(imageUrls.filter((_, j) => j !== i))
                        }
                        iconLeft={<Trash2 className="h-4 w-4" />}
                      >
                        حذف
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              {imageUrls.length < 10 && (
                <button
                  type="button"
                  onClick={() => setImageUrls([...imageUrls, ""])}
                  className="mt-2 text-sm font-medium text-[#ff5c00] hover:underline"
                >
                  + إضافة صورة أخرى
                </button>
              )}
              <p className="mt-1 text-xs text-gray-500">
                {validImages.length}/10 صور
              </p>
            </div>

            <div className="border-t border-gray-100 pt-4">
              <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-gray-700">
                <Barcode className="h-4 w-4" />
                الباركود (اختياري)
              </p>
              <div className="flex gap-2">
                <Input
                  placeholder="123456789"
                  value={barcode}
                  onChange={(e) => {
                    setBarcode(e.target.value);
                    setLookupStatus("idle");
                    setLookupMessage("");
                  }}
                  fullWidth
                />
                <Button
                  variant="secondary"
                  onClick={handleLookup}
                  loading={lookupStatus === "loading"}
                >
                  تحقق
                </Button>
              </div>
              {lookupMessage && (
                <p
                  className={cn(
                    "mt-2 text-xs",
                    lookupStatus === "found" && "text-amber-600",
                    lookupStatus === "not_found" && "text-emerald-600",
                    lookupStatus === "error" && "text-red-600"
                  )}
                >
                  {lookupMessage}
                </p>
              )}
            </div>

            <div>
              <Input
                label="رمز QR (اختياري)"
                placeholder="NKB-QR-..."
                value={qrCode}
                onChange={(e) => setQrCode(e.target.value)}
                maxLength={200}
                hint="اتركه فارغًا للتوليد التلقائي"
              />
            </div>
          </div>
          <div className="mt-5 flex justify-between gap-2">
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
        </Card>
      )}

      {/* Step 3 */}
      {step === 3 && (
        <Card>
          <h2 className="mb-1 text-lg font-bold text-gray-900">المتغيرات</h2>
          <p className="mb-4 text-sm text-gray-500">
            أضف لون/مقاس أو اترك متغيرًا واحدًا فقط بدون خصائص.
          </p>

          <div className="space-y-4">
            {variants.map((variant, vi) => (
              <div
                key={variant.key}
                className="rounded-lg border-2 border-gray-200 p-4"
              >
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-gray-900">
                      متغير #{vi + 1}
                    </span>
                    {variant.isDefault && (
                      <span className="rounded bg-orange-100 px-2 py-0.5 text-xs font-medium text-[#ff5c00]">
                        افتراضي
                      </span>
                    )}
                  </div>
                  <div className="flex gap-1">
                    {!variant.isDefault && (
                      <button
                        type="button"
                        onClick={() => setDefaultVariant(variant.key)}
                        className="text-xs font-medium text-[#ff5c00] hover:underline"
                      >
                        تعيين كافتراضي
                      </button>
                    )}
                    {variants.length > 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeVariant(variant.key)}
                        iconLeft={<Trash2 className="h-3.5 w-3.5" />}
                      >
                        حذف
                      </Button>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  {variant.attributes.map((attr, ai) => (
                    <div key={ai} className="flex gap-2">
                      <Input
                        placeholder="الاسم (مثال: اللون)"
                        value={attr.name}
                        onChange={(e) =>
                          updateAttr(variant.key, ai, { name: e.target.value })
                        }
                        fullWidth
                      />
                      <Input
                        placeholder="القيمة (مثال: أحمر)"
                        value={attr.value}
                        onChange={(e) =>
                          updateAttr(variant.key, ai, { value: e.target.value })
                        }
                        fullWidth
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeAttr(variant.key, ai)}
                        iconLeft={<Trash2 className="h-3.5 w-3.5" />}
                      />
                    </div>
                  ))}
                  {variant.attributes.length < 20 && (
                    <button
                      type="button"
                      onClick={() => addAttr(variant.key)}
                      className="text-xs font-medium text-[#ff5c00] hover:underline"
                    >
                      + إضافة خاصية
                    </button>
                  )}
                </div>

                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <Input
                    label="SKU (اختياري)"
                    placeholder="TSHIRT-RED-M"
                    value={variant.sku}
                    onChange={(e) =>
                      updateVariant(variant.key, { sku: e.target.value })
                    }
                    maxLength={100}
                  />
                  <Input
                    label="باركود Variant (اختياري)"
                    placeholder="1234567890"
                    value={variant.barcode}
                    onChange={(e) =>
                      updateVariant(variant.key, { barcode: e.target.value })
                    }
                    maxLength={100}
                  />
                </div>
              </div>
            ))}
          </div>

          {variants.length < 20 && (
            <button
              type="button"
              onClick={addVariant}
              className="mt-3 flex w-full items-center justify-center gap-1 rounded-lg border-2 border-dashed border-gray-300 py-3 text-sm font-medium text-gray-500 hover:border-[#ff5c00] hover:text-[#ff5c00]"
            >
              <Plus className="h-4 w-4" /> إضافة متغير آخر
            </button>
          )}

          <div className="mt-5 flex justify-between gap-2">
            <Button
              variant="outline"
              onClick={() => setStep(2)}
              iconLeft={<ArrowRight className="h-4 w-4" />}
            >
              السابق
            </Button>
            <Button
              onClick={() => setStep(4)}
              disabled={!step3Valid}
              iconRight={<ArrowLeft className="h-4 w-4" />}
            >
              التالي
            </Button>
          </div>
        </Card>
      )}

      {/* Step 4 */}
      {step === 4 && (
        <Card>
          <h2 className="mb-4 text-lg font-bold text-gray-900">
            المراجعة والإرسال
          </h2>

          <div className="space-y-4">
            <div>
              <p className="mb-2 text-xs font-medium text-gray-500">
                المعلومات الأساسية
              </p>
              <div className="rounded-lg bg-gray-50 p-3 text-sm">
                <p className="font-bold text-gray-900">{name}</p>
                {brand && <p className="text-gray-600">{brand}</p>}
                <p className="mt-1 text-xs text-gray-500">
                  الفئة:{" "}
                  {categories.find((c) => String(c.id) === categoryId)?.name ??
                    "—"}
                </p>
                {description && (
                  <p className="mt-2 whitespace-pre-wrap text-gray-700">
                    {description}
                  </p>
                )}
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-medium text-gray-500">
                الصور ({validImages.length})
              </p>
              <div className="grid grid-cols-4 gap-2">
                {validImages.map((url, i) => (
                  <div
                    key={i}
                    className="aspect-square overflow-hidden rounded border border-gray-200 bg-gray-50"
                  >
                    <img
                      src={url}
                      alt={`صورة ${i + 1}`}
                      className="h-full w-full object-cover"
                    />
                  </div>
                ))}
              </div>
            </div>

            {(barcode || qrCode) && (
              <div className="grid gap-2 sm:grid-cols-2">
                {barcode && (
                  <div className="rounded-lg bg-gray-50 p-2 text-sm">
                    <p className="text-xs text-gray-500">الباركود</p>
                    <p className="font-mono text-gray-900">{barcode}</p>
                  </div>
                )}
                {qrCode && (
                  <div className="rounded-lg bg-gray-50 p-2 text-sm">
                    <p className="text-xs text-gray-500">QR</p>
                    <p className="font-mono text-gray-900">{qrCode}</p>
                  </div>
                )}
              </div>
            )}

            <div>
              <p className="mb-2 text-xs font-medium text-gray-500">
                المتغيرات ({variants.length})
              </p>
              <div className="space-y-2">
                {variants.map((v, i) => (
                  <div key={v.key} className="rounded-lg bg-gray-50 p-2 text-sm">
                    <p className="font-medium text-gray-900">
                      #{i + 1} {v.isDefault && "(افتراضي)"}
                    </p>
                    {v.attributes.filter((a) => a.name.trim() && a.value.trim())
                      .length > 0 ? (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {v.attributes
                          .filter((a) => a.name.trim() && a.value.trim())
                          .map((a, ai) => (
                            <span
                              key={ai}
                              className="rounded bg-white px-2 py-0.5 text-xs text-gray-700"
                            >
                              {a.name}: <strong>{a.value}</strong>
                            </span>
                          ))}
                      </div>
                    ) : (
                      <p className="mt-0.5 text-xs text-gray-500">
                        بدون خصائص
                      </p>
                    )}
                    {v.sku && (
                      <p className="mt-1 text-xs text-gray-500">
                        SKU: <span className="font-mono">{v.sku}</span>
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">
              <AlertCircle className="inline h-3.5 w-3.5" /> سيُرسل المنتج
              للمراجعة. عند الاعتماد، يمكنك إضافته كعرض جملة في نشاطك.
            </div>
          </div>

          <div className="mt-5 flex justify-between gap-2">
            <Button
              variant="outline"
              onClick={() => setStep(3)}
              iconLeft={<ArrowRight className="h-4 w-4" />}
              disabled={submitting}
            >
              السابق
            </Button>
            <Button
              onClick={handleSubmit}
              loading={submitting}
              iconRight={
                !submitting ? <Check className="h-4 w-4" /> : undefined
              }
            >
              إرسال للمراجعة
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}