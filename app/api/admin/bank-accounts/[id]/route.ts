import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";
import { decrypt } from "@/lib/encryption";

async function requireAdmin() {
  const current = await SessionService.getCurrent();
  if (!current) return { error: "غير مصرح", status: 401 };
  if (current.user.role !== "ADMIN" && current.user.role !== "SUPER_ADMIN") {
    return { error: "غير مصرح", status: 403 };
  }
  return { user: current.user };
}

// ═══ GET — عرض التفاصيل مع البيانات الكاملة (للمراجعة) ═══
export async function GET(
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
    const accountId = parseInt(id);
    if (isNaN(accountId)) {
      return NextResponse.json(
        { success: false, message: "معرف غير صحيح" },
        { status: 400 }
      );
    }

    const account = await prisma.sellerBankAccount.findUnique({
      where: { id: accountId },
      include: {
        seller: {
          select: {
            id: true,
            storeName: true,
            slug: true,
            user: { select: { name: true, email: true, phone: true } },
          },
        },
      },
    });

    if (!account || account.deletedAt) {
      return NextResponse.json(
        { success: false, message: "الحساب غير موجود" },
        { status: 404 }
      );
    }

    // ⚠️ فك التشفير للمراجعة (Admin فقط)
    let accountHolderFull: string | null = null;
    let ibanFull: string | null = null;
    let ribFull: string | null = null;

    try {
      accountHolderFull = decrypt(account.accountHolderEnc);
      ibanFull = decrypt(account.ibanEnc);
      if (account.ribEnc) ribFull = decrypt(account.ribEnc);
    } catch (err) {
      console.error("Decrypt error:", err);
    }

    return NextResponse.json({
      success: true,
      account: {
        id: account.id,
        bankName: account.bankName,
        accountHolderMasked: account.accountHolderMasked,
        ibanMasked: account.ibanMasked,
        ribMasked: account.ribMasked,
        businessName: account.businessName,
        accountType: account.accountType,
        currency: account.currency,
        verificationStatus: account.verificationStatus,
        verifiedAt: account.verifiedAt,
        rejectionReason: account.rejectionReason,
        isDefault: account.isDefault,
        isActive: account.isActive,
        createdAt: account.createdAt,
        seller: account.seller,
        // 🔓 البيانات الكاملة (للمراجعة)
        accountHolderFull,
        ibanFull,
        ribFull,
      },
    });
  } catch (error) {
    console.error("Admin bank account GET error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}

// ═══ PATCH — Approve / Reject ═══
const actionSchema = z.object({
  action: z.enum(["approve", "reject"]),
  rejectionReason: z.string().trim().max(500).optional(),
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
    const accountId = parseInt(id);
    if (isNaN(accountId)) {
      return NextResponse.json(
        { success: false, message: "معرف غير صحيح" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const parsed = actionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: "إجراء غير صحيح" },
        { status: 400 }
      );
    }

    const account = await prisma.sellerBankAccount.findUnique({
      where: { id: accountId },
      include: {
        seller: { select: { userId: true, storeName: true } },
      },
    });

    if (!account || account.deletedAt) {
      return NextResponse.json(
        { success: false, message: "الحساب غير موجود" },
        { status: 404 }
      );
    }

    if (parsed.data.action === "approve") {
      await prisma.$transaction(async (tx) => {
        await tx.sellerBankAccount.update({
          where: { id: accountId },
          data: {
            verificationStatus: "VERIFIED",
            verifiedAt: new Date(),
            verifiedById: auth.user.id,
            rejectionReason: null,
          },
        });

        await tx.notification.create({
          data: {
            userId: account.seller.userId,
            type: "SELLER_PAYOUT_READY",
            title: "✅ تم توثيق حسابك البنكي",
            message: `تم التحقق من حسابك في "${account.bankName}". يمكنك الآن استقبال الأموال.`,
            link: `/seller/bank-accounts`,
            category: "SYSTEM",
            severity: "INFO",
          },
        });
      });
    } else {
      // reject
      if (!parsed.data.rejectionReason) {
        return NextResponse.json(
          { success: false, message: "سبب الرفض مطلوب" },
          { status: 400 }
        );
      }

      await prisma.$transaction(async (tx) => {
        await tx.sellerBankAccount.update({
          where: { id: accountId },
          data: {
            verificationStatus: "REJECTED",
            verifiedAt: new Date(),
            verifiedById: auth.user.id,
            rejectionReason: parsed.data.rejectionReason,
          },
        });

        await tx.notification.create({
          data: {
            userId: account.seller.userId,
            type: "SELLER_PAYOUT_READY",
            title: "❌ تم رفض حسابك البنكي",
            message: `تم رفض الحساب في "${account.bankName}". السبب: ${parsed.data.rejectionReason}`,
            link: `/seller/bank-accounts`,
            category: "SYSTEM",
            severity: "WARNING",
          },
        });
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Admin bank account PATCH error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}