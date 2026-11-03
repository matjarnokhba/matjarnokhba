import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import {
  ConflictError,
  NotFoundError,
  ValidationError,
  ForbiddenError,
} from "@/lib/wholesale/errors";
import { logWholesaleAction } from "@/lib/wholesale/audit";

type AttributeInput = { name: string; value: string };

type VariantInput = {
  sku?: string | null;
  barcode?: string | null;
  qrCode?: string | null;
  attributes: AttributeInput[];
  isDefault?: boolean;
};

type SubmitInput = {
  name: string;
  brand?: string | null;
  description?: string | null;
  categoryId: number;
  images: string[];
  barcode?: string | null;
  qrCode?: string | null;
  variants: VariantInput[];
};

type UpdateInput = {
  name?: string;
  brand?: string | null;
  description?: string | null;
  categoryId?: number;
  images?: string[];
  barcode?: string | null;
  qrCode?: string | null;
  changeReason?: string | null;
};

function computeAttributesHash(attributes: AttributeInput[]): string {
  const sorted = [...attributes].sort((a, b) => a.name.localeCompare(b.name));
  const canonical = sorted.map((a) => `${a.name}:${a.value}`).join("|");
  return createHash("sha256").update(canonical).digest("hex");
}

function validateImages(images: string[]): void {
  if (!Array.isArray(images) || images.length === 0) {
    throw new ValidationError("يجب إضافة صورة واحدة على الأقل");
  }
  if (images.length > 10) {
    throw new ValidationError("الحد الأقصى 10 صور");
  }
}

function validateVariants(variants: VariantInput[]): void {
  if (!variants || variants.length === 0) {
    throw new ValidationError("يجب إضافة variant واحد على الأقل");
  }
  const hashes = new Set<string>();
  for (const v of variants) {
    const h = computeAttributesHash(v.attributes || []);
    if (hashes.has(h)) {
      throw new ValidationError("يوجد variant مكرر بنفس الخصائص");
    }
    hashes.add(h);
  }
}

async function ensureCategoryExists(categoryId: number): Promise<void> {
  const cat = await prisma.masterCategory.findUnique({
    where: { id: categoryId },
    select: { id: true, isActive: true, deletedAt: true },
  });
  if (!cat || cat.deletedAt || !cat.isActive) {
    throw new NotFoundError("MasterCategory", categoryId);
  }
}

async function ensureBarcodeUnique(
  barcode: string | null | undefined,
  excludeMasterId?: number
): Promise<void> {
  if (!barcode) return;
  const existing = await prisma.masterProduct.findFirst({
    where: {
      barcode,
      deletedAt: null,
      ...(excludeMasterId ? { id: { not: excludeMasterId } } : {}),
    },
    select: { id: true },
  });
  if (existing) throw new ConflictError("الباركود مستخدم لمنتج آخر");
}

async function ensureQrCodeUnique(
  qrCode: string | null | undefined,
  excludeMasterId?: number
): Promise<void> {
  if (!qrCode) return;
  const existing = await prisma.masterProduct.findFirst({
    where: {
      qrCode,
      deletedAt: null,
      ...(excludeMasterId ? { id: { not: excludeMasterId } } : {}),
    },
    select: { id: true },
  });
  if (existing) throw new ConflictError("رمز QR مستخدم لمنتج آخر");
}

async function buildSnapshot(masterId: number): Promise<any> {
  const m = await prisma.masterProduct.findUnique({
    where: { id: masterId },
    include: { variants: true, category: { select: { id: true, name: true, slug: true } } },
  });
  return m;
}

