import * as SecureStore from "expo-secure-store";
type Store = {
  getItemAsync: (key: string) => Promise<string | null>;
  setItemAsync: (key: string, value: string) => Promise<void>;
  deleteItemAsync: (key: string) => Promise<void>;
};
type Manifest = { generation: string; count: number };
/** Commit the encrypted manifest last, retaining the old session on a failed write. */
export function secureStorage(store: Store) {
  let queue = Promise.resolve();
  let sequence = 0;
  const safe = (key: string) => key.replace(/[^a-zA-Z0-9._-]/g, "_");
  const manifest = async (key: string): Promise<Manifest | null> => {
    const raw = await store.getItemAsync(key);
    if (!raw) return null;
    try {
      const m = JSON.parse(raw);
      return typeof m.generation === "string" &&
        /^[a-z0-9-]+$/.test(m.generation) &&
        Number.isInteger(m.count) &&
        m.count > 0 &&
        m.count <= 100
        ? m
        : null;
    } catch {
      return null;
    }
  };
  const cleanup = async (key: string, m: Manifest | null) => {
    if (m)
      for (let i = 0; i < m.count; i++)
        await store.deleteItemAsync(`${key}.${m.generation}.${i}`);
  };
  const serial = <T>(fn: () => Promise<T>) => {
    const work = queue.then(fn);
    queue = work.then(
      () => {},
      () => {},
    );
    return work;
  };
  return {
    getItem(key: string) {
      return serial(async () => {
        key = safe(key);
        const m = await manifest(key);
        if (!m) return null;
        const chunks = await Promise.all(
          Array.from({ length: m.count }, (_, i) =>
            store.getItemAsync(`${key}.${m.generation}.${i}`),
          ),
        );
        return chunks.some((c) => c === null) ? null : chunks.join("");
      });
    },
    setItem(key: string, value: string) {
      return serial(async () => {
        key = safe(key);
        if (value.length > 50000) throw new Error("Storage limit");
        const old = await manifest(key);
        const chunks = value.match(/[\s\S]{1,500}/g) ?? [""];
        const next = {
          generation: `${Date.now().toString(36)}-${(++sequence).toString(36)}`,
          count: chunks.length,
        };
        try {
          for (let i = 0; i < chunks.length; i++)
            await store.setItemAsync(
              `${key}.${next.generation}.${i}`,
              chunks[i],
            );
          await store.setItemAsync(key, JSON.stringify(next));
        } catch (error) {
          await cleanup(key, next).catch(() => {});
          throw error;
        }
        await cleanup(key, old).catch(() => {});
      });
    },
    removeItem(key: string) {
      return serial(async () => {
        key = safe(key);
        const old = await manifest(key);
        await store.deleteItemAsync(key);
        await cleanup(key, old);
      });
    },
  };
}
export const storage = secureStorage(SecureStore);
