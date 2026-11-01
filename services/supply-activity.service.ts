import { prisma } from "@/lib/prisma";
import { slugifySupplyActivity, ensureUniqueSupplyActivitySlug } from "@/lib/supply-activity-slug";
import { WholesaleNotifications } from "@/lib/wholesale-notifications";

type CreateInput = {
  type: "FACTORY" | "COMPANY" | "SUPPLIER" | "IMPORTER";
  name: string;
  legalName?: string | null;
  description?: string | null;
  commercialRegister?: string | null;
  taxId?: string | null;
  city: string;
  address?: string | null;
};

export const SupplyActivityService = {
  async listForBusiness(businessId: number) {
    return prisma.supplyActivity.findMany({
      where: { businessId, deletedAt: null },
      orderBy: [{ createdAt: "asc" }],
    });
  },

  async getOne(businessId: number, saId: number) {
    return prisma.supplyActivity.findFirst({
      where: { id: saId, businessId, deletedAt: null },
    });
  },

  async createForTrader(businessId: number, userId: number, data: CreateInput) {
    const biz = await prisma.business.findUnique({
      where: { id: businessId },
      select: { id: true, type: true, status: true, ownerUserId: true, deletedAt: true },
    });
    if (!biz || biz.deletedAt) throw new Error("النشاط غير موجود");
    if (biz.ownerUserId !== userId) throw new Error("فقط مالك النشاط يمكنه إضافة هويات");
    if (biz.type !== "WHOLESALE_TRADER") {
      throw new Error("إضافة هويات إضافية متاحة لتجار الجملة فقط");
    }
    if (biz.status !== "VERIFIED") {
      throw new Error("يجب توثيق النشاط التجاري أولاً");
    }
    if (data.type === "TRADER" as any) {
      throw new Error("لا يمكن إضافة هوية TRADER — موجودة مسبقًا");
    }

    const base = slugifySupplyActivity(data.name);
    const slug = await ensureUniqueSupplyActivitySlug(base);

    return prisma.supplyActivity.create({
      data: {
        businessId,
        type: data.type,
        status: "PENDING",
        name: data.name,
        slug,
        legalName: data.legalName ?? null,
        description: data.description ?? null,
        commercialRegister: data.commercialRegister ?? null,
        taxId: data.taxId ?? null,
        city: data.city,
        address: data.address ?? null,
      },
    });
  },

  async updateForTrader(businessId: number, userId: number, saId: number, data: Partial<CreateInput>) {
    const biz = await prisma.business.findUnique({
      where: { id: businessId },
      select: { ownerUserId: true, deletedAt: true },
    });
    if (!biz || biz.deletedAt) throw new Error("النشاط غير موجود");
    if (biz.ownerUserId !== userId) throw new Error("فقط المالك يمكنه التعديل");

    const sa = await prisma.supplyActivity.findFirst({
      where: { id: saId, businessId, deletedAt: null },
      select: { id: true, type: true },
    });
    if (!sa) throw new Error("الهوية غير موجودة");
    if (sa.type === "TRADER") throw new Error("لا يمكن تعديل هوية TRADER");

    const updateData: any = {};
    const allowed = ["name", "legalName", "description", "commercialRegister", "taxId", "city", "address"];
    for (const k of allowed) {
      if ((data as any)[k] !== undefined) updateData[k] = (data as any)[k];
    }
    if (Object.keys(updateData).length === 0) throw new Error("لا يوجد تغيير");

    return prisma.supplyActivity.update({ where: { id: saId }, data: updateData });
  },

  async adminListPending(page: number = 1, pageSize: number = 30) {
    const size = Math.min(Math.max(1, pageSize), 100);
    const where = { status: "PENDING" as const, deletedAt: null };
    const [total, items] = await Promise.all([
      prisma.supplyActivity.count({ where }),
      prisma.supplyActivity.findMany({
        where,
        orderBy: { createdAt: "asc" },
        skip: (Math.max(1, page) - 1) * size,
        take: size,
        include: {
          business: { select: { id: true, name: true, type: true, status: true, city: true } },
        },
      }),
    ]);
    return { items, total, page, pageSize: size, totalPages: Math.ceil(total / size) };
  },

  async adminVerify(saId: number, adminUserId: number, approve: boolean, reason?: string | null) {
    const sa = await prisma.supplyActivity.findUnique({
      where: { id: saId },
      select: { id: true, status: true, type: true, businessId: true, name: true },
    });
    if (!sa) throw new Error("الهوية غير موجودة");
    if (sa.type === "TRADER") throw new Error("هويات TRADER تلقائية ولا تحتاج توثيق");
    if (sa.status === "VERIFIED" && approve) throw new Error("موثقة مسبقًا");

    if (approve) {
      const updated = await prisma.supplyActivity.update({
        where: { id: saId },
        data: {
          status: "VERIFIED",
          verifiedAt: new Date(),
          verifiedById: adminUserId,
          rejectionReason: null,
        },
        select: { id: true, name: true, type: true, status: true, verifiedAt: true },
      });
      const owner = await prisma.business.findUnique({ where: { id: sa.businessId }, select: { ownerUserId: true } });
      if (owner) {
        WholesaleNotifications.supplyActivityVerified(owner.ownerUserId, {
          businessId: sa.businessId, saName: updated.name,
        }).catch((e) => console.error("notify SA:", e));
      }
      return updated;
    } else {
      const updated = await prisma.supplyActivity.update({
        where: { id: saId },
        data: {
          status: "REJECTED",
          verifiedAt: null,
          verifiedById: adminUserId,
          rejectionReason: reason ?? "لم يتم تقديم سبب",
        },
        select: { id: true, name: true, type: true, status: true, rejectionReason: true },
      });
      const owner = await prisma.business.findUnique({ where: { id: sa.businessId }, select: { ownerUserId: true } });
      if (owner) {
        WholesaleNotifications.supplyActivityRejected(owner.ownerUserId, {
          businessId: sa.businessId, saName: updated.name, reason,
        }).catch((e) => console.error("notify SA reject:", e));
      }
      return updated;
    }
  },
};