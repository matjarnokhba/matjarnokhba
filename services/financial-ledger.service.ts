import { prisma } from "@/lib/prisma";
import {
  ConflictError,
  NotFoundError,
  UnbalancedLedgerError,
  ValidationError,
} from "@/lib/wholesale/errors";
import { logWholesaleAction } from "@/lib/wholesale/audit";

// ═══ Types ═══
type LedgerAccountType = "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE";
type LedgerAccountSubtype =
  | "CASH"
  | "BANK"
  | "INVENTORY"
  | "AR"
  | "AP"
  | "COMMISSION"
  | "TAX"
  | "SALES"
  | "PURCHASES"
  | "COGS"
  | "OTHER";

type LineInput = {
  accountId: number;
  debit?: number;
  credit?: number;
};

type PostEntryInput = {
  bookId: number;
  referenceType: string;
  referenceId: number;
  description: string;
  lines: LineInput[];
  userId?: number;
};

// ═══ Default Chart of Accounts ═══
const DEFAULT_ACCOUNTS: Array<{
  code: string;
  name: string;
  type: LedgerAccountType;
  subtype: LedgerAccountSubtype;
}> = [
  { code: "1000", name: "الصندوق النقدي", type: "ASSET", subtype: "CASH" },
  { code: "1010", name: "الحساب البنكي", type: "ASSET", subtype: "BANK" },
  { code: "1100", name: "المخزون", type: "ASSET", subtype: "INVENTORY" },
  { code: "1200", name: "الذمم المدينة (لنا)", type: "ASSET", subtype: "AR" },
  { code: "2000", name: "الذمم الدائنة (علينا)", type: "LIABILITY", subtype: "AP" },
  { code: "2100", name: "ضريبة مستحقة", type: "LIABILITY", subtype: "TAX" },
  { code: "4000", name: "المبيعات", type: "REVENUE", subtype: "SALES" },
  { code: "5000", name: "المشتريات", type: "EXPENSE", subtype: "PURCHASES" },
  { code: "5100", name: "تكلفة البضاعة المباعة", type: "EXPENSE", subtype: "COGS" },
  { code: "5200", name: "عمولة المنصة", type: "EXPENSE", subtype: "COMMISSION" },
];

// ═══ Helpers ═══

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

async function getBookOrThrow(bookId: number) {
  const book = await prisma.ledgerBook.findUnique({
    where: { id: bookId },
    include: { businessUnit: { select: { id: true, name: true, status: true } } },
  });
  if (!book) throw new NotFoundError("LedgerBook", bookId);
  return book;
}

async function getAccountOrThrow(accountId: number) {
  const a = await prisma.ledgerAccount.findUnique({
    where: { id: accountId },
    select: { id: true, code: true, name: true, bookId: true, type: true },
  });
  if (!a) throw new NotFoundError("LedgerAccount", accountId);
  return a;
}

async function lockBalanceByAccount(
  tx: any,
  accountId: number,
  currency: string
): Promise<{ id: number; debitTotal: number; creditTotal: number; balance: number } | null> {
  const rows: any[] = await tx.$queryRaw`
    SELECT id, "debitTotal", "creditTotal", balance
    FROM "AccountBalance"
    WHERE "accountId" = ${accountId} AND currency = ${currency}
    FOR UPDATE
  `;
  if (!rows[0]) return null;
  return {
    id: rows[0].id,
    debitTotal: Number(rows[0].debitTotal),
    creditTotal: Number(rows[0].creditTotal),
    balance: Number(rows[0].balance),
  };
}

