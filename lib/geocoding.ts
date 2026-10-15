// ═══════════════════════════════════════════
// Geocoding Service — Nominatim (OpenStreetMap)
// Free, supports Arabic, detailed addresses
// Rate limit: 1 req/sec (must cache)
// Docs: https://nominatim.org/release-docs/latest/api/
// ═══════════════════════════════════════════

const NOMINATIM_BASE = "https://nominatim.openstreetmap.org";

// ═══ Morocco bounding box ═══
const MOROCCO_BBOX = "-17.2,20.7,-0.99,36.1";

// ═══ Required by Nominatim usage policy ═══
const USER_AGENT = "MatjarNokhba/1.0 (contact: matjarnokhba.vercel.app)";

export type GeocodingResult = {
  placeId: string;
  osmId: number;
  osmType: string;

  name: string;
  displayName: string;
  country: string;
  countryCode: string;

  city: string | null;
  district: string | null;
  suburb: string | null;
  neighbourhood: string | null;
  state: string | null;
  street: string | null;
  housenumber: string | null;
  postcode: string | null;

  type: string;
  lat: number;
  lng: number;
};

// ═══ Place ID helpers ═══
export function makePlaceId(osmType: string, osmId: number): string {
  return `${osmType}_${osmId}`;
}

export function parsePlaceId(
  placeId: string
): { osmType: string; osmId: number } | null {
  const m = placeId.match(/^([NWR])_(\d+)$/);
  if (!m) return null;
  return { osmType: m[1], osmId: parseInt(m[2]) };
}

export function isValidPlaceId(placeId: string): boolean {
  // Accept both base IDs (N_123) and extended (N_123_d, N_123_f)
  return /^([NWR])_(\d+)(_[df])?$/.test(placeId);
}

// ═══ Normalize Nominatim response ═══
function normalize(result: any): GeocodingResult {
  const addr = result.address || {};

  const city =
    addr.city || addr.town || addr.village || addr.municipality || null;

  const suburb = addr.suburb || addr.city_district || null;
  const neighbourhood = addr.neighbourhood || addr.quarter || null;
  const district = addr.district || addr.county || null;
  const state = addr.state || addr.region || null;
  const street = addr.road || addr.pedestrian || addr.footway || null;
  const housenumber = addr.house_number || null;
  const postcode = addr.postcode || null;

  const name =
    addr.amenity ||
    addr.shop ||
    street ||
    suburb ||
    neighbourhood ||
    city ||
    result.display_name?.split(",")[0] ||
    "—";

  return {
    placeId: makePlaceId(
      (result.osm_type || "N").charAt(0).toUpperCase(),
      parseInt(result.osm_id)
    ),
    osmId: parseInt(result.osm_id),
    osmType: (result.osm_type || "N").charAt(0).toUpperCase(),

    name: String(name).trim(),
    displayName: result.display_name || "",
    country: addr.country || "Maroc",
    countryCode: (addr.country_code || "ma").toUpperCase(),

    city,
    district,
    suburb,
    neighbourhood,
    state,
    street,
    housenumber,
    postcode,

    type: result.type || "unknown",
    lat: parseFloat(result.lat),
    lng: parseFloat(result.lon),
  };
}

// ═══ Search ═══
export async function searchPlaces(
  query: string,
  options: {
    lang?: "ar" | "fr" | "en";
    limit?: number;
    lat?: number;
    lng?: number;
    types?: string[];
    includeCountryCodes?: string[];
    viewbox?: string;
    bounded?: boolean;
  } = {}
): Promise<GeocodingResult[]> {
  if (!query || query.trim().length < 2) return [];

  const params = new URLSearchParams();
  params.set("q", query.trim());
  params.set("format", "jsonv2");
  params.set("addressdetails", "1");
  params.set("limit", String(options.limit || 10));
  params.set("accept-language", options.lang || "ar");

  // Filter by country (default Morocco)
  const countries =
    options.includeCountryCodes && options.includeCountryCodes.length > 0
      ? options.includeCountryCodes
      : ["ma"];
  params.set("countrycodes", countries.join(",").toLowerCase());

  // Optional viewbox for location bias
  if (options.viewbox) {
    params.set("viewbox", options.viewbox);
    params.set("bounded", options.bounded ? "1" : "0");
  } else if (options.lat !== undefined && options.lng !== undefined) {
    // Build small viewbox around point (~50km)
    const d = 0.5;
    const vb = `${options.lng - d},${options.lat + d},${options.lng + d},${options.lat - d}`;
    params.set("viewbox", vb);
    params.set("bounded", "0"); // prefer but not exclusive
  }

  const url = `${NOMINATIM_BASE}/search?${params.toString()}`;

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        "Accept-Language": options.lang || "ar",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      console.error("Nominatim search failed:", res.status, res.statusText);
      return [];
    }

    const data = await res.json();
    if (!Array.isArray(data)) return [];

    let results = data.map(normalize);

    // Type filter (Nominatim types)
    if (options.types && options.types.length > 0) {
      const allowed = new Set(options.types);
      results = results.filter((r) => allowed.has(r.type));
    }

    return results;
  } catch (err) {
    console.error("Nominatim fetch error:", err);
    return [];
  }
}

