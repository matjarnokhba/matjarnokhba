import { prisma } from "@/lib/prisma";
import {
  ConflictError,
  NotFoundError,
  ValidationError,
  ForbiddenError,
} from "@/lib/wholesale/errors";
import { logWholesaleAction } from "@/lib/wholesale/audit";
import { getBusinessUnitContext } from "@/lib/wholesale/context";

type AttributeInput = { name: string; value: string };

type CreateVariantInput = {
  masterVariantId?: number | null;
  displayAttributes: AttributeInput[];
  baseUnitPrice: number;
  sku: string;
  barcode?: string | null;
  isDefault?: boolean;
  isActive?: boolean;
};

type CreateSellingUnitInput = {
  name: string;
  conversionFactor: number;
  price: number;
  isActive?: boolean;
};

type CreateMerchantProductInput = {
  businessUnitId: number;
  masterId: number;
  displayName: string;
  displayImages: string[];
  displayDescription?: string | null;
  retailPrice: number;
  variants: CreateVariantInput[];
  sellingUnits: CreateSellingUnitInput[];
};

type UpdateDisplayInput = {
  displayName?: string;
  displayImages?: string[];
  displayDescription?: string | null;
  retailPrice?: number;
};

type UpdateVariantInput = {
  baseUnitPrice?: number;
  barcode?: string | null;
  isDefault?: boolean;
  isActive?: boolean;
};

type CreateFromWholesaleInput = {
  businessUnitId: number;
  masterId: number;
  sourceWholesaleOrderId: number;
  /** Default retail price */
  retailPrice: number;
  /** Map: masterVariantId -> unit price / sku / barcode */
  variantOverrides?: Array<{
    masterVariantId: number;
    sku?: string;
    barcode?: string | null;
    price?: number;
  }>;
};

// ═══ Validation helpers ═══
function validateDisplayImages(images: string[]): void {
  if (!Array.isArray(images) || images.length === 0) {
    throw new ValidationError("يجب إضافة صورة واحدة على الأقل");
  }
  if (images.length > 10) {
    throw new ValidationError("الحد الأقصى 10 صور");
  }
}

function validateRetailPrice(price: number): void {
  if (typeof price !== "number" || price < 0 || price > 99999999.99) {
    throw new ValidationError("سعر التجزئة غير صالح");
  }
}

function validateSellingUnits(units: CreateSellingUnitInput[]): void {
  if (!Array.isArray(units) || units.length === 0) {
    throw new ValidationError("يجب إضافة وحدة بيع واحدة على الأقل");
  }
  const names = new Set<string>();
  let hasBase = false;
  for (const u of units) {
    if (!u.name || u.name.trim().length < 1) {
      throw new ValidationError("اسم وحدة البيع مطلوب");
    }
    if (names.has(u.name)) {
      throw new ValidationError(`وحدة بيع مكررة: ${u.name}`);
    }
    names.add(u.name);
    if (u.conversionFactor <= 0) {
      throw new ValidationError("معامل التحويل يجب أن يكون موجبًا");
    }
    if (u.price < 0) {
      throw new ValidationError("سعر الوحدة لا يمكن أن يكون سالبًا");
    }
    if (u.conversionFactor === 1) hasBase = true;
  }
  if (!hasBase) {
    throw new ValidationError("يجب وجود وحدة أساسية (معامل تحويل = 1)");
  }
}

function validateVariants(variants: CreateVariantInput[]): void {
  if (!Array.isArray(variants) || variants.length === 0) {
    throw new ValidationError("يجب إضافة variant واحد على الأقل");
  }
  const skus = new Set<string>();
  let defaultCount = 0;
  for (const v of variants) {
    if (!v.sku || v.sku.trim().length < 1) {
      throw new ValidationError("SKU مطلوب لكل variant");
    }
    if (skus.has(v.sku.trim())) {
      throw new ValidationError(`SKU مكرر: ${v.sku}`);
    }
    skus.add(v.sku.trim());
    if (v.baseUnitPrice < 0) {
      throw new ValidationError("سعر variant لا يمكن أن يكون سالبًا");
    }
    if (v.isDefault) defaultCount++;
  }
  if (defaultCount > 1) {
    throw new ValidationError("لا يمكن أن يكون هناك أكثر من variant افتراضي واحد");
  }
}

async function ensureMasterActive(masterId: number): Promise<void> {
  const m = await prisma.masterProduct.findUnique({
    where: { id: masterId },
    select: { id: true, status: true, deletedAt: true },
  });
  if (!m || m.deletedAt) throw new NotFoundError("MasterProduct", masterId);
  if (m.status !== "ACTIVE") {
    throw new ValidationError(
      `المنتج الأصلي ليس ACTIVE (الحالة الحالية: ${m.status})`
    );
  }
}

