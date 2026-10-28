"use client";

import { useEffect, useMemo, useState } from "react";
import { Barcode, Loader2, Info, Layers, AlertTriangle, Lock } from "lucide-react";
import type { Attribute, ExistingVariant, ProductFormData } from "./types";

type Props = {
  form: ProductFormData;
  update: <K extends keyof ProductFormData>(field: K, value: ProductFormData[K]) => void;
  attributes: Attribute[];
  loading: boolean;
  isEdit?: boolean;
  productStatus?: string;
};

type ComboRow = {
  key: string;
  labels: { attrName: string; valueLabel: string; colorHex: string | null }[];
};

function buildCombinations(
  attrs: Attribute[],
  selectedValues: Record<number, number[]>
): ComboRow[] {
  const variantAttrs = attrs.filter(
    (a) => a.isVariantAxis && (selectedValues[a.id] || []).length > 0
  );
  if (variantAttrs.length === 0) return [];

  let combos: ComboRow[] = [{ key: "", labels: [] }];

  for (const attr of variantAttrs) {
    const valueIds = selectedValues[attr.id] || [];
    const next: ComboRow[] = [];
    for (const combo of combos) {
      for (const vId of valueIds) {
        const val = attr.values.find((v) => v.id === vId);
        if (!val) continue;
        next.push({
          key: combo.key ? `${combo.key}|${attr.slug}:${vId}` : `${attr.slug}:${vId}`,
          labels: [
            ...combo.labels,
            { attrName: attr.name, valueLabel: val.value, colorHex: val.colorHex },
          ],
        });
      }
    }
    combos = next;
  }

  return combos;
}

