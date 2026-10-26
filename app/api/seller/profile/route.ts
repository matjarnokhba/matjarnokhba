import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSeller, requireSellerOwner } from "@/lib/seller-guards";

const updateSchema = z.object({
  storeName: z
    .string()
    .trim()
    .min(2, "اسم المتجر يجب أن يكون حرفين على الأقل")
    .max(80)
    .optional(),
  description: z.string().trim().max(500).optional().nullable(),
  logo: z.string().url().optional().nullable(),
  city: z.string().trim().max(80).optional().nullable(),
  region: z.string().trim().max(80).optional().nullable(),
});

// GET — visible to owner and staff
export async function GET() {
  try {
    const guard = await requireSeller();
    if (!guard.ok) return guard.response;

    const seller = await prisma.seller.findUnique({
      where: { id: guard.current.user.seller!.id },
      select: {
        id: true,
        storeName: true,
        slug: true,
        description: true,
        logo: true,
        city: true,
        region: true,
        isVerified: true,
        status: true,
      },
    });

    return NextResponse.json({ success: true, seller });
  } catch (error) {
    console.error("Seller profile GET error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}

// PATCH — owner only
export async function PATCH(request: Request) {
  try {
    const guard = await requireSellerOwner();
    if (!guard.ok) return guard.response;

    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
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
    const sellerId = guard.current.user.seller!.id;

    const updated = await prisma.seller.update({
      where: { id: sellerId },
      data: {
        ...(data.storeName !== undefined && { storeName: data.storeName }),
        ...(data.description !== undefined && {
          description: data.description || null,
        }),
        ...(data.logo !== undefined && { logo: data.logo || null }),
        ...(data.city !== undefined && { city: data.city || null }),
        ...(data.region !== undefined && { region: data.region || null }),
      },
      select: {
        id: true,
        storeName: true,
        slug: true,
        description: true,
        logo: true,
        city: true,
        region: true,
      },
    });

    return NextResponse.json({ success: true, seller: updated });
  } catch (error) {
    console.error("Seller profile PATCH error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}