export const MasterProductService = {
  // ═══ Submit a new master product ═══
  async submit(userId: number, input: SubmitInput): Promise<number> {
    if (!input.name || input.name.trim().length < 2) {
      throw new ValidationError("اسم المنتج مطلوب (حرفان على الأقل)");
    }
    validateImages(input.images);
    validateVariants(input.variants);
    await ensureCategoryExists(input.categoryId);
    await ensureBarcodeUnique(input.barcode);
    await ensureQrCodeUnique(input.qrCode);

    const master = await prisma.$transaction(async (tx) => {
      const created = await tx.masterProduct.create({
        data: {
          name: input.name.trim(),
          brand: input.brand?.trim() || null,
          description: input.description?.trim() || null,
          categoryId: input.categoryId,
          images: input.images,
          barcode: input.barcode?.trim() || null,
          qrCode: input.qrCode?.trim() || null,
          status: "PENDING_REVIEW",
          createdByUserId: userId,
          version: 1,
        },
      });

      const anyDefault = input.variants.some((v) => v.isDefault === true);
      for (let i = 0; i < input.variants.length; i++) {
        const v = input.variants[i];
        const isDefault = anyDefault ? !!v.isDefault : i === 0;
        await tx.masterVariant.create({
          data: {
            masterId: created.id,
            sku: v.sku?.trim() || null,
            barcode: v.barcode?.trim() || null,
            qrCode: v.qrCode?.trim() || null,
            attributes: (v.attributes || []) as any,
            attributesHash: computeAttributesHash(v.attributes || []),
            isDefault,
          },
        });
      }

      const snapshot = await buildSnapshot(created.id);
      await tx.masterProductVersion.create({
        data: {
          masterId: created.id,
          version: 1,
          snapshot: snapshot as any,
          changedByUserId: userId,
          changeReason: "initial_submit",
        },
      });

      await logWholesaleAction(tx, {
        userId,
        action: "master_product.submitted",
        entityType: "MasterProduct",
        entityId: created.id,
        after: { name: created.name, categoryId: created.categoryId },
      });

      return created;
    });

    return master.id;
  },

  // ═══ Admin approve ═══
  async approve(adminUserId: number, masterId: number): Promise<void> {
    const m = await prisma.masterProduct.findUnique({
      where: { id: masterId },
      select: { id: true, status: true, deletedAt: true },
    });
    if (!m || m.deletedAt) throw new NotFoundError("MasterProduct", masterId);
    if (m.status === "ACTIVE") {
      throw new ValidationError("المنتج معتمد مسبقًا");
    }

    await prisma.$transaction(async (tx) => {
      await tx.masterProduct.update({
        where: { id: masterId },
        data: {
          status: "ACTIVE",
          approvedByUserId: adminUserId,
          approvedAt: new Date(),
        },
      });
      await logWholesaleAction(tx, {
        userId: adminUserId,
        action: "master_product.approved",
        entityType: "MasterProduct",
        entityId: masterId,
      });
    });
  },

  // ═══ Admin reject (soft: ARCHIVED) ═══
  async reject(adminUserId: number, masterId: number, reason: string): Promise<void> {
    if (!reason || reason.trim().length < 3) {
      throw new ValidationError("سبب الرفض مطلوب");
    }
    const m = await prisma.masterProduct.findUnique({
      where: { id: masterId },
      select: { id: true, deletedAt: true },
    });
    if (!m || m.deletedAt) throw new NotFoundError("MasterProduct", masterId);

    await prisma.$transaction(async (tx) => {
      await tx.masterProduct.update({
        where: { id: masterId },
        data: { status: "ARCHIVED" },
      });
      await logWholesaleAction(tx, {
        userId: adminUserId,
        action: "master_product.rejected",
        entityType: "MasterProduct",
        entityId: masterId,
        metadata: { reason: reason.trim() },
      });
    });
  },

  // ═══ Admin update (with version snapshot) ═══
  async update(adminUserId: number, masterId: number, input: UpdateInput): Promise<void> {
    const existing = await prisma.masterProduct.findUnique({
      where: { id: masterId },
      select: {
        id: true,
        name: true,
        brand: true,
        description: true,
        categoryId: true,
        images: true,
        barcode: true,
        qrCode: true,
        version: true,
        deletedAt: true,
      },
    });
    if (!existing || existing.deletedAt) throw new NotFoundError("MasterProduct", masterId);

    if (input.images !== undefined) validateImages(input.images);
    if (input.categoryId !== undefined) await ensureCategoryExists(input.categoryId);
    if (input.barcode !== undefined) await ensureBarcodeUnique(input.barcode, masterId);
    if (input.qrCode !== undefined) await ensureQrCodeUnique(input.qrCode, masterId);

    const data: any = {};
    if (input.name !== undefined) data.name = input.name.trim();
    if (input.brand !== undefined) data.brand = input.brand?.trim() || null;
    if (input.description !== undefined) data.description = input.description?.trim() || null;
    if (input.categoryId !== undefined) data.categoryId = input.categoryId;
    if (input.images !== undefined) data.images = input.images;
    if (input.barcode !== undefined) data.barcode = input.barcode?.trim() || null;
    if (input.qrCode !== undefined) data.qrCode = input.qrCode?.trim() || null;

    if (Object.keys(data).length === 0) {
      throw new ValidationError("لا يوجد تغيير");
    }

    await prisma.$transaction(async (tx) => {
      const newVersion = existing.version + 1;
      await tx.masterProduct.update({
        where: { id: masterId },
        data: { ...data, version: newVersion },
      });

      const snapshot = await buildSnapshot(masterId);
      await tx.masterProductVersion.create({
        data: {
          masterId,
          version: newVersion,
          snapshot: snapshot as any,
          changedByUserId: adminUserId,
          changeReason: input.changeReason?.trim() || "admin_update",
        },
      });

      await logWholesaleAction(tx, {
        userId: adminUserId,
        action: "master_product.updated",
        entityType: "MasterProduct",
        entityId: masterId,
        before: existing,
        after: data,
      });
    });
  },

  // ═══ Suspend ═══
  async suspend(adminUserId: number, masterId: number, reason: string): Promise<void> {
    const m = await prisma.masterProduct.findUnique({
      where: { id: masterId },
      select: { id: true, deletedAt: true },
    });
    if (!m || m.deletedAt) throw new NotFoundError("MasterProduct", masterId);

    await prisma.$transaction(async (tx) => {
      await tx.masterProduct.update({
        where: { id: masterId },
        data: { status: "SUSPENDED" },
      });
      await logWholesaleAction(tx, {
        userId: adminUserId,
        action: "master_product.suspended",
        entityType: "MasterProduct",
        entityId: masterId,
        metadata: { reason },
      });
    });
  },

  // ═══ Restore from ARCHIVED/SUSPENDED ═══
  async restore(adminUserId: number, masterId: number): Promise<void> {
    const m = await prisma.masterProduct.findUnique({
      where: { id: masterId },
      select: { id: true, deletedAt: true },
    });
    if (!m || m.deletedAt) throw new NotFoundError("MasterProduct", masterId);

    await prisma.$transaction(async (tx) => {
      await tx.masterProduct.update({
        where: { id: masterId },
        data: { status: "ACTIVE", approvedByUserId: adminUserId, approvedAt: new Date() },
      });
      await logWholesaleAction(tx, {
        userId: adminUserId,
        action: "master_product.restored",
        entityType: "MasterProduct",
        entityId: masterId,
      });
    });
  },

  // ═══ Get by ID ═══
  async get(masterId: number) {
    const m = await prisma.masterProduct.findUnique({
      where: { id: masterId },
      include: {
        variants: { orderBy: { id: "asc" } },
        category: { select: { id: true, name: true, slug: true } },
        createdByUser: { select: { id: true, name: true, email: true } },
        approvedByUser: { select: { id: true, name: true } },
      },
    });
    if (!m || m.deletedAt) throw new NotFoundError("MasterProduct", masterId);
    return m;
  },

  // ═══ Public lookup by barcode ═══
  async lookupByBarcode(barcode: string) {
    if (!barcode || barcode.trim().length < 3) {
      throw new ValidationError("الباركود غير صالح");
    }

    const master = await prisma.masterProduct.findFirst({
      where: {
        barcode: barcode.trim(),
        deletedAt: null,
        status: { not: "ARCHIVED" },
      },
      include: {
        variants: true,
        category: { select: { id: true, name: true } },
      },
    });
    if (master) {
      return { found: true as const, type: "master" as const, master };
    }

    const variant = await prisma.masterVariant.findFirst({
      where: { barcode: barcode.trim() },
      include: {
        master: {
          include: {
            variants: true,
            category: { select: { id: true, name: true } },
          },
        },
      },
    });
    if (variant && !variant.master.deletedAt && variant.master.status !== "ARCHIVED") {
      return {
        found: true as const,
        type: "variant" as const,
        master: variant.master,
        variant,
      };
    }

    return { found: false as const };
  },

  // ═══ Public lookup by QR ═══
  async lookupByQrCode(qrCode: string) {
    if (!qrCode || qrCode.trim().length < 3) {
      throw new ValidationError("رمز QR غير صالح");
    }

    const master = await prisma.masterProduct.findFirst({
      where: {
        qrCode: qrCode.trim(),
        deletedAt: null,
        status: { not: "ARCHIVED" },
      },
      include: {
        variants: true,
        category: { select: { id: true, name: true } },
      },
    });
    if (master) {
      return { found: true as const, type: "master" as const, master };
    }

    const variant = await prisma.masterVariant.findFirst({
      where: { qrCode: qrCode.trim() },
      include: {
        master: {
          include: {
            variants: true,
            category: { select: { id: true, name: true } },
          },
        },
      },
    });
    if (variant && !variant.master.deletedAt && variant.master.status !== "ARCHIVED") {
      return {
        found: true as const,
        type: "variant" as const,
        master: variant.master,
        variant,
      };
    }

    return { found: false as const };
  },

  // ═══ List with pagination and filters ═══
  async list(filters: {
    status?: "PENDING_REVIEW" | "ACTIVE" | "SUSPENDED" | "ARCHIVED";
    categoryId?: number;
    search?: string;
    createdByUserId?: number;
    page?: number;
    pageSize?: number;
  }) {
    const page = Math.max(1, filters.page || 1);
    const pageSize = Math.min(100, Math.max(1, filters.pageSize || 30));

    const where: any = { deletedAt: null };
    if (filters.status) where.status = filters.status;
    if (filters.categoryId) where.categoryId = filters.categoryId;
    if (filters.createdByUserId) where.createdByUserId = filters.createdByUserId;
    if (filters.search && filters.search.trim().length >= 2) {
      const q = filters.search.trim();
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { barcode: { contains: q } },
        { brand: { contains: q, mode: "insensitive" } },
      ];
    }

    const [total, items] = await Promise.all([
      prisma.masterProduct.count({ where }),
      prisma.masterProduct.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          category: { select: { id: true, name: true } },
          createdByUser: { select: { id: true, name: true, email: true } },
          _count: { select: { variants: true, merchantProducts: true } },
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

  // ═══ Version history ═══
  async getVersions(masterId: number) {
    const versions = await prisma.masterProductVersion.findMany({
      where: { masterId },
      orderBy: { version: "desc" },
      include: {
        master: { select: { name: true } },
      },
    });
    return versions;
  },

  // ═══ List categories (helper for UI) ═══
  async listCategories(onlyLeaves = true) {
    const where: any = { deletedAt: null, isActive: true };
    if (onlyLeaves) where.isLeaf = true;
    return prisma.masterCategory.findMany({
      where,
      orderBy: [{ parentId: "asc" }, { order: "asc" }, { name: "asc" }],
      select: { id: true, name: true, slug: true, parentId: true, isLeaf: true },
    });
  },

  // ═══ Assert permission (admin-only actions check) ═══
  assertAdmin(userRole: string): void {
    if (userRole !== "ADMIN" && userRole !== "SUPER_ADMIN") {
      throw new ForbiddenError("هذه العملية للأدمن فقط");
    }
  },
};