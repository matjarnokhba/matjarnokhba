import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";

const ENTRY_TYPES = ["SALE", "PURCHASE", "PAYMENT_RECEIVED", "PAYMENT_SENT"] as const;

const patchSchema = z.object({
  entryType: z.enum(ENTRY_TYPES).optional(),
  amount: z.number().positive().max(999999999).optional(),
  description: z.string().trim().min(2).max(300).optional(),
  entryDate: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
  referenceNumber: z.string().trim().max(80).optional().nullable(),
});

async function verifyOwner(sellerId: number, entryId: number) {
  const e = await prisma.ledgerEntry.findUnique({ where: { id: entryId }, select: { sellerId: true, deletedAt: true } });
  if (!e || e.deletedAt) return { ok: false, reason: "not_found" as const };
  if (e.sellerId !== sellerId) return { ok: false, reason: "forbidden" as const };
  return { ok: true };
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const current = await SessionService.getCurrent();
    if (!current || !current.user.seller) {
      return NextResponse.json({ success: false, message: "غير مصرح" }, { status: 403 });
    }
    const sellerId = current.user.seller.id;
    const { id } = await params;
    const entryId = parseInt(id);
    if (isNaN(entryId)) return NextResponse.json({ success: false, message: "معرف غير صحيح" }, { status: 400 });

    const check = await verifyOwner(sellerId, entryId);
    if (!check.ok) {
      return NextResponse.json(
        { success: false, message: check.reason === "forbidden" ? "غير مصرح" : "القيد غير موجود" },
        { status: check.reason === "forbidden" ? 403 : 404 }
      );
    }

    const body = await request.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message || "بيانات غير صحيحة" }, { status: 400 });
    }

    const data: any = {};
    if (parsed.data.entryType !== undefined) data.entryType = parsed.data.entryType;
    if (parsed.data.amount !== undefined) data.amount = parsed.data.amount;
    if (parsed.data.description !== undefined) data.description = parsed.data.description;
    if (parsed.data.entryDate !== undefined) data.entryDate = parsed.data.entryDate ? new Date(parsed.data.entryDate) : undefined;
    if (parsed.data.dueDate !== undefined) data.dueDate = parsed.data.dueDate ? new Date(parsed.data.dueDate) : null;
    if (parsed.data.notes !== undefined) data.notes = parsed.data.notes || null;
    if (parsed.data.referenceNumber !== undefined) data.referenceNumber = parsed.data.referenceNumber || null;

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ success: false, message: "لا يوجد تغيير" }, { status: 400 });
    }

    await prisma.ledgerEntry.update({ where: { id: entryId }, data });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Ledger PATCH error:", error);
    return NextResponse.json({ success: false, message: "حدث خطأ" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const current = await SessionService.getCurrent();
    if (!current || !current.user.seller) {
      return NextResponse.json({ success: false, message: "غير مصرح" }, { status: 403 });
    }
    const sellerId = current.user.seller.id;
    const { id } = await params;
    const entryId = parseInt(id);
    if (isNaN(entryId)) return NextResponse.json({ success: false, message: "معرف غير صحيح" }, { status: 400 });

    const check = await verifyOwner(sellerId, entryId);
    if (!check.ok) {
      return NextResponse.json(
        { success: false, message: check.reason === "forbidden" ? "غير مصرح" : "القيد غير موجود" },
        { status: check.reason === "forbidden" ? 403 : 404 }
      );
    }

    await prisma.ledgerEntry.update({ where: { id: entryId }, data: { deletedAt: new Date() } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Ledger DELETE error:", error);
    return NextResponse.json({ success: false, message: "حدث خطأ" }, { status: 500 });
  }
}