async function ensureSkuUnique(
  businessUnitId: number,
  sku: string,
  excludeVariantId?: number
): Promise<void> {
  const existing = await prisma.merchantVariant.findFirst({
    where: {
      sku,
      merchantProduct: { businessUnitId, deletedAt: null },
      ...(excludeVariantId ? { id: { not: excludeVariantId } } : {}),
    },
    select: { id: true },
  });
  if (existing) throw new ConflictError(`SKU مستخدم: ${sku}`);
}

async function ensureBusinessUnitActive(businessUnitId: number, userId: number): Promise<void> {
  const ctx = await getBusinessUnitContext(userId, businessUnitId);
  if (ctx.businessUnit.status !== "ACTIVE") {
    throw new ForbiddenError("النشاط التجاري غير نشط");
  }
}

async function getMerchantProductOrThrow(id: number) {
  const p = await prisma.merchantProduct.findUnique({
    where: { id },
    include: {
      variants: { orderBy: { id: "asc" } },
      sellingUnits: {
        orderBy: { conversionFactor: "asc" },
        where: { isActive: true },
      },
      master: {
        select: {
          id: true,
          name: true,
          brand: true,
          barcode: true,
          images: true,
          categoryId: true,
          status: true,
        },
      },
      businessUnit: { select: { id: true, name: true, slug: true } },
    },
  });
  if (!p || p.deletedAt) throw new NotFoundError("MerchantProduct", id);
  return p;
}

