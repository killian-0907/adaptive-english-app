import { readDraft, writeDraft, clearDrafts } from "./drafts";
const mockValues = new Map<string, string>();
jest.mock("./secure-storage", () => ({
  storage: {
    getItem: async (k: string) => mockValues.get(k) ?? null,
    setItem: async (k: string, v: string) => {
      mockValues.set(k, v);
    },
    removeItem: async (k: string) => {
      mockValues.delete(k);
    },
  },
}));
beforeEach(() => mockValues.clear());
test("drafts survive navigation/network and remain isolated by user and activity", async () => {
  await Promise.all([
    writeDraft("a", "one", "first"),
    writeDraft("a", "two", "second"),
    writeDraft("b", "one", "private"),
  ]);
  expect(await readDraft("a", "one")).toBe("first");
  expect(await readDraft("b", "one")).toBe("private");
  await writeDraft("a", "one", "");
  expect(await readDraft("a", "one")).toBe("");
  expect(await readDraft("a", "two")).toBe("second");
  await clearDrafts("a");
  expect(await readDraft("a", "two")).toBe("");
  expect(await readDraft("b", "one")).toBe("private");
});
test("draft retention is bounded and expired text is removed", async () => {
  for (let i = 0; i < 12; i++) await writeDraft("a", String(i), "text");
  expect(await readDraft("a", "0")).toBe("");
  expect(await readDraft("a", "11")).toBe("text");
  mockValues.set(
    "draft.a.old",
    JSON.stringify({ text: "expired", at: Date.now() - 86400001 }),
  );
  expect(await readDraft("a", "old")).toBe("");
  expect(mockValues.has("draft.a.old")).toBe(false);
});
