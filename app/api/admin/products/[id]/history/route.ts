import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const current = await SessionService.getCurrent();
    if (
      !current ||
      (current.user.role !== "ADMIN" && current.user.role !== "SUPER_ADMIN")
    ) {
      return NextResponse.json(
        { success: false, message: "غير مصرح" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const productId = parseInt(id);
    if (isNaN(productId)) {
      return NextResponse.json(
        { success: false, message: "معرف غير صحيح" },
        { status: 400 }
      );
    }

    const url = new URL(request.url);
    const skip = parseInt(url.searchParams.get("skip") || "0");
    const take = Math.min(parseInt(url.searchParams.get("take") || "50"), 100);

    const [logs, total] = await Promise.all([
      prisma.productEditLog.findMany({
        where: { productId },
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
      prisma.productEditLog.count({ where: { productId } }),
    ]);

    return NextResponse.json({
      success: true,
      logs: logs.map((l) => ({
        id: l.id,
        changedFields: l.changedFields,
        oldValues: l.oldValues,
        newValues: l.newValues,
        requiresReapproval: l.requiresReapproval,
        reason: l.reason,
        reviewedAt: l.reviewedAt,
        reviewAction: l.reviewAction,
        createdAt: l.createdAt,
      })),
      total,
      skip,
      take,
    });
  } catch (error) {
    console.error("Admin history GET error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}