// ═══ Service ═══
export const FinancialLedgerService = {
  /**
   * Ensure a LedgerBook exists for a business unit (creates + seeds accounts if needed).
   */
  async ensureBook(businessUnitId: number, userId?: number): Promise<number> {
    const existing = await prisma.ledgerBook.findFirst({
      where: { businessUnitId, isPrimary: true, isActive: true },
      select: { id: true },
    });
    if (existing) return existing.id;

    const created = await prisma.$transaction(async (tx) => {
      const book = await tx.ledgerBook.create({
        data: {
          businessUnitId,
          name: "الدفتر الرئيسي",
          currency: "MAD",
          isPrimary: true,
          isActive: true,
        },
      });

      for (const acc of DEFAULT_ACCOUNTS) {
        const exists = await tx.ledgerAccount.findUnique({
          where: { bookId_code: { bookId: book.id, code: acc.code } },
          select: { id: true },
        });
        if (!exists) {
          await tx.ledgerAccount.create({
            data: {
              bookId: book.id,
              code: acc.code,
              name: acc.name,
              type: acc.type as any,
              subtype: acc.subtype as any,
              isActive: true,
            },
          });
        }
      }

      await logWholesaleAction(tx, {
        userId: userId ?? null,
        businessUnitId,
        action: "ledger_book.created",
        entityType: "LedgerBook",
        entityId: book.id,
      });

      return book;
    });

    return created.id;
  },

  /**
   * Get a specific account by code within a book.
   */
  async getAccountByCode(bookId: number, code: string) {
    const a = await prisma.ledgerAccount.findUnique({
      where: { bookId_code: { bookId, code } },
      select: {
        id: true,
        code: true,
        name: true,
        type: true,
        subtype: true,
        isActive: true,
      },
    });
    if (!a) throw new NotFoundError("LedgerAccount", `${bookId}/${code}`);
    return a;
  },

  /**
   * List all accounts for a book.
   */
  async listAccounts(bookId: number) {
    await getBookOrThrow(bookId);
    return prisma.ledgerAccount.findMany({
      where: { bookId, isActive: true },
      orderBy: { code: "asc" },
      select: {
        id: true,
        code: true,
        name: true,
        type: true,
        subtype: true,
      },
    });
  },

  /**
   * Post a balanced journal entry (double-entry).
   * Validates: sum(debits) = sum(credits), each line has exactly one side.
   * Updates AccountBalance for each affected account.
   */
  async postEntry(input: PostEntryInput): Promise<number> {
    if (!input.lines || input.lines.length === 0) {
      throw new ValidationError("القيد يجب أن يحتوي على سطر واحد على الأقل");
    }
    if (input.lines.length < 2) {
      throw new ValidationError("القيد المزدوج يتطلب سطرين على الأقل");
    }

    // Validate lines
    const normalized: Array<{ accountId: number; debit: number; credit: number }> = [];
    let totalDebit = 0;
    let totalCredit = 0;
    for (const line of input.lines) {
      const debit = round2(Number(line.debit ?? 0));
      const credit = round2(Number(line.credit ?? 0));
      if (debit < 0 || credit < 0) {
        throw new ValidationError("القيم لا يمكن أن تكون سالبة");
      }
      if (debit > 0 && credit > 0) {
        throw new ValidationError("السطر لا يمكن أن يكون مدينًا ودائنًا في نفس الوقت");
      }
      if (debit === 0 && credit === 0) {
        throw new ValidationError("السطر يجب أن يحتوي على قيمة موجبة");
      }
      normalized.push({ accountId: line.accountId, debit, credit });
      totalDebit += debit;
      totalCredit += credit;
    }

    totalDebit = round2(totalDebit);
    totalCredit = round2(totalCredit);

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      throw new UnbalancedLedgerError(totalDebit, totalCredit);
    }

    const book = await getBookOrThrow(input.bookId);

    return prisma.$transaction(async (tx) => {
      // Verify all accounts belong to book
      const accountIds = [...new Set(normalized.map((l) => l.accountId))];
      const accounts = await tx.ledgerAccount.findMany({
        where: { id: { in: accountIds }, bookId: input.bookId, isActive: true },
        select: { id: true },
      });
      if (accounts.length !== accountIds.length) {
        throw new ValidationError(
          "بعض الحسابات لا تنتمي لهذا الدفتر أو غير نشطة"
        );
      }

      // Create entry
      const entry = await tx.ledgerEntry.create({
        data: {
          bookId: input.bookId,
          referenceType: input.referenceType,
          referenceId: input.referenceId,
          description: input.description,
          createdByUserId: input.userId ?? null,
        },
      });

      // Create lines
      for (const line of normalized) {
        await tx.ledgerLine.create({
          data: {
            entryId: entry.id,
            accountId: line.accountId,
            debit: line.debit,
            credit: line.credit,
          },
        });
      }

      // Update balances
      for (const line of normalized) {
        // Upsert balance row
        await tx.accountBalance.upsert({
          where: {
            accountId_currency: {
              accountId: line.accountId,
              currency: book.currency,
            },
          },
          create: {
            accountId: line.accountId,
            currency: book.currency,
            debitTotal: 0,
            creditTotal: 0,
            balance: 0,
          },
          update: {},
        });

        // Lock
        const locked = await lockBalanceByAccount(
          tx,
          line.accountId,
          book.currency
        );
        if (!locked) {
          throw new NotFoundError(
            "AccountBalance",
            `${line.accountId}/${book.currency}`
          );
        }

        // Compute new balance based on account type
        const account = await tx.ledgerAccount.findUnique({
          where: { id: line.accountId },
          select: { type: true },
        });
        const isDebitNormal =
          account!.type === "ASSET" || account!.type === "EXPENSE";
        const delta = isDebitNormal
          ? line.debit - line.credit
          : line.credit - line.debit;

        await tx.accountBalance.update({
          where: { id: locked.id },
          data: {
            debitTotal: { increment: line.debit },
            creditTotal: { increment: line.credit },
            balance: { increment: delta },
            lastLineId: entry.id,
          },
        });
      }

      await logWholesaleAction(tx, {
        userId: input.userId ?? null,
        businessUnitId: book.businessUnitId,
        action: "ledger_entry.posted",
        entityType: "LedgerEntry",
        entityId: entry.id,
        metadata: {
          referenceType: input.referenceType,
          referenceId: input.referenceId,
          totalDebit,
          totalCredit,
          linesCount: normalized.length,
        },
      });

      return entry.id;
    });
  },

  /**
   * Reverse a specific entry (creates a compensating entry).
   */
  async reverseEntry(
    entryId: number,
    reason: string,
    userId?: number
  ): Promise<number> {
    if (!reason || reason.trim().length < 3) {
      throw new ValidationError("سبب الإلغاء مطلوب");
    }

    const original = await prisma.ledgerEntry.findUnique({
      where: { id: entryId },
      include: {
        lines: true,
        book: { select: { id: true, businessUnitId: true, currency: true } },
      },
    });
    if (!original) throw new NotFoundError("LedgerEntry", entryId);

    // Check if already reversed (idempotency: look for entry with same ref)
    const alreadyReversed = await prisma.ledgerEntry.findFirst({
      where: {
        bookId: original.bookId,
        referenceType: "REVERSAL",
        referenceId: entryId,
      },
      select: { id: true },
    });
    if (alreadyReversed) {
      throw new ConflictError("هذا القيد تم عكسه مسبقًا");
    }

    // Create reversing entry
    const reversing = await prisma.$transaction(async (tx) => {
      const newEntry = await tx.ledgerEntry.create({
        data: {
          bookId: original.bookId,
          referenceType: "REVERSAL",
          referenceId: entryId,
          description: `عكس القيد #${entryId}: ${reason.trim()}`,
          createdByUserId: userId ?? null,
        },
      });

      for (const line of original.lines) {
        await tx.ledgerLine.create({
          data: {
            entryId: newEntry.id,
            accountId: line.accountId,
            debit: Number(line.credit),
            credit: Number(line.debit),
          },
        });
      }

      // Update balances (swap debit/credit)
      for (const line of original.lines) {
        await tx.accountBalance.upsert({
          where: {
            accountId_currency: {
              accountId: line.accountId,
              currency: original.book.currency,
            },
          },
          create: {
            accountId: line.accountId,
            currency: original.book.currency,
            debitTotal: 0,
            creditTotal: 0,
            balance: 0,
          },
          update: {},
        });

        const locked = await lockBalanceByAccount(
          tx,
          line.accountId,
          original.book.currency
        );
        if (!locked) continue;

        const account = await tx.ledgerAccount.findUnique({
          where: { id: line.accountId },
          select: { type: true },
        });
        const isDebitNormal =
          account!.type === "ASSET" || account!.type === "EXPENSE";
        const originalDebit = Number(line.debit);
        const originalCredit = Number(line.credit);
        const delta = isDebitNormal
          ? originalCredit - originalDebit
          : originalDebit - originalCredit;

        await tx.accountBalance.update({
          where: { id: locked.id },
          data: {
            debitTotal: { increment: originalCredit },
            creditTotal: { increment: originalDebit },
            balance: { increment: delta },
            lastLineId: newEntry.id,
          },
        });
      }

      await logWholesaleAction(tx, {
        userId: userId ?? null,
        businessUnitId: original.book.businessUnitId,
        action: "ledger_entry.reversed",
        entityType: "LedgerEntry",
        entityId: newEntry.id,
        metadata: { reversedEntryId: entryId, reason: reason.trim() },
      });

      return newEntry;
    });

    return reversing.id;
  },

  /**
   * Get balance for a specific account.
   */
  async getAccountBalance(accountId: number, currency = "MAD") {
    const account = await getAccountOrThrow(accountId);
    const bal = await prisma.accountBalance.findUnique({
      where: {
        accountId_currency: { accountId, currency },
      },
      select: {
        debitTotal: true,
        creditTotal: true,
        balance: true,
        lastLineId: true,
        updatedAt: true,
      },
    });
    return {
      accountId,
      accountCode: account.code,
      accountName: account.name,
      accountType: account.type,
      currency,
      debitTotal: Number(bal?.debitTotal ?? 0),
      creditTotal: Number(bal?.creditTotal ?? 0),
      balance: Number(bal?.balance ?? 0),
      lastLineId: bal?.lastLineId ?? null,
      updatedAt: bal?.updatedAt ?? null,
    };
  },

  /**
   * Get statement for an account (entries within date range).
   */
  async getAccountStatement(
    accountId: number,
    from: Date,
    to: Date
  ) {
    const account = await getAccountOrThrow(accountId);
    const lines = await prisma.ledgerLine.findMany({
      where: {
        accountId,
        entry: {
          createdAt: { gte: from, lte: to },
        },
      },
      include: {
        entry: {
          select: {
            id: true,
            referenceType: true,
            referenceId: true,
            description: true,
            createdAt: true,
          },
        },
      },
      orderBy: { entry: { createdAt: "asc" } },
    });

    let runningBalance = 0;
    const isDebitNormal =
      account.type === "ASSET" || account.type === "EXPENSE";

    const rows = lines.map((l) => {
      const debit = Number(l.debit);
      const credit = Number(l.credit);
      const delta = isDebitNormal ? debit - credit : credit - debit;
      runningBalance = round2(runningBalance + delta);
      return {
        lineId: l.id,
        entryId: l.entry.id,
        date: l.entry.createdAt,
        referenceType: l.entry.referenceType,
        referenceId: l.entry.referenceId,
        description: l.entry.description,
        debit,
        credit,
        runningBalance,
      };
    });

    return {
      account: { id: account.id, code: account.code, name: account.name },
      from,
      to,
      openingBalance: 0,
      closingBalance: runningBalance,
      rows,
    };
  },

  /**
   * Get trial balance for a book (all accounts at a moment).
   */
  async getTrialBalance(bookId: number) {
    await getBookOrThrow(bookId);
    const accounts = await prisma.ledgerAccount.findMany({
      where: { bookId, isActive: true },
      orderBy: { code: "asc" },
      include: {
        balances: {
          select: { currency: true, debitTotal: true, creditTotal: true, balance: true },
        },
      },
    });

    let totalDebit = 0;
    let totalCredit = 0;
    const rows = accounts.map((a) => {
      const b = a.balances[0];
      const debit = Number(b?.debitTotal ?? 0);
      const credit = Number(b?.creditTotal ?? 0);
      totalDebit += debit;
      totalCredit += credit;
      return {
        accountId: a.id,
        code: a.code,
        name: a.name,
        type: a.type,
        debitTotal: debit,
        creditTotal: credit,
        balance: Number(b?.balance ?? 0),
      };
    });

    return {
      bookId,
      totalDebit: round2(totalDebit),
      totalCredit: round2(totalCredit),
      isBalanced: Math.abs(totalDebit - totalCredit) < 0.01,
      rows,
    };
  },

  /**
   * Convenience: get account ID by code (throws if not found).
   */
  async accountIdByCode(bookId: number, code: string): Promise<number> {
    const a = await this.getAccountByCode(bookId, code);
    return a.id;
  },
};