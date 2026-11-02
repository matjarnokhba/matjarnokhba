/**
 * Wholesale System - Permissions & Capabilities
 */

import { ForbiddenError } from "./errors";

export type Capability = "RETAIL" | "WHOLESALE_BUY" | "WHOLESALE_SELL";

export type MemberRole = "OWNER" | "MANAGER" | "STAFF";

export type Permission =
  | "products.read" | "products.write" | "products.delete"
  | "offers.read" | "offers.write" | "offers.delete"
  | "orders.read" | "orders.write" | "orders.cancel"
  | "inventory.read" | "inventory.adjust" | "inventory.transfer"
  | "payments.read" | "payments.write"
  | "returns.read" | "returns.write"
  | "ledger.read" | "ledger.write"
  | "members.read" | "members.write"
  | "settings.read" | "settings.write";

export const OWNER_PERMISSIONS: ReadonlySet<Permission> = new Set([
  "products.read", "products.write", "products.delete",
  "offers.read", "offers.write", "offers.delete",
  "orders.read", "orders.write", "orders.cancel",
  "inventory.read", "inventory.adjust", "inventory.transfer",
  "payments.read", "payments.write",
  "returns.read", "returns.write",
  "ledger.read", "ledger.write",
  "members.read", "members.write",
  "settings.read", "settings.write",
]);

export const MANAGER_PERMISSIONS: ReadonlySet<Permission> = new Set([
  "products.read", "products.write",
  "offers.read", "offers.write",
  "orders.read", "orders.write", "orders.cancel",
  "inventory.read", "inventory.adjust", "inventory.transfer",
  "payments.read",
  "returns.read", "returns.write",
  "ledger.read",
  "members.read",
  "settings.read",
]);

export const STAFF_PERMISSIONS: ReadonlySet<Permission> = new Set([
  "products.read",
  "offers.read",
  "orders.read",
  "inventory.read",
  "returns.read",
]);

export function getDefaultPermissions(role: MemberRole): ReadonlySet<Permission> {
  switch (role) {
    case "OWNER": return OWNER_PERMISSIONS;
    case "MANAGER": return MANAGER_PERMISSIONS;
    case "STAFF": return STAFF_PERMISSIONS;
  }
}

export interface BusinessUnitContext {
  id: number;
  capabilities: string[];
  status: string;
}

export interface MemberContext {
  role: MemberRole;
  permissions: string[];
  isActive: boolean;
}

export function hasPermission(
  member: MemberContext,
  permission: Permission,
  unit: BusinessUnitContext
): boolean {
  if (!member.isActive) return false;
  if (unit.status !== "ACTIVE") return false;
  if (member.role === "OWNER") return true;
  const defaults = getDefaultPermissions(member.role);
  if (!defaults.has(permission)) return false;
  return member.permissions.includes(permission);
}

export function hasCapability(unit: BusinessUnitContext, cap: Capability): boolean {
  if (unit.status !== "ACTIVE") return false;
  return unit.capabilities.includes(cap);
}

export function assertPermission(
  member: MemberContext,
  permission: Permission,
  unit: BusinessUnitContext
): void {
  if (!hasPermission(member, permission, unit)) {
    throw new ForbiddenError("لا تملك صلاحية: " + permission);
  }
}

export function assertCapability(unit: BusinessUnitContext, cap: Capability): void {
  if (!hasCapability(unit, cap)) {
    const label = cap === "RETAIL" ? "التجزئة"
      : cap === "WHOLESALE_BUY" ? "شراء الجملة"
      : "بيع الجملة";
    throw new ForbiddenError("النشاط غير مؤهل لـ" + label);
  }
}
