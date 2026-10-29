import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";

const variantSchema = z.object({
  masterVariantId: z.number().int().positive().nullable().optional(),
  stock: z.number().int().min(0).default(0),
  sku: z.string().trim().max(80).optional().nullable(),
  barcode: z.string().trim().max(80).optional().nullable(),
  options: z.record(z.string(), z.any()).optional().nullable(),
});

const createSchema = z.object({
  masterId: z.number().int().positive(),
  sourceId: z.number().int().positive().nullable().optional(),
  wholesalePrice: z.number().positive(),
  retailPrice: z.number().positive().nullable().optional(),
  minOrderQty: z.number().int().min(1).default(1),
  maxOrderQty: z.number().int().min(1).nullable().optional(),
  unit: z.enum(["PIECE", "PAIR", "SET", "PACK", "BOX", "KG", "GRAM", "LITER", "ML", "METER", "M2", "M3"]).default("PIECE"),
  claimType: z.enum(["MANUFACTURER", "DISTRIBUTOR", "RESELLER"]).default("DISTRIBUTOR"),
  claimProofUrl: z.string().url().nullable().optional(),
  claimNotes: z.string().trim().max(500).nullable().optional(),
  notes: z.string().trim().max(500).nullable().optional(),
  variants: z.array(variantSchema).default([]),
});

async function requireActiveSupplier() {
  const current = await SessionService.getCurrent();
  if (!current) return { error: "غير مصرح", status: 401 };

  const supplier = current.user.wholesaleSupplier;
  if (!supplier || supplier.status !== "ACTIVE") {
    return {
      error: "حساب الجملة غير نشط — يجب الموافقة عليه أولاً",
      status: 403,
    };
  }

  const supplierFull = await prisma.wholesaleSupplier.findUnique({
    where: { id: supplier.id },
    select: { id: true, userId: true, isVerified: true, status: true },
  });

  if (!supplierFull) {
    return { error: "حساب الجملة غير موجود", status: 404 };
  }

  return { user: current.user, supplier: supplierFull };
}

export async function GET() {
  try {
    const auth = await requireActiveSupplier();
    if ("error" in auth) {
      return NextResponse.json(
        { success: false, message: auth.error },
        { status: auth.status }
      );
    }

    const offers = await prisma.sellerOffer.findMany({
      where: {
        wholesaleSupplierId: auth.supplier.id,
        deletedAt: null,
      },
      orderBy: { createdAt: "desc" },
      include: {
        master: {
          select: {
            id: true,
            name: true,
            slug: true,
            images: true,
            barcode: true,
            brand: true,
          },
        },
        source: { select: { id: true, name: true, city: true } },
        variants: { select: { id: true, stock: true, masterVariantId: true } },
        _count: { select: { orderItems: true } },
      },
    });

    return NextResponse.json({
      success: true,
      offers: offers.map((o) => ({
        id: o.id,
        master: o.master,
        source: o.source,
        wholesalePrice: Number(o.wholesalePrice),
        retailPrice: o.retailPrice ? Number(o.retailPrice) : null,
        minOrderQty: o.minOrderQty,
        maxOrderQty: o.maxOrderQty,
        unit: o.unit,
        claimType: o.claimType,
        claimVerified: o.claimVerified,
        isActive: o.isActive,
        variantCount: o.variants.length,
        totalStock: o.variants.reduce((s, v) => s + v.stock, 0),
        ordersCount: o._count.orderItems,
        createdAt: o.createdAt,
      })),
    });
  } catch (error) {
    console.error("Offers GET error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireActiveSupplier();
    if ("error" in auth) {
      return NextResponse.json(
        { success: false, message: auth.error },
        { status: auth.status }
      );
    }

    const body = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          message: parsed.error.issues[0]?.message || "بيانات غير صحيحة",
        },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Verify master exists
    const master = await prisma.productMaster.findUnique({
      where: { id: data.masterId, deletedAt: null },
      select: {
        id: true,
        manufacturerUserId: true,
        barcode: true,
        variants: {
          select: { id: true },
          orderBy: { id: "asc" },
        },
      },
    });
    if (!master) {
      return NextResponse.json(
        { success: false, message: "المنتج الأصلي غير موجود" },
        { status: 404 }
      );
    }

    // Verify source belongs to this supplier
    if (data.sourceId) {
      const source = await prisma.wholesaleSource.findUnique({
        where: { id: data.sourceId },
        select: { supplierId: true, isActive: true },
      });
      if (!source || source.supplierId !== auth.supplier.id) {
        return NextResponse.json(
          { success: false, message: "المصدر لا ينتمي إليك" },
          { status: 400 }
        );
      }
      if (!source.isActive) {
        return NextResponse.json(
          { success: false, message: "المصدر معطّل" },
          { status: 400 }
        );
      }
    }

    // Check duplicate offer (unique: supplierId, masterId, offerType)
    const existing = await prisma.sellerOffer.findFirst({
      where: {
        wholesaleSupplierId: auth.supplier.id,
        masterId: data.masterId,
        offerType: "WHOLESALE",
        deletedAt: null,
      },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json(
        {
          success: false,
          message: "لديك عرض بالفعل لهذا المنتج. استخدم تعديل العرض الموجود.",
          existingOfferId: existing.id,
        },
        { status: 409 }
      );
    }

    // Validate variants reference the master's variants
    if (data.variants.length > 0) {
      const masterVariantIds = new Set(master.variants.map((v) => v.id));
      for (const v of data.variants) {
        if (v.masterVariantId && !masterVariantIds.has(v.masterVariantId)) {
          return NextResponse.json(
            {
              success: false,
              message: `variant #${v.masterVariantId} لا ينتمي لهذا المنتج`,
            },
            { status: 400 }
          );
        }
      }
    }

    // Auto-verify claim if supplier IS the manufacturer
    const isManufacturer =
      data.claimType === "MANUFACTURER" &&
      master.manufacturerUserId === auth.user.id;
    const claimVerified = isManufacturer || auth.supplier.isVerified;

    const offer = await prisma.sellerOffer.create({
      data: {
        sellerUserId: auth.user.id,
        wholesaleSupplierId: auth.supplier.id,
        masterId: data.masterId,
        sourceId: data.sourceId || null,
        offerType: "WHOLESALE",
        wholesalePrice: data.wholesalePrice,
        retailPrice: data.retailPrice || null,
        minOrderQty: data.minOrderQty,
        maxOrderQty: data.maxOrderQty || null,
        unit: data.unit,
        claimType: data.claimType,
        claimVerified,
        claimProofUrl: data.claimProofUrl || null,
        claimNotes: data.claimNotes?.trim() || null,
        isActive: true,
        notes: data.notes?.trim() || null,
        variants: {
          create: data.variants.map((v) => ({
            masterVariantId: v.masterVariantId || null,
            stock: v.stock,
            sku: v.sku?.trim() || null,
            barcode: v.barcode?.trim() || null,
            options: v.options || undefined,
          })),
        },
      },
      include: {
        master: { select: { id: true, name: true, slug: true } },
        variants: { select: { id: true, stock: true } },
      },
    });

    return NextResponse.json(
      {
        success: true,
        offer: {
          id: offer.id,
          master: offer.master,
          wholesalePrice: Number(offer.wholesalePrice),
          claimVerified: offer.claimVerified,
          variantsCount: offer.variants.length,
          totalStock: offer.variants.reduce((s, v) => s + v.stock, 0),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Offer create error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ أثناء إنشاء العرض" },
      { status: 500 }
    );
  }
}