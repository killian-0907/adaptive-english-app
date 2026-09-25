export const MOBILE_API_VERSION = "1";
export function bearerToken(value: string | null) {
  if (!value || value.length > 16384) return null;
  const match = /^Bearer ([A-Za-z0-9._~-]+)$/i.exec(value);
  return match?.[1] ?? null;
}
export function mutationOriginAllowed(headers: Headers) {
  const origin = headers.get("origin");
  // Header syntax is only a CSRF distinction, never authentication. getUser verifies it next.
  if (!origin && bearerToken(headers.get("authorization"))) return true;
  return (
    !!origin &&
    URL.canParse(origin) &&
    new URL(origin).host === headers.get("host")
  );
}

export function mobileContext(headers: Headers) {
  const platform = headers.get("x-adaptive-platform"),
    version = headers.get("x-adaptive-app-version");
  if (
    !platform ||
    !["android", "ios"].includes(platform) ||
    !version ||
    !/^\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(version)
  )
    return {};
  return { platform, appVersion: version };
}
