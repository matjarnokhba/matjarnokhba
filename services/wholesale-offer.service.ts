import { prisma } from "@/lib/prisma";

type OfferCreateInput = {
  masterId: number;
  wholesalePrice: number;
  retailPrice?: number | null;
  minOrderQty: number;
  maxOrderQty?: number | null;
  unit: string;
  claimType: "MANUFACTURER" | "DISTRIBUTOR" | "RESELLER" | "IMPORTER";
  claimProofUrl?: string | null;
  claimNotes?: string | null;
  leadTimeDays?: number | null;
  notes?: string | null;
  tiers: Array<{ minQty: number; maxQty?: number | null; unitPrice: number }>;
  variants: Array<{ masterVariantId: number; stock: number; lowStockThreshold?: number }>;
};

const AUTO_VERIFY_MAP: Record<string, string[]> = {
  INDEPENDENT_SUPPLIER: ["MANUFACTURER", "DISTRIBUTOR", "IMPORTER"],
  WHOLESALE_TRADER: ["RESELLER"],
};

function shouldAutoVerify(businessType: string, claimType: string): boolean {
  return AUTO_VERIFY_MAP[businessType]?.includes(claimType) ?? false;
}

function validateTiers(tiers: Array<{ minQty: number; maxQty?: number | null; unitPrice: number }>) {
  if (tiers.length === 0) return;
  const sorted = [...tiers].sort((a, b) => a.minQty - b.minQty);
  for (let i = 0; i < sorted.length; i++) {
    const t = sorted[i];
    if (t.minQty < 1) throw new Error("الحد الأدنى في الشريحة يجب أن يكون ≥ 1");
    if (t.maxQty != null && t.maxQty < t.minQty) throw new Error("الحد الأقصى أقل من الحد الأدنى");
    if (i > 0) {
      const prev = sorted[i - 1];
      if (prev.maxQty == null) throw new Error("شريحة مفتوحة تليها شريحة أخرى غير مسموح");
      if (t.minQty !== prev.maxQty + 1) throw new Error("يجب أن تكون الشرائح متتالية بدون فراغات");
    }
    if (t.unitPrice <= 0) throw new Error("سعر الشريحة يجب أن يكون موجبًا");
  }
}

