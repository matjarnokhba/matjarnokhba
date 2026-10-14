"use client";

import { useEffect, useRef, useState } from "react";
import {
  Search,
  Loader2,
  X,
  MapPin,
  Check,
  Navigation,
} from "lucide-react";

export type GeocodingPlace = {
  placeId: string;
  name: string;
  displayName: string;
  city: string | null;
  district: string | null;
  state: string | null;
  lat: number;
  lng: number;
  type: string;
};

type Props = {
  label: string;
  placeholder: string;
  value: GeocodingPlace | null;
  onChange: (place: GeocodingPlace | null) => void;
  disabled?: boolean;
  required?: boolean;
  hint?: string;

  // Restrict search
  types?: string[]; // ["city"], ["district", "suburb"], ["street", "house"]
  bbox?: string;
  bias?: { lat: number; lng: number };

  // For district: filter by parent city name
  parentCity?: string | null;
};

export default function GeocodingAddressPicker({
  label,
  placeholder,
  value,
  onChange,
  disabled,
  required,
  hint,
  types,
  bbox,
  bias,
  parentCity,
}: Props) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<GeocodingPlace[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");

  const containerRef = useRef<HTMLDivElement>(null);

  // ═══ Debounced search ═══
  useEffect(() => {
    if (search.trim().length < 2) {
      setResults([]);
      return;
    }

    const t = setTimeout(async () => {
      setLoading(true);
      setError("");

      try {
        const params = new URLSearchParams();
        params.set("q", search.trim());
        params.set("lang", "ar");
        params.set("limit", "12");

        if (types && types.length > 0) {
          params.set("types", types.join(","));
        }
        if (bbox) params.set("bbox", bbox);
        if (bias) {
          params.set("lat", String(bias.lat));
          params.set("lng", String(bias.lng));
        }

        const res = await fetch(
          `/api/geocoding/search?${params.toString()}`
        );
        const data = await res.json();

        if (!data.success) {
          setResults([]);
          return;
        }

        let list: GeocodingPlace[] = data.results || [];

        // ═══ Filter by parent city (for districts) ═══
        if (parentCity) {
          const q = parentCity.toLowerCase();
          list = list.filter(
            (r) =>
              (r.city && r.city.toLowerCase().includes(q)) ||
              (r.state && r.state.toLowerCase().includes(q)) ||
              r.displayName.toLowerCase().includes(q)
          );
        }

        setResults(list);
      } catch {
        setError("فشل البحث");
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 350);

    return () => clearTimeout(t);
  }, [search, types, bbox, bias, parentCity]);

  // ═══ Click outside ═══
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

  function handleSelect(place: GeocodingPlace) {
    onChange(place);
    setSearch("");
    setResults([]);
    setOpen(false);
    setError("");
  }

  function handleClear() {
    onChange(null);
    setSearch("");
    setResults([]);
  }

  return (
    <div>
      <label className="mb-1 block text-xs font-bold text-[#4b5563]">
        {label} {required && <span className="text-red-500">*</span>}
      </label>

      {value ? (
        <div className="flex items-start gap-3 rounded-lg border-2 border-[#ff5c00] bg-[#fff4ed] p-3">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#ff5c00]" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold">{value.name}</div>
            {value.displayName && value.displayName !== value.name && (
              <div className="mt-0.5 text-[10px] leading-tight text-gray-500">
                {value.displayName}
              </div>
            )}
            {value.lat && value.lng && (
              <div className="mt-1 flex items-center gap-1 text-[9px] text-gray-400">
                <Navigation className="h-2.5 w-2.5" />
                <span dir="ltr">
                  {value.lat.toFixed(4)}, {value.lng.toFixed(4)}
                </span>
              </div>
            )}
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
      ) : (
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
              disabled={disabled}
              placeholder={placeholder}
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
              ) : results.length === 0 ? (
                <div className="p-4 text-center text-xs text-gray-500">
                  لا نتائج — جرّب كتابة أوضح
                </div>
              ) : (
                results.map((r) => (
                  <button
                    key={r.placeId}
                    type="button"
                    onClick={() => handleSelect(r)}
                    className="flex w-full items-start gap-3 border-b border-gray-50 px-3 py-2.5 text-right transition hover:bg-[#fff4ed]"
                  >
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold">{r.name}</div>
                      <div className="mt-0.5 line-clamp-2 text-[10px] leading-tight text-gray-500">
                        {r.displayName}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {hint && !value && (
        <p className="mt-1 text-[10px] text-gray-500">{hint}</p>
      )}

      {error && (
        <p className="mt-1 text-[10px] text-red-600">{error}</p>
      )}
    </div>
  );
}