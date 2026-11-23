import { describe, it, expect } from "vitest";
import { movementTypeLabel, referenceLabel, MOVEMENT_TYPE_LABELS, REFERENCE_LABELS, STOCK_SOURCE_LABELS } from "./stock-labels";

describe("stock labels", () => {
  it("labels every movement type that the system writes", () => {
    for (const t of ["STOCK_IN", "SALE", "RETURN", "ADJUSTMENT", "OPENING", "TRANSFER_IN"]) {
      expect(MOVEMENT_TYPE_LABELS[t]).toBeTruthy();
    }
  });
  it("labels every reference type", () => {
    for (const t of ["ORDER", "MANUAL", "SYSTEM", "RETURN", "STORE_SALE", "STORE_SALE_RETURN", "STOCK_RECEIPT", "TRANSFER"]) {
      expect(REFERENCE_LABELS[t]).toBeTruthy();
    }
  });
  it("labels every stock source", () => {
    for (const t of ["SUPPLIER", "FACTORY", "OTHER_STORE", "WHOLESALE_MARKET", "BRANCH_TRANSFER", "PLATFORM_TRANSFER", "OTHER"]) {
      expect(STOCK_SOURCE_LABELS[t]).toBeTruthy();
    }
  });
  it("falls back to the raw value for unknown codes", () => {
    expect(movementTypeLabel("NEW_TYPE")).toBe("NEW_TYPE");
    expect(referenceLabel(null)).toBe("");
    expect(referenceLabel("X")).toBe("X");
  });
});