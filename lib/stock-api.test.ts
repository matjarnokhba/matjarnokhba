import { describe, it, expect, vi } from "vitest";

vi.mock("@/services/pool.service", () => ({
  PoolService: { syncInventoryToPool: vi.fn() },
}));

import { mapServiceError, stockVisibility } from "./stock-api";
import { StockReceiptError } from "@/services/stock-receipt.service";
import { StoreSaleReturnError } from "@/services/store-sale-return.service";

describe("mapServiceError", () => {
  it("maps codes to HTTP statuses", async () => {
    expect(mapServiceError(new StockReceiptError("x", "VALIDATION"))!.status).toBe(400);
    expect(mapServiceError(new StockReceiptError("x", "NOT_FOUND"))!.status).toBe(404);
    expect(mapServiceError(new StockReceiptError("x", "CONFLICT"))!.status).toBe(409);
    expect(mapServiceError(new StoreSaleReturnError("x", "VALIDATION"))!.status).toBe(400);
    const body = await mapServiceError(new StockReceiptError("رسالة", "CONFLICT"))!.json();
    expect(body).toEqual({ success: false, message: "رسالة" });
  });

  it("ignores unknown errors", () => {
    expect(mapServiceError(new Error("boom"))).toBeNull();
    expect(mapServiceError("string")).toBeNull();
  });
});

describe("stockVisibility", () => {
  it("owner sees everything", () => {
    expect(stockVisibility({ user: { isSellerOwner: true, staffPermissions: [] } })).toEqual({ all: true, own: true });
  });
  it("staff with ADD_STOCK only sees own requests", () => {
    expect(stockVisibility({ user: { isSellerOwner: false, staffPermissions: ["ADD_STOCK"] } })).toEqual({ all: false, own: true });
  });
  it("approvers and history viewers see all", () => {
    expect(stockVisibility({ user: { isSellerOwner: false, staffPermissions: ["APPROVE_STOCK"] } }).all).toBe(true);
    expect(stockVisibility({ user: { isSellerOwner: false, staffPermissions: ["VIEW_STOCK_HISTORY"] } }).all).toBe(true);
  });
  it("others see nothing", () => {
    expect(stockVisibility({ user: { isSellerOwner: false, staffPermissions: ["SELL_ON_POS"] } })).toEqual({ all: false, own: false });
  });
});