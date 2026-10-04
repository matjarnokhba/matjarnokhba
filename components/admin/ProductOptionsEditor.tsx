"use client";

import { useMemo, useEffect, useState } from "react";
import { Check, Layers, Loader2, Plus, X, Clock } from "lucide-react";

export type AttributeValue = {
  id: number;
  value: string;
  slug: string;
  colorHex: string | null;
  status?: "PENDING" | "APPROVED" | "REJECTED";
  isOwn?: boolean;
};

export type Attribute = {
  id: number;
  name: string;
  slug: string;
  type: string;
  isVariantAxis: boolean;
  isRequired: boolean;
  allowCustom: boolean;
  values: AttributeValue[];
};

type Props = {
  apiBase?: "/api/admin" | "/api/seller";
  categoryId: number | null;
  selectedValues: Record<number, number[]>;
  variantData: Record<string, { price: number; stock: number }>;
  defaultPrice: number;
  defaultStock: number;
  onValuesChange: (attributeId: number, valueIds: number[]) => void;
  onVariantChange: (
    key: string,
    field: "price" | "stock",
    value: number
  ) => void;
};

type Combo = {
  key: string;
  values: Array<{ attributeId: number; valueId: number; value: string }>;
};

// ⭐⭐⭐ المفتاح = كل القيم المختارة مرتبة (يطابق الخادم) ⭐⭐⭐
function buildCombos(
  attributes: Attribute[],
  selectedValues: Record<number, number[]>
): Combo[] {
  // ⭐ لا نتحقق من isVariantAxis — نستخدم كل الخصائص المختارة
  const activeAttrs = attributes.filter(
    (a) => (selectedValues[a.id]?.length ?? 0) > 0
  );

  if (activeAttrs.length === 0) {
    return [{ key: "DEFAULT", values: [] }];
  }

  const lists = activeAttrs.map((a) => {
    const ids = selectedValues[a.id] || [];
    return ids.map((id) => {
      const v = a.values.find((x) => x.id === id);
      return { attributeId: a.id, valueId: id, value: v?.value || "" };
    });
  });

  const allCombos = lists.reduce<
    Array<Array<{ attributeId: number; valueId: number; value: string }>>
  >(
    (acc, list) => {
      const next: typeof acc = [];
      for (const existing of acc) {
        for (const v of list) {
          next.push([...existing, v]);
        }
      }
      return next;
    },
    [[]]
  );

  // ⭐ المفتاح = كل IDs مرتبة تصاعدياً
  return allCombos.map((values) => {
    const sortedIds = values.map((v) => v.valueId).sort((a, b) => a - b);
    return { key: sortedIds.join("|"), values };
  });
}

