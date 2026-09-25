import { z } from "zod";
import { createApi, ApiError } from "./api";
import { secureStorage } from "./secure-storage";
import { nativeMessages, t } from "./i18n";
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));
const schema = z.object({ ok: z.boolean() });
const response = (status: number, value: unknown) =>
  ({
    status,
    ok: status === 200,
    headers: { get: () => "request-1" },
    json: async () => value,
  }) as Response;
test("API verifies response and retries an expired token once with the same command", async () => {
  const auth = {
    getSession: async () => ({ data: { session: { access_token: "old" } } }),
    refreshSession: jest.fn(async () => ({
      data: { session: { access_token: "new" } },
      error: null,
    })),
  };
  const fetcher = jest
    .fn()
    .mockResolvedValueOnce(response(401, {}))
    .mockResolvedValueOnce(response(200, { ok: true }));
  const api = createApi("https://example.test", auth, fetcher);
  await expect(
    api("/api/learning", schema, { activityId: "same", action: "answer" }),
  ).resolves.toEqual({ ok: true });
  expect(fetcher.mock.calls[0][1].headers.Authorization).toBe("Bearer old");
  expect(fetcher.mock.calls[1][1].headers.Authorization).toBe("Bearer new");
  expect(fetcher.mock.calls[1][1].body).toBe(fetcher.mock.calls[0][1].body);
  expect(auth.refreshSession).toHaveBeenCalledTimes(1);
});
test("uncertain network POST is not automatically repeated", async () => {
  const fetcher = jest.fn().mockRejectedValue(new Error("offline"));
  const auth = {
    getSession: async () => ({ data: { session: { access_token: "test" } } }),
    refreshSession: jest.fn(),
  };
  await expect(
    createApi("", auth, fetcher)("/api/learning", schema, { action: "answer" }),
  ).rejects.toMatchObject({ code: "network" });
  expect(fetcher).toHaveBeenCalledTimes(1);
});
test("invalid JSON contract and incompatible API fail safely", async () => {
  const auth = {
    getSession: async () => ({ data: { session: { access_token: "test" } } }),
    refreshSession: jest.fn(),
  };
  await expect(
    createApi(
      "",
      auth,
      jest.fn().mockResolvedValue(response(200, { wrong: true })),
    )("/", schema),
  ).rejects.toBeInstanceOf(ApiError);
  await expect(
    createApi(
      "",
      auth,
      jest.fn().mockResolvedValue(response(426, {})),
    )("/", schema),
  ).rejects.toMatchObject({ code: "update" });
});
test("encrypted chunks retain the previous session if a replacement fails", async () => {
  const values = new Map<string, string>();
  let fail = false;
  const store = {
    getItemAsync: async (k: string) => values.get(k) ?? null,
    setItemAsync: async (k: string, v: string) => {
      if (fail && k.endsWith(".1")) throw new Error("full");
      values.set(k, v);
    },
    deleteItemAsync: async (k: string) => {
      values.delete(k);
    },
  };
  const s = secureStorage(store);
  await s.setItem("auth", "old-session");
  fail = true;
  await expect(s.setItem("auth", "x".repeat(1500))).rejects.toThrow("full");
  expect(await s.getItem("auth")).toBe("old-session");
  fail = false;
  await s.setItem("auth", "中".repeat(3000));
  expect(await s.getItem("auth")).toHaveLength(3000);
  expect([...values.values()].every((v) => v.length <= 500)).toBe(true);
  await s.removeItem("auth");
  expect(values.size).toBe(0);
});
test("every mobile-specific string has English, Chinese and Spanish", () => {
  for (const [key, strings] of Object.entries(nativeMessages))
    for (const language of ["en", "zh", "es"] as const) {
      expect(strings[language].length).toBeGreaterThan(0);
      expect(t(language, key)).toBe(strings[language]);
    }
});
