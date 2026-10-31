import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";

export async function GET() {
  try {
    const current = await SessionService.getCurrent();
    if (!current || !current.user.seller) {
      return NextResponse.json({ success: false, message: "غير مصرح" }, { status: 403 });
    }
    const sellerId = current.user.seller.id;

    const entries = await prisma.ledgerEntry.findMany({
      where: { sellerId, deletedAt: null },
      select: { entryType: true, amount: true, counterpartyUserId: true, counterpartyName: true, counterpartyType: true },
    });

    const partyMap = new Map<string, { name: string; type: string; userId: number | null; balance: number; count: number }>();
    let totalReceivable = 0;
    let totalPayable = 0;

    for (const e of entries) {
      const amt = Number(e.amount);
      const sign = e.entryType === "SALE" || e.entryType === "PAYMENT_SENT" ? 1 : -1;
      const signed = sign * amt;

      const key = e.counterpartyUserId ? `U:${e.counterpartyUserId}` : `N:${e.counterpartyName}`;
      let p = partyMap.get(key);
      if (!p) {
        p = { name: e.counterpartyName, type: e.counterpartyType, userId: e.counterpartyUserId, balance: 0, count: 0 };
        partyMap.set(key, p);
      }
      p.balance += signed;
      p.count += 1;
    }

    const parties = Array.from(partyMap.values());
    for (const p of parties) {
      if (p.balance > 0) totalReceivable += p.balance;
      else totalPayable += -p.balance;
    }
    parties.sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance));

    return NextResponse.json({
      success: true,
      totalReceivable: Math.round(totalReceivable * 100) / 100,
      totalPayable: Math.round(totalPayable * 100) / 100,
      netBalance: Math.round((totalReceivable - totalPayable) * 100) / 100,
      entriesCount: entries.length,
      parties: parties.slice(0, 50).map((p) => ({ ...p, balance: Math.round(p.balance * 100) / 100 })),
    });
  } catch (error) {
    console.error("Ledger overview error:", error);
    return NextResponse.json({ success: false, message: "حدث خطأ" }, { status: 500 });
  }
}