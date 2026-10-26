import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { encrypt, decrypt } from "@/lib/encryption";

const TOKEN_BYTES = 32;

export const ReturnShipmentService = {
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

  // ═══════ إنشاء ReturnShipment ═══════
  async createForReturn(tx: any, returnId: number) {
    const existing = await tx.returnShipment.findUnique({
      where: { returnId },
      select: { id: true },
    });
    if (existing) return existing;

    const ret = await tx.returnRequest.findUnique({
      where: { id: returnId },
      select: {
        id: true,
        status: true,
        order: { select: { shippingAddressSnapshot: true } },
      },
    });
    if (!ret) throw new Error("ReturnRequest غير موجود");
    if (ret.status !== "APPROVED") {
      throw new Error("يجب الموافقة على الإرجاع أولاً");
    }

    // ═══ إسناد تلقائي لسائق الاستلام حسب مدينة الزبون ═══
    const addressSnapshot = ret.order?.shippingAddressSnapshot as { city?: string } | null;
    const customerCity = (addressSnapshot?.city || "").trim();
    let pickupDriverId: number | null = null;
    let pickupAssignedAt: Date | null = null;
    if (customerCity) {
      const driver = await tx.deliveryPerson.findFirst({
        where: {
          status: "ACTIVE",
          deletedAt: null,
          OR: [
            { city: customerCity },
            { cities: { has: customerCity } },
          ],
        },
        orderBy: { createdAt: "asc" },
        select: { id: true },
      });
      if (driver) {
        pickupDriverId = driver.id;
        pickupAssignedAt = new Date();
      }
    }

    // ═══ returnNumber ═══
    const year = new Date().getFullYear();
    const count = await tx.returnShipment.count({
      where: { returnNumber: { startsWith: `RET-${year}-` } },
    });
    const returnNumber = `RET-${year}-${String(count + 1).padStart(5, "0")}`;

    // ═══ QR Pickup ═══
    const pickupRaw = this.generateToken();
    const pickupHash = this.hashToken(pickupRaw);
    const pickupEnc = this.encryptToken(pickupRaw);
    const pickupPreview = this.preview(pickupRaw);

    // ═══ QR Delivery ═══
    const deliveryRaw = this.generateToken();
    const deliveryHash = this.hashToken(deliveryRaw);
    const deliveryEnc = this.encryptToken(deliveryRaw);
    const deliveryPreview = this.preview(deliveryRaw);

    const shipment = await tx.returnShipment.create({
      data: {
        returnNumber,
        returnId,
        status: "PENDING_PICKUP",
        pickupTokenHash: pickupHash,
        pickupTokenEncrypted: pickupEnc,
        pickupTokenPreview: pickupPreview,
        deliveryTokenHash: deliveryHash,
        deliveryTokenEncrypted: deliveryEnc,
        deliveryTokenPreview: deliveryPreview,
        ...(pickupDriverId && {
          pickupDriverId,
          pickupAssignedAt,
        }),
      },
    });

    return {
      ...shipment,
      pickupRawToken: pickupRaw,
      deliveryRawToken: deliveryRaw,
    };
  },

  // ═══════ البحث بـPickup Token ═══════
  async findByPickupToken(token: string) {
    if (!token || token.length < 20) return null;
    const hash = this.hashToken(token);

    return prisma.returnShipment.findFirst({
      where: {
        pickupTokenHash: hash,
        pickupTokenRevokedAt: null,
      },
      include: {
        returnRequest: {
          include: {
            user: {
              select: { id: true, name: true, email: true, phone: true },
            },
            order: {
              select: {
                id: true,
                orderNumber: true,
                shippingAddressSnapshot: true,
                customerSnapshot: true,
              },
            },
            items: {
              include: {
                orderItem: {
                  include: {
                    seller: {
                      select: { id: true, storeName: true, city: true },
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

  // ═══════ البحث بـDelivery Token ═══════
  async findByDeliveryToken(token: string) {
    if (!token || token.length < 20) return null;
    const hash = this.hashToken(token);

    return prisma.returnShipment.findFirst({
      where: {
        deliveryTokenHash: hash,
        deliveryTokenRevokedAt: null,
      },
      include: {
        returnRequest: {
          include: {
            user: {
              select: { id: true, name: true, email: true, phone: true },
            },
            order: {
              select: {
                id: true,
                orderNumber: true,
                customerSnapshot: true,
              },
            },
            items: {
              include: {
                orderItem: {
                  include: {
                    seller: {
                      select: { id: true, storeName: true, city: true },
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

  // ═══════ استرجاع raw tokens ═══════
  async getRawTokens(shipmentId: number) {
    const s = await prisma.returnShipment.findUnique({
      where: { id: shipmentId },
      select: {
        pickupTokenEncrypted: true,
        pickupTokenRevokedAt: true,
        deliveryTokenEncrypted: true,
        deliveryTokenRevokedAt: true,
      },
    });
    if (!s) return null;

    let pickupRaw: string | null = null;
    let deliveryRaw: string | null = null;

    if (!s.pickupTokenRevokedAt) {
      try {
        pickupRaw = this.decryptToken(s.pickupTokenEncrypted);
      } catch {}
    }
    if (!s.deliveryTokenRevokedAt) {
      try {
        deliveryRaw = this.decryptToken(s.deliveryTokenEncrypted);
      } catch {}
    }

    return { pickupRaw, deliveryRaw };
  },
};