import { describe, it, expect } from "vitest";
import { isUploadThingUrl } from "./upload-url";

describe("isUploadThingUrl", () => {
  it("accepts UploadThing file urls", () => {
    expect(isUploadThingUrl("https://utfs.io/f/abc123")).toBe(true);
    expect(isUploadThingUrl("https://myapp.ufs.sh/f/abc123")).toBe(true);
  });
  it("rejects other hosts, look-alikes, http and garbage", () => {
    expect(isUploadThingUrl("https://evil.com/f/abc")).toBe(false);
    expect(isUploadThingUrl("https://utfs.io.evil.com/f/abc")).toBe(false);
    expect(isUploadThingUrl("https://notufs.sh/f/abc")).toBe(false);
    expect(isUploadThingUrl("http://utfs.io/f/abc")).toBe(false);
    expect(isUploadThingUrl("javascript:alert(1)")).toBe(false);
    expect(isUploadThingUrl("not a url")).toBe(false);
  });
});
