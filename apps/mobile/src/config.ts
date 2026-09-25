const api = process.env.EXPO_PUBLIC_API_BASE_URL ?? "";
const supabase = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
export const config = {
  api: api.replace(/\/$/, ""),
  supabase,
  key,
  callback: "adaptiveenglish://auth/callback",
  recovery: "adaptiveenglish://auth/recovery",
};
export const configured =
  [api, supabase].every((value) => {
    try {
      const u = new URL(value);
      return u.protocol === "https:" || (__DEV__ && u.protocol === "http:");
    } catch {
      return false;
    }
  }) &&
  !!key &&
  !/sb_secret_|service_role/.test(key);
