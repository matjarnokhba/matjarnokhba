"use client";

import { useState } from "react";
import {
  Loader2,
  User,
  Phone,
  Check,
  Navigation,
  MapPin,
} from "lucide-react";
import GeocodingAddressPicker, {
  type GeocodingPlace,
} from "./GeocodingAddressPicker";

export type AddressFormData = {
  id?: number;
  firstName: string;
  lastName: string;
  phone: string;

  city: GeocodingPlace | null;
  district: GeocodingPlace | null;

  fullAddressText: string;

  buildingNumber: string;
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
  firstName: "",
  lastName: "",
  phone: "",
  city: null,
  district: null,
  fullAddressText: "",
  buildingNumber: "",
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
  const [locating, setLocating] = useState(false);
  const [locatingError, setLocatingError] = useState("");

  function set<K extends keyof AddressFormData>(
    key: K,
    value: AddressFormData[K]
  ) {
    setData((prev) => ({ ...prev, [key]: value }));
    setError("");
  }

  async function handleLocateMe() {
    setLocating(true);
    setLocatingError("");

    if (!navigator.geolocation) {
      setLocatingError("جهازك لا يدعم تحديد الموقع");
      setLocating(false);
      return;
    }

    try {
      await new Promise((r) => setTimeout(r, 100));

      if (navigator.permissions) {
        try {
          const status = await navigator.permissions.query({
            name: "geolocation" as PermissionName,
          });
          if (status.state === "denied") {
            setLocatingError(
              "الموقع محظور على iPhone — استخدم الخانات أدناه"
            );
            setLocating(false);
            return;
          }
        } catch {
          // ignore
        }
      }

      let position: GeolocationPosition | null = null;

      try {
        position = await new Promise<GeolocationPosition>(
          (resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 12000,
              maximumAge: 30000,
            });
          }
        );
      } catch (err: any) {
        if (err?.code === 2 || err?.code === 3) {
          position = await new Promise<GeolocationPosition>(
            (resolve, reject) => {
              navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: false,
                timeout: 15000,
                maximumAge: 60000,
              });
            }
          );
        } else {
          throw err;
        }
      }

      if (!position) throw new Error("POSITION_FAILED");

      const { latitude, longitude } = position.coords;

      const res = await fetch(
        `/api/geocoding/reverse?lat=${latitude}&lng=${longitude}`
      );
      const json = await res.json();

      if (!res.ok || !json.success || !json.result) {
        setLocatingError(
          json.message || "لم نتمكن من تحديد عنوانك — املأ يدويًا"
        );
        return;
      }

      const r = json.result;

      const cityPlace: GeocodingPlace | null = r.city
        ? {
            placeId: r.placeId,
            name: r.city,
            displayName: r.city,
            city: r.city,
            district: null,
            state: r.state,
            lat: r.lat,
            lng: r.lng,
            type: "city",
          }
        : null;

      const districtName = r.suburb || r.neighbourhood || r.district;
      const districtPlace: GeocodingPlace | null = districtName
        ? {
            placeId: r.placeId + "_d",
            name: districtName,
            displayName: districtName,
            city: r.city,
            district: districtName,
            state: r.state,
            lat: r.lat,
            lng: r.lng,
            type: "district",
          }
        : null;

      const streetPart = r.street || "";
      const numberPart = r.housenumber || "";
      const textAddress = [streetPart, numberPart].filter(Boolean).join(" ");

      setData((prev) => ({
        ...prev,
        city: cityPlace || prev.city,
        district: districtPlace || prev.district,
        fullAddressText: textAddress || prev.fullAddressText,
        postalCode: r.postcode || prev.postalCode,
        buildingNumber: numberPart || prev.buildingNumber,
      }));
    } catch (err: any) {
      console.error("Geolocation error:", err);

      const isSecure =
        typeof window !== "undefined" &&
        window.location.protocol === "https:";

      if (err?.code === 1 || err?.message === "User denied Geolocation") {
        if (!isSecure) {
          setLocatingError("⚠️ iOS يطلب HTTPS لتحديد الموقع.");
        } else {
          setLocatingError(
            "الموقع محظور على iPhone — استخدم الخانات أدناه"
          );
        }
      } else if (err?.code === 2) {
        setLocatingError("تعذّر تحديد الموقع — جرّب في مكان مكشوف");
      } else if (err?.code === 3) {
        setLocatingError("انتهت المهلة — حاول مرة أخرى");
      } else {
        setLocatingError("فشل تحديد الموقع — املأ يدويًا");
      }
    } finally {
      setLocating(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!data.firstName.trim() || data.firstName.trim().length < 2) {
      setError("الاسم الشخصي مطلوب (2 أحرف على الأقل)");
      return;
    }
    if (!data.lastName.trim() || data.lastName.trim().length < 2) {
      setError("الاسم العائلي مطلوب (2 أحرف على الأقل)");
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
    if (!data.city) {
      setError("اختر المدينة");
      return;
    }
    if (!data.district) {
      setError("اختر الحي");
      return;
    }
    if (
      !data.fullAddressText.trim() ||
      data.fullAddressText.trim().length < 3
    ) {
      setError("العنوان الكامل مطلوب (3 أحرف على الأقل)");
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
      {/* زر تحديد الموقع */}
      <div className="rounded-xl border-2 border-dashed border-[#ff5c00] bg-[#fff4ed] p-3">
        <button
          type="button"
          onClick={handleLocateMe}
          disabled={locating}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#ff5c00] py-3 text-sm font-bold text-white transition hover:bg-[#e64a00] disabled:opacity-50"
        >
          {locating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Navigation className="h-4 w-4" />
          )}
          {locating ? "جاري تحديد موقعك..." : "📍 تحديد موقعي تلقائيًا (اختياري)"}
        </button>
        <p className="mt-2 text-center text-[10px] text-gray-600">
          يعبئ المدينة والحي تلقائيًا — يمكنك تجاوزه يدويًا
        </p>

        {locatingError && (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
            <p className="text-xs text-amber-800">{locatingError}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <a
                href="https://maps.google.com"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg bg-amber-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-amber-700"
              >
                افتح Google Maps
              </a>
              <span className="text-[11px] text-amber-700">
                وانسخ اسم مدينتك وحيّك هنا
              </span>
            </div>
          </div>
        )}
      </div>

      {/* الأسماء */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-bold text-[#4b5563]">
            الاسم الشخصي <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <User className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={data.firstName}
              onChange={(e) => set("firstName", e.target.value)}
              placeholder="أحمد"
              className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 pr-10 pl-3 text-sm outline-none transition focus:border-[#ff5c00] focus:bg-white"
            />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-bold text-[#4b5563]">
            الاسم العائلي <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <User className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={data.lastName}
              onChange={(e) => set("lastName", e.target.value)}
              placeholder="العلوي"
              className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 pr-10 pl-3 text-sm outline-none transition focus:border-[#ff5c00] focus:bg-white"
            />
          </div>
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
      </div>

      {/* المدينة */}
      <GeocodingAddressPicker
        label="المدينة"
        placeholder="اكتب اسم مدينتك..."
        value={data.city}
        onChange={(city) => {
          setData((prev) => ({
            ...prev,
            city,
            district: null,
          }));
          setError("");
        }}
        required
        types={[
          "administrative",
          "city",
          "town",
          "village",
          "municipality",
        ]}
        hint="اكتب حرفين على الأقل ثم اختر من القائمة"
      />

      {/* الحي */}
      <GeocodingAddressPicker
        label="الحي / المنطقة"
        placeholder={
          data.city ? `ابحث في ${data.city.name}` : "اختر المدينة أولاً"
        }
        value={data.district}
        onChange={(district) => {
          setData((prev) => ({ ...prev, district }));
          setError("");
        }}
        disabled={!data.city}
        required
        types={[
          "suburb",
          "neighbourhood",
          "quarter",
          "city_district",
          "district",
          "hamlet",
          "village",
        ]}
        bias={
          data.city
            ? { lat: data.city.lat, lng: data.city.lng }
            : undefined
        }
        parentCity={data.city?.name || null}
        hint={
          data.city
            ? "ابحث عن حيّك — أو اختر أقرب منطقة"
            : "اختر المدينة أولاً"
        }
      />

      {/* العنوان الكامل — نص حر */}
      <div>
        <label className="mb-1 block text-xs font-bold text-[#4b5563]">
          العنوان الكامل <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <MapPin className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-gray-400" />
          <textarea
            value={data.fullAddressText}
            onChange={(e) => set("fullAddressText", e.target.value)}
            rows={3}
            maxLength={300}
            placeholder="مثال: شارع الحسن الثاني، عمارة 12، الطابق 3، شقة 4"
            className="w-full resize-none rounded-lg border border-gray-200 bg-gray-50 py-2.5 pr-10 pl-3 text-sm outline-none transition focus:border-[#ff5c00] focus:bg-white"
          />
        </div>
        <p className="mt-1 text-[10px] text-gray-500">
          اكتب العنوان كما تريده — الشارع، رقم المنزل، الطابق، أي تفاصيل
        </p>
      </div>

      {/* رقم المنزل + الرمز البريدي */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-bold text-[#4b5563]">
            رقم المنزل / العمارة{" "}
            <span className="text-gray-400">(اختياري)</span>
          </label>
          <input
            type="text"
            value={data.buildingNumber}
            onChange={(e) => set("buildingNumber", e.target.value)}
            placeholder="45"
            className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 px-3 text-sm outline-none transition focus:border-[#ff5c00] focus:bg-white"
          />
        </div>
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
            سيُستخدم تلقائيًا في الطلبات القادمة
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