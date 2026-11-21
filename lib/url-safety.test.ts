import { describe, it, expect } from "vitest";
import { isSafeDocumentUrl, whyUnsafeDocumentUrl } from "./url-safety";

describe("isSafeDocumentUrl", () => {
  it("accepts utfs.io", () => expect(isSafeDocumentUrl("https://utfs.io/f/abc")).toBe(true));
  it("accepts ufs.sh", () => expect(isSafeDocumentUrl("https://abc.ufs.sh/f/x")).toBe(true));
  it("rejects AWS metadata", () => expect(isSafeDocumentUrl("http://169.254.169.254/")).toBe(false));
  it("rejects localhost", () => expect(isSafeDocumentUrl("http://localhost:3000/")).toBe(false));
  it("rejects 10.x", () => expect(isSafeDocumentUrl("http://10.0.0.1/")).toBe(false));
  it("rejects http", () => expect(isSafeDocumentUrl("http://utfs.io/f/abc")).toBe(false));
  it("rejects file", () => expect(isSafeDocumentUrl("file:///etc/passwd")).toBe(false));
  it("rejects evil.com", () => expect(isSafeDocumentUrl("https://evil.com/x")).toBe(false));
  it("rejects invalid", () => expect(isSafeDocumentUrl("not-a-url")).toBe(false));
  it("rejects empty", () => expect(isSafeDocumentUrl("")).toBe(false));
});

describe("whyUnsafeDocumentUrl", () => {
  it("null for safe", () => expect(whyUnsafeDocumentUrl("https://utfs.io/f/abc")).toBeNull());
  it("invalid_url for malformed", () => expect(whyUnsafeDocumentUrl("not-a-url")).toBe("invalid_url"));
  it("wrong_protocol for http", () => expect(whyUnsafeDocumentUrl("http://utfs.io/f/a")).toContain("wrong_protocol"));
  it("host_not_allowed for evil", () => expect(whyUnsafeDocumentUrl("https://evil.com/x")).toContain("host_not_allowed"));
});