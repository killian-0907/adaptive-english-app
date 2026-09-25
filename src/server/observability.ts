import "server-only";
export function operationLog(category: "billing" | "webhook" | "entitlement" | "cleanup" | "provider", status: "ok" | "failed", requestId = crypto.randomUUID()) {
  // Deliberately accepts no arbitrary payload, exception, user ID or provider response.
  console[status === "failed" ? "error" : "info"](JSON.stringify({ category, status, requestId }));
  return requestId;
}
