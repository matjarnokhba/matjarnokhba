import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/services/session.service", () => ({
  SessionService: { getCurrent: vi.fn() },
}));

import { SessionService } from "@/services/session.service";
import { requireSeller, requireSellerOwner, requireStaffPermission, isSellerDisabled } from "./seller-guards";

function sess(status: string, owner = true, perms: string[] = []) {
  return { user: { id: 1, seller: { id: 5, status }, isSellerOwner: owner, staffPermissions: perms } } as any;
}
const getCurrent = SessionService.getCurrent as unknown as ReturnType<typeof vi.fn>;

describe("seller guards: suspended / closed sellers", () => {
  beforeEach(() => getCurrent.mockReset());

  it("isSellerDisabled", () => {
    expect(isSellerDisabled("SUSPENDED")).toBe(true);
    expect(isSellerDisabled("CLOSED")).toBe(true);
    expect(isSellerDisabled("ACTIVE")).toBe(false);
    expect(isSellerDisabled("PENDING")).toBe(false);
  });
  it("requireSellerOwner: الموقوف مرفوض 403", async () => {
    getCurrent.mockResolvedValue(sess("SUSPENDED"));
    const r: any = await requireSellerOwner();
    expect(r.ok).toBe(false);
    expect(r.response.status).toBe(403);
  });
  it("requireSellerOwner: النشط مقبول", async () => {
    getCurrent.mockResolvedValue(sess("ACTIVE"));
    expect(((await requireSellerOwner()) as any).ok).toBe(true);
  });
  it("requireSellerOwner: PENDING مقبول (مرحلة التسجيل)", async () => {
    getCurrent.mockResolvedValue(sess("PENDING"));
    expect(((await requireSellerOwner()) as any).ok).toBe(true);
  });
  it("requireStaffPermission: المغلق مرفوض حتى للمالك", async () => {
    getCurrent.mockResolvedValue(sess("CLOSED"));
    const r: any = await requireStaffPermission("X");
    expect(r.ok).toBe(false);
    expect(r.response.status).toBe(403);
  });
  it("requireSeller (للقراءة): الموقوف ما زال مسموحاً", async () => {
    getCurrent.mockResolvedValue(sess("SUSPENDED"));
    expect(((await requireSeller()) as any).ok).toBe(true);
  });
});