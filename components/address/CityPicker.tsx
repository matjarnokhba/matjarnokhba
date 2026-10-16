"use client";

import { useEffect, useRef, useState } from "react";
import { Search, Loader2, X, MapPin } from "lucide-react";

export type LocalCity = {
  name: string;
  nameFr: string;
  slug: string;
  region: string;
};

type Props = {
  value: LocalCity | null;
  onChange: (city: LocalCity | null) => void;
  disabled?: boolean;
  required?: boolean;
};

export default function CityPicker({
  value,
  onChange,
  disabled,
  required,
}: Props) {
  const [search, setSearch] = useState("");
  const [cities, setCities] = useState<LocalCity[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/cities/search?q=${encodeURIComponent(search)}&limit=50`
        );
        const data = await res.json();
        if (data.success) setCities(data.cities);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }, 150);

    return () => clearTimeout(t);
  }, [search]);

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

  function handleSelect(city: LocalCity) {
    onChange(city);
    setSearch("");
    setOpen(false);
  }

  function handleClear() {
    onChange(null);
    setSearch("");
  }

  return (
    <div>
      <label className="mb-1 block text-xs font-bold text-[#4b5563]">
        المدينة {required && <span className="text-red-500">*</span>}
      </label>

      {value ? (
        <div className="flex items-center gap-3 rounded-lg border-2 border-[#ff5c00] bg-[#fff4ed] p-3">
          <MapPin className="h-4 w-4 shrink-0 text-[#ff5c00]" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold">{value.name}</div>
            <div className="text-[10px] text-gray-500">
              {value.nameFr} · {value.region}
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
              placeholder="اكتب مدينتك بالعربية أو الفرنسية..."
              autoComplete="off"
              className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 pr-10 pl-3 text-sm outline-none transition focus:border-[#ff5c00] focus:bg-white disabled:opacity-50"
            />
            {loading && (
              <Loader2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-gray-400" />
            )}
          </div>

          {open && (
            <div className="absolute z-40 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-xl">
              {cities.length === 0 ? (
                <div className="p-4 text-center text-xs text-gray-500">
                  {loading ? "جاري التحميل..." : "لا نتائج — جرّب كتابة مختلفة"}
                </div>
              ) : (
                cities.map((c) => (
                  <button
                    key={c.slug}
                    type="button"
                    onClick={() => handleSelect(c)}
                    className="flex w-full items-center gap-3 border-b border-gray-50 px-3 py-2.5 text-right transition hover:bg-[#fff4ed]"
                  >
                    <MapPin className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold">{c.name}</span>
                        <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500">
                          {c.nameFr}
                        </span>
                      </div>
                      <div className="mt-0.5 text-[10px] text-gray-400">
                        {c.region}
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
  );
}