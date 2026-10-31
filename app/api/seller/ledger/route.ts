import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";

const ENTRY_TYPES = ["SALE", "PURCHASE", "PAYMENT_RECEIVED", "PAYMENT_SENT"] as const;

const createSchema = z.object({
  counterpartyType: z.enum(["INTERNAL", "EXTERNAL"]),
  counterpartyUserId: z.number().int().positive().optional().nullable(),
  counterpartyName: z.string().trim().min(1).max(120),
  entryType: z.enum(ENTRY_TYPES),
  amount: z.number().positive().max(999999999),
  description: z.string().trim().min(2).max(300),
  entryDate: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
  referenceNumber: z.string().trim().max(80).optional().nullable(),
});

export async function GET(request: Request) {
  try {
    const current = await SessionService.getCurrent();
    if (!current || !current.user.seller) {
      return NextResponse.json({ success: false, message: "غير مصرح" }, { status: 403 });
    }
    const sellerId = current.user.seller.id;
    const url = new URL(request.url);
    const search = (url.searchParams.get("search") || "").trim();
    const entryType = url.searchParams.get("entryType");
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");

    const where: any = { sellerId, deletedAt: null };
    if (search) where.counterpartyName = { contains: search, mode: "insensitive" };
    if (entryType && (ENTRY_TYPES as readonly string[]).includes(entryType)) where.entryType = entryType;
    if (from) where.entryDate = { ...(where.entryDate || {}), gte: new Date(from) };
    if (to) where.entryDate = { ...(where.entryDate || {}), lte: new Date(to + "T23:59:59") };

    const rows = await prisma.ledgerEntry.findMany({
      where,
      take: 200,
      orderBy: [{ entryDate: "desc" }, { id: "desc" }],
    });

    const items = rows.map((r) => ({
      id: r.id,
      counterpartyType: r.counterpartyType,
      counterpartyUserId: r.counterpartyUserId,
      counterpartyName: r.counterpartyName,
      entryType: r.entryType,
      amount: Number(r.amount),
      currency: r.currency,
      description: r.description,
      entryDate: r.entryDate.toISOString(),
      dueDate: r.dueDate ? r.dueDate.toISOString() : null,
      notes: r.notes,
      referenceNumber: r.referenceNumber,
    }));

    return NextResponse.json({ success: true, items });
  } catch (error) {
    console.error("Ledger GET error:", error);
    return NextResponse.json({ success: false, message: "حدث خطأ" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const current = await SessionService.getCurrent();
    if (!current || !current.user.seller) {
      return NextResponse.json({ success: false, message: "غير مصرح" }, { status: 403 });
    }
    const sellerId = current.user.seller.id;
    const userId = current.user.id;

    const body = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.issues[0]?.message || "بيانات غير صحيحة" },
        { status: 400 }
      );
    }

    const d = parsed.data;
    let resolvedName = d.counterpartyName;
    if (d.counterpartyType === "INTERNAL") {
      if (!d.counterpartyUserId) {
        return NextResponse.json({ success: false, message: "حدد مستخدمًا داخليًا" }, { status: 400 });
      }
      const u = await prisma.user.findUnique({
        where: { id: d.counterpartyUserId },
        select: { id: true, name: true, deletedAt: true },
      });
      if (!u || u.deletedAt) {
        return NextResponse.json({ success: false, message: "المستخدم غير موجود" }, { status: 404 });
      }
      resolvedName = u.name;
    }

    const entry = await prisma.ledgerEntry.create({
      data: {
        sellerId,
        counterpartyType: d.counterpartyType,
        counterpartyUserId: d.counterpartyType === "INTERNAL" ? d.counterpartyUserId ?? null : null,
        counterpartyName: resolvedName,
        entryType: d.entryType,
        amount: d.amount,
        description: d.description,
        entryDate: d.entryDate ? new Date(d.entryDate) : new Date(),
        dueDate: d.dueDate ? new Date(d.dueDate) : null,
        notes: d.notes || null,
        referenceNumber: d.referenceNumber || null,
        createdById: userId,
      },
    });

    return NextResponse.json({ success: true, id: entry.id });
  } catch (error) {
    console.error("Ledger POST error:", error);
    return NextResponse.json({ success: false, message: "حدث خطأ" }, { status: 500 });
  }
}