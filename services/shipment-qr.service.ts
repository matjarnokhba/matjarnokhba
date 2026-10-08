import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { encrypt, decrypt } from "@/lib/encryption";

const TOKEN_BYTES = 32; // 256-bit

export const ShipmentQRService = {
  // ═══════ توليد Token عشوائي آمن ═══════
  generateToken(): string {
    return randomBytes(TOKEN_BYTES).toString("base64url");
  },

  // ═══════ Hash آمن للـToken (مصدر التحقق الوحيد) ═══════
  hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  },

  // ═══════ تشفير raw token (للطباعة فقط) ═══════
  encryptToken(token: string): Uint8Array<ArrayBuffer> {
    return encrypt(token);
  },

  // ═══════ فك تشفير raw token (على السيرفر فقط) ═══════
  decryptToken(encrypted: Uint8Array | Buffer): string {
    return decrypt(encrypted);
  },

  // ═══════ Preview للعرض (آخر 6 أحرف) ═══════
  preview(token: string): string {
    return token.slice(-6);
  },

  // ═══════ البحث عن شحنة بـToken (للتحقق عند المسح) ═══════
  async findByToken(token: string) {
    if (!token || token.length < 20) return null;

    // ✅ التحقق عبر hash فقط — لا نستخدم النسخة المشفّرة
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

  // ═══════ استرجاع raw token (لإعادة طباعة QR — Server-Side فقط) ═══════
  async getRawToken(shipmentId: number): Promise<string | null> {
    const shipment = await prisma.shipment.findUnique({
      where: { id: shipmentId },
      select: {
        qrTokenEncrypted: true,
        qrTokenRevokedAt: true,
      },
    });

    if (!shipment || shipment.qrTokenRevokedAt) return null;

    try {
      return this.decryptToken(shipment.qrTokenEncrypted);
    } catch (err) {
      console.error("Failed to decrypt shipment token:", err);
      return null;
    }
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

  // ═══════ إعادة توليد Token (نادراً ما نحتاجه) ═══════
  async regenerateToken(shipmentId: number) {
    const newToken = this.generateToken();
    const newHash = this.hashToken(newToken);
    const newEncrypted = this.encryptToken(newToken);
    const newPreview = this.preview(newToken);

    const updated = await prisma.shipment.update({
      where: { id: shipmentId },
      data: {
        qrTokenHash: newHash,
        qrTokenEncrypted: newEncrypted,
        qrTokenPreview: newPreview,
        qrTokenRevokedAt: null,
        qrTokenRegens: { increment: 1 },
      },
    });

    return { shipment: updated, rawToken: newToken };
  },
};