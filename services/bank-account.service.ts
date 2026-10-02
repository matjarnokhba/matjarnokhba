import { prisma } from "@/lib/prisma";
import {
  encrypt,
  hashForLookup,
  maskIBAN,
  maskName,
  maskRIB,
} from "@/lib/encryption";

type CreateBankAccountInput = {
  bankName: string;
  accountHolder: string;
  iban: string;
  rib?: string;
  businessName?: string;
  accountType?: "PERSONAL" | "BUSINESS";
  currency?: string;
};

export const BankAccountService = {
  // ═══ قائمة الحسابات ═══
  async list(sellerId: number) {
    const accounts = await prisma.sellerBankAccount.findMany({
      where: { sellerId, deletedAt: null },
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    });

    return accounts.map((a) => ({
      id: a.id,
      bankName: a.bankName,
      accountHolderMasked: a.accountHolderMasked,
      ibanMasked: a.ibanMasked,
      ibanLast4: a.ibanLast4,
      ribMasked: a.ribMasked,
      businessName: a.businessName,
      accountType: a.accountType,
      currency: a.currency,
      verificationStatus: a.verificationStatus,
      verifiedAt: a.verifiedAt,
      rejectionReason: a.rejectionReason,
      isDefault: a.isDefault,
      isActive: a.isActive,
      createdAt: a.createdAt,
    }));
  },

  // ═══ إضافة حساب ═══
  async create(sellerId: number, data: CreateBankAccountInput) {
    const bankName = data.bankName?.trim();
    const accountHolder = data.accountHolder?.trim();
    const cleanIban = data.iban?.trim().replace(/\s/g, "").toUpperCase();
    const cleanRib = data.rib?.trim().replace(/\s/g, "").toUpperCase() || null;
    const businessName = data.businessName?.trim() || null;
    const accountType = data.accountType || "PERSONAL";
    const currency = (data.currency || "MAD").toUpperCase();

    // ═══ التحقق ═══
    if (!bankName || bankName.length < 2) throw new Error("اسم البنك مطلوب");
    if (!accountHolder || accountHolder.length < 3) {
      throw new Error("اسم صاحب الحساب مطلوب");
    }
    if (!cleanIban || cleanIban.length < 15 || cleanIban.length > 34) {
      throw new Error("IBAN غير صحيح (15-34 حرف)");
    }
    if (!/^[A-Z0-9]+$/.test(cleanIban)) {
      throw new Error("IBAN يجب أن يحتوي حروفاً إنجليزية وأرقاماً فقط");
    }
    if (cleanRib && !/^[0-9]{20,24}$/.test(cleanRib)) {
      throw new Error("RIB يجب أن يكون 20-24 رقماً");
    }

    const ibanHash = hashForLookup(cleanIban);

    // ═══ تحقق من التكرار ═══
    const existing = await prisma.sellerBankAccount.findFirst({
      where: { sellerId, ibanHash, deletedAt: null },
    });
    if (existing) throw new Error("هذا الحساب البنكي مضاف مسبقاً");

    // ═══ هل هذا أول حساب؟ ═══
    const count = await prisma.sellerBankAccount.count({
      where: { sellerId, deletedAt: null, isActive: true },
    });
    const isDefault = count === 0;

    // ═══ الإنشاء ═══
    const account = await prisma.sellerBankAccount.create({
      data: {
        sellerId,
        bankName,
        accountHolderMasked: maskName(accountHolder),
        ibanMasked: maskIBAN(cleanIban),
        ibanLast4: cleanIban.slice(-4),
        ribMasked: cleanRib ? maskRIB(cleanRib) : null,
        accountHolderEnc: encrypt(accountHolder),
        ibanEnc: encrypt(cleanIban),
        ribEnc: cleanRib ? encrypt(cleanRib) : null,
        ibanHash,
        ribHash: cleanRib ? hashForLookup(cleanRib) : null,
        businessName,
        accountType,
        currency,
        isDefault,
        isActive: true,
      },
    });

    return {
      id: account.id,
      bankName: account.bankName,
      accountHolderMasked: account.accountHolderMasked,
      ibanMasked: account.ibanMasked,
      ribMasked: account.ribMasked,
      businessName: account.businessName,
      accountType: account.accountType,
      currency: account.currency,
      verificationStatus: account.verificationStatus,
      isDefault: account.isDefault,
      isActive: account.isActive,
      createdAt: account.createdAt,
    };
  },

  // ═══ تعيين كافتراضي ═══
  async setDefault(sellerId: number, accountId: number) {
    const account = await prisma.sellerBankAccount.findFirst({
      where: { id: accountId, sellerId, deletedAt: null, isActive: true },
    });
    if (!account) throw new Error("الحساب غير موجود أو غير مفعّل");

    await prisma.$transaction(async (tx) => {
      await tx.sellerBankAccount.updateMany({
        where: { sellerId, deletedAt: null },
        data: { isDefault: false },
      });
      await tx.sellerBankAccount.update({
        where: { id: accountId },
        data: { isDefault: true },
      });
    });
  },

  // ═══ تعطيل ═══
  async deactivate(sellerId: number, accountId: number) {
    const account = await prisma.sellerBankAccount.findFirst({
      where: { id: accountId, sellerId, deletedAt: null },
    });
    if (!account) throw new Error("الحساب غير موجود");

    if (account.isDefault) {
      const alternative = await prisma.sellerBankAccount.findFirst({
        where: {
          sellerId,
          deletedAt: null,
          isActive: true,
          id: { not: accountId },
        },
        orderBy: { createdAt: "desc" },
      });

      await prisma.$transaction(async (tx) => {
        await tx.sellerBankAccount.update({
          where: { id: accountId },
          data: { isActive: false, isDefault: false },
        });
        if (alternative) {
          await tx.sellerBankAccount.update({
            where: { id: alternative.id },
            data: { isDefault: true },
          });
        }
      });
    } else {
      await prisma.sellerBankAccount.update({
        where: { id: accountId },
        data: { isActive: false },
      });
    }
  },

  // ═══ حذف ═══
  async remove(sellerId: number, accountId: number) {
    const account = await prisma.sellerBankAccount.findFirst({
      where: { id: accountId, sellerId, deletedAt: null },
    });
    if (!account) throw new Error("الحساب غير موجود");
    if (account.isDefault) {
      throw new Error("لا يمكن حذف الحساب الافتراضي — عيّن بديلاً أولاً");
    }

    await prisma.sellerBankAccount.update({
      where: { id: accountId },
      data: { deletedAt: new Date(), isActive: false },
    });
  },
};