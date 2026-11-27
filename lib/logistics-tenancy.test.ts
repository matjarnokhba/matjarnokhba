import { describe, it, expect } from "vitest";
import { generatePlatformKey, parsePlatformKey, hashPlatformKey, safeEqualHex } from "./logistics-platform-key";
import { canPlatformTransition, canLinkTransition } from "./logistics-tenancy-rules";
import { platformCreateSchema, platformActionSchema, linkActionSchema, brandSchema } from "./logistics-tenancy-validation";

describe("platform keys", () => {
  it("generates parseable, hashed, unique keys", () => {
    const a = generatePlatformKey();
    const b = generatePlatformKey();
    expect(a.raw).not.toBe(b.raw);
    expect(parsePlatformKey(a.raw)?.prefix).toBe(a.prefix);
    expect(a.hash).toBe(hashPlatformKey(a.raw));
    expect(a.hash).not.toContain(a.raw);
    expect(a.hash).toHaveLength(64);
  });
  it("rejects malformed keys and compares safely", () => {
    expect(parsePlatformKey("garbage")).toBeNull();
    expect(parsePlatformKey("nkp_zzzzzzzz_abc")).toBeNull();
    const a = generatePlatformKey();
    expect(safeEqualHex(a.hash, a.hash)).toBe(true);
    expect(safeEqualHex(a.hash, hashPlatformKey("x"))).toBe(false);
    expect(safeEqualHex("", "")).toBe(false);
  });
});

describe("tenancy transitions", () => {
  it("platform lifecycle", () => {
    expect(canPlatformTransition("ACTIVE", "SUSPENDED")).toBe(true);
    expect(canPlatformTransition("REVOKED", "ACTIVE")).toBe(true);
    expect(canPlatformTransition("REVOKED", "SUSPENDED")).toBe(false);
    expect(canPlatformTransition("ACTIVE", "ACTIVE")).toBe(false);
  });
  it("link lifecycle", () => {
    expect(canLinkTransition("ACTIVE", "PAUSED")).toBe(true);
    expect(canLinkTransition("PAUSED", "ACTIVE")).toBe(true);
    expect(canLinkTransition("REVOKED", "PAUSED")).toBe(false);
    expect(canLinkTransition("PAUSED", "PAUSED")).toBe(false);
  });
});

describe("tenancy validation", () => {
  it("platform create", () => {
    expect(platformCreateSchema.safeParse({ code: "SHOP-1", name: "متجر" }).success).toBe(true);
    expect(platformCreateSchema.safeParse({ code: "a b", name: "متجر" }).success).toBe(false);
    expect(platformCreateSchema.safeParse({ code: "SHOP-1", name: "متجر", webhookUrl: "http://x.com" }).success).toBe(false);
    expect(platformCreateSchema.safeParse({ code: "SHOP-1", name: "متجر", webhookUrl: "https://x.com/hook" }).success).toBe(true);
  });
  it("actions need reasons where destructive", () => {
    expect(platformActionSchema.safeParse({ action: "suspend" }).success).toBe(false);
    expect(platformActionSchema.safeParse({ action: "suspend", reason: "مخالفة" }).success).toBe(true);
    expect(platformActionSchema.safeParse({ action: "rotate_key" }).success).toBe(true);
    expect(linkActionSchema.safeParse({ action: "pause" }).success).toBe(false);
    expect(linkActionSchema.safeParse({ action: "resume" }).success).toBe(true);
  });
  it("brand validation", () => {
    expect(brandSchema.safeParse({ brandColor: "#ff5c00" }).success).toBe(true);
    expect(brandSchema.safeParse({ brandColor: "red" }).success).toBe(false);
    expect(brandSchema.safeParse({}).success).toBe(false);
    expect(brandSchema.safeParse({ logoUrl: "http://x.com/a.png" }).success).toBe(false);
  });
});