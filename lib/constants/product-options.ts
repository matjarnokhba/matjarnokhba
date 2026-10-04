// ═══════════════════════════════════════════
// قوائم الألوان والمقاسات المعتمدة
// ═══════════════════════════════════════════

export type ColorOption = {
  value: string;   // القيمة المخزنة في DB
  label: string;   // الاسم المعروض
  hex: string;     // كود اللون
};

export const COLORS: ColorOption[] = [
  { value: "أسود",      label: "أسود",      hex: "#000000" },
  { value: "أبيض",      label: "أبيض",      hex: "#FFFFFF" },
  { value: "رمادي",     label: "رمادي",     hex: "#808080" },
  { value: "فضي",       label: "فضي",       hex: "#C0C0C0" },
  { value: "أحمر",      label: "أحمر",      hex: "#EF4444" },
  { value: "خمري",      label: "خمري",      hex: "#722F37" },
  { value: "عنابي",     label: "عنابي",     hex: "#7F1D1D" },
  { value: "وردي",      label: "وردي",      hex: "#EC4899" },
  { value: "زهري",      label: "زهري",      hex: "#FFB6C1" },
  { value: "برتقالي",   label: "برتقالي",   hex: "#F97316" },
  { value: "أصفر",      label: "أصفر",      hex: "#FACC15" },
  { value: "ذهبي",      label: "ذهبي",      hex: "#EAB308" },
  { value: "بني",       label: "بني",       hex: "#78350F" },
  { value: "بيج",       label: "بيج",       hex: "#F5F5DC" },
  { value: "كريمي",     label: "كريمي",     hex: "#FFFDD0" },
  { value: "كاشمير",    label: "كاشمير",    hex: "#D4B5A0" },
  { value: "نحاسي",     label: "نحاسي",     hex: "#B87333" },
  { value: "أخضر",      label: "أخضر",      hex: "#22C55E" },
  { value: "أخضر داكن", label: "أخضر داكن", hex: "#15803D" },
  { value: "زيتي",      label: "زيتي",      hex: "#808000" },
  { value: "أزرق",      label: "أزرق",      hex: "#3B82F6" },
  { value: "كحلي",      label: "كحلي",      hex: "#1E3A8A" },
  { value: "سماوي",     label: "سماوي",     hex: "#87CEEB" },
  { value: "تركوازي",   label: "تركوازي",   hex: "#06B6D4" },
  { value: "نيلي",      label: "نيلي",      hex: "#4F46E5" },
  { value: "بنفسجي",    label: "بنفسجي",    hex: "#8B5CF6" },
];

export const SIZES: string[] = [
  "XS",
  "S",
  "M",
  "L",
  "XL",
  "XXL",
  "3XL",
  "36",
  "38",
  "40",
  "42",
  "44",
  "46",
  "48",
];

// ═══ البحث عن لون ═══
export function findColor(value: string): ColorOption | undefined {
  return COLORS.find((c) => c.value === value);
}