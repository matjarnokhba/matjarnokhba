import {
  requireAuth,
  handleError,
  ok,
  fail,
  numericParam,
} from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { getBusinessUnitContext } from "@/lib/wholesale/context";
import { FinancialLedgerService } from "@/services/financial-ledger.service";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; accountId: string }> }
) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;

    const { id, accountId } = await params;
    const businessUnitId = numericParam(id);
    const accId = numericParam(accountId);
    if (!businessUnitId || !accId) return fail("معرف غير صحيح", 400);

    await getBusinessUnitContext(auth.current.user.id, businessUnitId);

    // Verify account belongs to BU
    const acc = await prisma.ledgerAccount.findFirst({
      where: {
        id: accId,
        book: { businessUnitId, isActive: true },
      },
      select: { id: true, bookId: true },
    });
    if (!acc) return fail("الحساب غير موجود", 404);

    const balance = await FinancialLedgerService.getAccountBalance(accId);

    const url = new URL(request.url);
    const fromRaw = url.searchParams.get("from");
    const toRaw = url.searchParams.get("to");
    const from = fromRaw ? new Date(fromRaw) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const to = toRaw ? new Date(toRaw) : new Date();

    if (isNaN(from.getTime()) || isNaN(to.getTime())) {
      return fail("تواريخ غير صحيحة", 400);
    }
    if (from > to) return fail("تاريخ البداية بعد تاريخ النهاية", 400);

    const statement = await FinancialLedgerService.getAccountStatement(
      accId,
      from,
      to
    );

    return ok({ balance, statement });
  } catch (err) {
    return handleError(err, "GET /wholesale/business-units/[id]/ledger/[accountId]");
  }
}