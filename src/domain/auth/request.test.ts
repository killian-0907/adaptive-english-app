import { describe, expect, it } from "vitest";
import { bearerToken, mutationOriginAllowed } from "./request";
import { apiGuard } from "../../server/api-guard";
describe("mobile bearer boundary", () => {
  it("rejects malformed authorization rather than interpreting it as cookie auth", () => {
    for (const value of [
      null,
      "",
      "Basic token",
      "Bearer a b",
      "Bearer",
      "Bearer a\nb",
      "Bearer " + "x".repeat(17000),
    ])
      expect(bearerToken(value)).toBeNull();
    expect(bearerToken("Bearer signed.token.value")).toBe("signed.token.value");
  });
  it("retains same-origin web CSRF and allows originless native requests only for subsequent token verification", () => {
    expect(
      mutationOriginAllowed(
        new Headers({ host: "app.test", origin: "https://app.test" }),
      ),
    ).toBe(true);
    expect(mutationOriginAllowed(new Headers({ host: "app.test" }))).toBe(
      false,
    );
    expect(
      mutationOriginAllowed(
        new Headers({ host: "app.test", authorization: "Bearer test" }),
      ),
    ).toBe(true);
    expect(
      mutationOriginAllowed(
        new Headers({
          host: "app.test",
          origin: "https://evil.test",
          authorization: "Bearer test",
        }),
      ),
    ).toBe(false);
  });
  it("rejects incompatible versions without breaking unversioned web clients", () => {
    expect(
      apiGuard(
        new Request("https://app.test/api/mobile", {
          headers: { "x-adaptive-api-version": "2" },
        }),
      )?.status,
    ).toBe(426);
    expect(apiGuard(new Request("https://app.test/api/mobile"))).toBeNull();
  });
});
