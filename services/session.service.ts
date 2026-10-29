import crypto from "crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import {
  SESSION_COOKIE_NAME,
  SESSION_DURATION_MS,
} from "@/lib/validations/auth";

function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

const SELLER_SELECT = {
  id: true,
  storeName: true,
  slug: true,
  status: true,
  isVerified: true,
  logo: true,
} as const;

export const SessionService = {
  async create(userId: number, userAgent?: string, ipAddress?: string) {
    const token = generateToken();
    const tokenHash = hashToken(token);

    const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

    const session = await prisma.session.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
        userAgent: userAgent || null,
        ipAddress: ipAddress || null,
      },
    });

    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      expires: expiresAt,
      path: "/",
    });

    return session;
  },

  async getCurrent() {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    if (!token) return null;

    const tokenHash = hashToken(token);
    const session = await prisma.session.findUnique({
      where: { tokenHash },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            role: true,
            deletedAt: true,
            emailVerified: true,
            seller: { select: SELLER_SELECT },
            wholesaleSupplier: {
              select: {
                id: true,
                displayName: true,
                slug: true,
                status: true,
                isVerified: true,
                activityType: true,
              },
            },
            staffOf: {
              where: { deletedAt: null, isActive: true },
              select: {
                id: true,
                seller: { select: SELLER_SELECT },
                permissions: { select: { permissionKey: true } },
              },
            },
          },
        },
      },
    });

    if (!session) return null;
    if (session.revokedAt) return null;
    if (session.expiresAt < new Date()) return null;
    if (session.user.deletedAt) return null;

    const { staffOf, ...userBase } = session.user;
    const isSellerOwner = !!userBase.seller;
    const staffId = staffOf?.id ?? null;
    const staffPermissions =
      staffOf?.permissions.map((p) => p.permissionKey) ?? [];
    const effectiveSeller = userBase.seller ?? staffOf?.seller ?? null;

    // Guard: SELLER with neither active seller nor active staff = disabled staff
    if (userBase.role === "SELLER" && !effectiveSeller) {
      const anyStaff = await prisma.sellerStaff.findUnique({
        where: { userId: userBase.id },
        select: { id: true },
      });
      if (anyStaff) {
        // Disabled/deleted staff -> force logout
        return null;
      }
      // Else: onboarding case (new seller without a store yet)
    }

    return {
      session,
      user: {
        ...userBase,
        seller: effectiveSeller,
        isSellerOwner,
        staffId,
        staffPermissions,
      },
    };
  },

  async destroy() {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    if (token) {
      const tokenHash = hashToken(token);
      await prisma.session.updateMany({
        where: { tokenHash },
        data: {
          revokedAt: new Date(),
          revokedReason: "LOGOUT",
        },
      });
    }

    cookieStore.delete(SESSION_COOKIE_NAME);
  },
};