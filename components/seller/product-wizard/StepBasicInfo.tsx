"use client";

import { Package, Info } from "lucide-react";
import ImageUploader from "@/components/admin/ImageUploader";
import { COUNTRIES } from "@/lib/countries";
import type { ProductFormData } from "./types";

type Props = {
  form: ProductFormData;
  update: <K extends keyof ProductFormData>(field: K, value: ProductFormData[K]) => void;
  categoryName: string;
  isEdit?: boolean;
};

export default function StepBasicInfo({ form, update, categoryName, isEdit = false }: Props) {
  return (
    <div className="space-y-4" dir="rtl">
      <div className="rounded-lg bg-orange-50 px-3 py-2 text-xs font-bold text-orange-800">
        الفئة: {categoryName}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          <div>
            <label className="mb-1 block text-xs font-bold text-gray-700">
              اسم المنتج <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              placeholder="مثال: قميص رجالي كلاسيكي"
              maxLength={200}
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-[#ff5c00] focus:bg-white"
            />
            {form.slug && (
              <p className="mt-1 text-[10px] text-gray-400 font-mono" dir="ltr">
                الرابط: /{form.slug}
              </p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold text-gray-700">الوصف</label>
            <textarea
              value={form.description}
              onChange={(e) => update("description", e.target.value)}
              rows={4}
              maxLength={2000}
              placeholder="وصف تفصيلي للمنتج..."
              className="w-full resize-none rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-[#ff5c00] focus:bg-white"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-bold text-gray-700">الماركة</label>
              <input
                type="text"
                value={form.brand}
                onChange={(e) => update("brand", e.target.value)}
                placeholder="Nike"
                maxLength={80}
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-[#ff5c00] focus:bg-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-gray-700">شارة المنتج</label>
              <input
                type="text"
                value={form.badge}
                onChange={(e) => update("badge", e.target.value)}
                placeholder="الأكثر مبيعاً"
                maxLength={40}
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-[#ff5c00] focus:bg-white"
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-bold text-gray-700">بلد المنشأ</label>
              <select
                value={form.originCountry}
                onChange={(e) => update("originCountry", e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-[#ff5c00] focus:bg-white"
              >
                <option value="">— اختر البلد —</option>
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-gray-700">فيديو المنتج (URL)</label>
              <input
                type="url"
                value={form.videoUrl}
                onChange={(e) => update("videoUrl", e.target.value)}
                placeholder="https://youtube.com/..."
                dir="ltr"
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-[#ff5c00] focus:bg-white"
              />
            </div>
          </div>
        </div>

        <div className="lg:col-span-1">
          <div className="rounded-xl bg-gray-50 p-3">
            <h3 className="mb-2 flex items-center gap-2 text-xs font-black text-gray-700">
              <Package className="h-3.5 w-3.5" />
              صور المنتج <span className="text-red-500">*</span>
            </h3>
            <ImageUploader
              value={form.imageUrls}
              onChange={(urls) => update("imageUrls", urls)}
            />
            <p className="mt-2 flex items-start gap-1 text-[10px] text-gray-500">
              <Info className="mt-0.5 h-3 w-3 shrink-0" />
              الصورة الأولى ستكون الرئيسية. اسحب لإعادة الترتيب.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}