// ═══════ نموذج إضافة قيمة ═══════
function AddCustomValueForm({
  apiBase,
  attributeId,
  attributeType,
  onAdded,
  onCancel,
}: {
  apiBase: string;
  attributeId: number;
  attributeType: string;
  onAdded: (v: AttributeValue) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState("");
  const [colorHex, setColorHex] = useState("#000000");
  const [isColor, setIsColor] = useState(attributeType === "color");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [success, setSuccess] = useState(false);

  async function submit() {
    const val = text.trim();
    if (!val) {
      setErr("أدخل القيمة");
      return;
    }
    setLoading(true);
    setErr("");

    try {
      const res = await fetch(
        `${apiBase}/categories/attributes/${attributeId}/values`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            value: val,
            colorHex: isColor ? colorHex : null,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok || !data.success) {
        setErr(data.message || "فشل الإضافة");
        setLoading(false);
        return;
      }
      setSuccess(true);
      onAdded(data.value);
    } catch {
      setErr("فشل الاتصال");
      setLoading(false);
    }
  }

  return (
    <div className="mt-3 rounded-lg border-2 border-dashed border-[#ff5c00] bg-[#fff4ed] p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] font-bold text-[#ff5c00]">
          إضافة قيمة جديدة
        </span>
        <button
          type="button"
          onClick={onCancel}
          className="flex h-6 w-6 items-center justify-center rounded-full text-gray-500 hover:bg-white"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex flex-col gap-2">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="اكتب القيمة..."
          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs outline-none focus:border-[#ff5c00]"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
        />

        <label className="flex items-center gap-2 text-[11px] font-bold text-gray-700">
          <input
            type="checkbox"
            checked={isColor}
            onChange={(e) => setIsColor(e.target.checked)}
            className="h-3.5 w-3.5 rounded"
          />
          قيمة لونية
        </label>

        {isColor && (
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={colorHex}
              onChange={(e) => setColorHex(e.target.value)}
              className="h-8 w-16 cursor-pointer rounded border border-gray-200"
            />
            <input
              type="text"
              value={colorHex}
              onChange={(e) => setColorHex(e.target.value)}
              className="w-24 rounded border border-gray-200 px-2 py-1 font-mono text-[10px]"
              dir="ltr"
            />
          </div>
        )}

        {err && <p className="text-[10px] text-red-600">{err}</p>}

        {success ? (
          <div className="rounded-lg bg-blue-50 px-3 py-2 text-[10px] text-blue-700">
            ℹ️ القيمة مُضافة وتعمل مباشرة. سيراجعها الأدمن لنشرها لكل
            التجار.
          </div>
        ) : (
          <button
            type="button"
            onClick={submit}
            disabled={loading}
            className="flex items-center justify-center gap-1 rounded-lg bg-[#ff5c00] py-1.5 text-[11px] font-bold text-white hover:bg-[#e64a00] disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plus className="h-3.5 w-3.5" />
            )}
            إضافة
          </button>
        )}
      </div>
    </div>
  );
}

