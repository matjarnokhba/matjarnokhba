// ═══════════════════════════════════════════
// Deterministic Color Generator
// Same place (city/district) → same color FOREVER
// Source of truth: lib/moroccan-cities.ts
// ═══════════════════════════════════════════

import { findCityCanonicalSlug } from "./moroccan-cities";

// ═══════════════════════════════════════════
// تطبيع النص
// ═══════════════════════════════════════════

function normalizeName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/[ىي]/g, "ي")
    .replace(/[ؤئء]/g, "ء")
    .replace(/[ةه]/g, "ه")
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[‘’ʻʼ]/g, "'")
    .replace(/[\s\-_.ـ]+/g, " ")
    .trim();
}

// ═══════════════════════════════════════════
// تحويل أي اسم → slug موحّد
// ═══════════════════════════════════════════

export function canonicalizeName(name: string): string {
  if (!name) return "";

  const citySlug = findCityCanonicalSlug(name);
  if (citySlug) return citySlug;

  return normalizeName(name);
}

// ═══════════════════════════════════════════
// Hash (FNV-1a 32-bit)
// ═══════════════════════════════════════════

function fnv1aHash(str: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

// ═══════════════════════════════════════════
// توليد Hue + Hex + HSL
// ═══════════════════════════════════════════

export function getColorHue(name: string): number {
  const canonical = canonicalizeName(name);
  if (!canonical) return 0;
  return fnv1aHash(canonical) % 360;
}

export function getColorHex(name: string): string {
  const hue = getColorHue(name);
  return hslToHex(hue, 65, 45);
}

export function getColorHsl(name: string): string {
  const hue = getColorHue(name);
  return `hsl(${hue}, 65%, 45%)`;
}

// ═══════════════════════════════════════════
// HSL → Hex
// ═══════════════════════════════════════════

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

// ═══════════════════════════════════════════
// لون النص المقروء (أبيض/أسود)
// ═══════════════════════════════════════════

export function getContrastText(hex: string): string {
  if (!hex) return "#FFFFFF";
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "#000000" : "#FFFFFF";
}