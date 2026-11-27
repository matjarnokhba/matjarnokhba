import { describe, it, expect } from "vitest";
import { assignmentDeniedMessage } from "./shipment-assignment-messages";

describe("assignmentDeniedMessage", () => {
  it("maps every known reason to a distinct Arabic message", () => {
    const reasons = ["NOT_FOUND", "NO_LINK", "LINK_PAUSED", "LINK_REVOKED", "EXTERNAL_NOT_ALLOWED", "PLATFORM_SUSPENDED", "COMPANY_SUSPENDED"];
    const msgs = reasons.map(assignmentDeniedMessage);
    expect(new Set(msgs).size).toBe(reasons.length);
    for (const m of msgs) expect(m.length).toBeGreaterThan(5);
  });
  it("falls back for unknown or other link states", () => {
    expect(assignmentDeniedMessage("LINK_OTHER")).toContain("غير نشط");
    expect(assignmentDeniedMessage("???")).toContain("غير مسموح");
  });
});