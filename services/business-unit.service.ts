import { prisma } from "@/lib/prisma";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "@/lib/wholesale/errors";
import {
  generateUniqueBusinessUnitSlug,
} from "@/lib/wholesale/slug";
import { logWholesaleAction } from "@/lib/wholesale/audit";
import {
  getBusinessUnitContext,
  type BusinessUnitAccessContext,
} from "@/lib/wholesale/context";
import type { Capability } from "@/lib/wholesale/permissions";

type CreateInput = {
  name: string;
  type: "FACTORY" | "SHOP" | "BRANCH" | "IMPORTER" | "WHOLESALER" | "DISTRIBUTOR";
  activityType?: string;
  description?: string;
  logo?: string;
  capabilities: Capability[];
  legalEntity?: {
    name: string;
    registrationNumber?: string;
    taxId?: string;
    country?: string;
    address?: string;
  };
};

type UpdateInput = {
  name?: string;
  activityType?: string;
  description?: string;
  logo?: string;
  capabilities?: Capability[];
  status?: "ACTIVE" | "SUSPENDED" | "CLOSED";
};

type AddMemberInput = {
  userId: number;
  role: "MANAGER" | "STAFF";
  permissions: string[];
};

export const BusinessUnitService = {
  async create(userId: number, input: CreateInput): Promise<number> {
    if (!input.name || input.name.trim().length < 2) {
      throw new ValidationError("اسم النشاط مطلوب (حرفان على الأقل)");
    }
    if (!input.capabilities || input.capabilities.length === 0) {
      throw new ValidationError("يجب تحديد صلاحية واحدة على الأقل");
    }

    // 1. Find or create BusinessOwner
    let owner = await prisma.businessOwner.findUnique({
      where: { userId },
    });

    if (!owner) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { name: true },
      });
      if (!user) throw new NotFoundError("User", userId);

      owner = await prisma.businessOwner.create({
        data: {
          userId,
          type: "INDIVIDUAL",
          displayName: user.name,
          verificationStatus: "PENDING",
        },
      });
    }

    // 2. Find or create primary AccountingGroup
    let primaryGroup = await prisma.accountingGroup.findFirst({
      where: { ownerId: owner.id, isPrimary: true },
    });
    if (!primaryGroup) {
      primaryGroup = await prisma.accountingGroup.create({
        data: {
          ownerId: owner.id,
          name: "Default",
          isPrimary: true,
        },
      });
    }

    // 3. Create LegalEntity if provided
    let legalEntityId: number | null = null;
    if (input.legalEntity) {
      if (input.legalEntity.registrationNumber) {
        const dup = await prisma.legalEntity.findUnique({
          where: { registrationNumber: input.legalEntity.registrationNumber },
          select: { id: true },
        });
        if (dup) {
          throw new ConflictError("رقم التسجيل مستخدم مسبقًا");
        }
      }
      if (input.legalEntity.taxId) {
        const dup = await prisma.legalEntity.findUnique({
          where: { taxId: input.legalEntity.taxId },
          select: { id: true },
        });
        if (dup) {
          throw new ConflictError("الرقم الضريبي مستخدم مسبقًا");
        }
      }

      const le = await prisma.legalEntity.create({
        data: {
          ownerId: owner.id,
          name: input.legalEntity.name,
          registrationNumber: input.legalEntity.registrationNumber ?? null,
          taxId: input.legalEntity.taxId ?? null,
          status: input.legalEntity.registrationNumber ? "REGISTERED" : "UNREGISTERED",
          country: input.legalEntity.country ?? null,
          address: input.legalEntity.address ?? null,
        },
      });
      legalEntityId = le.id;
    }

    // 4. Create BusinessUnit
    const slug = await generateUniqueBusinessUnitSlug(prisma, input.name);

    const bu = await prisma.businessUnit.create({
      data: {
        ownerId: owner.id,
        legalEntityId,
        accountingGroupId: primaryGroup.id,
        name: input.name,
        slug,
        type: input.type,
        activityType: input.activityType ?? null,
        description: input.description ?? null,
        logo: input.logo ?? null,
        status: "ACTIVE",
        capabilities: input.capabilities as any,
        registrationStatus: legalEntityId ? "REGISTERED" : "UNREGISTERED",
        verificationStatus: "PENDING",
      },
    });

    await logWholesaleAction(null, {
      userId,
      businessUnitId: bu.id,
      action: "business_unit.created",
      entityType: "BusinessUnit",
      entityId: bu.id,
      after: { name: bu.name, type: bu.type, capabilities: input.capabilities },
    });

    return bu.id;
  },

  async list(userId: number) {
    const owner = await prisma.businessOwner.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!owner) return [];

    return prisma.businessUnit.findMany({
      where: {
        deletedAt: null,
        OR: [
          { ownerId: owner.id },
          { members: { some: { userId, isActive: true, deletedAt: null } } },
        ],
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        slug: true,
        type: true,
        status: true,
        capabilities: true,
        verificationStatus: true,
        createdAt: true,
      },
    });
  },

  async get(userId: number, businessUnitId: number): Promise<BusinessUnitAccessContext> {
    return getBusinessUnitContext(userId, businessUnitId);
  },

  async update(
    userId: number,
    businessUnitId: number,
    input: UpdateInput
  ): Promise<void> {
    const ctx = await getBusinessUnitContext(userId, businessUnitId);

    if (!ctx.isOwner) {
      throw new ForbiddenError("فقط مالك النشاط يمكنه تعديل بياناته");
    }

    const data: any = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.activityType !== undefined) data.activityType = input.activityType;
    if (input.description !== undefined) data.description = input.description;
    if (input.logo !== undefined) data.logo = input.logo;
    if (input.capabilities !== undefined) data.capabilities = input.capabilities;
    if (input.status !== undefined) data.status = input.status;

    if (Object.keys(data).length === 0) {
      throw new ValidationError("لا يوجد تغيير");
    }

    await prisma.businessUnit.update({
      where: { id: businessUnitId },
      data,
    });

    await logWholesaleAction(null, {
      userId,
      businessUnitId,
      action: "business_unit.updated",
      entityType: "BusinessUnit",
      entityId: businessUnitId,
      after: data,
    });
  },

  async addMember(
    userId: number,
    businessUnitId: number,
    input: AddMemberInput
  ): Promise<number> {
    const ctx = await getBusinessUnitContext(userId, businessUnitId);

    if (!ctx.isOwner) {
      const can = ctx.member.permissions.includes("members.write");
      if (!can) throw new ForbiddenError("لا تملك صلاحية إضافة أعضاء");
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: input.userId },
      select: { id: true, deletedAt: true },
    });
    if (!targetUser || targetUser.deletedAt) {
      throw new NotFoundError("User", input.userId);
    }

    const existing = await prisma.businessUnitMember.findUnique({
      where: {
        businessUnitId_userId: {
          businessUnitId,
          userId: input.userId,
        },
      },
    });
    if (existing && !existing.deletedAt) {
      throw new ConflictError("المستخدم عضو بالفعل في هذا النشاط");
    }

    const member = existing
      ? await prisma.businessUnitMember.update({
          where: { id: existing.id },
          data: {
            role: input.role,
            permissions: input.permissions as any,
            isActive: true,
            deletedAt: null,
            joinedAt: new Date(),
          },
        })
      : await prisma.businessUnitMember.create({
          data: {
            businessUnitId,
            userId: input.userId,
            role: input.role,
            permissions: input.permissions as any,
            isActive: true,
          },
        });

    await logWholesaleAction(null, {
      userId,
      businessUnitId,
      action: "member.added",
      entityType: "BusinessUnitMember",
      entityId: member.id,
      after: {
        userId: input.userId,
        role: input.role,
        permissions: input.permissions,
      },
    });

    return member.id;
  },

  async removeMember(
    userId: number,
    businessUnitId: number,
    memberId: number
  ): Promise<void> {
    const ctx = await getBusinessUnitContext(userId, businessUnitId);

    if (!ctx.isOwner) {
      const can = ctx.member.permissions.includes("members.write");
      if (!can) throw new ForbiddenError("لا تملك صلاحية إزالة الأعضاء");
    }

    const member = await prisma.businessUnitMember.findUnique({
      where: { id: memberId },
    });
    if (!member || member.businessUnitId !== businessUnitId) {
      throw new NotFoundError("BusinessUnitMember", memberId);
    }

    if (member.userId === userId) {
      throw new ForbiddenError("لا يمكنك إزالة نفسك");
    }

    await prisma.businessUnitMember.update({
      where: { id: memberId },
      data: { isActive: false, deletedAt: new Date() },
    });

    await logWholesaleAction(null, {
      userId,
      businessUnitId,
      action: "member.removed",
      entityType: "BusinessUnitMember",
      entityId: memberId,
    });
  },

  async updateMemberPermissions(
    userId: number,
    businessUnitId: number,
    memberId: number,
    permissions: string[]
  ): Promise<void> {
    const ctx = await getBusinessUnitContext(userId, businessUnitId);
    if (!ctx.isOwner) {
      throw new ForbiddenError(
        "فقط مالك النشاط يمكنه تعديل صلاحيات الأعضاء"
      );
    }

    const member = await prisma.businessUnitMember.findUnique({
      where: { id: memberId },
    });
    if (!member || member.businessUnitId !== businessUnitId) {
      throw new NotFoundError("BusinessUnitMember", memberId);
    }

    await prisma.businessUnitMember.update({
      where: { id: memberId },
      data: { permissions: permissions as any },
    });

    await logWholesaleAction(null, {
      userId,
      businessUnitId,
      action: "member.permissions_updated",
      entityType: "BusinessUnitMember",
      entityId: memberId,
      after: { permissions },
    });
  },

  async verify(
    adminUserId: number,
    businessUnitId: number,
    status: "VERIFIED" | "REJECTED"
  ): Promise<void> {
    const bu = await prisma.businessUnit.findUnique({
      where: { id: businessUnitId },
    });
    if (!bu) throw new NotFoundError("BusinessUnit", businessUnitId);

    await prisma.businessUnit.update({
      where: { id: businessUnitId },
      data: { verificationStatus: status },
    });

    await logWholesaleAction(null, {
      userId: adminUserId,
      businessUnitId,
      action: `business_unit.${status.toLowerCase()}`,
      entityType: "BusinessUnit",
      entityId: businessUnitId,
    });
  },
};