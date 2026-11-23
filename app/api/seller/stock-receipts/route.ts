import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isSafeDocumentUrl } from "@/lib/url-safety";
import { requireSeller, requireStaffPermission } from "@/lib/seller-guards";
import { StockReceiptService, STOCK_SOURCE_TYPES } from "@/services/stock-receipt.service";
import {
  mapServiceError,
  stockVisibility,
  RECEIPT_INCLUDE,
  receiptToDto,
  receiptUserIds,
  loadUserNames,
} from "@/lib/stock-api";

const httpsUrl = z.string().trim().url().max(1000).refine((u) => isSafeDocumentUrl(u), "unsafe url");

const schema = z.object({
  sourceType: z.enum(STOCK_SOURCE_TYPES),
  sourceName: z.string().trim().max(200).optional().nullable(),
  sourcePhone: z.string().trim().max(40).optional().nullable(),
  sourceNote: z.string().trim().max(1000).optional().nullable(),
  totalCost: z.number().min(0).max(100_000_000).optional().nullable(),
  invoiceUrl: httpsUrl.optional().nullable(),
  invoiceName: z.string().trim().max(200).optional().nullable(),
  purchasedByUserId: z.number().int().positive().optional().nullable(),
  receivedByUserId: z.number().int().positive().optional().nullable(),
  externalRefType: z.string().trim().max(40).optional().nullable(),
  externalRefId: z.number().int().positive().optional().nullable(),
  items: z
    .array(
      z.object({
        variantId: z.number().int().positive(),
        quantity: z.number().int().min(1).max(1_000_000),
        unitCost: z.number().min(0).max(10_000_000).optional().nullable(),
      })
    )
    .min(1)
    .max(200),
});

// إنشاء طلب إضافة مخزون
export async function POST(request: Request) {
  try {
    const guard = await requireStaffPermission("ADD_STOCK");
    if (!guard.ok) return guard.response;
    const { current } = guard;
    const sellerId = current.user.seller!.id;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, message: "بيانات غير صحيحة" }, { status: 400 });
    }
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, message: "بيانات غير صحيحة" }, { status: 400 });
    }
    const d = parsed.data;

    // المشتري والمستلم يجب أن يتبعا هذا المتجر (المالك أو موظفيه)
    const [seller, staff] = await Promise.all([
      prisma.seller.findUnique({ where: { id: sellerId }, select: { userId: true } }),
      prisma.sellerStaff.findMany({ where: { sellerId, isActive: true, deletedAt: null }, select: { userId: true } }),
    ]);
    if (!seller) return NextResponse.json({ success: false, message: "التاجر غير موجود" }, { status: 404 });
    const allowed = new Set<number>([seller.userId, ...staff.map((s) => s.userId)]);
    for (const id of [d.purchasedByUserId, d.receivedByUserId]) {
      if (id != null && !allowed.has(id)) {
        return NextResponse.json({ success: false, message: "الشخص المحدد لا يتبع متجرك" }, { status: 400 });
      }
    }

    const result = await prisma.$transaction(
      (tx) =>
        StockReceiptService.createReceipt(tx, {
          sellerId,
          enteredByUserId: current.user.id,
          actorIsOwner: !!current.user.isSellerOwner,
          sourceType: d.sourceType,
          sourceName: d.sourceName,
          sourcePhone: d.sourcePhone,
          sourceNote: d.sourceNote,
          totalCost: d.totalCost,
          invoiceUrl: d.invoiceUrl,
          invoiceName: d.invoiceName,
          purchasedByUserId: d.purchasedByUserId ?? seller.userId,
          receivedByUserId: d.receivedByUserId ?? undefined,
          externalRefType: d.externalRefType,
          externalRefId: d.externalRefId,
          items: d.items,
        }),
      { timeout: 30000 }
    );

    return NextResponse.json({ success: true, receipt: result }, { status: 201 });
  } catch (e) {
    const mapped = mapServiceError(e);
    if (mapped) return mapped;
    console.error("Create stock receipt error:", e);
    return NextResponse.json({ success: false, message: "حدث خطأ أثناء الحفظ" }, { status: 500 });
  }
}

// قائمة الطلبات
export async function GET(request: Request) {
  try {
    const guard = await requireSeller();
    if (!guard.ok) return guard.response;
    const { current } = guard;
    const vis = stockVisibility(current);
    if (!vis.all && !vis.own) {
      return NextResponse.json({ success: false, message: "لا تملك الصلاحية لهذه العملية" }, { status: 403 });
    }
    const sellerId = current.user.seller!.id;

    const url = new URL(request.url);
    const statusParam = url.searchParams.get("status");
    const status = statusParam && ["PENDING", "APPROVED", "REJECTED"].includes(statusParam) ? statusParam : undefined;
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get("limit") || "20", 10) || 20));

    const where: any = { sellerId };
    if (status) where.status = status;
    if (!vis.all) where.enteredByUserId = current.user.id;

    const [rows, total] = await Promise.all([
      prisma.stockReceipt.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: RECEIPT_INCLUDE,
      }),
      prisma.stockReceipt.count({ where }),
    ]);
    const names = await loadUserNames(prisma, receiptUserIds(rows));

    return NextResponse.json({
      success: true,
      total,
      page,
      limit,
      receipts: rows.map((r) => ({ ...receiptToDto(r, names), canEdit: r.status === "PENDING" && r.enteredByUserId === current.user.id, edited: r.status === "PENDING" && r.updatedAt.getTime() - r.createdAt.getTime() > 2000 })),
    });
  } catch (e) {
    console.error("List stock receipts error:", e);
    return NextResponse.json({ success: false, message: "حدث خطأ غير متوقع" }, { status: 500 });
  }
}