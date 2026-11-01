import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";
import { businessCreateSchema } from "@/lib/business-validation";
import { slugifyBusiness, ensureUniqueBusinessSlug } from "@/lib/business-slug";
import { slugifySupplyActivity, ensureUniqueSupplyActivitySlug } from "@/lib/supply-activity-slug";

export async function GET() {
  try {
    const current = await SessionService.getCurrent();
    if (!current) {
      return NextResponse.json({ success: false, message: "يجب تسجيل الدخول" }, { status: 401 });
    }

    const businesses = await prisma.business.findMany({
      where: {
        deletedAt: null,
        OR: [
          { ownerUserId: current.user.id },
          { members: { some: { userId: current.user.id, deletedAt: null } } },
        ],
      },
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { members: true, productMasters: true, wholesaleOffers: true } },
      },
    });

    return NextResponse.json({ success: true, businesses });
  } catch (error) {
    console.error("Business GET error:", error);
    return NextResponse.json({ success: false, message: "حدث خطأ" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const current = await SessionService.getCurrent();
    if (!current) {
      return NextResponse.json({ success: false, message: "يجب تسجيل الدخول" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = businessCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.issues[0]?.message || "بيانات غير صحيحة" },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // P30.1b: enforce type-based linkedSellerId rules
    if (data.type === "WHOLESALE_TRADER") {
      if (!data.linkedSellerId) {
        return NextResponse.json(
          { success: false, message: "تجار الجملة يجب أن يربطوا متجر تجزئة" },
          { status: 400 }
        );
      }
    } else if (data.type === "INDEPENDENT_SUPPLIER" && data.linkedSellerId) {
      return NextResponse.json(
        { success: false, message: "الموردون المستقلون لا يمكنهم ربط متجر تجزئة" },
        { status: 400 }
      );
    }

    // A3: INDEPENDENT_SUPPLIER requires supplyActivityType
    if (data.type === "INDEPENDENT_SUPPLIER" && !data.supplyActivityType) {
      return NextResponse.json(
        { success: false, message: "يجب تحديد نوع النشاط التجاري (مصنع/شركة/مورد/مستورد)" },
        { status: 400 }
      );
    }
    if (data.type === "WHOLESALE_TRADER" && data.supplyActivityType) {
      return NextResponse.json(
        { success: false, message: "نوع النشاط الفرعي غير مطلوب لتجار الجملة" },
        { status: 400 }
      );
    }

    let initialStatus: "PENDING" | "VERIFIED" = "PENDING";
    let verifiedAt: Date | null = null;

    if (data.linkedSellerId) {
      const seller = await prisma.seller.findUnique({
        where: { id: data.linkedSellerId },
        select: { id: true, userId: true, isVerified: true },
      });
      if (!seller) {
        return NextResponse.json({ success: false, message: "المتجر غير موجود" }, { status: 404 });
      }
      if (seller.userId !== current.user.id) {
        return NextResponse.json({ success: false, message: "المتجر لا ينتمي إليك" }, { status: 403 });
      }
      if (data.type === "WHOLESALE_TRADER" && seller.isVerified) {
        initialStatus = "VERIFIED";
        verifiedAt = new Date();
      }
    }

    const slug = await ensureUniqueBusinessSlug(slugifyBusiness(data.name));

    const business = await prisma.$transaction(async (tx) => {
      const biz = await tx.business.create({
        data: {
          type: data.type,
          status: initialStatus,
          name: data.name,
          legalName: data.legalName ?? null,
          slug,
          description: data.description ?? null,
          logo: data.logo ?? null,
          commercialRegister: data.commercialRegister ?? null,
          taxId: data.taxId ?? null,
          city: data.city,
          address: data.address ?? null,
          phone: data.phone,
          email: data.email ?? null,
          ownerUserId: current.user.id,
          linkedSellerId: data.linkedSellerId ?? null,
          verifiedAt,
        },
      });

      await tx.businessMember.create({
        data: { businessId: biz.id, userId: current.user.id, role: "OWNER" },
      });

      // A3: auto-create default SupplyActivity
      const saType = data.type === "WHOLESALE_TRADER" ? "TRADER" : data.supplyActivityType!;
      const saBase = slugifySupplyActivity(data.name);
      const saSlug = await ensureUniqueSupplyActivitySlug(saBase, tx);
      await tx.supplyActivity.create({
        data: {
          businessId: biz.id,
          type: saType as any,
          status: initialStatus as any,
          name: biz.name,
          slug: saSlug,
          legalName: biz.legalName,
          description: biz.description,
          logo: biz.logo,
          commercialRegister: biz.commercialRegister,
          taxId: biz.taxId,
          city: biz.city,
          address: biz.address,
          verifiedAt,
        },
      });

      return biz;
    });

    return NextResponse.json({ success: true, business }, { status: 201 });
  } catch (error) {
    console.error("Business POST error:", error);
    const msg = error instanceof Error ? error.message : "حدث خطأ";
    return NextResponse.json({ success: false, message: msg }, { status: 400 });
  }
}