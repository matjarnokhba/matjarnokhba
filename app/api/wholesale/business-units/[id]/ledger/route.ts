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
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const businessUnitId = numericParam(id);
    if (!businessUnitId) return fail("معرف غير صحيح", 400);

    await getBusinessUnitContext(auth.current.user.id, businessUnitId);

    // Ensure book exists (creates + seeds if first access)
    const bookId = await FinancialLedgerService.ensureBook(
      businessUnitId,
      auth.current.user.id
    );

    const accounts = await FinancialLedgerService.listAccounts(bookId);
    const trial = await FinancialLedgerService.getTrialBalance(bookId);

    return ok({
      bookId,
      accounts,
      trialBalance: {
        totalDebit: trial.totalDebit,
        totalCredit: trial.totalCredit,
        isBalanced: trial.isBalanced,
        rows: trial.rows,
      },
    });
  } catch (err) {
    return handleError(err, "GET /wholesale/business-units/[id]/ledger");
  }
}