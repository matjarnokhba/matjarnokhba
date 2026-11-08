import { prisma } from "@/lib/prisma";
import { WHOLESALE_CONFIG } from "@/lib/wholesale/config";
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from "@/lib/wholesale/errors";
import { logWholesaleAction } from "@/lib/wholesale/audit";
import { NotificationService } from "./notification.service";
import {
  assertBusinessUnitCapability,
  assertBusinessUnitPermission,
  getBusinessUnitContext,
} from "@/lib/wholesale/context";

// ═══ Types ═══
type OfferClaimType = "MANUFACTURER" | "DISTRIBUTOR" | "IMPORTER" | "RESELLER";

type TierInput = {
  minQty: number;
  maxQty?: number | null;
  unitPrice: number;
};

type CreateVariantInput = {
  masterVariantId: number;
  tiers: TierInput[];
};

type CreateOfferInput = {
  masterId: number;
  wholesalePrice: number;
  minOrderQty: number;
  maxOrderQty?: number | null;
  claimType: OfferClaimType;
  claimProofUrl?: string | null;
  claimNotes?: string | null;
  notes?: string | null;
  variants: CreateVariantInput[];
};

type UpdateOfferInput = {
  wholesalePrice?: number;
  minOrderQty?: number;
  maxOrderQty?: number | null;
  notes?: string | null;
};

type ListFilters = {
  status?: "DRAFT" | "PENDING_REVIEW" | "ACTIVE" | "PAUSED" | "REJECTED" | "OUT_OF_STOCK" | "SUSPENDED" | "ARCHIVED";
  search?: string;
  page?: number;
  pageSize?: number;
};

type PublicListFilters = {
  categoryId?: number;
  businessType?: "FACTORY" | "SHOP" | "BRANCH" | "IMPORTER" | "WHOLESALER" | "DISTRIBUTOR";
  claimVerified?: boolean;
  minPrice?: number;
  maxPrice?: number;
  search?: string;
  page?: number;
  pageSize?: number;
};

// ═══ Helpers ═══
function validateTiers(
  tiers: TierInput[],
  offerMinQty: number,
  offerMaxQty: number | null
): void {
  if (!Array.isArray(tiers) || tiers.length === 0) {
    throw new ValidationError("مطلوب شريحة سعر واحدة على الأقل");
  }

  const sorted = [...tiers].sort((a, b) => a.minQty - b.minQty);

  if (sorted[0].minQty !== offerMinQty) {
    throw new ValidationError(
      `الشريحة الأولى يجب أن تبدأ من ${offerMinQty}`
    );
  }

  for (let i = 0; i < sorted.length; i++) {
    const t = sorted[i];
    if (!Number.isInteger(t.minQty) || t.minQty < 1) {
      throw new ValidationError("minQty يجب أن يكون عددًا صحيحًا >= 1");
    }
    if (typeof t.unitPrice !== "number" || t.unitPrice <= 0) {
      throw new ValidationError("unitPrice يجب أن يكون > 0");
    }
    if (
      t.maxQty !== null &&
      t.maxQty !== undefined &&
      (!Number.isInteger(t.maxQty) || t.maxQty < t.minQty)
    ) {
      throw new ValidationError("maxQty يجب أن يكون عددًا صحيحًا >= minQty");
    }

    if (i < sorted.length - 1) {
      if (t.maxQty === null || t.maxQty === undefined) {
        throw new ValidationError(
          "لا يمكن وجود شرائح بعد شريحة مفتوحة (maxQty = null)"
        );
      }
      if (sorted[i + 1].minQty !== t.maxQty + 1) {
        throw new ValidationError(
          `يوجد فجوة بين الشرائح (${t.maxQty} -> ${sorted[i + 1].minQty})`
        );
      }
    } else {
      if (offerMaxQty !== null) {
        if (
          t.maxQty !== null &&
          t.maxQty !== undefined &&
          t.maxQty !== offerMaxQty
        ) {
          throw new ValidationError(
            `آخر شريحة يجب أن تنتهي عند ${offerMaxQty} أو تكون مفتوحة`
          );
        }
      } else {
        if (t.maxQty !== null && t.maxQty !== undefined) {
          throw new ValidationError(
            "آخر شريحة يجب أن تكون مفتوحة (maxQty = null)"
          );
        }
      }
    }
  }
}

