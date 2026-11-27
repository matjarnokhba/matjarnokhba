export type UserHit = { id: number; name: string | null; phone: string | null; role: string };

export type CompanyRow = {
  id: number;
  code: string;
  name: string;
  kind: string;
  status: string;
  headUserId: number | null;
  head: { id: number; name: string | null; phone: string | null } | null;
  _count: { warehouses: number };
};

export type WarehouseRow = {
  id: number;
  code: string;
  name: string;
  companyId: number;
  city: string;
  district: string | null;
  address: string | null;
  capacity: number | null;
  status: string;
  isDefault: boolean;
  company: { id: number; name: string; code: string; kind: string; status: string };
  manager: { id: number; name: string | null; phone: string | null } | null;
  _count: { memberships: number };
};

export type MembershipRow = {
  id: number;
  userId: number;
  scope: string;
  companyId: number | null;
  warehouseId: number | null;
  jobRoles: string[];
  status: string;
  notes: string | null;
  user: { id: number; name: string | null; phone: string | null; role: string };
  warehouse: { id: number; name: string; code: string } | null;
  company: { id: number; name: string; code: string } | null;
};

export type AuditRow = {
  id: number;
  action: string;
  entityType: string;
  entityId: number;
  before: unknown;
  after: unknown;
  createdAt: string;
  actorName: string | null;
  userId: number | null;
};