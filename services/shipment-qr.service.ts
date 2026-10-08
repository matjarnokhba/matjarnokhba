import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";

const TOKEN_BYTES = 32; // 256-bit

export const ShipmentQRService = {
  // ═══════ توليد Token عشوائي آمن ═══════
  generateToken(): string {
    return randomBytes(TOKEN_BYTES).toString("base64url");
  },

  // ═══════ Hash آمن للـToken ═══════
  hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  },

  // ═══════ Preview للعرض (آخر 6 أحرف) ═══════
  preview(token: string): string {
    return token.slice(-6);
  },

  // ═══════ البحث عن شحنة بـToken ═══════
  async findByToken(token: string) {
    if (!token || token.length < 20) return null;

    const hash = this.hashToken(token);

    return prisma.shipment.findFirst({
      where: {
        qrTokenHash: hash,
        qrTokenRevokedAt: null,
      },
      include: {
        items: {
          include: {
            order: {
              select: {
                id: true,
                orderNumber: true,
                customerSnapshot: true,
                shippingAddressSnapshot: true,
              },
            },
            orderItem: {
              select: {
                id: true,
                productName: true,
                variantName: true,
                quantity: true,
                imageUrl: true,
                unitPrice: true,
              },
            },
          },
        },
        deliveryPerson: {
          include: {
            user: { select: { id: true, name: true, phone: true } },
          },
        },
        customer: {
          select: { id: true, name: true, email: true, phone: true },
        },
      },
    });
  },

  // ═══════ إبطال Token الشحنة ═══════
  async revokeToken(shipmentId: number) {
    return prisma.shipment.update({
      where: { id: shipmentId },
      data: {
        qrTokenRevokedAt: new Date(),
        qrTokenRegens: { increment: 1 },
      },
    });
  },

  // ═══════ إعادة توليد Token (بعد الإبطال) ═══════
  async regenerateToken(shipmentId: number) {
    const newToken = this.generateToken();
    const newHash = this.hashToken(newToken);
    const newPreview = this.preview(newToken);

    const updated = await prisma.shipment.update({
      where: { id: shipmentId },
      data: {
        qrTokenHash: newHash,
        qrTokenPreview: newPreview,
        qrTokenRevokedAt: null,
        qrTokenRegens: { increment: 1 },
      },
    });

    // نُعيد الـtoken الأصلي مرة واحدة (لا يُخزَّن مجدداً)
    return {
      shipment: updated,
      rawToken: newToken,
    };
  },
};