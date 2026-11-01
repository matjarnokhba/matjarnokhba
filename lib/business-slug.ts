import { prisma } from "@/lib/prisma";

export function slugifyBusiness(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s\u0600-\u06FF-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .substring(0, 60) || "business"
  );
}

export async function ensureUniqueBusinessSlug(base: string): Promise<string> {
  let slug = base;
  let counter = 1;
  while (await prisma.business.findUnique({ where: { slug } })) {
    slug = `${base}-${counter++}`;
    if (counter > 100) throw new Error("تعذر إنشاء رابط فريد");
  }
  return slug;
}