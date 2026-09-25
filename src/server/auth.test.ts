import { beforeEach, expect, test, vi } from "vitest";
const mock = vi.hoisted(() => ({
  authorization: null as string | null,
  getUser: vi.fn(),
  job: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("react", () => ({ cache: (fn: unknown) => fn }));
vi.mock("next/headers", () => ({
  headers: async () =>
    new Headers(
      mock.authorization ? { authorization: mock.authorization } : {},
    ),
}));
vi.mock("@/lib/supabase/server", () => ({
  createServerUserSupabaseClient: async () => ({
    auth: { getUser: mock.getUser },
  }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminSupabaseClient: () => ({
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: mock.job }) }) }),
  }),
}));
import { getAuthenticatedUser } from "./auth";
beforeEach(() => {
  vi.clearAllMocks();
  mock.authorization = null;
  mock.job.mockResolvedValue({ data: null, error: null });
});
test("verified bearer identity is used rather than decoded client identity", async () => {
  mock.authorization = "Bearer signed.token";
  mock.getUser.mockResolvedValue({
    data: { user: { id: "verified-user" } },
    error: null,
  });
  expect(await getAuthenticatedUser()).toEqual({ id: "verified-user" });
  expect(mock.getUser).toHaveBeenCalledWith("signed.token");
});
test("invalid and expired tokens fail closed", async () => {
  mock.authorization = "Bearer expired.token";
  mock.getUser.mockResolvedValue({
    data: { user: null },
    error: { code: "bad_jwt" },
  });
  expect(await getAuthenticatedUser()).toBeNull();
});
test("malformed explicit bearer cannot fall back to cookies", async () => {
  mock.authorization = "Basic invalid";
  expect(await getAuthenticatedUser()).toBeNull();
  expect(mock.getUser).not.toHaveBeenCalled();
});
test("existing cookie auth uses trusted getUser without an injected token", async () => {
  mock.getUser.mockResolvedValue({
    data: { user: { id: "cookie-user" } },
    error: null,
  });
  expect(await getAuthenticatedUser()).toEqual({ id: "cookie-user" });
  expect(mock.getUser).toHaveBeenCalledWith(undefined);
});
test("queued account deletion blocks both authentication methods", async () => {
  mock.getUser.mockResolvedValue({
    data: { user: { id: "deleted-user" } },
    error: null,
  });
  mock.job.mockResolvedValue({
    data: { user_id: "deleted-user" },
    error: null,
  });
  expect(await getAuthenticatedUser()).toBeNull();
});