async function computeReviewLevel(
  businessUnitId: number
): Promise<"AUTO" | "MANUAL" | "TRUSTED"> {
  const bu = await prisma.businessUnit.findUnique({
    where: { id: businessUnitId },
    select: { verificationStatus: true, createdAt: true },
  });
  if (!bu || bu.verificationStatus !== "VERIFIED") return "MANUAL";
  const ageDays =
    (Date.now() - bu.createdAt.getTime()) / (1000 * 60 * 60 * 24);
  if (ageDays < WHOLESALE_CONFIG.TRUSTED_SELLER_MIN_ACCOUNT_DAYS) return "MANUAL";
  return "AUTO";
}

async function getOfferOrThrow(offerId: number) {
  const offer = await prisma.wholesaleOffer.findUnique({
    where: { id: offerId },
    include: {
      variants: {
        orderBy: { id: "asc" },
        include: {
          tiers: { orderBy: { minQty: "asc" } },
        },
      },
      master: {
        select: {
          id: true,
          name: true,
          brand: true,
          images: true,
          categoryId: true,
          status: true,
        },
      },
      businessUnit: {
        select: {
          id: true,
          name: true,
          slug: true,
          type: true,
          status: true,
          verificationStatus: true,
        },
      },
    },
  });
  if (!offer || offer.deletedAt) throw new NotFoundError("WholesaleOffer", offerId);
  return offer;
}


