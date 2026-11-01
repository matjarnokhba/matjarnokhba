import { prisma } from "@/lib/prisma";
import { computeOptionsHash } from "@/lib/product-master-validation";

function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s\u0600-\u06FF-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .substring(0, 80) || "product"
  );
}

async function ensureUniqueSlug(base: string): Promise<string> {
  let slug = base;
  let counter = 1;
  while (await prisma.productMaster.findUnique({ where: { slug } })) {
    slug = `${base}-${counter++}`;
    if (counter > 100) throw new Error("تعذر إنشاء رابط فريد");
  }
  return slug;
}

export type MasterVariantInput = {
  sku?: string | null;
  barcode?: string | null;
  options?: Record<string, string> | null;
};

export type MasterCreateInput = {
  name: string;
  categoryId: number;
  brand?: string | null;
  description?: string | null;
  images: string[];
  barcode?: string | null;
  qrCode?: string | null;
  specifications?: Record<string, any> | null;
  variants: MasterVariantInput[];
};

export const ProductMasterService = {
  async createMaster(businessId: number, createdByUserId: number, input: MasterCreateInput) {
    return prisma.$transaction(async (tx) => {
      if (input.barcode) {
        const existing = await tx.productMaster.findFirst({
          where: { barcode: input.barcode, deletedAt: null },
          select: { id: true, name: true },
        });
        if (existing) {
          throw new Error(`الباركود مسجل للمنتج "${existing.name}" (ID: ${existing.id})`);
        }
      }
      if (input.qrCode) {
        const existing = await tx.productMaster.findFirst({
          where: { qrCode: input.qrCode, deletedAt: null },
          select: { id: true },
        });
        if (existing) {
          throw new Error("رمز QR مسجل مسبقًا");
        }
      }

      const category = await tx.category.findFirst({
        where: { id: input.categoryId, deletedAt: null },
        select: { id: true },
      });
      if (!category) throw new Error("الفئة غير موجودة");

      const seenHashes = new Set<string>();
      const preparedVariants = input.variants.map((v) => {
        const optionsHash = computeOptionsHash(v.options ?? null);
        if (seenHashes.has(optionsHash)) {
          throw new Error("يوجد تكرار في خيارات المتغيرات");
        }
        seenHashes.add(optionsHash);
        return { ...v, optionsHash };
      });

      if (input.variants.some((v) => v.barcode)) {
        const barcodes = input.variants.map((v) => v.barcode).filter(Boolean) as string[];
        const dups = barcodes.filter((b, i) => barcodes.indexOf(b) !== i);
        if (dups.length > 0) throw new Error(`باركود مكرر داخل المتغيرات: ${dups[0]}`);

        const existing = await tx.productMasterVariant.findFirst({
          where: { barcode: { in: barcodes } },
          select: { barcode: true },
        });
        if (existing) {
          throw new Error(`باركود متغير مسجل مسبقًا: ${existing.barcode}`);
        }
      }

      const slug = await ensureUniqueSlug(slugify(input.name));

      const master = await tx.productMaster.create({
        data: {
          createdByBusinessId: businessId,
          categoryId: input.categoryId,
          name: input.name,
          slug,
          brand: input.brand ?? null,
          description: input.description ?? null,
          images: input.images,
          barcode: input.barcode ?? null,
          qrCode: input.qrCode ?? null,
          specifications: input.specifications ?? undefined,
          isVerified: false,
          status: "ACTIVE",
          variants: {
            create: preparedVariants.map((v) => ({
              sku: v.sku ?? null,
              barcode: v.barcode ?? null,
              options: v.options ?? undefined,
              optionsHash: v.optionsHash,
            })),
          },
        },
        include: { variants: true },
      });

      // Initial lineage (creation)
      await tx.productLineage.create({
        data: {
          masterId: master.id,
          masterVariantId: master.variants[0].id,
          fromBusinessId: null,
          toBusinessId: businessId,
          quantity: 1,
          unitPrice: 0,
          transferType: "INITIAL_CREATION",
          notes: `إنشاء المنتج بواسطة المستخدم #${createdByUserId}`,
        },
      });

      return master;
    }, { timeout: 30000 });
  },

  async listMasters(params: {
    businessId?: number;
    categoryId?: number;
    brand?: string;
    search?: string;
    verifiedOnly?: boolean;
    page?: number;
    pageSize?: number;
  }) {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(Math.max(1, params.pageSize ?? 30), 100);
    const where: any = { deletedAt: null };
    if (params.businessId) where.createdByBusinessId = params.businessId;
    if (params.categoryId) where.categoryId = params.categoryId;
    if (params.brand) where.brand = params.brand;
    if (params.verifiedOnly) where.isVerified = true;
    if (params.search) {
      where.OR = [
        { name: { contains: params.search, mode: "insensitive" } },
        { brand: { contains: params.search, mode: "insensitive" } },
        { barcode: { equals: params.search } },
      ];
    }

    const [total, items] = await Promise.all([
      prisma.productMaster.count({ where }),
      prisma.productMaster.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          category: { select: { id: true, name: true, slug: true } },
          createdByBusiness: { select: { id: true, name: true, type: true, city: true, status: true, logo: true } },
          _count: { select: { variants: true, wholesaleOffers: true } },
        },
      }),
    ]);
    return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  },

  async getMaster(id: number) {
    return prisma.productMaster.findFirst({
      where: { id, deletedAt: null },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        createdByBusiness: { select: { id: true, name: true, slug: true, type: true, city: true, status: true, logo: true } },
        variants: { orderBy: { id: "asc" } },
        _count: { select: { wholesaleOffers: true } },
      },
    });
  },

  async updateMaster(id: number, data: Partial<MasterCreateInput>) {
    const current = await prisma.productMaster.findFirst({
      where: { id, deletedAt: null },
      select: { barcode: true, qrCode: true },
    });
    if (!current) throw new Error("المنتج غير موجود");

    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name.trim();
    if (data.brand !== undefined) updateData.brand = data.brand?.trim() || null;
    if (data.description !== undefined) updateData.description = data.description?.trim() || null;
    if (data.images !== undefined) updateData.images = data.images;
    if (data.categoryId !== undefined) updateData.categoryId = data.categoryId;
    if (data.specifications !== undefined) updateData.specifications = data.specifications ?? undefined;

    if (data.barcode !== undefined && data.barcode !== current.barcode) {
      if (data.barcode) {
        const existing = await prisma.productMaster.findFirst({
          where: { barcode: data.barcode, id: { not: id }, deletedAt: null },
          select: { id: true, name: true },
        });
        if (existing) throw new Error(`الباركود مسجل للمنتج "${existing.name}"`);
      }
      updateData.barcode = data.barcode?.trim() || null;
    }

    if (data.qrCode !== undefined && data.qrCode !== current.qrCode) {
      if (data.qrCode) {
        const existing = await prisma.productMaster.findFirst({
          where: { qrCode: data.qrCode, id: { not: id }, deletedAt: null },
          select: { id: true },
        });
        if (existing) throw new Error("رمز QR مسجل مسبقًا");
      }
      updateData.qrCode = data.qrCode?.trim() || null;
    }

    if (Object.keys(updateData).length === 0) throw new Error("لا يوجد تغيير");

    return prisma.productMaster.update({ where: { id }, data: updateData });
  },

  async adminVerify(id: number, approve: boolean, verifiedByUserId: number, reason?: string | null) {
    const master = await prisma.productMaster.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, isVerified: true },
    });
    if (!master) throw new Error("المنتج غير موجود");
    if (master.isVerified && approve) throw new Error("موثق مسبقًا");

    return prisma.productMaster.update({
      where: { id },
      data: approve
        ? { isVerified: true, verifiedAt: new Date(), verifiedById: verifiedByUserId }
        : { isVerified: false, verifiedAt: null, verifiedById: verifiedByUserId },
      select: { id: true, name: true, isVerified: true, verifiedAt: true },
    });
  },
};