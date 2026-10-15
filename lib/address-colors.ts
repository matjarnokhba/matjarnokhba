// ═══════════════════════════════════════════
// Deterministic color generation for cities & districts
// Same name → same color, forever
// ═══════════════════════════════════════════

// ═══ Normalize Arabic/French names for consistent hashing ═══
function normalizeName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove accents
    .replace(/[أإآا]/g, "ا")
    .replace(/[ىي]/g, "ي")
    .replace(/[ؤئء]/g, "ء")
    .replace(/[ةه]/g, "ه")
    .replace(/[\s\-_.]+/g, " ");
}

// ═══ Simple string hash (FNV-1a 32-bit) ═══
function fnv1aHash(str: string): number {
  let hash = 0x811c9dc5; // FNV offset basis
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0; // FNV prime, keep 32-bit
  }
  return hash >>> 0;
}

// ═══ Generate Hue (0-359) from name ═══
export function getColorHue(name: string): number {
  const normalized = normalizeName(name);
  if (!normalized) return 0;
  return fnv1aHash(normalized) % 360;
}

// ═══ Generate Color Hex (HSL → Hex) ═══
// Fixed saturation + lightness for readable labels
export function getColorHex(name: string): string {
  const hue = getColorHue(name);
  return hslToHex(hue, 65, 45); // Saturated but not blinding
}

// ═══ Generate HSL string for CSS ═══
export function getColorHsl(name: string): string {
  const hue = getColorHue(name);
  return `hsl(${hue}, 65%, 45%)`;
}

// ═══ HSL → Hex ═══
function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;

  let r = 0;
  let g = 0;
  let b = 0;

  if (h < 60) {
    r = c;
    g = x;
    b = 0;
  } else if (h < 120) {
    r = x;
    g = c;
    b = 0;
  } else if (h < 180) {
    r = 0;
    g = c;
    b = x;
  } else if (h < 240) {
    r = 0;
    g = x;
    b = c;
  } else if (h < 300) {
    r = x;
    g = 0;
    b = c;
  } else {
    r = c;
    g = 0;
    b = x;
  }

  const toHex = (n: number) =>
    Math.round((n + m) * 255)
      .toString(16)
      .padStart(2, "0");

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// ═══ Contrast text color (black or white) ═══
export function getContrastText(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);

  // Relative luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "#000000" : "#FFFFFF";
}