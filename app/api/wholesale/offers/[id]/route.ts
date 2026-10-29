import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";

async function requireOwnOffer(offerId: number) {
  const current = await SessionService.getCurrent();
  if (!current) return { error: "غير مصرح", status: 401 };

  const supplier = current.user.wholesaleSupplier;
  if (!supplier || supplier.status !== "ACTIVE") {
    return { error: "حساب الجملة غير نشط", status: 403 };
  }

  const offer = await prisma.sellerOffer.findUnique({
    where: { id: offerId },
    include: {
      master: { select: { id: true, name: true, slug: true } },
      variants: { orderBy: { id: "asc" } },
      _count: { select: { orderItems: true } },
    },
  });

  if (!offer || offer.deletedAt) {
    return { error: "العرض غير موجود", status: 404 };
  }

  if (offer.wholesaleSupplierId !== supplier.id) {
    return { error: "غير مصرح", status: 403 };
  }

  return { user: current.user, supplier, offer };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const offerId = parseInt(id);
    if (isNaN(offerId)) {
      return NextResponse.json(
        { success: false, message: "معرف غير صحيح" },
        { status: 400 }
      );
    }

    const auth = await requireOwnOffer(offerId);
    if ("error" in auth) {
      return NextResponse.json(
        { success: false, message: auth.error },
        { status: auth.status }
      );
    }

    const { offer } = auth;
    return NextResponse.json({
      success: true,
      offer: {
        id: offer.id,
        master: offer.master,
        wholesalePrice: Number(offer.wholesalePrice),
        retailPrice: offer.retailPrice ? Number(offer.retailPrice) : null,
        minOrderQty: offer.minOrderQty,
        maxOrderQty: offer.maxOrderQty,
        unit: offer.unit,
        claimType: offer.claimType,
        claimVerified: offer.claimVerified,
        claimProofUrl: offer.claimProofUrl,
        claimNotes: offer.claimNotes,
        isActive: offer.isActive,
        notes: offer.notes,
        sourceId: offer.sourceId,
        variants: offer.variants.map((v) => ({
          id: v.id,
          masterVariantId: v.masterVariantId,
          stock: v.stock,
          sku: v.sku,
          barcode: v.barcode,
          options: v.options,
        })),
        orderItemsCount: offer._count.orderItems,
        createdAt: offer.createdAt,
      },
    });
  } catch (error) {
    console.error("Offer GET error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}

const variantPatchSchema = z.object({
  id: z.number().int().positive().optional(),
  masterVariantId: z.number().int().positive().nullable().optional(),
  stock: z.number().int().min(0).optional(),
  sku: z.string().trim().max(80).nullable().optional(),
  barcode: z.string().trim().max(80).nullable().optional(),
  options: z.record(z.string(), z.any()).nullable().optional(),
  _delete: z.boolean().optional(),
});

const patchSchema = z.object({
  wholesalePrice: z.number().positive().optional(),
  retailPrice: z.number().positive().nullable().optional(),
  minOrderQty: z.number().int().min(1).optional(),
  maxOrderQty: z.number().int().min(1).nullable().optional(),
  unit: z
    .enum(["PIECE", "PAIR", "SET", "PACK", "BOX", "KG", "GRAM", "LITER", "ML", "METER", "M2", "M3"])
    .optional(),
  sourceId: z.number().int().positive().nullable().optional(),
  isActive: z.boolean().optional(),
  notes: z.string().trim().max(500).nullable().optional(),
  claimProofUrl: z.string().url().nullable().optional(),
  claimNotes: z.string().trim().max(500).nullable().optional(),
  variants: z.array(variantPatchSchema).optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const offerId = parseInt(id);
    if (isNaN(offerId)) {
      return NextResponse.json(
        { success: false, message: "معرف غير صحيح" },
        { status: 400 }
      );
    }

    const auth = await requireOwnOffer(offerId);
    if ("error" in auth) {
      return NextResponse.json(
        { success: false, message: auth.error },
        { status: auth.status }
      );
    }

    const body = await request.json();
    const parsed = patchSchema.safeParse(body);
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

    // Validate source ownership if provided
    if (data.sourceId !== undefined && data.sourceId !== null) {
      const source = await prisma.wholesaleSource.findUnique({
        where: { id: data.sourceId },
        select: { supplierId: true },
      });
      if (!source || source.supplierId !== auth.supplier.id) {
        return NextResponse.json(
          { success: false, message: "المصدر لا ينتمي إليك" },
          { status: 400 }
        );
      }
    }

    // Validate variant IDs belong to this offer
    if (data.variants && data.variants.length > 0) {
      const offerVariantIds = new Set(auth.offer.variants.map((v) => v.id));
      for (const v of data.variants) {
        if (v.id && !offerVariantIds.has(v.id)) {
          return NextResponse.json(
            { success: false, message: `variant #${v.id} لا ينتمي لهذا العرض` },
            { status: 400 }
          );
        }
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      const updateData: Record<string, unknown> = {};
      if (data.wholesalePrice !== undefined) updateData.wholesalePrice = data.wholesalePrice;
      if (data.retailPrice !== undefined) updateData.retailPrice = data.retailPrice || null;
      if (data.minOrderQty !== undefined) updateData.minOrderQty = data.minOrderQty;
      if (data.maxOrderQty !== undefined) updateData.maxOrderQty = data.maxOrderQty || null;
      if (data.unit !== undefined) updateData.unit = data.unit;
      if (data.sourceId !== undefined) updateData.sourceId = data.sourceId || null;
      if (data.isActive !== undefined) updateData.isActive = data.isActive;
      if (data.notes !== undefined) updateData.notes = data.notes?.trim() || null;
      if (data.claimProofUrl !== undefined) updateData.claimProofUrl = data.claimProofUrl || null;
      if (data.claimNotes !== undefined) updateData.claimNotes = data.claimNotes?.trim() || null;

      if (Object.keys(updateData).length > 0) {
        await tx.sellerOffer.update({
          where: { id: offerId },
          data: updateData,
        });
      }

      if (data.variants && data.variants.length > 0) {
        for (const v of data.variants) {
          if (v._delete && v.id) {
            await tx.sellerOfferVariant.delete({ where: { id: v.id } });
            continue;
          }

          if (v.id) {
            const variantUpdate: Record<string, unknown> = {};
            if (v.stock !== undefined) variantUpdate.stock = v.stock;
            if (v.sku !== undefined) variantUpdate.sku = v.sku?.trim() || null;
            if (v.barcode !== undefined) variantUpdate.barcode = v.barcode?.trim() || null;
            if (v.options !== undefined) variantUpdate.options = v.options || null;
            if (v.masterVariantId !== undefined) variantUpdate.masterVariantId = v.masterVariantId || null;

            if (Object.keys(variantUpdate).length > 0) {
              await tx.sellerOfferVariant.update({
                where: { id: v.id },
                data: variantUpdate,
              });
            }
          } else {
            // New variant
            await tx.sellerOfferVariant.create({
              data: {
                offerId,
                masterVariantId: v.masterVariantId || null,
                stock: v.stock ?? 0,
                sku: v.sku?.trim() || null,
                barcode: v.barcode?.trim() || null,
                options: v.options || undefined,
              },
            });
          }
        }
      }

      return { id: offerId };
    });

    return NextResponse.json({ success: true, offer: result });
  } catch (error) {
    console.error("Offer PATCH error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ أثناء التعديل" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const offerId = parseInt(id);
    if (isNaN(offerId)) {
      return NextResponse.json(
        { success: false, message: "معرف غير صحيح" },
        { status: 400 }
      );
    }

    const auth = await requireOwnOffer(offerId);
    if ("error" in auth) {
      return NextResponse.json(
        { success: false, message: auth.error },
        { status: auth.status }
      );
    }

    // Block if offer has order items
    if (auth.offer._count.orderItems > 0) {
      return NextResponse.json(
        {
          success: false,
          message: `لا يمكن حذف العرض لوجود ${auth.offer._count.orderItems} طلب مرتبط. عطّله بدلاً من ذلك.`,
        },
        { status: 400 }
      );
    }

    await prisma.sellerOffer.update({
      where: { id: offerId },
      data: { deletedAt: new Date(), isActive: false },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Offer DELETE error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ أثناء الحذف" },
      { status: 500 }
    );
  }
}