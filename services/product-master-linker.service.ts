import { prisma } from "@/lib/prisma";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s\u0600-\u06FF-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .substring(0, 80) || "product";
}

async function ensureUniqueSlug(db: any, base: string): Promise<string> {
  let slug = base;
  let counter = 1;
  while (await db.productMaster.findUnique({ where: { slug } })) {
    slug = `${base}-${counter++}`;
    if (counter > 100) throw new Error("Cannot generate unique master slug");
  }
  return slug;
}

export const ProductMasterLinker = {
  async ensureMasterForProduct(tx: any, productId: number) {
    const db = tx || prisma;

    const product = await db.product.findUnique({
      where: { id: productId },
      include: {
        variants: {
          select: { id: true, sku: true, barcode: true, optionsHash: true },
        },
        images: { orderBy: { order: "asc" }, select: { url: true } },
        seller: { select: { userId: true } },
      },
    });

    if (!product || product.deletedAt) return null;

    const firstBarcode =
      product.variants.find((v: any) => v.barcode)?.barcode || null;

    // Case 1: Already has masterId → sync
    if (product.masterId) {
      if (firstBarcode) {
        const conflict = await db.productMaster.findFirst({
          where: {
            barcode: firstBarcode,
            id: { not: product.masterId },
            deletedAt: null,
          },
          select: { id: true },
        });
        if (conflict) {
          await db.product.update({
            where: { id: product.id },
            data: { masterId: conflict.id },
          });
          return { masterId: conflict.id, action: "relinked" };
        }
      }

      await db.productMaster.update({
        where: { id: product.masterId },
        data: {
          barcode: firstBarcode,
          name: product.name,
          brand: product.brand,
          description: product.description,
          images: product.images.map((i: any) => i.url),
          categoryId: product.categoryId,
        },
      });
      return { masterId: product.masterId, action: "synced" };
    }

    // Case 2: No master → create or link
    if (firstBarcode) {
      const existing = await db.productMaster.findUnique({
        where: { barcode: firstBarcode },
        select: { id: true, deletedAt: true },
      });
      if (existing && !existing.deletedAt) {
        await db.product.update({
          where: { id: product.id },
          data: { masterId: existing.id },
        });
        return { masterId: existing.id, action: "linked" };
      }
    }

    const slug = await ensureUniqueSlug(db, slugify(product.name));

    let master: any;
    try {
      master = await db.productMaster.create({
        data: {
          barcode: firstBarcode,
          name: product.name,
          slug,
          brand: product.brand,
          description: product.description,
          images: product.images.map((i: any) => i.url),
          categoryId: product.categoryId,
          createdByUserId: product.seller?.userId || 1,
          manufacturerUserId: null,
          isVerified: true,
          status: "ACTIVE",
        },
      });
    } catch (e: any) {
      if (e?.code === "P2002" && firstBarcode) {
        const raced = await db.productMaster.findUnique({
          where: { barcode: firstBarcode },
          select: { id: true },
        });
        if (raced) {
          await db.product.update({
            where: { id: product.id },
            data: { masterId: raced.id },
          });
          return { masterId: raced.id, action: "linked_after_race" };
        }
      }
      throw e;
    }

    for (const v of product.variants) {
      try {
        await db.productMasterVariant.create({
          data: {
            masterId: master.id,
            sku: v.sku,
            barcode: v.barcode,
            options: {},
          },
        });
      } catch (e: any) {
        if (e?.code !== "P2002") throw e;
      }
    }

    await db.product.update({
      where: { id: product.id },
      data: { masterId: master.id },
    });

    return { masterId: master.id, action: "created" };
  },
};