// ═══ Reverse Geocoding (Coordinates → Address) ═══
export async function reverseGeocode(
  lat: number,
  lng: number,
  lang: "ar" | "fr" | "en" = "ar"
): Promise<GeocodingResult | null> {
  if (!isWithinMorocco(lat, lng)) return null;

  const params = new URLSearchParams();
  params.set("lat", String(lat));
  params.set("lon", String(lng));
  params.set("format", "jsonv2");
  params.set("addressdetails", "1");
  params.set("accept-language", lang);
  params.set("zoom", "18"); // building level

  const url = `${NOMINATIM_BASE}/reverse?${params.toString()}`;

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        "Accept-Language": lang,
      },
      cache: "no-store",
    });

    if (!res.ok) {
      console.error("Nominatim reverse failed:", res.status);
      return null;
    }

    const data = await res.json();
    if (!data || data.error) return null;

    return normalize(data);
  } catch (err) {
    console.error("Nominatim reverse error:", err);
    return null;
  }
}

// ═══ Verify a place on the server ═══
export async function verifyPlace(
  placeId: string,
  expectedName: string
): Promise<GeocodingResult | null> {
  // ═══ Parse (accept extended IDs) ═══
  const m = placeId.match(/^([NWR])_(\d+)(?:_([df]))?$/);
  if (!m) return null;

  const osmType = m[1];
  const osmId = parseInt(m[2]);

  // Nominatim /lookup by OSM ID
  const params = new URLSearchParams();
  params.set("osm_ids", `${osmType}${osmId}`);
  params.set("format", "jsonv2");
  params.set("addressdetails", "1");
  params.set("accept-language", "ar");

  const url = `${NOMINATIM_BASE}/lookup?${params.toString()}`;

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        "Accept-Language": "ar",
      },
      cache: "no-store",
    });

    if (!res.ok) return null;

    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;

    return normalize(data[0]);
  } catch (err) {
    console.error("Nominatim verify error:", err);
    return null;
  }
}

// ═══ Coordinates within Morocco bbox ═══
export function isWithinMorocco(lat: number, lng: number): boolean {
  const [minLng, minLat, maxLng, maxLat] = MOROCCO_BBOX.split(",").map(Number);
  return lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng;
}

// ═══ Extended place ID for locations chosen via GPS ═══
// Format: N_12345 | N_12345_d | N_12345_f  (d = district, f = full)
export function isValidPlaceIdExtended(placeId: string): boolean {
  const m = placeId.match(/^([NWR])_(\d+)(_[df])?$/);
  return m !== null;
}

export function parseExtendedPlaceId(
  placeId: string
): { osmType: string; osmId: number; variant: string | null } | null {
  const m = placeId.match(/^([NWR])_(\d+)(?:_([df]))?$/);
  if (!m) return null;
  return {
    osmType: m[1],
    osmId: parseInt(m[2]),
    variant: m[3] || null,
  };
}
// ═══ Independent lat/lng checks (for Zod refines) ═══
export function isValidMoroccoLat(lat: number): boolean {
  return lat >= 20.7 && lat <= 36.1;
}

export function isValidMoroccoLng(lng: number): boolean {
  return lng >= -17.2 && lng <= -0.99;
}