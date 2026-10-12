import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { encrypt, decrypt } from "@/lib/encryption";

const TOKEN_BYTES = 32;

export const CollectionBatchService = {
  // ═══════ توليد Token ═══════
  generateToken(): string {
    return randomBytes(TOKEN_BYTES).toString("base64url");
  },

  hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  },

  encryptToken(token: string): Uint8Array<ArrayBuffer> {
    return encrypt(token);
  },

  decryptToken(encrypted: Uint8Array | Buffer): string {
    return decrypt(encrypted);
  },

  preview(token: string): string {
    return token.slice(-6);
  },

  // ═══════ إنشاء Batch جديد ═══════
  async createBatch(
    tx: any,
    collectorId: number,
    fulfillmentItemIds: number[]
  ) {
    if (fulfillmentItemIds.length === 0) {
      throw new Error("لا توجد عناصر لإنشاء دفعة");
    }

    // ═══ توليد batchNumber ═══
    const year = new Date().getFullYear();
    const count = await tx.collectionBatch.count({
      where: {
        batchNumber: { startsWith: `BATCH-${year}-` },
      },
    });
    const batchNumber = `BATCH-${year}-${String(count + 1).padStart(5, "0")}`;

    // ═══ QR Token ═══
    const rawToken = this.generateToken();
    const tokenHash = this.hashToken(rawToken);
    const encrypted = this.encryptToken(rawToken);
    const preview = this.preview(rawToken);

    // ═══ جلب تفاصيل العناصر ═══
    const items = await tx.fulfillmentItem.findMany({
      where: { id: { in: fulfillmentItemIds } },
      select: {
        id: true,
        orderItem: { select: { orderId: true } },
      },
    });

    const uniqueOrderIds = Array.from(
      new Set(items.map((i: any) => i.orderItem.orderId))
    );

    // ═══ إنشاء Batch ═══
    const batch = await tx.collectionBatch.create({
      data: {
        batchNumber,
        collectorId,
        status: "IN_TRANSIT",
        qrTokenHash: tokenHash,
        qrTokenEncrypted: encrypted,
        qrTokenPreview: preview,
        itemsCount: items.length,
        totalOrders: uniqueOrderIds.length,
        departedAt: new Date(),
      },
    });

    // ═══ ربط العناصر ═══
    for (const itemId of fulfillmentItemIds) {
      await tx.collectionBatchItem.create({
        data: {
          batchId: batch.id,
          fulfillmentItemId: itemId,
        },
      });
    }

    return {
      batch,
      rawToken,
    };
  },

  // ═══════ البحث بـToken (للتحقق عند المسح) ═══════
  async findByToken(token: string) {
    if (!token || token.length < 20) return null;

    const hash = this.hashToken(token);

    return prisma.collectionBatch.findFirst({
      where: {
        qrTokenHash: hash,
        qrTokenRevokedAt: null,
      },
      include: {
        collector: {
          select: { id: true, name: true, phone: true, email: true },
        },
        items: {
          include: {
            fulfillmentItem: {
              include: {
                seller: {
                  select: { id: true, storeName: true, city: true },
                },
                orderItem: {
                  select: {
                    orderId: true,
                    order: {
                      select: { id: true, orderNumber: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
  },

  // ═══════ جلب Batch نشط للجامع ═══════
  async getActiveBatchForCollector(collectorId: number) {
    return prisma.collectionBatch.findFirst({
      where: {
        collectorId,
        status: "IN_TRANSIT",
      },
      include: {
        items: {
          include: {
            fulfillmentItem: {
              include: {
                seller: {
                  select: { storeName: true, city: true },
                },
                orderItem: {
                  select: {
                    order: {
                      select: { orderNumber: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  },

  // ═══════ استرجاع raw token (لإعادة الطباعة) ═══════
  async getRawToken(batchId: number): Promise<string | null> {
    const batch = await prisma.collectionBatch.findUnique({
      where: { id: batchId },
      select: {
        qrTokenEncrypted: true,
        qrTokenRevokedAt: true,
      },
    });

    if (!batch || batch.qrTokenRevokedAt) return null;

    try {
      return this.decryptToken(batch.qrTokenEncrypted);
    } catch (err) {
      console.error("Failed to decrypt batch token:", err);
      return null;
    }
  },

  // ═══════ إبطال QR بعد الاستلام ═══════
  async revokeToken(tx: any, batchId: number) {
    return tx.collectionBatch.update({
      where: { id: batchId },
      data: { qrTokenRevokedAt: new Date() },
    });
  },
};