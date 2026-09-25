export function getPublicSupabaseEnv() {
  // Keep these as direct NEXT_PUBLIC_* references. Next.js only guarantees
  // client-side replacement for statically referenced public environment vars.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url) throw new Error("Missing required environment variable: NEXT_PUBLIC_SUPABASE_URL");
  if (!publishableKey) {
    throw new Error("Missing required environment variable: NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  }

  if ((process.env.NETLIFY === "true" || process.env.VERCEL) && (new URL(url).protocol !== "https:" || !new URL(url).hostname.endsWith(".supabase.co"))) throw new Error("Hosted Supabase configuration required");
  return { url, publishableKey };
}
