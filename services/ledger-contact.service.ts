import { prisma } from "@/lib/prisma";
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from "@/lib/wholesale/errors";
import { getBusinessUnitContext } from "@/lib/wholesale/context";
import { logWholesaleAction } from "@/lib/wholesale/audit";

export type LedgerEntryType = "GAVE" | "TOOK" | "SETTLEMENT";

const VALID_CONTACT_TYPES = [
  "PLATFORM_TRADER",
  "EXTERNAL",
  "EMPLOYEE",
  "SUPPLIER",
] as const;

type ContactType = (typeof VALID_CONTACT_TYPES)[number];

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

type CreateContactInput = {
  name: string;
  contactType?: ContactType;
  linkedUserId?: number | null;
  linkedBUId?: number | null;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
  openingBalance?: number;
};

type UpdateContactInput = {
  name?: string;
  contactType?: ContactType;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
  isActive?: boolean;
};

type AddEntryInput = {
  type: LedgerEntryType;
  amount: number;
  description: string;
  entryDate?: Date;
  referenceType?: string | null;
  referenceId?: number | null;
  attachmentUrl?: string | null;
};

async function getContactOrThrow(
  userId: number,
  businessUnitId: number,
  contactId: number
) {
  await getBusinessUnitContext(userId, businessUnitId);
  const contact = await prisma.ledgerContact.findFirst({
    where: {
      id: contactId,
      businessUnitId,
      deletedAt: null,
    },
  });
  if (!contact) throw new NotFoundError("LedgerContact", contactId);
  return contact;
}

