// ═══════════════════════════════════════════
// Geocoding Service — Photon (Komoot)
// Free, no API key, built on OpenStreetMap
// Docs: https://photon.komoot.io
// ═══════════════════════════════════════════

const PHOTON_BASE = "https://photon.komoot.io/api";

// نطاق المغرب التقريبي (bbox: minLon,minLat,maxLon,maxLat)
const MOROCCO_BBOX = "-13.5,27.5,-0.5,36.0";

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
  state: string | null;
  street: string | null;
  housenumber: string | null;
  postcode: string | null;
  type: string;
  lat: number;
  lng: number;
};

type PhotonFeature = {
  type: "Feature";
  geometry: { coordinates: [number, number]; type: "Point" };
  properties: {
    osm_id: number;
    osm_type: string;
    osm_key?: string;
    osm_value?: string;
    name?: string;
    country?: string;
    countrycode?: string;
    city?: string;
    district?: string;
    state?: string;
    street?: string;
    housenumber?: string;
    postcode?: string;
    type?: string;
    extent?: number[];
    [key: string]: any;
  };
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
  return parsePlaceId(placeId) !== null;
}

// ═══ Normalize Photon feature ═══
function normalizeFeature(f: PhotonFeature): GeocodingResult {
  const p = f.properties;

  const parts = [
    p.name,
    p.street,
    p.district,
    p.city,
    p.state,
    p.country,
  ].filter(Boolean);

  return {
    placeId: makePlaceId(p.osm_type, p.osm_id),
    osmId: p.osm_id,
    osmType: p.osm_type,
    name: p.name || p.street || p.city || "—",
    displayName: parts.join("، "),
    country: p.country || "Maroc",
    countryCode: (p.countrycode || "MA").toUpperCase(),
    city: p.city || null,
    district: p.district || null,
    state: p.state || null,
    street: p.street || null,
    housenumber: p.housenumber || null,
    postcode: p.postcode || null,
    type: p.type || p.osm_value || "unknown",
    lng: f.geometry.coordinates[0],
    lat: f.geometry.coordinates[1],
  };
}

// ═══ Search ═══
export async function searchPlaces(
  query: string,
  options: {
    lang?: "ar" | "fr" | "en" | "default";
    limit?: number;
    lat?: number;
    lng?: number;
    bbox?: string;
    types?: string[];
    includeCountryCodes?: string[];
  } = {}
): Promise<GeocodingResult[]> {
  if (!query || query.trim().length < 2) return [];

  const params = new URLSearchParams();
  params.set("q", query.trim());
  params.set("lang", options.lang || "ar");
  params.set("limit", String(options.limit || 12));
  params.set("bbox", options.bbox || MOROCCO_BBOX);

  // location bias
  if (options.lat && options.lng) {
    params.set("lat", String(options.lat));
    params.set("lon", String(options.lng));
  }

  const url = `${PHOTON_BASE}?${params.toString()}`;

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "MatjarNokhba/1.0 (matjarnokhba.vercel.app)",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      console.error("Photon search failed:", res.status);
      return [];
    }

    const data = await res.json();
    let results: GeocodingResult[] = (data.features || []).map(
      normalizeFeature
    );

    // ═══ Filter to Morocco only (default) ═══
    if (!options.includeCountryCodes) {
      results = results.filter((r) => r.countryCode === "MA");
    } else {
      results = results.filter((r) =>
        options.includeCountryCodes!.includes(r.countryCode)
      );
    }

    // ═══ Type filter ═══
    if (options.types && options.types.length > 0) {
      results = results.filter((r) => options.types!.includes(r.type));
    }

    return results;
  } catch (err) {
    console.error("Photon fetch error:", err);
    return [];
  }
}

// ═══ Verify a place on the server ═══
export async function verifyPlace(
  placeId: string,
  expectedName: string
): Promise<GeocodingResult | null> {
  const parsed = parsePlaceId(placeId);
  if (!parsed) return null;

  // Photon has no direct ID lookup — we re-search by name
  // and confirm that a result with matching osm_id + osm_type exists
  const results = await searchPlaces(expectedName, {
    limit: 20,
    includeCountryCodes: ["MA"],
  });

  const match = results.find(
    (r) => r.osmId === parsed.osmId && r.osmType === parsed.osmType
  );

  return match || null;
}

// ═══ Coordinates within Morocco bbox ═══
export function isWithinMorocco(lat: number, lng: number): boolean {
  const [minLng, minLat, maxLng, maxLat] = MOROCCO_BBOX.split(",").map(Number);
  return lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng;
}