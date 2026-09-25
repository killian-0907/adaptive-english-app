import { storage } from "./secure-storage";
let queue = Promise.resolve();
function serial<T>(job: () => Promise<T>) {
  const work = queue.then(job);
  queue = work.then(
    () => {},
    () => {},
  );
  return work;
}
const indexKey = (user: string) => `draft-index.${user}`;
async function index(user: string) {
  try {
    const list = JSON.parse((await storage.getItem(indexKey(user))) ?? "[]");
    return Array.isArray(list)
      ? list
          .filter(
            (k): k is string =>
              typeof k === "string" && k.startsWith(`draft.${user}.`),
          )
          .slice(-10)
      : [];
  } catch {
    return [];
  }
}
export function readDraft(user: string, activity: string) {
  return serial(async () => {
    const key = `draft.${user}.${activity}`,
      raw = await storage.getItem(key);
    if (!raw) return "";
    try {
      const d = JSON.parse(raw);
      if (
        typeof d.text === "string" &&
        d.text.length <= 3000 &&
        Number.isFinite(d.at) &&
        Date.now() - d.at >= 0 &&
        Date.now() - d.at < 86400000
      )
        return d.text;
    } catch {}
    await storage.removeItem(key);
    return "";
  });
}
export function writeDraft(user: string, activity: string, text: string) {
  return serial(async () => {
    const key = `draft.${user}.${activity}`,
      previous = await index(user);
    const next = previous.filter((k) => k !== key);
    if (text) {
      next.push(key);
      while (next.length > 10) await storage.removeItem(next.shift()!);
      await storage.setItem(
        key,
        JSON.stringify({ text: text.slice(0, 3000), at: Date.now() }),
      );
    } else await storage.removeItem(key);
    await storage.setItem(indexKey(user), JSON.stringify(next));
  });
}
export function clearDrafts(user: string) {
  return serial(async () => {
    for (const key of await index(user)) await storage.removeItem(key);
    await storage.removeItem(indexKey(user));
  });
}
