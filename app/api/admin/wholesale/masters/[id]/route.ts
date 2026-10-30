import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";

async function requireAdmin() {
  const current = await SessionService.getCurrent();
  if (!current) return { error: "غير مصرح", status: 401 };
  if (current.user.role !== "ADMIN" && current.user.role !== "SUPER_ADMIN") {
    return { error: "غير مصرح", status: 403 };
  }
  return { user: current.user };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin();
    if ("error" in auth) {
      return NextResponse.json(
        { success: false, message: auth.error },
        { status: auth.status }
      );
    }

    const { id } = await params;
    const masterId = parseInt(id);
    if (isNaN(masterId)) {
      return NextResponse.json(
        { success: false, message: "معرف غير صحيح" },
        { status: 400 }
      );
    }

    const master = await prisma.productMaster.findUnique({
      where: { id: masterId },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        manufacturer: { select: { id: true, name: true } },
        variants: {
          orderBy: { id: "asc" },
          select: { id: true, barcode: true, sku: true, options: true },
        },
        offers: {
          where: { deletedAt: null },
          select: {
            id: true,
            isActive: true,
            wholesalePrice: true,
            claimType: true,
            claimVerified: true,
            supplier: { select: { id: true, displayName: true, slug: true } },
          },
        },
        derivativesFrom: {
          select: {
            id: true,
            childMasterId: true,
            childMaster: { select: { id: true, name: true, slug: true } },
            createdAt: true,
          },
        },
      },
    });

    if (!master || master.deletedAt) {
      return NextResponse.json(
        { success: false, message: "المنتج غير موجود" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      master: {
        id: master.id,
        name: master.name,
        slug: master.slug,
        brand: master.brand,
        description: master.description,
        images: master.images,
        barcode: master.barcode,
        qrCode: master.qrCode,
        specifications: master.specifications,
        category: master.category,
        createdBy: master.createdBy,
        manufacturer: master.manufacturer,
        isVerified: master.isVerified,
        status: master.status,
        variants: master.variants,
        offers: master.offers.map((o) => ({
          id: o.id,
          isActive: o.isActive,
          wholesalePrice: Number(o.wholesalePrice),
          claimType: o.claimType,
          claimVerified: o.claimVerified,
          supplier: o.supplier,
        })),
        derivatives: master.derivativesFrom.map((d) => ({
          id: d.id,
          childMasterId: d.childMasterId,
          childName: d.childMaster.name,
          childSlug: d.childMaster.slug,
          createdAt: d.createdAt,
        })),
        createdAt: master.createdAt,
      },
    });
  } catch (error) {
    console.error("Admin master detail error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}

const patchSchema = z.object({
  action: z.enum(["verify", "unverify", "suspend", "activate"]),
  note: z.string().trim().max(500).optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin();
    if ("error" in auth) {
      return NextResponse.json(
        { success: false, message: auth.error },
        { status: auth.status }
      );
    }

    const { id } = await params;
    const masterId = parseInt(id);
    if (isNaN(masterId)) {
      return NextResponse.json(
        { success: false, message: "معرف غير صحيح" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: "إجراء غير صحيح" },
        { status: 400 }
      );
    }

    const master = await prisma.productMaster.findUnique({
      where: { id: masterId },
      select: {
        id: true,
        name: true,
        createdByUserId: true,
        manufacturerUserId: true,
        deletedAt: true,
      },
    });

    if (!master || master.deletedAt) {
      return NextResponse.json(
        { success: false, message: "المنتج غير موجود" },
        { status: 404 }
      );
    }

    const { action, note } = parsed.data;
    const updateData: Record<string, unknown> = {};

    if (action === "verify") {
      updateData.isVerified = true;
    } else if (action === "unverify") {
      updateData.isVerified = false;
    } else if (action === "suspend") {
      updateData.status = "INACTIVE";
      updateData.isVerified = false;
    } else if (action === "activate") {
      updateData.status = "ACTIVE";
    }

    await prisma.$transaction(async (tx) => {
      await tx.productMaster.update({
        where: { id: masterId },
        data: updateData,
      });

      // Notify creator (and manufacturer if different)
      const userIds = new Set<number>();
      if (master.createdByUserId) userIds.add(master.createdByUserId);
      if (master.manufacturerUserId) userIds.add(master.manufacturerUserId);

      const titles: Record<string, string> = {
        verify: "تم توثيق هوية منتجك",
        unverify: "أُلغي توثيق هوية منتجك",
        suspend: "تم إيقاف هوية منتجك",
        activate: "تم إعادة تفعيل هوية منتجك",
      };

      const messages: Record<string, string> = {
        verify: `تم توثيق المنتج "${master.name}".`,
        unverify: `أُلغي توثيق المنتج "${master.name}".`,
        suspend: `تم إيقاف المنتج "${master.name}".${note ? ` السبب: ${note}` : ""}`,
        activate: `تم إعادة تفعيل المنتج "${master.name}".`,
      };

      for (const uid of userIds) {
        await tx.notification.create({
          data: {
            userId: uid,
            type: "SELLER_PRODUCT_LOW_STOCK" as any,
            title: titles[action],
            message: messages[action],
            link: `/seller/wholesale/masters/${masterId}`,
          },
        });
      }
    });

    return NextResponse.json({ success: true, action });
  } catch (error) {
    console.error("Admin master PATCH error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}