export const LedgerContactService = {
  // ═══ List contacts (paginated) ═══
  async list(
    userId: number,
    businessUnitId: number,
    filters: {
      search?: string;
      contactType?: string;
      hasBalance?: "positive" | "negative" | "zero";
      page?: number;
      pageSize?: number;
    } = {}
  ) {
    await getBusinessUnitContext(userId, businessUnitId);

    const page = Math.max(1, filters.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 30));

    const where: any = {
      businessUnitId,
      deletedAt: null,
      isActive: true,
    };

    if (filters.contactType) {
      where.contactType = filters.contactType;
    }

    if (filters.hasBalance === "positive") {
      where.currentBalance = { gt: 0 };
    } else if (filters.hasBalance === "negative") {
      where.currentBalance = { lt: 0 };
    } else if (filters.hasBalance === "zero") {
      where.currentBalance = 0;
    }

    if (filters.search && filters.search.trim().length >= 2) {
      const q = filters.search.trim();
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { phone: { contains: q } },
        { email: { contains: q, mode: "insensitive" } },
      ];
    }

    const [total, items, totals] = await Promise.all([
      prisma.ledgerContact.count({ where }),
      prisma.ledgerContact.findMany({
        where,
        orderBy: [{ currentBalance: "desc" }, { name: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          name: true,
          contactType: true,
          phone: true,
          email: true,
          currentBalance: true,
          openingBalance: true,
          isActive: true,
          createdAt: true,
        },
      }),
      prisma.ledgerContact.aggregate({
        where: { businessUnitId, deletedAt: null, isActive: true },
        _sum: { currentBalance: true },
        _count: { _all: true },
      }),
    ]);

    return {
      items: items.map((i) => ({
        ...i,
        currentBalance: Number(i.currentBalance),
        openingBalance: Number(i.openingBalance),
        createdAt: i.createdAt.toISOString(),
      })),
      summary: {
        totalContacts: totals._count._all,
        netBalance: Number(totals._sum.currentBalance ?? 0),
      },
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    };
  },

  // ═══ Get contact + entries (with running balance already stored) ═══
  async get(
    userId: number,
    businessUnitId: number,
    contactId: number,
    entryLimit = 100
  ) {
    const contact = await getContactOrThrow(userId, businessUnitId, contactId);

    const entries = await prisma.ledgerContactEntry.findMany({
      where: { contactId },
      orderBy: [{ entryDate: "desc" }, { id: "desc" }],
      take: Math.min(entryLimit, 200),
    });

    return {
      contact: {
        id: contact.id,
        name: contact.name,
        contactType: contact.contactType,
        phone: contact.phone,
        email: contact.email,
        notes: contact.notes,
        linkedUserId: contact.linkedUserId,
        linkedBUId: contact.linkedBUId,
        openingBalance: Number(contact.openingBalance),
        currentBalance: Number(contact.currentBalance),
        isActive: contact.isActive,
        createdAt: contact.createdAt.toISOString(),
        updatedAt: contact.updatedAt.toISOString(),
      },
      entries: entries.map((e) => ({
        id: e.id,
        type: e.type,
        amount: Number(e.amount),
        balanceBefore: Number(e.balanceBefore),
        balanceAfter: Number(e.balanceAfter),
        description: e.description,
        entryDate: e.entryDate.toISOString(),
        referenceType: e.referenceType,
        referenceId: e.referenceId,
        attachmentUrl: e.attachmentUrl,
        createdAt: e.createdAt.toISOString(),
      })),
    };
  },

  // ═══ Create contact ═══
  async create(
    userId: number,
    businessUnitId: number,
    input: CreateContactInput
  ): Promise<number> {
    await getBusinessUnitContext(userId, businessUnitId);

    if (!input.name || input.name.trim().length < 2) {
      throw new ValidationError("اسم الطرف مطلوب (حرفان على الأقل)");
    }

    const contactType = input.contactType ?? "EXTERNAL";
    if (!VALID_CONTACT_TYPES.includes(contactType)) {
      throw new ValidationError(`نوع الطرف غير صالح: ${contactType}`);
    }

    const openingBalance = round2(input.openingBalance ?? 0);

    if (input.linkedUserId && input.linkedBUId) {
      throw new ValidationError(
        "لا يمكن تحديد مستخدم ونشاط معًا — اختر واحدًا فقط"
      );
    }

    const contact = await prisma.ledgerContact.create({
      data: {
        businessUnitId,
        name: input.name.trim(),
        contactType,
        linkedUserId: input.linkedUserId ?? null,
        linkedBUId: input.linkedBUId ?? null,
        phone: input.phone?.trim() ?? null,
        email: input.email?.trim() ?? null,
        notes: input.notes?.trim() ?? null,
        openingBalance,
        currentBalance: openingBalance,
      },
    });

    await logWholesaleAction(null, {
      userId,
      businessUnitId,
      action: "ledger_contact.created",
      entityType: "LedgerContact",
      entityId: contact.id,
      after: {
        name: contact.name,
        contactType: contact.contactType,
        openingBalance,
      },
    });

    return contact.id;
  },

  // ═══ Update contact (does NOT touch balance) ═══
  async update(
    userId: number,
    businessUnitId: number,
    contactId: number,
    input: UpdateContactInput
  ): Promise<void> {
    await getContactOrThrow(userId, businessUnitId, contactId);

    const data: any = {};

    if (input.name !== undefined) {
      if (input.name.trim().length < 2) {
        throw new ValidationError("اسم الطرف مطلوب (حرفان على الأقل)");
      }
      data.name = input.name.trim();
    }

    if (input.contactType !== undefined) {
      if (!VALID_CONTACT_TYPES.includes(input.contactType)) {
        throw new ValidationError(`نوع الطرف غير صالح: ${input.contactType}`);
      }
      data.contactType = input.contactType;
    }

    if (input.phone !== undefined) data.phone = input.phone?.trim() ?? null;
    if (input.email !== undefined) data.email = input.email?.trim() ?? null;
    if (input.notes !== undefined) data.notes = input.notes?.trim() ?? null;
    if (input.isActive !== undefined) data.isActive = input.isActive;

    if (Object.keys(data).length === 0) {
      throw new ValidationError("لا يوجد تغيير");
    }

    await prisma.ledgerContact.update({
      where: { id: contactId },
      data,
    });

    await logWholesaleAction(null, {
      userId,
      businessUnitId,
      action: "ledger_contact.updated",
      entityType: "LedgerContact",
      entityId: contactId,
      after: data,
    });
  },

  // ═══ Soft delete contact (only if balance = 0) ═══
  async softDelete(
    userId: number,
    businessUnitId: number,
    contactId: number
  ): Promise<void> {
    const contact = await getContactOrThrow(
      userId,
      businessUnitId,
      contactId
    );

    if (Number(contact.currentBalance) !== 0) {
      throw new ConflictError(
        `لا يمكن حذف طرف له رصيد غير مسدّد (${Number(
          contact.currentBalance
        ).toFixed(2)} د.م). سوِّ الرصيد أولًا.`
      );
    }

    await prisma.ledgerContact.update({
      where: { id: contactId },
      data: { deletedAt: new Date(), isActive: false },
    });

    await logWholesaleAction(null, {
      userId,
      businessUnitId,
      action: "ledger_contact.deleted",
      entityType: "LedgerContact",
      entityId: contactId,
    });
  },

  // ═══ Add entry (ATOMIC — locks contact row) ═══
  async addEntry(
    userId: number,
    businessUnitId: number,
    contactId: number,
    input: AddEntryInput
  ): Promise<{ entryId: number; newBalance: number }> {
    await getBusinessUnitContext(userId, businessUnitId);

    if (!input.description || input.description.trim().length < 3) {
      throw new ValidationError("وصف العملية مطلوب (3 أحرف على الأقل)");
    }

    if (typeof input.amount !== "number" || input.amount === 0) {
      throw new ValidationError("المبلغ لا يمكن أن يكون صفرًا");
    }

    if (!["GAVE", "TOOK", "SETTLEMENT"].includes(input.type)) {
      throw new ValidationError(`نوع القيد غير صالح: ${input.type}`);
    }

    // For GAVE/TOOK: amount must be positive
    if (input.type !== "SETTLEMENT" && input.amount <= 0) {
      throw new ValidationError(
        "المبلغ يجب أن يكون موجبًا لهذا النوع من القيود"
      );
    }

    const amount = round2(input.amount);
    const entryDate = input.entryDate ?? new Date();

    return prisma.$transaction(async (tx) => {
      // Lock the contact row
      const rows: any[] = await tx.$queryRaw`
        SELECT id, "currentBalance", "businessUnitId", "deletedAt"
        FROM "LedgerContact"
        WHERE id = ${contactId}
        FOR UPDATE
      `;
      const locked = rows[0];
      if (!locked || locked.deletedAt) {
        throw new NotFoundError("LedgerContact", contactId);
      }
      if (Number(locked.businessUnitId) !== businessUnitId) {
        throw new NotFoundError("LedgerContact", contactId);
      }

      const balanceBefore = round2(Number(locked.currentBalance));

      let balanceAfter: number;
      if (input.type === "GAVE") {
        balanceAfter = round2(balanceBefore + amount);
      } else if (input.type === "TOOK") {
        balanceAfter = round2(balanceBefore - amount);
      } else {
        // SETTLEMENT: amount is signed
        balanceAfter = round2(balanceBefore + amount);
      }

      const entry = await tx.ledgerContactEntry.create({
        data: {
          contactId,
          type: input.type as any,
          amount: Math.abs(amount) === amount ? amount : amount, // keep signed for SETTLEMENT
          balanceBefore,
          balanceAfter,
          description: input.description.trim(),
          entryDate,
          referenceType: input.referenceType ?? "MANUAL",
          referenceId: input.referenceId ?? null,
          attachmentUrl: input.attachmentUrl?.trim() ?? null,
          createdByUserId: userId,
        },
      });

      await tx.ledgerContact.update({
        where: { id: contactId },
        data: { currentBalance: balanceAfter },
      });

      await logWholesaleAction(tx, {
        userId,
        businessUnitId,
        action: "ledger_entry.created",
        entityType: "LedgerContactEntry",
        entityId: entry.id,
        after: {
          contactId,
          type: input.type,
          amount,
          balanceBefore,
          balanceAfter,
        },
      });

      return { entryId: entry.id, newBalance: balanceAfter };
    });
  },
};