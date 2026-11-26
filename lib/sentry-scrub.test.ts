import { describe, it, expect } from "vitest";
import { scrubEvent, isNoise } from "./sentry-scrub";

describe("scrubEvent", () => {
  it("removes cookies, body and sensitive headers", () => {
    const e = scrubEvent({
      request: {
        cookies: { session: "abc" },
        data: { phone: "0612345678" },
        headers: { Cookie: "s=1", Authorization: "Bearer x", "user-agent": "UA", "X-Real-IP": "1.2.3.4" },
      },
    });
    expect(e.request?.cookies).toBeUndefined();
    expect(e.request?.data).toBeUndefined();
    expect(e.request?.headers).toEqual({ "user-agent": "UA" });
  });

  it("removes personal user fields but keeps the id", () => {
    const e = scrubEvent({ user: { id: "7", email: "a@b.c", ip_address: "1.1.1.1", username: "x" } });
    expect(e.user).toEqual({ id: "7" });
  });

  it("is safe on empty events", () => {
    expect(scrubEvent({})).toEqual({});
  });
});

describe("isNoise", () => {
  it("flags node experimental and deprecation warnings", () => {
    expect(isNoise({ message: "(node:8) ExperimentalWarning: vm.USE_MAIN_CONTEXT_DEFAULT_LOADER is an experimental feature" })).toBe(true);
    expect(isNoise({ logentry: { message: "(node:4) DeprecationWarning: something" } })).toBe(true);
    expect(isNoise({ exception: { values: [{ value: "ExperimentalWarning: x" }] } })).toBe(true);
  });
  it("keeps real errors", () => {
    expect(isNoise({ message: "Store sale return error: boom" })).toBe(false);
    expect(isNoise({ exception: { values: [{ value: "TypeError: x is undefined" }] } })).toBe(false);
    expect(isNoise({})).toBe(false);
  });
});