export const MerchantProductService = {
  // ═══ Create merchant product (manual or from master) ═══
  async create(userId: number, input: CreateMerchantProductInput): Promise<number> {
    if (!input.displayName || input.displayName.trim().length < 2) {
      throw new ValidationError("اسم العرض مطلوب (حرفان على الأقل)");
    }
    validateDisplayImages(input.displayImages);
    validateRetailPrice(input.retailPrice);
    validateVariants(input.variants);
    validateSellingUnits(input.sellingUnits);

    await ensureBusinessUnitActive(input.businessUnitId, userId);
    await ensureMasterActive(input.masterId);

    // Check duplicate (businessUnitId, masterId)
    const existing = await prisma.merchantProduct.findFirst({
      where: {
        businessUnitId: input.businessUnitId,
        masterId: input.masterId,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictError(
        "يوجد منتج مسجل لهذا النشاط بنفس المنتج الأصلي"
      );
    }

    // Verify masterVariantIds belong to master
    const masterVariantIds = input.variants
      .map((v) => v.masterVariantId)
      .filter((v): v is number => typeof v === "number");

    if (masterVariantIds.length > 0) {
      const valid = await prisma.masterVariant.findMany({
        where: { id: { in: masterVariantIds }, masterId: input.masterId },
        select: { id: true },
      });
      if (valid.length !== new Set(masterVariantIds).size) {
        throw new ValidationError(
          "بعض variants لا تنتمي للمنتج الأصلي المحدد"
        );
      }
    }

    // Verify SKU uniqueness
    for (const v of input.variants) {
      await ensureSkuUnique(input.businessUnitId, v.sku.trim());
    }

    const created = await prisma.$transaction(async (tx) => {
      const product = await tx.merchantProduct.create({
        data: {
          businessUnitId: input.businessUnitId,
          masterId: input.masterId,
          displayName: input.displayName.trim(),
          displayImages: input.displayImages,
          displayDescription: input.displayDescription?.trim() || null,
          retailPrice: input.retailPrice,
          status: "DRAFT",
          isFromWholesale: false,
        },
      });

      const anyDefault = input.variants.some((v) => v.isDefault === true);
      for (let i = 0; i < input.variants.length; i++) {
        const v = input.variants[i];
        const isDefault = anyDefault ? !!v.isDefault : i === 0;
        await tx.merchantVariant.create({
          data: {
            merchantProductId: product.id,
            masterVariantId: v.masterVariantId ?? null,
            displayAttributes: (v.displayAttributes || []) as any,
            baseUnitPrice: v.baseUnitPrice,
            sku: v.sku.trim(),
            barcode: v.barcode?.trim() || null,
            isDefault,
            isActive: v.isActive !== false,
          },
        });
      }

      for (const u of input.sellingUnits) {
        await tx.sellingUnit.create({
          data: {
            merchantProductId: product.id,
            name: u.name.trim(),
            conversionFactor: u.conversionFactor,
            price: u.price,
            isActive: u.isActive !== false,
            validFrom: new Date(),
          },
        });
      }

      await logWholesaleAction(tx, {
        userId,
        businessUnitId: input.businessUnitId,
        action: "merchant_product.created",
        entityType: "MerchantProduct",
        entityId: product.id,
        after: {
          displayName: product.displayName,
          retailPrice: product.retailPrice,
          masterId: input.masterId,
        },
      });

      return product;
    });

    return created.id;
  },

  // ═══ Create from wholesale (called after order receipt) ═══
  async createFromWholesale(
    userId: number,
    input: CreateFromWholesaleInput
  ): Promise<number> {
    validateRetailPrice(input.retailPrice);
    await ensureBusinessUnitActive(input.businessUnitId, userId);
    await ensureMasterActive(input.masterId);

    const existing = await prisma.merchantProduct.findFirst({
      where: {
        businessUnitId: input.businessUnitId,
        masterId: input.masterId,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictError(
        "منتج مسجل مسبقًا لهذا النشاط. استخدم addQuantity بدلًا من createFromWholesale."
      );
    }

    const master = await prisma.masterProduct.findUnique({
      where: { id: input.masterId },
      include: { variants: { orderBy: { id: "asc" } } },
    });
    if (!master) throw new NotFoundError("MasterProduct", input.masterId);

    const overridesMap = new Map(
      (input.variantOverrides || []).map((o) => [o.masterVariantId, o])
    );

    const created = await prisma.$transaction(async (tx) => {
      const product = await tx.merchantProduct.create({
        data: {
          businessUnitId: input.businessUnitId,
          masterId: input.masterId,
          displayName: master.name,
          displayImages: master.images as string[],
          displayDescription: master.description,
          retailPrice: input.retailPrice,
          status: "DRAFT",
          isFromWholesale: true,
          sourceWholesaleOrderId: input.sourceWholesaleOrderId,
        },
      });

      let idx = 0;
      for (const mv of master.variants) {
        const override = overridesMap.get(mv.id);
        const isDefault = idx === 0;
        await tx.merchantVariant.create({
          data: {
            merchantProductId: product.id,
            masterVariantId: mv.id,
            displayAttributes: (mv.attributes as any) ?? [],
            baseUnitPrice: override?.price ?? input.retailPrice,
            sku: override?.sku?.trim() || mv.sku || `M-${product.id}-${mv.id}`,
            barcode: override?.barcode ?? mv.barcode ?? null,
            isDefault,
            isActive: true,
          },
        });
        idx++;
      }

      await tx.sellingUnit.create({
        data: {
          merchantProductId: product.id,
          name: "PIECE",
          conversionFactor: 1,
          price: input.retailPrice,
          isActive: true,
          validFrom: new Date(),
        },
      });

      await logWholesaleAction(tx, {
        userId,
        businessUnitId: input.businessUnitId,
        action: "merchant_product.created_from_wholesale",
        entityType: "MerchantProduct",
        entityId: product.id,
        after: {
          masterId: input.masterId,
          sourceWholesaleOrderId: input.sourceWholesaleOrderId,
        },
      });

      return product;
    });

    return created.id;
  },

  // ═══ Update display info ═══
  async updateDisplay(
    userId: number,
    merchantProductId: number,
    input: UpdateDisplayInput
  ): Promise<void> {
    const p = await getMerchantProductOrThrow(merchantProductId);
    await ensureBusinessUnitActive(p.businessUnitId, userId);

    if (input.displayImages !== undefined) validateDisplayImages(input.displayImages);
    if (input.retailPrice !== undefined) validateRetailPrice(input.retailPrice);
    if (input.displayName !== undefined && input.displayName.trim().length < 2) {
      throw new ValidationError("اسم العرض يجب أن يكون حرفين على الأقل");
    }

    const data: any = {};
    if (input.displayName !== undefined) data.displayName = input.displayName.trim();
    if (input.displayImages !== undefined) data.displayImages = input.displayImages;
    if (input.displayDescription !== undefined) {
      data.displayDescription = input.displayDescription?.trim() || null;
    }
    if (input.retailPrice !== undefined) data.retailPrice = input.retailPrice;

    if (Object.keys(data).length === 0) {
      throw new ValidationError("لا يوجد تغيير");
    }

    await prisma.$transaction(async (tx) => {
      await tx.merchantProduct.update({
        where: { id: merchantProductId },
        data,
      });
      await logWholesaleAction(tx, {
        userId,
        businessUnitId: p.businessUnitId,
        action: "merchant_product.display_updated",
        entityType: "MerchantProduct",
        entityId: merchantProductId,
        before: {
          displayName: p.displayName,
          retailPrice: p.retailPrice,
          displayImages: p.displayImages,
        },
        after: data,
      });
    });
  },

  // ═══ Update variant ═══
  async updateVariant(
    userId: number,
    variantId: number,
    input: UpdateVariantInput
  ): Promise<void> {
    const v = await prisma.merchantVariant.findUnique({
      where: { id: variantId },
      include: {
        merchantProduct: {
          select: { id: true, businessUnitId: true },
        },
      },
    });
    if (!v) throw new NotFoundError("MerchantVariant", variantId);

    await ensureBusinessUnitActive(v.merchantProduct.businessUnitId, userId);

    if (input.baseUnitPrice !== undefined && input.baseUnitPrice < 0) {
      throw new ValidationError("السعر لا يمكن أن يكون سالبًا");
    }

    // If promoting to default, unset others
    if (input.isDefault === true) {
      const existingDefault = await prisma.merchantVariant.findFirst({
        where: {
          merchantProductId: v.merchantProductId,
          isDefault: true,
          id: { not: variantId },
        },
        select: { id: true },
      });
      if (existingDefault) {
        await prisma.merchantVariant.update({
          where: { id: existingDefault.id },
          data: { isDefault: false },
        });
      }
    }

    const data: any = {};
    if (input.baseUnitPrice !== undefined) data.baseUnitPrice = input.baseUnitPrice;
    if (input.barcode !== undefined) data.barcode = input.barcode?.trim() || null;
    if (input.isDefault !== undefined) data.isDefault = input.isDefault;
    if (input.isActive !== undefined) data.isActive = input.isActive;

    if (Object.keys(data).length === 0) {
      throw new ValidationError("لا يوجد تغيير");
    }

    await prisma.merchantVariant.update({
      where: { id: variantId },
      data,
    });

    await logWholesaleAction(null, {
      userId,
      businessUnitId: v.merchantProduct.businessUnitId,
      action: "merchant_variant.updated",
      entityType: "MerchantVariant",
      entityId: variantId,
      after: data,
    });
  },

  // ═══ Add selling unit ═══
  async addSellingUnit(
    userId: number,
    merchantProductId: number,
    input: CreateSellingUnitInput
  ): Promise<number> {
    const p = await getMerchantProductOrThrow(merchantProductId);
    await ensureBusinessUnitActive(p.businessUnitId, userId);

    if (!input.name || input.name.trim().length < 1) {
      throw new ValidationError("اسم وحدة البيع مطلوب");
    }
    if (input.conversionFactor <= 0) {
      throw new ValidationError("معامل التحويل يجب أن يكون موجبًا");
    }
    if (input.price < 0) {
      throw new ValidationError("السعر لا يمكن أن يكون سالبًا");
    }

    const existing = await prisma.sellingUnit.findFirst({
      where: {
        merchantProductId,
        name: input.name.trim(),
        isActive: true,
      },
    });
    if (existing) {
      throw new ConflictError(
        "وحدة بيع بنفس الاسم موجودة ونشطة. عطّلها أولًا ثم أنشئ إصدارًا جديدًا."
      );
    }

    const su = await prisma.sellingUnit.create({
      data: {
        merchantProductId,
        name: input.name.trim(),
        conversionFactor: input.conversionFactor,
        price: input.price,
        isActive: input.isActive !== false,
        validFrom: new Date(),
      },
    });

    await logWholesaleAction(null, {
      userId,
      businessUnitId: p.businessUnitId,
      action: "selling_unit.created",
      entityType: "SellingUnit",
      entityId: su.id,
      after: {
        name: su.name,
        conversionFactor: su.conversionFactor,
        price: su.price,
      },
    });

    return su.id;
  },

  // ═══ Deactivate selling unit (versioned) ═══
  async deactivateSellingUnit(userId: number, sellingUnitId: number): Promise<void> {
    const su = await prisma.sellingUnit.findUnique({
      where: { id: sellingUnitId },
      include: {
        merchantProduct: {
          select: { id: true, businessUnitId: true },
        },
      },
    });
    if (!su) throw new NotFoundError("SellingUnit", sellingUnitId);
    await ensureBusinessUnitActive(su.merchantProduct.businessUnitId, userId);

    if (!su.isActive) {
      throw new ValidationError("وحدة البيع معطلة مسبقًا");
    }

    await prisma.sellingUnit.update({
      where: { id: sellingUnitId },
      data: { isActive: false, validTo: new Date() },
    });

    await logWholesaleAction(null, {
      userId,
      businessUnitId: su.merchantProduct.businessUnitId,
      action: "selling_unit.deactivated",
      entityType: "SellingUnit",
      entityId: sellingUnitId,
    });
  },

  // ═══ Activate/Pause/Archive (state machine) ═══
  async updateStatus(
    userId: number,
    merchantProductId: number,
    status: "DRAFT" | "ACTIVE" | "PAUSED" | "ARCHIVED"
  ): Promise<void> {
    const p = await getMerchantProductOrThrow(merchantProductId);
    await ensureBusinessUnitActive(p.businessUnitId, userId);

    await prisma.merchantProduct.update({
      where: { id: merchantProductId },
      data: { status },
    });

    await logWholesaleAction(null, {
      userId,
      businessUnitId: p.businessUnitId,
      action: "merchant_product.status_changed",
      entityType: "MerchantProduct",
      entityId: merchantProductId,
      before: { status: p.status },
      after: { status },
    });
  },

  // ═══ Get by ID ═══
  async get(userId: number, merchantProductId: number) {
    const p = await getMerchantProductOrThrow(merchantProductId);
    await ensureBusinessUnitActive(p.businessUnitId, userId);
    return p;
  },

  // ═══ Get by (businessUnit, master) ═══
  async getByMaster(businessUnitId: number, masterId: number) {
    const p = await prisma.merchantProduct.findFirst({
      where: { businessUnitId, masterId, deletedAt: null },
      include: {
        variants: { orderBy: { id: "asc" } },
        sellingUnits: {
          where: { isActive: true },
          orderBy: { conversionFactor: "asc" },
        },
      },
    });
    return p;
  },

  // ═══ List by business unit ═══
  async list(
    userId: number,
    businessUnitId: number,
    filters: {
      status?: "DRAFT" | "ACTIVE" | "PAUSED" | "ARCHIVED";
      search?: string;
      page?: number;
      pageSize?: number;
    } = {}
  ) {
    await ensureBusinessUnitActive(businessUnitId, userId);

    const page = Math.max(1, filters.page || 1);
    const pageSize = Math.min(100, Math.max(1, filters.pageSize || 30));

    const where: any = { businessUnitId, deletedAt: null };
    if (filters.status) where.status = filters.status;
    if (filters.search && filters.search.trim().length >= 2) {
      const q = filters.search.trim();
      where.OR = [
        { displayName: { contains: q, mode: "insensitive" } },
        { master: { name: { contains: q, mode: "insensitive" } } },
      ];
    }

    const [total, items] = await Promise.all([
      prisma.merchantProduct.count({ where }),
      prisma.merchantProduct.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          master: {
            select: {
              id: true,
              name: true,
              brand: true,
              images: true,
              status: true,
            },
          },
          _count: { select: { variants: true, sellingUnits: true } },
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

  // ═══ Delete (soft) ═══
  async softDelete(userId: number, merchantProductId: number): Promise<void> {
    const p = await getMerchantProductOrThrow(merchantProductId);
    await ensureBusinessUnitActive(p.businessUnitId, userId);

    await prisma.merchantProduct.update({
      where: { id: merchantProductId },
      data: { deletedAt: new Date(), status: "ARCHIVED" },
    });

    await logWholesaleAction(null, {
      userId,
      businessUnitId: p.businessUnitId,
      action: "merchant_product.deleted",
      entityType: "MerchantProduct",
      entityId: merchantProductId,
    });
  },

  // ═══ Public: read-only (for storefront) ═══
  async getPublicBySlug(businessUnitSlug: string, masterId: number) {
    const bu = await prisma.businessUnit.findUnique({
      where: { slug: businessUnitSlug },
      select: { id: true, status: true, deletedAt: true },
    });
    if (!bu || bu.deletedAt || bu.status !== "ACTIVE") return null;

    const p = await prisma.merchantProduct.findFirst({
      where: {
        businessUnitId: bu.id,
        masterId,
        status: "ACTIVE",
        deletedAt: null,
      },
      include: {
        variants: {
          where: { isActive: true },
          orderBy: { id: "asc" },
        },
        sellingUnits: {
          where: { isActive: true },
          orderBy: { conversionFactor: "asc" },
        },
        master: {
          select: {
            id: true,
            name: true,
            brand: true,
            description: true,
            images: true,
            categoryId: true,
          },
        },
      },
    });
    return p;
  },
};