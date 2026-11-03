import { prisma } from "@/lib/prisma";
import { ForbiddenError, NotFoundError } from "./errors";
import {
  hasPermission,
  hasCapability,
  type MemberContext,
  type BusinessUnitContext,
  type Permission,
  type Capability,
  type MemberRole,
} from "./permissions";

export interface BusinessUnitAccessContext {
  businessUnit: {
    id: number;
    ownerId: number;
    legalEntityId: number | null;
    accountingGroupId: number | null;
    name: string;
    slug: string;
    type: string;
    status: string;
    capabilities: string[];
    verificationStatus: string;
  };
  member: MemberContext;
  isOwner: boolean;
}

export async function getBusinessUnitContext(
  userId: number,
  businessUnitId: number
): Promise<BusinessUnitAccessContext> {
  const bu = await prisma.businessUnit.findUnique({
    where: { id: businessUnitId },
    include: {
      owner: { select: { userId: true } },
      members: {
        where: { userId, isActive: true, deletedAt: null },
        take: 1,
      },
    },
  });

  if (!bu) throw new NotFoundError("BusinessUnit", businessUnitId);

  const isOwner = bu.owner.userId === userId;
  const memberRow = bu.members[0] ?? null;

  if (!isOwner && !memberRow) {
    throw new ForbiddenError(
      "ليس لديك صلاحية الوصول إلى هذا النشاط التجاري"
    );
  }

  const member: MemberContext = isOwner
    ? { role: "OWNER", permissions: [], isActive: true }
    : {
        role: memberRow!.role as MemberRole,
        permissions: (memberRow!.permissions as string[]) ?? [],
        isActive: memberRow!.isActive,
      };

  return {
    businessUnit: {
      id: bu.id,
      ownerId: bu.ownerId,
      legalEntityId: bu.legalEntityId,
      accountingGroupId: bu.accountingGroupId,
      name: bu.name,
      slug: bu.slug,
      type: bu.type,
      status: bu.status,
      capabilities: (bu.capabilities as string[]) ?? [],
      verificationStatus: bu.verificationStatus,
    },
    member,
    isOwner,
  };
}

export function toUnitContext(
  ctx: BusinessUnitAccessContext
): BusinessUnitContext {
  return {
    id: ctx.businessUnit.id,
    capabilities: ctx.businessUnit.capabilities,
    status: ctx.businessUnit.status,
  };
}

export function assertBusinessUnitPermission(
  ctx: BusinessUnitAccessContext,
  permission: Permission
): void {
  const unit = toUnitContext(ctx);
  if (!hasPermission(ctx.member, permission, unit)) {
    throw new ForbiddenError(`لا تملك صلاحية: ${permission}`);
  }
}

export function assertBusinessUnitCapability(
  ctx: BusinessUnitAccessContext,
  cap: Capability
): void {
  const unit = toUnitContext(ctx);
  if (!hasCapability(unit, cap)) {
    const label =
      cap === "RETAIL"
        ? "التجزئة"
        : cap === "WHOLESALE_BUY"
        ? "شراء الجملة"
        : "بيع الجملة";
    throw new ForbiddenError(`النشاط غير مؤهل لـ${label}`);
  }
}