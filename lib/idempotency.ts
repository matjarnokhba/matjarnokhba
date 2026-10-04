import { prisma } from "@/lib/prisma";
import { createHash } from "crypto";

const TTL_HOURS = 24;

export type IdempotencyCheckResult =
  | { status: "new"; id: number }
  | { status: "cached"; response: any; statusCode: number }
  | { status: "conflict"; message: string }
  | { status: "in_progress"; message: string };

function hashRequest(data: unknown): string {
  return createHash("sha256").update(JSON.stringify(data)).digest("hex");
}

export const IdempotencyService = {
  async check(
    userId: number,
    endpoint: string,
    key: string,
    requestBody: unknown
  ): Promise<IdempotencyCheckResult> {
    const requestHash = hashRequest(requestBody);
    const now = new Date();

    const existing = await prisma.idempotencyKey.findUnique({
      where: {
        userId_endpoint_key: { userId, endpoint, key },
      },
    });

    if (existing) {
      if (existing.expiresAt < now) {
        await prisma.idempotencyKey.delete({ where: { id: existing.id } });
      } else {
        if (existing.requestHash === requestHash) {
          if (existing.response === null) {
            return {
              status: "in_progress",
              message: "الطلب قيد المعالجة، انتظر قليلاً",
            };
          }
          return {
            status: "cached",
            response: existing.response,
            statusCode: existing.statusCode ?? 200,
          };
        } else {
          return {
            status: "conflict",
            message: "المفتاح مستخدم مسبقاً بطلب مختلف",
          };
        }
      }
    }

    const expiresAt = new Date(Date.now() + TTL_HOURS * 60 * 60 * 1000);

    try {
      const created = await prisma.idempotencyKey.create({
        data: {
          userId,
          endpoint,
          key,
          requestHash,
          expiresAt,
        },
      });
      return { status: "new", id: created.id };
    } catch (err: any) {
      if (err?.code === "P2002") {
        return {
          status: "in_progress",
          message: "الطلب قيد المعالجة، انتظر قليلاً",
        };
      }
      throw err;
    }
  },

  async save(id: number, response: any, statusCode: number): Promise<void> {
    await prisma.idempotencyKey.update({
      where: { id },
      data: { response, statusCode },
    });
  },

  async clear(id: number): Promise<void> {
    try {
      await prisma.idempotencyKey.delete({ where: { id } });
    } catch {
      // تجاهل
    }
  },
};