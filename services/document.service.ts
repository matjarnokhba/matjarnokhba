import { prisma } from "@/lib/prisma";

type DocumentType =
  | "CIN"
  | "PASSPORT"
  | "ICE"
  | "RC"
  | "IF"
  | "BANK_STATEMENT"
  | "ADDRESS_PROOF"
  | "OTHER";

type CreateDocumentInput = {
  type: DocumentType;
  storageKey: string;
  mimeType: string;
  sizeBytes: number;
  checksum?: string;
  notes?: string;
};

// ═══ خريطة أسماء الوثائق ═══
export const DOCUMENT_LABELS: Record<DocumentType, string> = {
  CIN: "بطاقة التعريف الوطنية",
  PASSPORT: "جواز السفر",
  ICE: "السجل التجاري (ICE)",
  RC: "البطاقة التجارية (RC)",
  IF: "المعرف الجبائي (IF)",
  BANK_STATEMENT: "كشف حساب بنكي",
  ADDRESS_PROOF: "إثبات العنوان",
  OTHER: "وثيقة أخرى",
};

export const DocumentService = {
  // ═══ قائمة وثائق التاجر ═══
  async list(sellerId: number) {
    const docs = await prisma.sellerDocument.findMany({
      where: { sellerId, deletedAt: null },
      orderBy: { createdAt: "desc" },
    });

    return docs.map((d) => ({
      id: d.id,
      type: d.type,
      typeLabel: DOCUMENT_LABELS[d.type] || d.type,
      status: d.status,
      storageKey: d.storageKey,
      mimeType: d.mimeType,
      sizeBytes: d.sizeBytes,
      rejectionReason: d.rejectionReason,
      reviewedAt: d.reviewedAt,
      createdAt: d.createdAt,
    }));
  },

  // ═══ إضافة وثيقة ═══
  async create(sellerId: number, data: CreateDocumentInput) {
    if (!data.storageKey || !data.mimeType) {
      throw new Error("بيانات الملف مطلوبة");
    }
    if (data.sizeBytes <= 0 || data.sizeBytes > 8 * 1024 * 1024) {
      throw new Error("حجم الملف يجب أن يكون أقل من 8MB");
    }

    // ═══ تحقق: هل الوثيقة من هذا النوع موجودة مسبقاً؟ ═══
    const existing = await prisma.sellerDocument.findFirst({
      where: {
        sellerId,
        type: data.type,
        deletedAt: null,
        status: { in: ["PENDING", "APPROVED"] },
      },
    });

    if (existing) {
      throw new Error(
        `لديك ${DOCUMENT_LABELS[data.type]} مرفوعة بالفعل (${existing.status === "PENDING" ? "قيد المراجعة" : "معتمدة"})`
      );
    }

    return prisma.sellerDocument.create({
      data: {
        sellerId,
        type: data.type,
        storageKey: data.storageKey,
        mimeType: data.mimeType,
        sizeBytes: data.sizeBytes,
        checksum: data.checksum || "n/a",
        notes: data.notes || null,
        status: "PENDING",
      },
    });
  },

  // ═══ حذف وثيقة (من التاجر) ═══
  async remove(sellerId: number, documentId: number) {
    const doc = await prisma.sellerDocument.findFirst({
      where: { id: documentId, sellerId, deletedAt: null },
    });

    if (!doc) throw new Error("الوثيقة غير موجودة");
    if (doc.status === "APPROVED") {
      throw new Error("لا يمكن حذف وثيقة معتمدة");
    }

    await prisma.sellerDocument.update({
      where: { id: documentId },
      data: { deletedAt: new Date() },
    });
  },

  // ═══ Admin: قائمة كل الوثائق ═══
  async listAll(filter: "PENDING" | "APPROVED" | "REJECTED" | "ALL") {
    const where: any = { deletedAt: null };
    if (filter !== "ALL") where.status = filter;

    const docs = await prisma.sellerDocument.findMany({
      where,
      include: {
        seller: {
          select: {
            id: true,
            storeName: true,
            slug: true,
            isVerified: true,
            user: { select: { name: true, email: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return docs.map((d) => ({
      id: d.id,
      type: d.type,
      typeLabel: DOCUMENT_LABELS[d.type] || d.type,
      status: d.status,
      storageKey: d.storageKey,
      mimeType: d.mimeType,
      sizeBytes: d.sizeBytes,
      rejectionReason: d.rejectionReason,
      reviewedAt: d.reviewedAt,
      createdAt: d.createdAt,
      seller: d.seller,
    }));
  },

  // ═══ Admin: Approve / Reject ═══
  async review(
    documentId: number,
    adminId: number,
    action: "approve" | "reject",
    rejectionReason?: string
  ) {
    const doc = await prisma.sellerDocument.findUnique({
      where: { id: documentId },
      include: {
        seller: { select: { userId: true, storeName: true } },
      },
    });

    if (!doc || doc.deletedAt) throw new Error("الوثيقة غير موجودة");
    if (doc.status !== "PENDING") {
      throw new Error("لا يمكن المراجعة إلا للوثائق المعلّقة");
    }

    if (action === "reject" && !rejectionReason?.trim()) {
      throw new Error("سبب الرفض مطلوب");
    }

    const newStatus = action === "approve" ? "APPROVED" : "REJECTED";

    await prisma.$transaction(async (tx) => {
      await tx.sellerDocument.update({
        where: { id: documentId },
        data: {
          status: newStatus,
          reviewedAt: new Date(),
          reviewedById: adminId,
          rejectionReason: action === "reject" ? rejectionReason : null,
        },
      });

      // إشعار للتاجر
      await tx.notification.create({
        data: {
          userId: doc.seller.userId,
          type: "SELLER_DOCUMENT_APPROVED",
          title:
            action === "approve"
              ? "✅ تم اعتماد وثيقتك"
              : "❌ تم رفض وثيقتك",
          message:
            action === "approve"
              ? `تم اعتماد "${DOCUMENT_LABELS[doc.type]}" بنجاح.`
              : `تم رفض "${DOCUMENT_LABELS[doc.type]}". السبب: ${rejectionReason}`,
          link: "/seller/documents",
          category: "SYSTEM",
          severity: action === "approve" ? "INFO" : "WARNING",
        },
      });
    });
  },
};