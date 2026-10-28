"use client";

import { Package, Image as ImageIcon, Layers, AlertCircle } from "lucide-react";
import type { Attribute, ProductFormData } from "./types";

type Props = {
  form: ProductFormData;
  attributes: Attribute[];
  categoryName: string;
};

function buildCombos(attrs: Attribute[], selectedValues: Record<number, number[]>) {
  const variantAttrs = attrs.filter(
    (a) => a.isVariantAxis && (selectedValues[a.id] || []).length > 0
  );
  if (variantAttrs.length === 0) return [];
  let combos: { key: string; labels: string[] }[] = [{ key: "", labels: [] }];
  for (const attr of variantAttrs) {
    const ids = selectedValues[attr.id] || [];
    const next: typeof combos = [];
    for (const combo of combos) {
      for (const id of ids) {
        const val = attr.values.find((v) => v.id === id);
        if (!val) continue;
        next.push({
          key: combo.key ? `${combo.key}|${attr.slug}:${id}` : `${attr.slug}:${id}`,
          labels: [...combo.labels, `${attr.name}: ${val.value}`],
        });
      }
    }
    combos = next;
  }
  return combos;
}

export default function StepReview({ form, attributes, categoryName }: Props) {
  const combos = buildCombos(attributes, form.selectedValues);
  const mainImage = form.imageUrls[0];
  const totalStock = combos.length > 0
    ? Object.values(form.variantData).reduce((s, v) => s + (v.stock || 0), 0)
    : Number(form.stock) || 0;

  return (
    <div className="space-y-4" dir="rtl">
      <div className="rounded-lg bg-green-50 px-3 py-2 text-xs font-bold text-green-800 flex items-start gap-2">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
        <p>راجع المعلومات قبل الحفظ. سيتم حفظ المنتج كمسودة حتى موافقة الإدارة.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Preview card */}
        <div className="lg:col-span-1">
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <h3 className="mb-3 text-xs font-black text-gray-900">معاينة المنتج</h3>
            {mainImage ? (
              <div className="aspect-square overflow-hidden rounded-lg bg-gray-100">
                <img src={mainImage} alt={form.name} className="h-full w-full object-cover" />
              </div>
            ) : (
              <div className="flex aspect-square items-center justify-center rounded-lg bg-gray-100">
                <ImageIcon className="h-8 w-8 text-gray-300" />
              </div>
            )}
            <div className="mt-3">
              <div className="text-[10px] text-gray-500">{categoryName}</div>
              <div className="mt-0.5 text-sm font-black text-gray-900">{form.name}</div>
              {form.brand && (
                <div className="text-[10px] text-gray-500">{form.brand}</div>
              )}
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="text-xl font-black text-[#ff5c00]">
                  {Number(form.price || 0).toFixed(2)}
                </span>
                <span className="text-xs text-gray-500">د.م</span>
                {Number(form.oldPrice) > 0 && (
                  <span className="text-xs text-gray-400 line-through">
                    {Number(form.oldPrice).toFixed(2)}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Details */}
        <div className="space-y-3 lg:col-span-2">
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <h3 className="mb-2 flex items-center gap-2 text-xs font-black text-gray-900">
              <Package className="h-3.5 w-3.5 text-[#ff5c00]" />
              التفاصيل
            </h3>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              <div>
                <dt className="text-gray-500">الفئة</dt>
                <dd className="font-bold text-gray-900">{categoryName}</dd>
              </div>
              <div>
                <dt className="text-gray-500">الرابط</dt>
                <dd className="font-mono text-[10px] text-gray-700" dir="ltr">{form.slug}</dd>
              </div>
              <div>
                <dt className="text-gray-500">المخزون الكلي</dt>
                <dd className="font-bold text-gray-900">{totalStock}</dd>
              </div>
              <div>
                <dt className="text-gray-500">الصور</dt>
                <dd className="font-bold text-gray-900">{form.imageUrls.length}</dd>
              </div>
              <div>
                <dt className="text-gray-500">الحد الأدنى للطلب</dt>
                <dd className="font-bold text-gray-900">{form.minOrderQty || 1}</dd>
              </div>
              <div>
                <dt className="text-gray-500">شحن مجاني</dt>
                <dd className="font-bold text-gray-900">{form.freeShipping ? "نعم" : "لا"}</dd>
              </div>
              {form.originCountry && (
                <div>
                  <dt className="text-gray-500">بلد المنشأ</dt>
                  <dd className="font-bold text-gray-900">{form.originCountry}</dd>
                </div>
              )}
              {form.barcode && (
                <div>
                  <dt className="text-gray-500">الباركود</dt>
                  <dd className="font-mono text-[10px] text-gray-700" dir="ltr">{form.barcode}</dd>
                </div>
              )}
            </dl>
            {form.description && (
              <div className="mt-3 border-t border-gray-100 pt-2">
                <div className="text-[10px] text-gray-500">الوصف</div>
                <p className="mt-1 text-xs text-gray-700 line-clamp-3">{form.description}</p>
              </div>
            )}
          </div>

          {combos.length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <h3 className="mb-2 flex items-center gap-2 text-xs font-black text-gray-900">
                <Layers className="h-3.5 w-3.5 text-[#ff5c00]" />
                المتغيرات ({combos.length})
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-[11px]">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-2 py-1.5 text-right font-bold text-gray-600">#</th>
                      <th className="px-2 py-1.5 text-right font-bold text-gray-600">التركيبة</th>
                      <th className="px-2 py-1.5 text-right font-bold text-gray-600">السعر</th>
                      <th className="px-2 py-1.5 text-right font-bold text-gray-600">المخزون</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {combos.map((combo, idx) => {
                      const data = form.variantData[combo.key] || { price: 0, stock: 0 };
                      const effectivePrice = data.price > 0 ? data.price : Number(form.price);
                      return (
                        <tr key={combo.key}>
                          <td className="px-2 py-1.5 text-gray-400">{idx + 1}</td>
                          <td className="px-2 py-1.5 text-gray-700">{combo.labels.join(" / ")}</td>
                          <td className="px-2 py-1.5 font-bold text-gray-900">{effectivePrice.toFixed(2)}</td>
                          <td className="px-2 py-1.5 text-gray-700">{data.stock}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}