import { prisma } from "@/lib/prisma";

export function slugifySupplyActivity(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s\u0600-\u06FF-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .substring(0, 60) || "activity"
  );
}

export async function ensureUniqueSupplyActivitySlug(base: string, tx?: any): Promise<string> {
  const db = tx || prisma;
  let slug = base;
  let counter = 1;
  while (await db.supplyActivity.findUnique({ where: { slug } })) {
    slug = `${base}-${counter++}`;
    if (counter > 100) throw new Error("تعذر إنشاء رابط فريد للنشاط");
  }
  return slug;
}