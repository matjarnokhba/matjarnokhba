"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin, Search, Loader2, X, Check } from "lucide-react";

type City = {
  id: number;
  name: string;
  nameFr: string | null;
  slug: string;
  region: string | null;
  postalCode: string | null;
  districtsCount: number;
};

type District = {
  id: number;
  name: string;
  nameFr: string | null;
  type: string;
};

type Props = {
  cityId: number | null;
  districtId: number | null;
  onChange: (cityId: number | null, districtId: number | null) => void;
  disabled?: boolean;
};

export default function CityDistrictPicker({
  cityId,
  districtId,
  onChange,
  disabled,
}: Props) {
  const [citySearch, setCitySearch] = useState("");
  const [districtSearch, setDistrictSearch] = useState("");

  const [cities, setCities] = useState<City[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);

  const [selectedCity, setSelectedCity] = useState<City | null>(null);
  const [selectedDistrict, setSelectedDistrict] = useState<District | null>(
    null
  );

  const [showCityDropdown, setShowCityDropdown] = useState(false);
  const [showDistrictDropdown, setShowDistrictDropdown] = useState(false);

  const [loadingCities, setLoadingCities] = useState(false);
  const [loadingDistricts, setLoadingDistricts] = useState(false);

  const cityRef = useRef<HTMLDivElement>(null);
  const districtRef = useRef<HTMLDivElement>(null);

  // ═══ تحميل المدن ═══
  useEffect(() => {
    const t = setTimeout(async () => {
      setLoadingCities(true);
      try {
        const params = new URLSearchParams();
        if (citySearch.trim()) params.set("q", citySearch.trim());
        params.set("limit", "50");

        const res = await fetch(`/api/cities?${params.toString()}`);
        const data = await res.json();
        if (data.success) setCities(data.cities);
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingCities(false);
      }
    }, 250);

    return () => clearTimeout(t);
  }, [citySearch]);

  // ═══ تحميل الأحياء عند اختيار مدينة ═══
  useEffect(() => {
    if (!selectedCity) {
      setDistricts([]);
      setSelectedDistrict(null);
      return;
    }

    const t = setTimeout(async () => {
      setLoadingDistricts(true);
      try {
        const params = new URLSearchParams();
        if (districtSearch.trim()) params.set("q", districtSearch.trim());

        const res = await fetch(
          `/api/cities/${selectedCity.id}/districts?${params.toString()}`
        );
        const data = await res.json();
        if (data.success) setDistricts(data.districts);
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingDistricts(false);
      }
    }, 200);

    return () => clearTimeout(t);
  }, [selectedCity, districtSearch]);

  // ═══ تحميل المدينة والحي المختارين (edit mode) ═══
  useEffect(() => {
    if (cityId && !selectedCity) {
      fetch(`/api/cities?limit=200`)
        .then((r) => r.json())
        .then((data) => {
          if (data.success) {
            const c = data.cities.find((x: City) => x.id === cityId);
            if (c) setSelectedCity(c);
          }
        });
    }
  }, [cityId, selectedCity]);

  useEffect(() => {
    if (districtId && !selectedDistrict && districts.length > 0) {
      const d = districts.find((x) => x.id === districtId);
      if (d) setSelectedDistrict(d);
    }
  }, [districtId, selectedDistrict, districts]);

  // ═══ Click outside ═══
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (cityRef.current && !cityRef.current.contains(e.target as Node)) {
        setShowCityDropdown(false);
      }
      if (
        districtRef.current &&
        !districtRef.current.contains(e.target as Node)
      ) {
        setShowDistrictDropdown(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function handleSelectCity(city: City) {
    setSelectedCity(city);
    setSelectedDistrict(null);
    setDistrictSearch("");
    setCitySearch("");
    setShowCityDropdown(false);
    onChange(city.id, null);
  }

  function handleClearCity() {
    setSelectedCity(null);
    setSelectedDistrict(null);
    setCitySearch("");
    setDistrictSearch("");
    setDistricts([]);
    onChange(null, null);
  }

  function handleSelectDistrict(d: District) {
    setSelectedDistrict(d);
    setDistrictSearch("");
    setShowDistrictDropdown(false);
    onChange(selectedCity?.id || null, d.id);
  }

  function handleClearDistrict() {
    setSelectedDistrict(null);
    setDistrictSearch("");
    onChange(selectedCity?.id || null, null);
  }

  const hasDistricts =
    selectedCity && selectedCity.districtsCount > 0;

  return (
    <div className="space-y-3">
      {/* ═══ المدينة ═══ */}
      <div>
        <label className="mb-1 block text-xs font-bold text-[#4b5563]">
          المدينة <span className="text-red-500">*</span>
        </label>

        {selectedCity ? (
          <div className="flex items-center gap-3 rounded-lg border-2 border-[#ff5c00] bg-[#fff4ed] p-3">
            <MapPin className="h-4 w-4 shrink-0 text-[#ff5c00]" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold">{selectedCity.name}</div>
              {selectedCity.region && (
                <div className="text-[10px] text-gray-500">
                  {selectedCity.region}
                </div>
              )}
            </div>
            {!disabled && (
              <button
                type="button"
                onClick={handleClearCity}
                className="flex h-7 w-7 items-center justify-center rounded-full text-gray-500 hover:bg-white"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        ) : (
          <div className="relative" ref={cityRef}>
            <div className="relative">
              <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={citySearch}
                onChange={(e) => {
                  setCitySearch(e.target.value);
                  setShowCityDropdown(true);
                }}
                onFocus={() => setShowCityDropdown(true)}
                disabled={disabled}
                placeholder="ابحث عن مدينتك..."
                className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 pr-10 pl-3 text-sm outline-none transition focus:border-[#ff5c00] focus:bg-white disabled:opacity-50"
              />
              {loadingCities && (
                <Loader2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-gray-400" />
              )}
            </div>

            {showCityDropdown && (
              <div className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                {cities.length === 0 && !loadingCities ? (
                  <div className="p-4 text-center text-xs text-gray-500">
                    لا نتائج
                  </div>
                ) : (
                  cities.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => handleSelectCity(c)}
                      className="flex w-full items-center gap-3 border-b border-gray-50 px-3 py-2.5 text-right transition hover:bg-[#fff4ed]"
                    >
                      <MapPin className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-bold">{c.name}</div>
                        <div className="text-[10px] text-gray-500">
                          {c.region}
                          {c.districtsCount > 0 && ` · ${c.districtsCount} حي`}
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ═══ الحي (يظهر بعد اختيار المدينة) ═══ */}
      {selectedCity && (
        <div>
          <label className="mb-1 block text-xs font-bold text-[#4b5563]">
            الحي {hasDistricts && <span className="text-red-500">*</span>}
            {!hasDistricts && (
              <span className="text-gray-400"> (اختياري لهذه اسم المدينة)</span>
            )}
          </label>

          {selectedDistrict ? (
            <div className="flex items-center gap-3 rounded-lg border-2 border-[#ff5c00] bg-[#fff4ed] p-3">
              <MapPin className="h-4 w-4 shrink-0 text-[#ff5c00]" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold">{selectedDistrict.name}</div>
                <div className="text-[10px] text-gray-500">
                  {districtTypeLabel(selectedDistrict.type)}
                </div>
              </div>
              {!disabled && (
                <button
                  type="button"
                  onClick={handleClearDistrict}
                  className="flex h-7 w-7 items-center justify-center rounded-full text-gray-500 hover:bg-white"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          ) : (
            <div className="relative" ref={districtRef}>
              <div className="relative">
                <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={districtSearch}
                  onChange={(e) => {
                    setDistrictSearch(e.target.value);
                    setShowDistrictDropdown(true);
                  }}
                  onFocus={() => setShowDistrictDropdown(true)}
                  disabled={disabled}
                  placeholder={
                    hasDistricts
                      ? "ابحث عن حيّك..."
                      : "اكتب الحي يدوياً (إن وُجد)"
                  }
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 pr-10 pl-3 text-sm outline-none transition focus:border-[#ff5c00] focus:bg-white disabled:opacity-50"
                />
                {loadingDistricts && (
                  <Loader2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-gray-400" />
                )}
              </div>

              {showDistrictDropdown && (
                <div className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                  {districts.length === 0 && !loadingDistricts ? (
                    <div className="p-4 text-center text-xs text-gray-500">
                      لا نتائج — يمكنك إكمال العنوان بدون حي
                    </div>
                  ) : (
                    districts.map((d) => (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => handleSelectDistrict(d)}
                        className="flex w-full items-center gap-3 border-b border-gray-50 px-3 py-2.5 text-right transition hover:bg-[#fff4ed]"
                      >
                        <MapPin className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-bold">{d.name}</div>
                          <div className="text-[10px] text-gray-500">
                            {districtTypeLabel(d.type)}
                          </div>
                        </div>
                        {districtId === d.id && (
                          <Check className="h-4 w-4 text-[#ff5c00]" />
                        )}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          {hasDistricts && !selectedDistrict && (
            <p className="mt-1 text-[10px] text-amber-600">
              ⚠️ اختر حيّك من القائمة لضمان دقة التوصيل
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function districtTypeLabel(type: string): string {
  return (
    {
      NEIGHBORHOOD: "حي",
      RURAL: "منطقة قروية",
      DOUAR: "دوار",
      VILLAGE: "قرية",
    }[type] || "حي"
  );
}