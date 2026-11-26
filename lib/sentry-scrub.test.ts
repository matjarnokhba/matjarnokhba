import { describe, it, expect } from "vitest";
import { scrubEvent } from "./sentry-scrub";

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