export default function StepPriceStock({
  form,
  update,
  attributes,
  loading,
  isEdit = false,
  productStatus,
}: Props) {
  const [editVariants, setEditVariants] = useState<ExistingVariant[]>(
    form.existingVariants || []
  );

  useEffect(() => {
    setEditVariants(form.existingVariants || []);
  }, [form.existingVariants]);

  const variantAttrs = useMemo(
    () => attributes.filter((a) => a.isVariantAxis),
    [attributes]
  );

  const hasExistingVariants = isEdit && editVariants.length > 1;

  const combos = useMemo(
    () =>
      hasExistingVariants
        ? []
        : buildCombinations(variantAttrs, form.selectedValues),
    [variantAttrs, form.selectedValues, hasExistingVariants]
  );

  // Validation: variant stock < reserved
  const invalidVariants = editVariants.filter(
    (v) => v.stock < v.reservedQuantity
  );
  const hasInvalidVariant = invalidVariants.length > 0;

  // Validation: base stock < reserved (no variants case)
  const baseInvalid =
    !hasExistingVariants && form.reservedQuantity > 0 && Number(form.stock) < form.reservedQuantity;

  function toggleValue(attrId: number, valueId: number) {
    const current = form.selectedValues[attrId] || [];
    const next = current.includes(valueId)
      ? current.filter((id) => id !== valueId)
      : [...current, valueId];
    update("selectedValues", { ...form.selectedValues, [attrId]: next });
  }

  function updateVariant(comboKey: string, field: "price" | "stock", value: number) {
    const current = form.variantData[comboKey] || { price: 0, stock: 0 };
    update("variantData", {
      ...form.variantData,
      [comboKey]: { ...current, [field]: value },
    });
  }

  function updateExistingVariant(
    id: number,
    field: "price" | "stock" | "barcode",
    value: number | string
  ) {
    setEditVariants((prev) => {
      const next = prev.map((v) => (v.id === id ? { ...v, [field]: value } : v));
      update("existingVariants", next);
      return next;
    });
  }

  return (
    <div className="space-y-4" dir="rtl">
      {/* Status warning for ACTIVE product edit */}
      {isEdit && productStatus === "ACTIVE" && (
        <div className="rounded-xl bg-amber-50 p-3 flex items-start gap-2 text-xs text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <div className="font-bold">المنتج منشور حاليًا</div>
            <div className="mt-0.5 text-[11px]">
              تعديل <strong>الاسم / الوصف / الصور / الماركة / الفئة</strong> في الخطوة 2 سيعيد المنتج إلى حالة &quot;قيد المراجعة&quot;. تعديل السعر/المخزون/الباركود فقط لا يؤثر.
            </div>
          </div>
        </div>
      )}

      {/* Edit mode with variants */}
      {hasExistingVariants && (
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <h3 className="mb-1 flex items-center gap-2 text-sm font-black text-gray-900">
            <Layers className="h-4 w-4 text-[#ff5c00]" />
            المتغيرات الحالية ({editVariants.length})
          </h3>
          <p className="mb-3 flex items-start gap-1 text-[10px] text-gray-500">
            <Info className="mt-0.5 h-3 w-3 shrink-0" />
            عدّل السعر والمخزون لكل متغير. القيم (المقاس/اللون) لا يمكن تغييرها بعد النشر.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-2 py-2 text-right font-bold text-gray-600">#</th>
                  <th className="px-2 py-2 text-right font-bold text-gray-600">التركيبة</th>
                  <th className="px-2 py-2 text-right font-bold text-gray-600">السعر *</th>
                  <th className="px-2 py-2 text-right font-bold text-gray-600">المخزون *</th>
                  <th className="px-2 py-2 text-right font-bold text-gray-600">محجوز</th>
                  <th className="px-2 py-2 text-right font-bold text-gray-600">الباركود</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {editVariants.map((v, idx) => {
                  const isInvalid = v.stock < v.reservedQuantity;
                  return (
                    <tr
                      key={v.id}
                      className={isInvalid ? "bg-red-50" : ""}
                    >
                      <td className="px-2 py-1.5 text-gray-400">{idx + 1}</td>
                      <td className="px-2 py-1.5">
                        <div className="flex flex-wrap gap-1">
                          {v.options.length > 0 ? (
                            v.options.map((o, i) => (
                              <span
                                key={i}
                                className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-bold text-gray-700"
                              >
                                {o.attributeName}: {o.value}
                              </span>
                            ))
                          ) : (
                            <span className="text-gray-400">افتراضي</span>
                          )}
                        </div>
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          type="number"
                          value={v.price}
                          onChange={(e) =>
                            updateExistingVariant(
                              v.id,
                              "price",
                              Number(e.target.value) || 0
                            )
                          }
                          min="0.01"
                          step="0.01"
                          className="w-24 rounded border border-gray-200 px-2 py-1 text-xs outline-none focus:border-[#ff5c00]"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          type="number"
                          value={v.stock}
                          onChange={(e) =>
                            updateExistingVariant(
                              v.id,
                              "stock",
                              Number(e.target.value) || 0
                            )
                          }
                          min="0"
                          className={`w-20 rounded border px-2 py-1 text-xs outline-none focus:border-[#ff5c00] ${
                            isInvalid
                              ? "border-red-400 bg-red-50"
                              : "border-gray-200"
                          }`}
                        />
                        {isInvalid && (
                          <div className="mt-0.5 text-[9px] font-bold text-red-600">
                            أقل من المحجوز!
                          </div>
                        )}
                      </td>
                      <td className="px-2 py-1.5">
                        {v.reservedQuantity > 0 ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                            <Lock className="h-2.5 w-2.5" />
                            {v.reservedQuantity}
                          </span>
                        ) : (
                          <span className="text-[10px] text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          type="text"
                          value={v.barcode || ""}
                          onChange={(e) =>
                            updateExistingVariant(v.id, "barcode", e.target.value)
                          }
                          placeholder="تلقائي"
                          dir="ltr"
                          className="w-32 rounded border border-gray-200 px-2 py-1 font-mono text-[11px] outline-none focus:border-[#ff5c00]"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-2 rounded-lg bg-blue-50 p-2 text-[10px] text-blue-800">
            💡 لتعديل القيم (المقاس/اللون)، يجب حذف المنتج وإعادة إنشائه — حفاظًا على بيانات الطلبات.
          </div>

          {hasInvalidVariant && (
            <div className="mt-2 rounded-lg bg-red-50 p-2 text-[11px] font-bold text-red-700">
              ⚠️ لا يمكن تخفيض مخزون متغيرات لها قطع محجوزة. عدّل المخزون أو انتظر تسليم الطلبات أولًا.
            </div>
          )}
        </div>
      )}

      {/* Base pricing */}
      {!hasExistingVariants && (
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <h3 className="mb-3 flex items-center justify-between text-sm font-black text-gray-900">
            <span>{isEdit ? "السعر والمخزون الأساسي" : "السعر والمخزون"}</span>
            {form.reservedQuantity > 0 && (
              <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                <Lock className="h-2.5 w-2.5" />
                محجوز: {form.reservedQuantity}
              </span>
            )}
          </h3>

          <div className="mb-2 rounded-lg bg-blue-50 p-2 text-[10px] text-blue-800 flex items-start gap-1.5">
            <Info className="mt-0.5 h-3 w-3 shrink-0" />
            <span>
              تغيير السعر يؤثر على <strong>الطلبات الجديدة فقط</strong>. الطلبات الحالية تحتفظ بالسعر الأصلي تلقائيًا.
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-bold text-gray-700">
                السعر (د.م) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={form.price}
                onChange={(e) => update("price", e.target.value)}
                min="0"
                step="0.01"
                placeholder="149"
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-[#ff5c00] focus:bg-white"
              />
              {Number(form.price) > 0 && (
                <div className="mt-1.5 flex items-center justify-between rounded-lg bg-green-50 px-2 py-1.5">
                  <span className="text-[10px] font-bold text-green-800">صافي أرباحك:</span>
                  <span className="font-mono text-xs font-black text-green-700">
                    {(Number(form.price) * 0.9).toFixed(2)} د.م
                  </span>
                </div>
              )}
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-gray-700">السعر القديم</label>
              <input
                type="number"
                value={form.oldPrice}
                onChange={(e) => update("oldPrice", e.target.value)}
                min="0"
                step="0.01"
                placeholder="220"
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-[#ff5c00] focus:bg-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-gray-700">المخزون</label>
              <input
                type="number"
                value={form.stock}
                onChange={(e) => update("stock", e.target.value)}
                min="0"
                placeholder="50"
                className={`w-full rounded-lg border bg-gray-50 px-3 py-2.5 text-sm outline-none focus:bg-white ${
                  baseInvalid
                    ? "border-red-400 focus:border-red-500"
                    : "border-gray-200 focus:border-[#ff5c00]"
                }`}
              />
              {baseInvalid && (
                <div className="mt-1 text-[10px] font-bold text-red-600">
                  أقل من المحجوز ({form.reservedQuantity})!
                </div>
              )}
            </div>
          </div>

          <div className="mt-3">
            <label className="mb-1 flex items-center gap-1 text-xs font-bold text-gray-700">
              <Barcode className="h-4 w-4" />
              الباركود (اختياري)
            </label>
            <input
              type="text"
              value={form.barcode}
              onChange={(e) => update("barcode", e.target.value)}
              placeholder="سيُنشأ تلقائيًا (NK-xxx-x) إن تُرك فارغًا"
              dir="ltr"
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 font-mono text-sm outline-none focus:border-[#ff5c00] focus:bg-white"
            />
          </div>
        </div>
      )}

      {/* Common fields */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-bold text-gray-700">الحد الأدنى للطلب</label>
            <input
              type="number"
              value={form.minOrderQty}
              onChange={(e) => update("minOrderQty", e.target.value)}
              min="1"
              placeholder="1"
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-[#ff5c00] focus:bg-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-gray-700">الحد الأقصى للطلب</label>
            <input
              type="number"
              value={form.maxOrderQty}
              onChange={(e) => update("maxOrderQty", e.target.value)}
              min="1"
              placeholder="اتركه فارغًا = بدون حد"
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-[#ff5c00] focus:bg-white"
            />
          </div>
        </div>

        <label className="mt-3 flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={form.freeShipping}
            onChange={(e) => update("freeShipping", e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-[#ff5c00] focus:ring-[#ff5c00]"
          />
          <span className="text-xs font-bold text-gray-700">شحن مجاني لهذا المنتج</span>
        </label>
      </div>

      {/* Create mode — variant axes */}
      {!isEdit && (
        <>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-[#ff5c00]" />
            </div>
          ) : variantAttrs.length > 0 ? (
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <h3 className="mb-1 flex items-center gap-2 text-sm font-black text-gray-900">
                الخيارات (المقاس، اللون، إلخ)
              </h3>
              <p className="mb-3 flex items-start gap-1 text-[10px] text-gray-500">
                <Info className="mt-0.5 h-3 w-3 shrink-0" />
                اختر القيم المتاحة. سيتم إنشاء متغير مستقل لكل توليفة.
              </p>

              {variantAttrs.map((attr) => (
                <div key={attr.id} className="mb-3 last:mb-0">
                  <div className="mb-1.5 text-xs font-bold text-gray-700">
                    {attr.name}
                    {(form.selectedValues[attr.id] || []).length > 0 && (
                      <span className="mr-2 rounded-full bg-[#fff4ed] px-2 py-0.5 text-[10px] text-[#ff5c00]">
                        {(form.selectedValues[attr.id] || []).length} محدد
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {attr.values.map((v) => {
                      const selected = (form.selectedValues[attr.id] || []).includes(v.id);
                      const isColor = attr.type === "color";
                      return (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => toggleValue(attr.id, v.id)}
                          className={`flex items-center gap-1.5 rounded-lg border-2 px-3 py-1.5 text-xs font-bold transition ${
                            selected
                              ? "border-[#ff5c00] bg-[#fff4ed] text-[#ff5c00]"
                              : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
                          }`}
                        >
                          {isColor && v.colorHex && (
                            <span
                              className="h-3 w-3 rounded-full border border-gray-300"
                              style={{ backgroundColor: v.colorHex }}
                            />
                          )}
                          {v.value}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}

              {combos.length > 0 && (
                <div className="mt-4 border-t border-gray-100 pt-3">
                  <div className="mb-2 flex items-center justify-between">
                    <h4 className="text-xs font-black text-gray-900">المتغيرات ({combos.length})</h4>
                    <span className="text-[10px] text-gray-500">اترك فارغًا = السعر/المخزون الأساسي</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50">
                        <tr>
                          {variantAttrs.map((a) => (
                            <th key={a.id} className="px-2 py-2 text-right font-bold text-gray-600">
                              {a.name}
                            </th>
                          ))}
                          <th className="px-2 py-2 text-right font-bold text-gray-600">السعر</th>
                          <th className="px-2 py-2 text-right font-bold text-gray-600">المخزون</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {combos.map((combo) => {
                          const data = form.variantData[combo.key] || { price: 0, stock: 0 };
                          return (
                            <tr key={combo.key}>
                              {combo.labels.map((label, i) => (
                                <td key={i} className="px-2 py-1.5">
                                  <div className="flex items-center gap-1">
                                    {label.colorHex && (
                                      <span
                                        className="h-3 w-3 rounded-full border border-gray-300"
                                        style={{ backgroundColor: label.colorHex }}
                                      />
                                    )}
                                    <span className="text-gray-700">{label.valueLabel}</span>
                                  </div>
                                </td>
                              ))}
                              <td className="px-2 py-1.5">
                                <input
                                  type="number"
                                  value={data.price || ""}
                                  onChange={(e) =>
                                    updateVariant(combo.key, "price", Number(e.target.value) || 0)
                                  }
                                  placeholder={form.price || "0"}
                                  min="0"
                                  step="0.01"
                                  className="w-20 rounded border border-gray-200 px-2 py-1 text-xs outline-none focus:border-[#ff5c00]"
                                />
                              </td>
                              <td className="px-2 py-1.5">
                                <input
                                  type="number"
                                  value={data.stock || ""}
                                  onChange={(e) =>
                                    updateVariant(combo.key, "stock", Number(e.target.value) || 0)
                                  }
                                  placeholder="0"
                                  min="0"
                                  className="w-16 rounded border border-gray-200 px-2 py-1 text-xs outline-none focus:border-[#ff5c00]"
                                />
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
          ) : null}
        </>
      )}
    </div>
  );
}