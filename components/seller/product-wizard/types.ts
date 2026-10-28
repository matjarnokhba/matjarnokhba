export type Category = {
  id: number;
  name: string;
  slug: string;
  parentId: number | null;
  level: number;
  isLeaf: boolean;
  order: number;
};

export type AttributeValue = {
  id: number;
  value: string;
  slug: string;
  colorHex: string | null;
  status: string;
  isOwn: boolean;
};

export type Attribute = {
  id: number;
  name: string;
  slug: string;
  type: string;
  isVariantAxis: boolean;
  isRequired: boolean;
  allowCustom: boolean;
  values: AttributeValue[];
};

export type WizardStep = 1 | 2 | 3 | 4;

export type ProductFormData = {
  categoryId: number | null;
  categoryName: string;
  categorySlug: string;

  name: string;
  slug: string;
  description: string;
  brand: string;
  badge: string;
  originCountry: string;
  videoUrl: string;

  imageUrls: string[];

  price: string;
  oldPrice: string;
  stock: string;
  barcode: string;
  freeShipping: boolean;
  minOrderQty: string;
  maxOrderQty: string;

  selectedValues: Record<number, number[]>;
  variantData: Record<string, { price: number; stock: number }>;
};

export const INITIAL_FORM: ProductFormData = {
  categoryId: null,
  categoryName: "",
  categorySlug: "",
  name: "",
  slug: "",
  description: "",
  brand: "",
  badge: "",
  originCountry: "",
  videoUrl: "",
  imageUrls: [],
  price: "",
  oldPrice: "",
  stock: "0",
  barcode: "",
  freeShipping: false,
  minOrderQty: "1",
  maxOrderQty: "",
  selectedValues: {},
  variantData: {},
};

// ✅ يدعم العربية + الإنجليزية
export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s\u0600-\u06FF-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .substring(0, 80);
}

export function buildVariantKey(
  attributes: Attribute[],
  selectedValues: Record<number, number[]>,
  valueIds: number[]
): string {
  const parts: string[] = [];
  const variantAttrs = attributes.filter((a) => a.isVariantAxis);
  for (const attr of variantAttrs) {
    const selected = selectedValues[attr.id] || [];
    if (selected.length === 0) continue;
    parts.push(`${attr.slug}:${selected.sort((a, b) => a - b).join(",")}`);
  }
  return parts.join("|");
}

export function countCombinations(
  attributes: Attribute[],
  selectedValues: Record<number, number[]>
): number {
  const variantAttrs = attributes.filter((a) => a.isVariantAxis);
  let total = 1;
  let hasAny = false;
  for (const attr of variantAttrs) {
    const count = (selectedValues[attr.id] || []).length;
    if (count > 0) {
      total *= count;
      hasAny = true;
    }
  }
  return hasAny ? total : 0;
}

export const STEPS = [
  { n: 1 as const, label: "الفئة", icon: "category" },
  { n: 2 as const, label: "المعلومات", icon: "info" },
  { n: 3 as const, label: "السعر والمخزون", icon: "price" },
  { n: 4 as const, label: "المراجعة", icon: "review" },
];