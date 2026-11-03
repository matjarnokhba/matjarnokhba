import { prisma } from "@/lib/prisma";

export function slugify(text: string): string {
  return (
    (text || "")
      .toLowerCase()
      .trim()
      .replace(/[^\w\s\u0600-\u06FF-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .substring(0, 80) || "item"
  );
}

export async function generateUniqueBusinessUnitSlug(
  tx: any,
  base: string
): Promise<string> {
  const db = tx ?? prisma;
  const baseSlug = slugify(base);
  let slug = baseSlug;
  let counter = 1;
  while (await db.businessUnit.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${counter++}`;
    if (counter > 100) throw new Error("تعذر إنشاء رابط فريد للنشاط");
  }
  return slug;
}