export const WholesaleOfferService = {
  async createOffer(businessId: number, input: OfferCreateInput) {
    return prisma.$transaction(async (tx) => {
      const biz = await tx.business.findUnique({
        where: { id: businessId },
        select: { id: true, type: true, status: true, deletedAt: true, ownerUserId: true },
      });
      if (!biz || biz.deletedAt) throw new Error("النشاط غير موجود");
      if (biz.status !== "VERIFIED") throw new Error("النشاط غير موثق");

      const master = await tx.productMaster.findFirst({
        where: { id: input.masterId, deletedAt: null },
        include: { variants: true },
      });
      if (!master) throw new Error("المنتج غير موجود");
      if (!master.isVerified && master.createdByBusinessId !== businessId) {
        throw new Error("لا يمكن عرض منتج غير موثق من نشاط آخر");
      }

      const existing = await tx.wholesaleOffer.findUnique({
        where: { businessId_masterId: { businessId, masterId: input.masterId } },
      });
      if (existing && !existing.deletedAt) throw new Error("لديك عرض مسبق لهذا المنتج");

      const masterVariantIds = new Set(master.variants.map((v: any) => v.id));
      for (const v of input.variants) {
        if (!masterVariantIds.has(v.masterVariantId)) throw new Error("متغير غير موجود في المنتج");
        if (v.stock < 0) throw new Error("الكمية لا يمكن أن تكون سالبة");
      }
      const vIds = input.variants.map((v) => v.masterVariantId);
      if (new Set(vIds).size !== vIds.length) throw new Error("تكرار في المتغيرات");

      validateTiers(input.tiers);

      const autoVerify = shouldAutoVerify(biz.type, input.claimType);

      const offer = await tx.wholesaleOffer.create({
        data: {
          businessId,
          masterId: input.masterId,
          wholesalePrice: input.wholesalePrice,
          retailPrice: input.retailPrice ?? null,
          minOrderQty: input.minOrderQty,
          maxOrderQty: input.maxOrderQty ?? null,
          unit: input.unit as any,
          claimType: input.claimType,
          claimVerified: autoVerify,
          claimProofUrl: input.claimProofUrl ?? null,
          claimNotes: input.claimNotes ?? null,
          leadTimeDays: input.leadTimeDays ?? 3,
          status: "DRAFT",
          isActive: false,
          notes: input.notes ?? null,
          tiers: input.tiers.length > 0
            ? { create: input.tiers.map((t) => ({ minQty: t.minQty, maxQty: t.maxQty ?? null, unitPrice: t.unitPrice })) }
            : undefined,
          variants: {
            create: input.variants.map((v) => ({
              masterVariantId: v.masterVariantId,
              stock: v.stock,
              lowStockThreshold: v.lowStockThreshold ?? 5,
            })),
          },
        },
        include: {
          master: { select: { id: true, name: true, brand: true, images: true, isVerified: true } },
          variants: true,
          tiers: true,
        },
      });

      return offer;
    }, { timeout: 30000 });
  },

  async updateOffer(offerId: number, businessId: number, data: Partial<OfferCreateInput>) {
    return prisma.$transaction(async (tx) => {
      const offer = await tx.wholesaleOffer.findFirst({
        where: { id: offerId, businessId, deletedAt: null },
        select: { id: true, status: true },
      });
      if (!offer) throw new Error("العرض غير موجود");
      if (offer.status === "CLOSED") throw new Error("لا يمكن تعديل عرض مغلق");

      const updateData: any = {};
      if (data.wholesalePrice !== undefined) updateData.wholesalePrice = data.wholesalePrice;
      if (data.retailPrice !== undefined) updateData.retailPrice = data.retailPrice;
      if (data.minOrderQty !== undefined) updateData.minOrderQty = data.minOrderQty;
      if (data.maxOrderQty !== undefined) updateData.maxOrderQty = data.maxOrderQty;
      if (data.unit !== undefined) updateData.unit = data.unit;
      if (data.claimProofUrl !== undefined) updateData.claimProofUrl = data.claimProofUrl;
      if (data.claimNotes !== undefined) updateData.claimNotes = data.claimNotes;
      if (data.leadTimeDays !== undefined) updateData.leadTimeDays = data.leadTimeDays;
      if (data.notes !== undefined) updateData.notes = data.notes;

      if (data.tiers !== undefined) {
        validateTiers(data.tiers);
        await tx.wholesaleOfferTier.deleteMany({ where: { offerId } });
        if (data.tiers.length > 0) {
          await tx.wholesaleOfferTier.createMany({
            data: data.tiers.map((t) => ({
              offerId,
              minQty: t.minQty,
              maxQty: t.maxQty ?? null,
              unitPrice: t.unitPrice,
            })),
          });
        }
      }

      if (data.variants !== undefined) {
        for (const v of data.variants) {
          await tx.wholesaleOfferVariant.updateMany({
            where: { offerId, masterVariantId: v.masterVariantId },
            data: {
              stock: v.stock,
              lowStockThreshold: v.lowStockThreshold ?? 5,
            },
          });
        }
      }

      if (Object.keys(updateData).length === 0 && data.tiers === undefined && data.variants === undefined) {
        throw new Error("لا يوجد تغيير");
      }

      return tx.wholesaleOffer.update({
        where: { id: offerId },
        data: updateData,
        include: { variants: true, tiers: true },
      });
    });
  },

  async updateOfferStatus(offerId: number, businessId: number, action: "activate" | "pause" | "close") {
    return prisma.$transaction(async (tx) => {
      const offer = await tx.wholesaleOffer.findFirst({
        where: { id: offerId, businessId, deletedAt: null },
        include: { variants: true },
      });
      if (!offer) throw new Error("العرض غير موجود");

      if (action === "activate") {
        if (offer.status === "CLOSED") throw new Error("عرض مغلق لا يمكن تنشيطه");
        if (!offer.claimVerified) throw new Error("يجب توثيق المطالبة قبل التنشيط");
        const available = offer.variants.reduce(
          (s: number, v: any) => s + (v.stock - v.reserved - v.inTransit),
          0
        );
        if (available <= 0) throw new Error("لا يوجد مخزون متاح للتنشيط");
        return tx.wholesaleOffer.update({
          where: { id: offerId },
          data: { status: "ACTIVE", isActive: true },
        });
      }

      if (action === "pause") {
        if (offer.status !== "ACTIVE") throw new Error("العرض غير نشط");
        return tx.wholesaleOffer.update({
          where: { id: offerId },
          data: { status: "PAUSED", isActive: false },
        });
      }

      if (action === "close") {
        return tx.wholesaleOffer.update({
          where: { id: offerId },
          data: { status: "CLOSED", isActive: false },
        });
      }

      throw new Error("إجراء غير معروف");
    });
  },

  async listMyOffers(businessId: number, filters: { status?: string; page?: number; pageSize?: number } = {}) {
    const page = Math.max(1, filters.page ?? 1);
    const pageSize = Math.min(Math.max(1, filters.pageSize ?? 30), 100);
    const where: any = { businessId, deletedAt: null };
    if (filters.status) where.status = filters.status;
    const [total, items] = await Promise.all([
      prisma.wholesaleOffer.count({ where }),
      prisma.wholesaleOffer.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          master: { select: { id: true, name: true, brand: true, images: true, isVerified: true } },
          _count: { select: { variants: true } },
          variants: { select: { stock: true, reserved: true, inTransit: true } },
          tiers: { orderBy: { minQty: "asc" } },
        },
      }),
    ]);
    const enriched = items.map((o: any) => ({
      ...o,
      totalStock: o.variants.reduce((s: number, v: any) => s + v.stock, 0),
      availableStock: o.variants.reduce((s: number, v: any) => s + Math.max(0, v.stock - v.reserved - v.inTransit), 0),
    }));
    return { items: enriched, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  },

  async getMyOffer(offerId: number, businessId: number) {
    const offer = await prisma.wholesaleOffer.findFirst({
      where: { id: offerId, businessId, deletedAt: null },
      include: {
        master: {
          select: { id: true, name: true, brand: true, images: true, barcode: true, isVerified: true, categoryId: true },
        },
        variants: {
          include: {
            masterVariant: { select: { id: true, sku: true, barcode: true, options: true, optionsHash: true } },
          },
        },
        tiers: { orderBy: { minQty: "asc" } },
        business: { select: { id: true, name: true, slug: true, type: true, status: true, city: true } },
      },
    });
    if (!offer) return null;
    return {
      ...offer,
      variants: offer.variants.map((v: any) => ({
        ...v,
        availableStock: Math.max(0, v.stock - v.reserved - v.inTransit),
      })),
    };
  },

  async listPublicOffers(filters: {
    categoryId?: number;
    businessType?: string;
    city?: string;
    search?: string;
    minPrice?: number;
    maxPrice?: number;
    page?: number;
    pageSize?: number;
  }) {
    const page = Math.max(1, filters.page ?? 1);
    const pageSize = Math.min(Math.max(1, filters.pageSize ?? 30), 100);

    const where: any = {
      deletedAt: null,
      isActive: true,
      status: "ACTIVE",
      claimVerified: true,
      business: { status: "VERIFIED", deletedAt: null },
    };
    if (filters.categoryId) where.master = { categoryId: filters.categoryId };
    if (filters.businessType) {
      where.business = { ...where.business, type: filters.businessType };
    }
    if (filters.city) {
      where.business = { ...where.business, city: filters.city };
    }
    if (filters.search) {
      where.master = {
        ...where.master,
        OR: [
          { name: { contains: filters.search, mode: "insensitive" } },
          { brand: { contains: filters.search, mode: "insensitive" } },
        ],
      };
    }
    if (filters.minPrice != null) where.wholesalePrice = { ...where.wholesalePrice, gte: filters.minPrice };
    if (filters.maxPrice != null) where.wholesalePrice = { ...where.wholesalePrice, lte: filters.maxPrice };

    const [total, items] = await Promise.all([
      prisma.wholesaleOffer.count({ where }),
      prisma.wholesaleOffer.findMany({
        where,
        orderBy: [{ ordersCount: "desc" }, { createdAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          master: {
            select: {
              id: true, name: true, slug: true, brand: true, images: true, barcode: true, categoryId: true,
            },
          },
          business: {
            select: { id: true, name: true, slug: true, type: true, city: true, logo: true, status: true },
          },
          variants: { select: { stock: true, reserved: true, inTransit: true } },
          tiers: { orderBy: { minQty: "asc" }, take: 3 },
        },
      }),
    ]);

    const enriched = items.map((o: any) => {
      const available = o.variants.reduce(
        (s: number, v: any) => s + Math.max(0, v.stock - v.reserved - v.inTransit),
        0
      );
      return {
        id: o.id,
        master: o.master,
        business: o.business,
        wholesalePrice: Number(o.wholesalePrice),
        retailPrice: o.retailPrice ? Number(o.retailPrice) : null,
        minOrderQty: o.minOrderQty,
        maxOrderQty: o.maxOrderQty,
        unit: o.unit,
        claimType: o.claimType,
        leadTimeDays: o.leadTimeDays,
        availableStock: available,
        tiers: o.tiers.map((t: any) => ({
          minQty: t.minQty,
          maxQty: t.maxQty,
          unitPrice: Number(t.unitPrice),
        })),
      };
    });

    return { items: enriched, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  },

  async getPublicOffer(offerId: number) {
    const offer = await prisma.wholesaleOffer.findFirst({
      where: {
        id: offerId,
        deletedAt: null,
        isActive: true,
        status: "ACTIVE",
        claimVerified: true,
        business: { status: "VERIFIED", deletedAt: null },
      },
      include: {
        master: {
          include: { category: { select: { id: true, name: true, slug: true } } },
        },
        business: {
          select: { id: true, name: true, slug: true, type: true, city: true, logo: true, description: true },
        },
        variants: {
          include: {
            masterVariant: { select: { id: true, sku: true, barcode: true, options: true, optionsHash: true } },
          },
        },
        tiers: { orderBy: { minQty: "asc" } },
      },
    });
    if (!offer) return null;

    // Increment views (fire-and-forget)
    prisma.wholesaleOffer
      .update({ where: { id: offerId }, data: { viewsCount: { increment: 1 } } })
      .catch(() => {});

    return {
      ...offer,
      wholesalePrice: Number(offer.wholesalePrice),
      retailPrice: offer.retailPrice ? Number(offer.retailPrice) : null,
      variants: offer.variants.map((v: any) => ({
        ...v,
        availableStock: Math.max(0, v.stock - v.reserved - v.inTransit),
      })),
      tiers: offer.tiers.map((t: any) => ({
        minQty: t.minQty,
        maxQty: t.maxQty,
        unitPrice: Number(t.unitPrice),
      })),
    };
  },

  async adminVerify(offerId: number, approve: boolean, adminUserId: number, reason?: string | null) {
    const offer = await prisma.wholesaleOffer.findFirst({
      where: { id: offerId, deletedAt: null },
      select: { id: true, claimVerified: true },
    });
    if (!offer) throw new Error("العرض غير موجود");
    if (offer.claimVerified) throw new Error("موثق مسبقًا");

    return prisma.wholesaleOffer.update({
      where: { id: offerId },
      data: approve
        ? { claimVerified: true }
        : {
            claimVerified: false,
            isActive: false,
            status: "CLOSED",
            claimNotes: reason ?? "رفض من الإدارة",
          },
      select: { id: true, claimVerified: true, status: true, isActive: true },
    });
  },

  async listPendingClaims(page: number = 1, pageSize: number = 30) {
    const size = Math.min(Math.max(1, pageSize), 100);
    const where = { claimVerified: false, deletedAt: null, status: { not: "CLOSED" as const } };
    const [total, items] = await Promise.all([
      prisma.wholesaleOffer.count({ where }),
      prisma.wholesaleOffer.findMany({
        where,
        orderBy: { createdAt: "asc" },
        skip: (Math.max(1, page) - 1) * size,
        take: size,
        include: {
          master: { select: { id: true, name: true, brand: true, images: true } },
          business: { select: { id: true, name: true, type: true, city: true, status: true } },
        },
      }),
    ]);
    return { items, total, page, pageSize: size, totalPages: Math.ceil(total / size) };
  },
};