// ═══ M6.2: Ensure MerchantProduct exists for an offer ═══
async function ensureMerchantProductForOffer(
  tx: any,
  businessUnitId: number,
  masterId: number,
  wholesalePrice: number,
  masterVariantIds: number[]
): Promise<{ mpId: number; variantMap: Map<number, number> }> {
  let mp = await tx.merchantProduct.findFirst({
    where: { businessUnitId, masterId, deletedAt: null },
    select: { id: true },
  });

  if (!mp) {
    const master = await tx.masterProduct.findUnique({
      where: { id: masterId },
      select: { name: true, images: true, description: true },
    });
    if (!master) throw new NotFoundError("MasterProduct", masterId);

    mp = await tx.merchantProduct.create({
      data: {
        businessUnitId,
        masterId,
        displayName: master.name,
        displayImages: master.images ?? [],
        displayDescription: master.description,
        retailPrice: wholesalePrice,
        status: "DRAFT",
        isFromWholesale: false,
      },
      select: { id: true },
    });
  }

  const variantMap = new Map<number, number>();
  for (const mvId of masterVariantIds) {
    const existing = await tx.merchantVariant.findFirst({
      where: { merchantProductId: mp.id, masterVariantId: mvId },
      select: { id: true },
    });

    if (existing) {
      variantMap.set(mvId, existing.id);
      continue;
    }

    const masterVariant = await tx.masterVariant.findUnique({
      where: { id: mvId },
      select: { sku: true, barcode: true, attributes: true },
    });

    let sku = masterVariant?.sku || `M-${mp.id}-${mvId}`;
    const collision = await tx.merchantVariant.findFirst({
      where: { merchantProductId: mp.id, sku },
      select: { id: true },
    });
    if (collision) sku = `M-${mp.id}-${mvId}`;

    const hasDefault = await tx.merchantVariant.findFirst({
      where: { merchantProductId: mp.id, isDefault: true },
      select: { id: true },
    });

    const newMv = await tx.merchantVariant.create({
      data: {
        merchantProductId: mp.id,
        masterVariantId: mvId,
        displayAttributes: (masterVariant?.attributes as any) ?? [],
        baseUnitPrice: wholesalePrice,
        sku,
        barcode: masterVariant?.barcode ?? null,
        isDefault: !hasDefault,
        isActive: true,
      },
      select: { id: true },
    });

    variantMap.set(mvId, newMv.id);
  }

  return { mpId: mp.id, variantMap };
}
export const WholesaleOfferService = {
  // ═══ Create offer ═══
  async create(
    userId: number,
    businessUnitId: number,
    input: CreateOfferInput
  ): Promise<number> {
    const ctx = await getBusinessUnitContext(userId, businessUnitId);
    assertBusinessUnitCapability(ctx, "WHOLESALE_SELL");
    assertBusinessUnitPermission(ctx, "offers.write");

    if (typeof input.wholesalePrice !== "number" || input.wholesalePrice <= 0) {
      throw new ValidationError("سعر الجملة يجب أن يكون > 0");
    }
    if (!Number.isInteger(input.minOrderQty) || input.minOrderQty < 1) {
      throw new ValidationError("minOrderQty يجب أن يكون عددًا صحيحًا >= 1");
    }
    if (
      input.maxOrderQty !== null &&
      input.maxOrderQty !== undefined &&
      input.maxOrderQty < input.minOrderQty
    ) {
      throw new ValidationError("maxOrderQty يجب أن يكون >= minOrderQty");
    }
    if (!["MANUFACTURER", "DISTRIBUTOR", "IMPORTER", "RESELLER"].includes(input.claimType)) {
      throw new ValidationError("نوع claimType غير صالح");
    }
    if (!Array.isArray(input.variants) || input.variants.length === 0) {
      throw new ValidationError("يجب إضافة variant واحد على الأقل");
    }

    const master = await prisma.masterProduct.findUnique({
      where: { id: input.masterId },
      include: { variants: { select: { id: true } } },
    });
    if (!master || master.deletedAt) {
      throw new NotFoundError("MasterProduct", input.masterId);
    }
    if (master.status !== "ACTIVE") {
      throw new ValidationError(
        `المنتج الأصلي غير ACTIVE (الحالة: ${master.status})`
      );
    }

    const masterVariantIds = new Set(master.variants.map((v) => v.id));
    for (const v of input.variants) {
      if (!masterVariantIds.has(v.masterVariantId)) {
        throw new ValidationError(
          `variant ${v.masterVariantId} لا ينتمي للمنتج الأصلي`
        );
      }
      validateTiers(v.tiers, input.minOrderQty, input.maxOrderQty ?? null);
    }

    const existing = await prisma.wholesaleOffer.findFirst({
      where: {
        businessUnitId,
        masterId: input.masterId,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictError("يوجد عرض مسجل مسبقًا لهذا النشاط بنفس المنتج");
    }

    const reviewLevel = await computeReviewLevel(businessUnitId);
    const initialStatus =
      reviewLevel === "AUTO" || reviewLevel === "TRUSTED"
        ? "ACTIVE"
        : "PENDING_REVIEW";

    const created = await prisma.$transaction(async (tx) => {
      // M6.2: Ensure MerchantProduct exists and link variants
      const { mpId, variantMap } = await ensureMerchantProductForOffer(
        tx,
        businessUnitId,
        input.masterId,
        input.wholesalePrice,
        input.variants.map((v) => v.masterVariantId)
      );

      const offer = await tx.wholesaleOffer.create({
        data: {
          businessUnitId,
          masterId: input.masterId,
          merchantProductId: mpId,
          wholesalePrice: input.wholesalePrice,
          minOrderQty: input.minOrderQty,
          maxOrderQty: input.maxOrderQty ?? null,
          status: initialStatus as any,
          reviewLevel: reviewLevel as any,
          claimType: input.claimType as any,
          claimVerified: false,
          claimProofUrl: input.claimProofUrl?.trim() || null,
          claimNotes: input.claimNotes?.trim() || null,
          notes: input.notes?.trim() || null,
          approvedByUserId: null,
          approvedAt: initialStatus === "ACTIVE" ? new Date() : null,
        },
      });

      for (const v of input.variants) {
        const ov = await tx.wholesaleOfferVariant.create({
          data: {
            offerId: offer.id,
            masterVariantId: v.masterVariantId,
            merchantVariantId: variantMap.get(v.masterVariantId) ?? null,
          },
        });
        const sortedTiers = [...v.tiers].sort((a, b) => a.minQty - b.minQty);
        for (const t of sortedTiers) {
          await tx.wholesaleOfferTier.create({
            data: {
              variantId: ov.id,
              minQty: t.minQty,
              maxQty: t.maxQty ?? null,
              unitPrice: t.unitPrice,
            },
          });
        }
      }

      await logWholesaleAction(tx, {
        userId,
        businessUnitId,
        action: "wholesale_offer.created",
        entityType: "WholesaleOffer",
        entityId: offer.id,
        after: {
          masterId: input.masterId,
          merchantProductId: mpId,
          wholesalePrice: input.wholesalePrice,
          status: initialStatus,
          reviewLevel,
        },
      });

      return offer;
    });

    return created.id;
  },

  // ═══ Update basic offer fields ═══
  async update(
    userId: number,
    offerId: number,
    input: UpdateOfferInput
  ): Promise<void> {
    const offer = await getOfferOrThrow(offerId);
    const ctx = await getBusinessUnitContext(userId, offer.businessUnitId);
    assertBusinessUnitPermission(ctx, "offers.write");

    if (offer.status === "ARCHIVED" || offer.status === "SUSPENDED") {
      throw new ValidationError(
        `لا يمكن تعديل عرض بحالة ${offer.status}`
      );
    }

    if (input.wholesalePrice !== undefined) {
      if (input.wholesalePrice <= 0) {
        throw new ValidationError("سعر الجملة يجب أن يكون > 0");
      }
    }
    if (input.minOrderQty !== undefined) {
      if (!Number.isInteger(input.minOrderQty) || input.minOrderQty < 1) {
        throw new ValidationError("minOrderQty يجب أن يكون >= 1");
      }
    }
    if (
      input.maxOrderQty !== undefined &&
      input.maxOrderQty !== null &&
      input.maxOrderQty < (input.minOrderQty ?? offer.minOrderQty)
    ) {
      throw new ValidationError("maxOrderQty يجب أن يكون >= minOrderQty");
    }

    const data: any = {};
    if (input.wholesalePrice !== undefined) data.wholesalePrice = input.wholesalePrice;
    if (input.minOrderQty !== undefined) data.minOrderQty = input.minOrderQty;
    if (input.maxOrderQty !== undefined) data.maxOrderQty = input.maxOrderQty;
    if (input.notes !== undefined) data.notes = input.notes?.trim() || null;

    if (Object.keys(data).length === 0) {
      throw new ValidationError("لا يوجد تغيير");
    }

    await prisma.$transaction(async (tx) => {
      await tx.wholesaleOffer.update({
        where: { id: offerId },
        data,
      });
      await logWholesaleAction(tx, {
        userId,
        businessUnitId: offer.businessUnitId,
        action: "wholesale_offer.updated",
        entityType: "WholesaleOffer",
        entityId: offerId,
        before: {
          wholesalePrice: offer.wholesalePrice,
          minOrderQty: offer.minOrderQty,
          maxOrderQty: offer.maxOrderQty,
        },
        after: data,
      });
    });
  },

  // ═══ Replace tiers for a specific variant ═══
  async replaceTiers(
    userId: number,
    offerId: number,
    offerVariantId: number,
    tiers: TierInput[]
  ): Promise<void> {
    const offer = await getOfferOrThrow(offerId);
    const ctx = await getBusinessUnitContext(userId, offer.businessUnitId);
    assertBusinessUnitPermission(ctx, "offers.write");

    const ov = offer.variants.find((v) => v.id === offerVariantId);
    if (!ov) throw new NotFoundError("WholesaleOfferVariant", offerVariantId);

    validateTiers(tiers, offer.minOrderQty, offer.maxOrderQty);

    await prisma.$transaction(async (tx) => {
      await tx.wholesaleOfferTier.deleteMany({ where: { variantId: offerVariantId } });
      const sortedTiers = [...tiers].sort((a, b) => a.minQty - b.minQty);
      for (const t of sortedTiers) {
        await tx.wholesaleOfferTier.create({
          data: {
            variantId: offerVariantId,
            minQty: t.minQty,
            maxQty: t.maxQty ?? null,
            unitPrice: t.unitPrice,
          },
        });
      }
      await logWholesaleAction(tx, {
        userId,
        businessUnitId: offer.businessUnitId,
        action: "wholesale_offer.tiers_replaced",
        entityType: "WholesaleOfferVariant",
        entityId: offerVariantId,
        after: { tiers },
      });
    });
  },

  // ═══ Submit for review ═══
  async submitForReview(userId: number, offerId: number): Promise<void> {
    const offer = await getOfferOrThrow(offerId);
    const ctx = await getBusinessUnitContext(userId, offer.businessUnitId);
    assertBusinessUnitPermission(ctx, "offers.write");

    if (offer.status !== "DRAFT" && offer.status !== "REJECTED") {
      throw new ValidationError(
        `لا يمكن إرسال عرض بحالة ${offer.status} للمراجعة`
      );
    }

    await prisma.wholesaleOffer.update({
      where: { id: offerId },
      data: { status: "PENDING_REVIEW" },
    });

    await logWholesaleAction(null, {
      userId,
      businessUnitId: offer.businessUnitId,
      action: "wholesale_offer.submitted_for_review",
      entityType: "WholesaleOffer",
      entityId: offerId,
    });
  },

  // ═══ Admin approve ═══
  async approve(adminUserId: number, offerId: number): Promise<void> {
    const offer = await getOfferOrThrow(offerId);
    if (offer.status !== "PENDING_REVIEW" && offer.status !== "REJECTED") {
      throw new ValidationError(
        `لا يمكن اعتماد عرض بحالة ${offer.status}`
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.wholesaleOffer.update({
        where: { id: offerId },
        data: {
          status: "ACTIVE",
          approvedByUserId: adminUserId,
          approvedAt: new Date(),
          reviewLevel: "MANUAL",
        },
      });
      await NotificationService.createForBU({
        businessUnitId: offer.businessUnitId,
        type: "WHOLESALE_OFFER_APPROVED",
        title: "تم اعتماد عرضك",
        message: `تم اعتماد عرض "${offer.master.name}" — ظاهر الآن في سوق الجملة`,
        link: `/wholesale/offers/${offerId}`,
        severity: "SUCCESS",
      }, tx);
      await logWholesaleAction(tx, {
        userId: adminUserId,
        businessUnitId: offer.businessUnitId,
        action: "wholesale_offer.approved",
        entityType: "WholesaleOffer",
        entityId: offerId,
      });
    });
  },

  // ═══ Admin reject ═══
  async reject(adminUserId: number, offerId: number, reason: string): Promise<void> {
    if (!reason || reason.trim().length < 3) {
      throw new ValidationError("سبب الرفض مطلوب (3 أحرف على الأقل)");
    }
    const offer = await getOfferOrThrow(offerId);

    await prisma.$transaction(async (tx) => {
      await tx.wholesaleOffer.update({
        where: { id: offerId },
        data: { status: "REJECTED", notes: reason.trim() },
      });
      await NotificationService.createForBU({
        businessUnitId: offer.businessUnitId,
        type: "WHOLESALE_OFFER_REJECTED",
        title: "تم رفض عرضك",
        message: `تم رفض عرض "${offer.master.name}". السبب: ${reason.trim()}`,
        link: `/wholesale/offers/${offerId}`,
        severity: "WARNING",
      }, tx);
      await logWholesaleAction(tx, {
        userId: adminUserId,
        businessUnitId: offer.businessUnitId,
        action: "wholesale_offer.rejected",
        entityType: "WholesaleOffer",
        entityId: offerId,
        metadata: { reason: reason.trim() },
      });
    });
  },

  // ═══ Owner pause ═══
  async pause(userId: number, offerId: number): Promise<void> {
    const offer = await getOfferOrThrow(offerId);
    const ctx = await getBusinessUnitContext(userId, offer.businessUnitId);
    assertBusinessUnitPermission(ctx, "offers.write");

    if (offer.status !== "ACTIVE") {
      throw new ValidationError("يمكن إيقاف العروض النشطة فقط");
    }

    await prisma.wholesaleOffer.update({
      where: { id: offerId },
      data: { status: "PAUSED" },
    });

    await logWholesaleAction(null, {
      userId,
      businessUnitId: offer.businessUnitId,
      action: "wholesale_offer.paused",
      entityType: "WholesaleOffer",
      entityId: offerId,
    });
  },

  // ═══ Owner resume ═══
  async resume(userId: number, offerId: number): Promise<void> {
    const offer = await getOfferOrThrow(offerId);
    const ctx = await getBusinessUnitContext(userId, offer.businessUnitId);
    assertBusinessUnitPermission(ctx, "offers.write");

    if (offer.status !== "PAUSED") {
      throw new ValidationError("يمكن استئناف العروض الموقوفة فقط");
    }

    await prisma.wholesaleOffer.update({
      where: { id: offerId },
      data: { status: "ACTIVE" },
    });

    await logWholesaleAction(null, {
      userId,
      businessUnitId: offer.businessUnitId,
      action: "wholesale_offer.resumed",
      entityType: "WholesaleOffer",
      entityId: offerId,
    });
  },

  // ═══ Owner archive ═══
  async archive(userId: number, offerId: number): Promise<void> {
    const offer = await getOfferOrThrow(offerId);
    const ctx = await getBusinessUnitContext(userId, offer.businessUnitId);
    assertBusinessUnitPermission(ctx, "offers.write");

    await prisma.wholesaleOffer.update({
      where: { id: offerId },
      data: { status: "ARCHIVED", deletedAt: new Date() },
    });

    await logWholesaleAction(null, {
      userId,
      businessUnitId: offer.businessUnitId,
      action: "wholesale_offer.archived",
      entityType: "WholesaleOffer",
      entityId: offerId,
    });
  },

  // ═══ Admin suspend ═══
  async suspend(adminUserId: number, offerId: number, reason: string): Promise<void> {
    if (!reason || reason.trim().length < 3) {
      throw new ValidationError("سبب الإيقاف مطلوب");
    }
    const offer = await getOfferOrThrow(offerId);

    await prisma.wholesaleOffer.update({
      where: { id: offerId },
      data: { status: "SUSPENDED", notes: reason.trim() },
    });

    await logWholesaleAction(null, {
      userId: adminUserId,
      businessUnitId: offer.businessUnitId,
      action: "wholesale_offer.suspended",
      entityType: "WholesaleOffer",
      entityId: offerId,
      metadata: { reason: reason.trim() },
    });
  },

  // ═══ Admin restore ═══
  async restore(adminUserId: number, offerId: number): Promise<void> {
    const offer = await getOfferOrThrow(offerId);
    if (offer.status !== "SUSPENDED" && offer.status !== "REJECTED") {
      throw new ValidationError(
        `لا يمكن استرجاع عرض بحالة ${offer.status}`
      );
    }

    await prisma.wholesaleOffer.update({
      where: { id: offerId },
      data: {
        status: "ACTIVE",
        approvedByUserId: adminUserId,
        approvedAt: new Date(),
        deletedAt: null,
      },
    });

    await logWholesaleAction(null, {
      userId: adminUserId,
      businessUnitId: offer.businessUnitId,
      action: "wholesale_offer.restored",
      entityType: "WholesaleOffer",
      entityId: offerId,
    });
  },

  // ═══ Get (owner view) ═══
  async get(userId: number, offerId: number) {
    const offer = await getOfferOrThrow(offerId);
    const ctx = await getBusinessUnitContext(userId, offer.businessUnitId);
    assertBusinessUnitPermission(ctx, "offers.read");
    return offer;
  },

  // ═══ Public read (for marketplace detail page) ═══
  async getPublic(offerId: number) {
    const offer = await prisma.wholesaleOffer.findUnique({
      where: { id: offerId },
      include: {
        variants: {
          orderBy: { id: "asc" },
          include: {
            masterVariant: {
              select: { id: true, attributes: true, isDefault: true },
            },
            tiers: { orderBy: { minQty: "asc" } },
          },
        },
        master: {
          select: {
            id: true,
            name: true,
            brand: true,
            description: true,
            images: true,
            categoryId: true,
            status: true,
          },
        },
        businessUnit: {
          select: {
            id: true,
            name: true,
            slug: true,
            type: true,
            status: true,
            verificationStatus: true,
          },
        },
      },
    });
    if (!offer || offer.deletedAt) return null;
    if (offer.status !== "ACTIVE") return null;
    if (offer.businessUnit.status !== "ACTIVE") return null;
    if (offer.master.status !== "ACTIVE") return null;
    return offer;
  },

  // ═══ List by business unit (owner dashboard) ═══
  async listByBusinessUnit(
    userId: number,
    businessUnitId: number,
    filters: ListFilters = {}
  ) {
    const ctx = await getBusinessUnitContext(userId, businessUnitId);
    assertBusinessUnitPermission(ctx, "offers.read");

    const page = Math.max(1, filters.page || 1);
    const pageSize = Math.min(100, Math.max(1, filters.pageSize || 30));

    const where: any = { businessUnitId, deletedAt: null };
    if (filters.status) where.status = filters.status;
    if (filters.search && filters.search.trim().length >= 2) {
      const q = filters.search.trim();
      where.OR = [
        { master: { name: { contains: q, mode: "insensitive" } } },
        { master: { brand: { contains: q, mode: "insensitive" } } },
      ];
    }

    const [total, items] = await Promise.all([
      prisma.wholesaleOffer.count({ where }),
      prisma.wholesaleOffer.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          master: {
            select: { id: true, name: true, brand: true, images: true },
          },
          _count: { select: { variants: true } },
        },
      }),
    ]);

    return {
      items,
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    };
  },

  // ═══ Public list (marketplace browse) ═══
  async listPublic(filters: PublicListFilters = {}) {
    const page = Math.max(1, filters.page || 1);
    const pageSize = Math.min(100, Math.max(1, filters.pageSize || 30));

    const where: any = {
      status: "ACTIVE",
      deletedAt: null,
      businessUnit: { status: "ACTIVE", deletedAt: null },
      master: { status: "ACTIVE", deletedAt: null },
    };
    if (filters.categoryId) where.master.categoryId = filters.categoryId;
    if (filters.businessType) where.businessUnit.type = filters.businessType;
    if (filters.claimVerified !== undefined) where.claimVerified = filters.claimVerified;
    if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
      where.wholesalePrice = {};
      if (filters.minPrice !== undefined) where.wholesalePrice.gte = filters.minPrice;
      if (filters.maxPrice !== undefined) where.wholesalePrice.lte = filters.maxPrice;
    }
    if (filters.search && filters.search.trim().length >= 2) {
      const q = filters.search.trim();
      where.OR = [
        { master: { name: { contains: q, mode: "insensitive" } } },
        { master: { brand: { contains: q, mode: "insensitive" } } },
      ];
    }

    const [total, items] = await Promise.all([
      prisma.wholesaleOffer.count({ where }),
      prisma.wholesaleOffer.findMany({
        where,
        orderBy: [{ claimVerified: "desc" }, { createdAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          master: {
            select: {
              id: true,
              name: true,
              brand: true,
              images: true,
              categoryId: true,
            },
          },
          businessUnit: {
            select: {
              id: true,
              name: true,
              slug: true,
              type: true,
              verificationStatus: true,
            },
          },
          _count: { select: { variants: true } },
        },
      }),
    ]);

    return {
      items,
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    };
  },

  // ═══ Helper: price for quantity ═══
  computePriceForQuantity(
    tiers: Array<{ minQty: number; maxQty: number | null; unitPrice: any }>,
    quantity: number
  ): number {
    for (const t of tiers) {
      if (
        quantity >= t.minQty &&
        (t.maxQty === null || quantity <= t.maxQty)
      ) {
        return Number(t.unitPrice);
      }
    }
    const sorted = [...tiers].sort((a, b) => b.minQty - a.minQty);
    return sorted[0] ? Number(sorted[0].unitPrice) : 0;
  },
};