export default function ProductOptionsEditor({
  apiBase = "/api/admin",
  categoryId,
  selectedValues,
  variantData,
  defaultPrice,
  defaultStock,
  onValuesChange,
  onVariantChange,
}: Props) {
  const [attributes, setAttributes] = useState<Attribute[]>([]);
  const [loading, setLoading] = useState(false);
  const [openAddForm, setOpenAddForm] = useState<number | null>(null);

  useEffect(() => {
    if (!categoryId) {
      setAttributes([]);
      return;
    }
    let cancelled = false;
    setLoading(true);

    fetch(`${apiBase}/categories/${categoryId}/attributes`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && data.success) {
          setAttributes(data.attributes || []);
        }
      })
      .catch((e) => console.error(e))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [categoryId, apiBase]);

  function toggleValue(attrId: number, valueId: number) {
    const current = selectedValues[attrId] || [];
    if (current.includes(valueId)) {
      onValuesChange(
        attrId,
        current.filter((x) => x !== valueId)
      );
    } else {
      onValuesChange(attrId, [...current, valueId]);
    }
  }

  function handleCustomAdded(attrId: number, newValue: AttributeValue) {
    setAttributes((prev) =>
      prev.map((a) =>
        a.id === attrId
          ? {
              ...a,
              values: [
                ...a.values,
                { ...newValue, status: "PENDING", isOwn: true },
              ],
            }
          : a
      )
    );
    const current = selectedValues[attrId] || [];
    onValuesChange(attrId, [...current, newValue.id]);
  }

  const combos = useMemo(
    () => buildCombos(attributes, selectedValues),
    [attributes, selectedValues]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-xl bg-white p-8 shadow-sm">
        <Loader2 className="h-5 w-5 animate-spin text-[#ff5c00]" />
        <span className="mr-2 text-xs text-gray-500">
          جاري تحميل الخصائص...
        </span>
      </div>
    );
  }

  if (!categoryId) {
    return (
      <div className="rounded-xl bg-white p-5 shadow-sm">
        <h2 className="mb-1 flex items-center gap-2 text-sm font-black">
          <Layers className="h-4 w-4 text-[#ff5c00]" />
          خصائص المنتج
        </h2>
        <p className="text-[11px] text-gray-500">
          اختر التصنيف أولاً لعرض الخصائص المتاحة.
        </p>
      </div>
    );
  }

  if (attributes.length === 0) {
    return (
      <div className="rounded-xl bg-white p-5 shadow-sm">
        <h2 className="mb-1 flex items-center gap-2 text-sm font-black">
          <Layers className="h-4 w-4 text-[#ff5c00]" />
          خصائص المنتج
        </h2>
        <p className="text-[11px] text-gray-500">
          لا توجد خصائص معرّفة لهذا التصنيف بعد.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-white p-5 shadow-sm">
      <h2 className="mb-1 flex items-center gap-2 text-sm font-black">
        <Layers className="h-4 w-4 text-[#ff5c00]" />
        خصائص المنتج
      </h2>
      <p className="mb-4 text-[11px] text-gray-500">
        اختر القيم المتاحة. كل قيمة مختارة تُنشئ تركيبة مستقلة.
      </p>

      {attributes.map((attr) => {
        const selected = selectedValues[attr.id] || [];
        const isColor = attr.type === "color";

        return (
          <div key={attr.id} className="mb-5">
            <div className="mb-2 flex items-center justify-between">
              <label className="flex items-center gap-1 text-xs font-bold text-gray-700">
                {attr.name}
                {attr.isRequired && <span className="text-red-500">*</span>}
              </label>
              <div className="flex items-center gap-2">
                {selected.length > 0 && (
                  <span className="text-[10px] text-gray-500">
                    {selected.length} محدد
                  </span>
                )}
                <button
                  type="button"
                  onClick={() =>
                    setOpenAddForm(openAddForm === attr.id ? null : attr.id)
                  }
                  className="flex h-6 items-center gap-1 rounded-full bg-[#fff4ed] px-2 text-[10px] font-bold text-[#ff5c00] transition hover:bg-[#ffe4d3]"
                  title="إضافة قيمة جديدة"
                >
                  <Plus className="h-3 w-3" />
                  قيمة
                </button>
              </div>
            </div>

            {isColor ? (
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-8">
                {attr.values.map((v) => {
                  const sel = selected.includes(v.id);
                  const isLight =
                    v.colorHex === "#FFFFFF" ||
                    v.colorHex === "#F5F5DC" ||
                    v.colorHex === "#FFFDD0";
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => toggleValue(attr.id, v.id)}
                      title={v.value}
                      className={`group relative flex flex-col items-center gap-1 rounded-lg border p-1.5 transition ${
                        sel
                          ? "border-[#ff5c00] bg-[#fff4ed] ring-2 ring-[#ff5c00]"
                          : "border-gray-200 bg-white hover:border-gray-300"
                      }`}
                    >
                      {v.status === "PENDING" && (
                        <span
                          title="بانتظار مراجعة الأدمن"
                          className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-400 text-white shadow"
                        >
                          <Clock className="h-2.5 w-2.5" />
                        </span>
                      )}
                      <span
                        className={`relative flex h-8 w-8 items-center justify-center rounded-full border ${
                          isLight ? "border-gray-300" : "border-transparent"
                        }`}
                        style={{ backgroundColor: v.colorHex || "#ccc" }}
                      >
                        {sel && (
                          <Check
                            className={`h-4 w-4 ${
                              isLight ? "text-gray-700" : "text-white"
                            }`}
                            strokeWidth={3}
                          />
                        )}
                      </span>
                      <span className="line-clamp-1 text-[9px] font-bold text-gray-700">
                        {v.value}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {attr.values.map((v) => {
                  const sel = selected.includes(v.id);
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => toggleValue(attr.id, v.id)}
                      className={`relative min-w-[44px] rounded-lg border px-3 py-1.5 text-xs font-bold transition ${
                        sel
                          ? "border-[#ff5c00] bg-[#ff5c00] text-white"
                          : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
                      }`}
                    >
                      {v.status === "PENDING" && (
                        <Clock className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-amber-400 p-0.5 text-white" />
                      )}
                      {v.value}
                    </button>
                  );
                })}
              </div>
            )}

            {openAddForm === attr.id && (
              <AddCustomValueForm
                apiBase={apiBase}
                attributeId={attr.id}
                attributeType={attr.type}
                onAdded={(v) => handleCustomAdded(attr.id, v)}
                onCancel={() => setOpenAddForm(null)}
              />
            )}
          </div>
        );
      })}

      <div className="border-t border-gray-100 pt-4">
        <div className="mb-3 flex items-center justify-between">
          <label className="text-xs font-bold text-gray-700">التركيبات</label>
          <span className="rounded-full bg-[#fff4ed] px-2 py-0.5 text-[10px] font-bold text-[#ff5c00]">
            {combos.length} {combos.length === 1 ? "variant" : "variants"}
          </span>
        </div>

        <div className="overflow-hidden rounded-lg border border-gray-200">
          <table className="w-full text-xs">
            <thead className="bg-gray-50">
              <tr>
                {attributes
                  .filter((a) => (selectedValues[a.id]?.length ?? 0) > 0)
                  .map((a) => (
                    <th
                      key={a.id}
                      className="px-2 py-2 text-right font-bold text-gray-600"
                    >
                      {a.name}
                    </th>
                  ))}
                <th className="px-2 py-2 text-right font-bold text-gray-600">
                  السعر (د.م)
                </th>
                <th className="px-2 py-2 text-right font-bold text-gray-600">
                  المخزون
                </th>
              </tr>
            </thead>
            <tbody>
              {combos.map((combo) => {
                const data = variantData[combo.key] || {
                  price: defaultPrice,
                  stock: defaultStock,
                };
                return (
                  <tr key={combo.key} className="border-t border-gray-100">
                    {combo.values.map((cv) => {
                      const attr = attributes.find(
                        (a) => a.id === cv.attributeId
                      );
                      const val = attr?.values.find(
                        (v) => v.id === cv.valueId
                      );
                      const isColor = attr?.type === "color";
                      return (
                        <td key={cv.attributeId} className="px-2 py-2">
                          {isColor && val?.colorHex ? (
                            <div className="flex items-center gap-1.5">
                              <span
                                className="h-4 w-4 shrink-0 rounded-full border border-gray-200"
                                style={{ backgroundColor: val.colorHex }}
                              />
                              <span className="text-[11px] font-bold">
                                {cv.value}
                              </span>
                            </div>
                          ) : (
                            <span className="text-[11px] font-bold">
                              {cv.value}
                            </span>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-2 py-2">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={
                          data.price === 0 && defaultPrice > 0
                            ? ""
                            : data.price || ""
                        }
                        placeholder={String(defaultPrice)}
                        onChange={(e) =>
                          onVariantChange(
                            combo.key,
                            "price",
                            Number(e.target.value) || 0
                          )
                        }
                        className="w-20 rounded border border-gray-200 bg-gray-50 px-1.5 py-1 text-[11px] outline-none focus:border-[#ff5c00] focus:bg-white"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="number"
                        min="0"
                        value={
                          data.stock === 0 && defaultStock > 0
                            ? ""
                            : data.stock || ""
                        }
                        placeholder={String(defaultStock)}
                        onChange={(e) =>
                          onVariantChange(
                            combo.key,
                            "stock",
                            Number(e.target.value) || 0
                          )
                        }
                        className="w-16 rounded border border-gray-200 bg-gray-50 px-1.5 py-1 text-[11px] outline-none focus:border-[#ff5c00] focus:bg-white"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[10px] text-gray-400">
          اترك السعر/المخزون فارغين لاستخدام القيمة الافتراضية.
        </p>
      </div>
    </div>
  );
}