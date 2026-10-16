"use client";

import { useEffect, useRef, useState } from "react";
import { Search, Loader2, X, MapPin, Edit3, Check } from "lucide-react";

export type DistrictValue = {
  name: string;
  placeId?: string | null;
  verified: boolean;
};

type Suggestion = {
  placeId: string;
  name: string;
  displayName: string;
  district: string | null;
  suburb: string | null;
  neighbourhood: string | null;
  lat: number;
  lng: number;
};

type Props = {
  cityName: string | null;
  cityLat?: number | null;
  cityLng?: number | null;
  value: DistrictValue | null;
  onChange: (district: DistrictValue | null) => void;
  disabled?: boolean;
  required?: boolean;
};

export default function DistrictInput({
  cityName,
  cityLat,
  cityLng,
  value,
  onChange,
  disabled,
  required,
}: Props) {
  const [search, setSearch] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [manualText, setManualText] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  // ═══ البحث في Nominatim ═══
  useEffect(() => {
    if (search.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    if (!cityName) return;

    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("q", `${search.trim()} ${cityName}`);
        params.set("types", "suburb,neighbourhood,quarter,city_district,district,hamlet,village,locality");
        params.set("limit", "10");

        if (cityLat && cityLng) {
          params.set("lat", String(cityLat));
          params.set("lng", String(cityLng));
        }

        const res = await fetch(
          `/api/geocoding/search?${params.toString()}`
        );
        const data = await res.json();

        if (data.success) {
          setSuggestions(data.results || []);
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(t);
  }, [search, cityName, cityLat, cityLng]);

  // Click outside
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function handleSelect(s: Suggestion) {
    const districtName =
      s.suburb || s.neighbourhood || s.district || s.name;
    onChange({
      name: districtName,
      placeId: s.placeId,
      verified: true,
    });
    setSearch("");
    setOpen(false);
  }

  function handleManualSubmit() {
    const trimmed = manualText.trim();
    if (trimmed.length < 2) return;

    onChange({
      name: trimmed,
      placeId: null,
      verified: false,
    });
    setManualMode(false);
    setManualText("");
  }

  function handleClear() {
    onChange(null);
    setSearch("");
    setManualText("");
    setManualMode(false);
  }

  // ═══ اختيار حر ═══
  if (manualMode) {
    return (
      <div>
        <label className="mb-1 block text-xs font-bold text-[#4b5563]">
          الحي / المنطقة {required && <span className="text-red-500">*</span>}
        </label>

        <div className="rounded-lg border-2 border-dashed border-[#ff5c00] bg-[#fff4ed] p-3">
          <div className="mb-2 flex items-center gap-2">
            <Edit3 className="h-4 w-4 text-[#ff5c00]" />
            <span className="text-xs font-bold text-gray-700">
              اكتب اسم حيّك يدويًا
            </span>
          </div>

          <input
            type="text"
            value={manualText}
            onChange={(e) => setManualText(e.target.value)}
            placeholder="مثال: حي السلام، دوار أولاد بن سالم..."
            autoFocus
            maxLength={100}
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#ff5c00]"
          />

          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={handleManualSubmit}
              disabled={manualText.trim().length < 2}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#ff5c00] py-2 text-xs font-bold text-white transition hover:bg-[#e64a00] disabled:opacity-50"
            >
              <Check className="h-3.5 w-3.5" />
              تأكيد
            </button>
            <button
              type="button"
              onClick={() => {
                setManualMode(false);
                setManualText("");
              }}
              className="flex-1 rounded-lg border border-gray-200 bg-white py-2 text-xs font-bold text-gray-700"
            >
              إلغاء
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ═══ عرض القيمة المختارة ═══
  if (value) {
    return (
      <div>
        <label className="mb-1 block text-xs font-bold text-[#4b5563]">
          الحي / المنطقة {required && <span className="text-red-500">*</span>}
        </label>

        <div
          className={`flex items-center gap-3 rounded-lg border-2 p-3 ${
            value.verified
              ? "border-[#ff5c00] bg-[#fff4ed]"
              : "border-amber-300 bg-amber-50"
          }`}
        >
          <MapPin
            className={`h-4 w-4 shrink-0 ${
              value.verified ? "text-[#ff5c00]" : "text-amber-600"
            }`}
          />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold">{value.name}</div>
            <div className="text-[10px] text-gray-500">
              {value.verified ? "✓ مؤكد من الخريطة" : "⚠️ غير مؤكد — أدخلته يدويًا"}
            </div>
          </div>
          {!disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="flex h-7 w-7 items-center justify-center rounded-full text-gray-500 hover:bg-white"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    );
  }

  // ═══ البحث الافتراضي ═══
  return (
    <div>
      <label className="mb-1 block text-xs font-bold text-[#4b5563]">
        الحي / المنطقة {required && <span className="text-red-500">*</span>}
      </label>

      <div className="relative" ref={containerRef}>
        <div className="relative">
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            disabled={disabled || !cityName}
            placeholder={
              cityName
                ? `ابحث عن حيّك في ${cityName}...`
                : "اختر المدينة أولاً"
            }
            autoComplete="off"
            className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 pr-10 pl-3 text-sm outline-none transition focus:border-[#ff5c00] focus:bg-white disabled:opacity-50"
          />
          {loading && (
            <Loader2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-gray-400" />
          )}
        </div>

        {open && search.trim().length >= 2 && (
          <div className="absolute z-40 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-xl">
            {loading ? (
              <div className="p-4 text-center text-xs text-gray-500">
                <Loader2 className="mx-auto h-4 w-4 animate-spin text-[#ff5c00]" />
                <div className="mt-1">جاري البحث...</div>
              </div>
            ) : suggestions.length === 0 ? (
              <div className="p-3">
                <div className="text-center text-xs text-gray-500">
                  لا نتائج مطابقة
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setManualMode(true);
                    setManualText(search);
                    setOpen(false);
                  }}
                  className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#ff5c00] bg-[#fff4ed] py-2 text-xs font-bold text-[#ff5c00] transition hover:bg-[#ffe4d1]"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                  اكتبه يدويًا
                </button>
              </div>
            ) : (
              <>
                {suggestions.map((s) => (
                  <button
                    key={s.placeId}
                    type="button"
                    onClick={() => handleSelect(s)}
                    className="flex w-full items-start gap-3 border-b border-gray-50 px-3 py-2.5 text-right transition hover:bg-[#fff4ed]"
                  >
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold">
                        {s.suburb || s.neighbourhood || s.district || s.name}
                      </div>
                      <div className="mt-0.5 line-clamp-1 text-[10px] text-gray-500">
                        {s.displayName}
                      </div>
                    </div>
                  </button>
                ))}

                <button
                  type="button"
                  onClick={() => {
                    setManualMode(true);
                    setManualText(search);
                    setOpen(false);
                  }}
                  className="flex w-full items-center justify-center gap-1.5 border-t border-gray-100 bg-gray-50 py-2.5 text-xs font-bold text-[#ff5c00] transition hover:bg-[#fff4ed]"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                  لم أجد حيّي — اكتبه يدويًا
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}