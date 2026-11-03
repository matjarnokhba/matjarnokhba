import { prisma } from "@/lib/prisma";

/**
 * Generates a unique wholesale order number.
 * Uses the shared OrderSequence table with year offset to avoid collision with
 * retail orders. Format: WO-YYYY-NNNNN
 */
export async function generateWholesaleOrderNumber(tx: any): Promise<string> {
  const year = new Date().getFullYear();
  const seq = await (tx ?? prisma).orderSequence.upsert({
    where: { year: year + 100000 },
    create: { year: year + 100000, lastNumber: 1 },
    update: { lastNumber: { increment: 1 } },
  });
  return `WO-${year}-${String(seq.lastNumber).padStart(5, "0")}`;
}

/**
 * Generates a unique wholesale order GROUP number.
 * Format: WG-YYYY-NNNNN
 */
export async function generateWholesaleOrderGroupNumber(tx: any): Promise<string> {
  const year = new Date().getFullYear();
  const seq = await (tx ?? prisma).orderSequence.upsert({
    where: { year: year + 200000 },
    create: { year: year + 200000, lastNumber: 1 },
    update: { lastNumber: { increment: 1 } },
  });
  return `WG-${year}-${String(seq.lastNumber).padStart(5, "0")}`;
}