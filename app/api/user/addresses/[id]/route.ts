import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";
import { moroccanPhoneSchema } from "@/lib/validations/address";
import { isValidPlaceId } from "@/lib/geocoding";
import { isValidMoroccoLat, isValidMoroccoLng } from "@/lib/geocoding";

async function requireAuth() {
  const current = await SessionService.getCurrent();
  if (!current) return { error: "غير مصرح", status: 401 };
  return { user: current.user };
}

// ═══════ Schema ═══════
const placeSchema = z.object({
  placeId: z
    .string()
    .refine(
      (v) => /^([NWR])_(\d+)(_[df])?$/.test(v),
      "Place ID غير صالح"
    ),
  name: z.string().trim().min(1).max(200),
  displayName: z.string().trim().max(500).optional().default(""),
  lat: z.number().refine(isValidMoroccoLat, "خط عرض غير صالح"),
  lng: z.number().refine(isValidMoroccoLng, "خط طول غير صالح"),
});

const patchSchema = z.object({
  firstName: z.string().trim().min(2).max(60).optional(),
  lastName: z.string().trim().min(2).max(60).optional(),
  phone: moroccanPhoneSchema.optional(),
  city: placeSchema.optional(),
  district: placeSchema.optional(),
  fullAddressText: z.string().trim().min(3).max(300).optional(),
  buildingNumber: z.string().trim().max(50).optional().nullable(),
  landmark: z.string().trim().max(300).optional().nullable(),
  postalCode: z.string().trim().max(10).optional().nullable(),
  isDefault: z.boolean().optional(),
});

// ═══════════════════════════════════════════
// GET
// ═══════════════════════════════════════════
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    if ("error" in auth) {
      return NextResponse.json(
        { success: false, message: auth.error },
        { status: auth.status }
      );
    }

    const { id } = await params;
    const addressId = parseInt(id);
    if (isNaN(addressId)) {
      return NextResponse.json(
        { success: false, message: "معرف غير صحيح" },
        { status: 400 }
      );
    }

    const address = await prisma.address.findFirst({
      where: {
        id: addressId,
        userId: auth.user.id,
        deletedAt: null,
      },
    });

    if (!address) {
      return NextResponse.json(
        { success: false, message: "العنوان غير موجود" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, address });
  } catch (error) {
    console.error("Address get error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}

// ═══════════════════════════════════════════
// PATCH
// ═══════════════════════════════════════════
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    if ("error" in auth) {
      return NextResponse.json(
        { success: false, message: auth.error },
        { status: auth.status }
      );
    }

    const { id } = await params;
    const addressId = parseInt(id);
    if (isNaN(addressId)) {
      return NextResponse.json(
        { success: false, message: "معرف غير صحيح" },
        { status: 400 }
      );
    }

    const existing = await prisma.address.findFirst({
      where: { id: addressId, userId: auth.user.id, deletedAt: null },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, message: "العنوان غير موجود" },
        { status: 404 }
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
    const updates: any = {};

    if (data.firstName !== undefined) updates.firstName = data.firstName;
    if (data.lastName !== undefined) updates.lastName = data.lastName;

    if (data.firstName !== undefined || data.lastName !== undefined) {
      updates.fullName = `${data.firstName ?? existing.firstName ?? ""} ${
        data.lastName ?? existing.lastName ?? ""
      }`.trim();
    }

    if (data.phone !== undefined) updates.phone = data.phone;

    if (data.city !== undefined) {
      updates.cityPlaceId = data.city.placeId;
      updates.cityText = data.city.name;
      updates.city = data.city.name;
    }

    if (data.district !== undefined) {
      updates.districtPlaceId = data.district.placeId;
      updates.districtText = data.district.name;
      updates.district = data.district.name;
    }

    if (data.fullAddressText !== undefined) {
      updates.fullAddressPlaceId = null;
      updates.fullAddressText = data.fullAddressText;
      updates.street = data.fullAddressText;
    }

    if (data.buildingNumber !== undefined)
      updates.buildingNumber = data.buildingNumber;
    if (data.landmark !== undefined) updates.landmark = data.landmark;
    if (data.postalCode !== undefined) updates.postalCode = data.postalCode;

    const updated = await prisma.$transaction(async (tx) => {
      if (data.isDefault === true) {
        await tx.address.updateMany({
          where: {
            userId: auth.user.id,
            isDefault: true,
            id: { not: addressId },
            deletedAt: null,
          },
          data: { isDefault: false },
        });
        updates.isDefault = true;
      }

      return tx.address.update({
        where: { id: addressId },
        data: updates,
      });
    });

    return NextResponse.json({ success: true, address: updated });
  } catch (error) {
    console.error("Address update error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}

// ═══════════════════════════════════════════
// DELETE
// ═══════════════════════════════════════════
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    if ("error" in auth) {
      return NextResponse.json(
        { success: false, message: auth.error },
        { status: auth.status }
      );
    }

    const { id } = await params;
    const addressId = parseInt(id);
    if (isNaN(addressId)) {
      return NextResponse.json(
        { success: false, message: "معرف غير صحيح" },
        { status: 400 }
      );
    }

    const existing = await prisma.address.findFirst({
      where: { id: addressId, userId: auth.user.id, deletedAt: null },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, message: "العنوان غير موجود" },
        { status: 404 }
      );
    }

    await prisma.$transaction(async (tx) => {
      // Soft delete
      await tx.address.update({
        where: { id: addressId },
        data: { deletedAt: new Date(), isDefault: false },
      });

      // If default → promote latest
      if (existing.isDefault) {
        const next = await tx.address.findFirst({
          where: {
            userId: auth.user.id,
            deletedAt: null,
            id: { not: addressId },
          },
          orderBy: { createdAt: "desc" },
          select: { id: true },
        });

        if (next) {
          await tx.address.update({
            where: { id: next.id },
            data: { isDefault: true },
          });
        }
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Address delete error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}