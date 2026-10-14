"use client";

import { useState } from "react";
import { Loader2, User, Phone, Home, Check } from "lucide-react";
import CityDistrictPicker from "./CityDistrictPicker";

export type AddressFormData = {
  id?: number;
  fullName: string;
  phone: string;
  cityId: number | null;
  districtId: number | null;
  street: string;
  buildingNumber: string;
  apartment: string;
  landmark: string;
  postalCode: string;
  isDefault: boolean;
};

type Props = {
  initial?: Partial<AddressFormData>;
  onSubmit: (data: AddressFormData) => Promise<void>;
  onCancel?: () => void;
  submitLabel?: string;
};

const EMPTY: AddressFormData = {
  fullName: "",
  phone: "",
  cityId: null,
  districtId: null,
  street: "",
  buildingNumber: "",
  apartment: "",
  landmark: "",
  postalCode: "",
  isDefault: false,
};

export default function AddressForm({
  initial,
  onSubmit,
  onCancel,
  submitLabel = "حفظ",
}: Props) {
  const [data, setData] = useState<AddressFormData>({ ...EMPTY, ...initial });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  function set<K extends keyof AddressFormData>(
    key: K,
    value: AddressFormData[K]
  ) {
    setData((prev) => ({ ...prev, [key]: value }));
    setError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    // ═══ Validation ═══
    if (!data.fullName.trim() || data.fullName.trim().length < 2) {
      setError("الاسم مطلوب (2 أحرف على الأقل)");
      return;
    }
    if (!data.phone.trim()) {
      setError("رقم الهاتف مطلوب");
      return;
    }
    if (!/^0[567]\d{8}$/.test(data.phone.trim().replace(/\s|-/g, ""))) {
      setError("رقم الهاتف المغربي غير صحيح (مثال: 0612345678)");
      return;
    }
    if (!data.cityId) {
      setError("اختر المدينة");
      return;
    }
    if (!data.street.trim() || data.street.trim().length < 3) {
      setError("الشارع مطلوب (3 أحرف على الأقل)");
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit(data);
    } catch (err: any) {
      setError(err?.message || "فشل الحفظ");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* الاسم */}
      <div>
        <label className="mb-1 block text-xs font-bold text-[#4b5563]">
          الاسم الكامل <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <User className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={data.fullName}
            onChange={(e) => set("fullName", e.target.value)}
            placeholder="أحمد محمد"
            className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 pr-10 pl-3 text-sm outline-none transition focus:border-[#ff5c00] focus:bg-white"
          />
        </div>
      </div>

      {/* الهاتف */}
      <div>
        <label className="mb-1 block text-xs font-bold text-[#4b5563]">
          رقم الهاتف <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <Phone className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="tel"
            value={data.phone}
            onChange={(e) => set("phone", e.target.value)}
            placeholder="0612345678"
            dir="ltr"
            className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 pr-10 pl-3 text-sm outline-none transition focus:border-[#ff5c00] focus:bg-white"
          />
        </div>
        <p className="mt-1 text-[10px] text-gray-500">
          يقبل الصيغة: 06XXXXXXXX أو +2126XXXXXXXX
        </p>
      </div>

      {/* المدينة + الحي */}
      <CityDistrictPicker
        cityId={data.cityId}
        districtId={data.districtId}
        onChange={(cityId, districtId) => {
          setData((prev) => ({ ...prev, cityId, districtId }));
          setError("");
        }}
      />

      {/* الشارع */}
      <div>
        <label className="mb-1 block text-xs font-bold text-[#4b5563]">
          الشارع / العنوان <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <Home className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={data.street}
            onChange={(e) => set("street", e.target.value)}
            placeholder="مثال: شارع الحسن الثاني"
            className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 pr-10 pl-3 text-sm outline-none transition focus:border-[#ff5c00] focus:bg-white"
          />
        </div>
      </div>

      {/* رقم المبنى + الشقة */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-bold text-[#4b5563]">
            رقم المنزل / العمارة
          </label>
          <input
            type="text"
            value={data.buildingNumber}
            onChange={(e) => set("buildingNumber", e.target.value)}
            placeholder="مثال: 45 أو عمارة A"
            className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 px-3 text-sm outline-none transition focus:border-[#ff5c00] focus:bg-white"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-bold text-[#4b5563]">
            رقم الشقة / الطابق
          </label>
          <input
            type="text"
            value={data.apartment}
            onChange={(e) => set("apartment", e.target.value)}
            placeholder="مثال: ط3 شقة 12"
            className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 px-3 text-sm outline-none transition focus:border-[#ff5c00] focus:bg-white"
          />
        </div>
      </div>

      {/* علامة مميزة */}
      <div>
        <label className="mb-1 block text-xs font-bold text-[#4b5563]">
          علامة مميزة{" "}
          <span className="text-gray-400">(تساعد عامل التوصيل)</span>
        </label>
        <textarea
          value={data.landmark}
          onChange={(e) => set("landmark", e.target.value)}
          rows={2}
          maxLength={300}
          placeholder="مثال: قرب مسجد النور، بجانب صيدلية الأمل"
          className="w-full resize-none rounded-lg border border-gray-200 bg-gray-50 py-2.5 px-3 text-sm outline-none transition focus:border-[#ff5c00] focus:bg-white"
        />
      </div>

      {/* الرمز البريدي */}
      <div>
        <label className="mb-1 block text-xs font-bold text-[#4b5563]">
          الرمز البريدي{" "}
          <span className="text-gray-400">(اختياري)</span>
        </label>
        <input
          type="text"
          value={data.postalCode}
          onChange={(e) => set("postalCode", e.target.value)}
          placeholder="20000"
          dir="ltr"
          maxLength={10}
          className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 px-3 text-sm outline-none transition focus:border-[#ff5c00] focus:bg-white"
        />
      </div>

      {/* Default */}
      <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3 transition hover:bg-gray-100">
        <input
          type="checkbox"
          checked={data.isDefault}
          onChange={(e) => set("isDefault", e.target.checked)}
          className="h-4 w-4 accent-[#ff5c00]"
        />
        <div className="flex-1">
          <div className="text-sm font-bold">تعيين كعنوان افتراضي</div>
          <div className="text-[10px] text-gray-500">
            سيُستخدم تلقائياً في الطلبات القادمة
          </div>
        </div>
      </label>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="flex-1 rounded-lg border border-gray-200 bg-white py-3 text-sm font-bold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
          >
            إلغاء
          </button>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="flex flex-[2] items-center justify-center gap-2 rounded-lg bg-[#ff5c00] py-3 text-sm font-bold text-white transition hover:bg-[#e64a00] disabled:opacity-50"
        >
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Check className="h-4 w-4" />
          )}
          {submitting ? "جاري الحفظ..." : submitLabel}
        </button>
      </div>
    </form>
  );
}