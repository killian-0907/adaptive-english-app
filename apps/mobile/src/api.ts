import { Platform } from "react-native";
import * as Crypto from "expo-crypto";
import { z } from "zod";
import { MOBILE_API_VERSION } from "../../../packages/contracts/mobile";
export class ApiError extends Error {
  constructor(
    public code: "auth" | "network" | "update" | "server",
    public requestId?: string,
  ) {
    super(code);
  }
}
type Auth = {
  getSession: () => Promise<{
    data: { session: { access_token: string } | null };
  }>;
  refreshSession: () => Promise<{
    data: { session: { access_token: string } | null };
    error: unknown;
  }>;
};
export function createApi(
  base: string,
  auth: Auth,
  fetcher: typeof fetch = fetch,
) {
  return async function request<T>(
    path: string,
    schema: z.ZodType<T>,
    body?: unknown,
  ): Promise<T> {
    const requestId = Crypto.randomUUID();
    let session = (await auth.getSession()).data.session;
    if (!session) throw new ApiError("auth");
    for (let attempt = 0; attempt < 2; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 25000);
      let response: Response;
      try {
        response = await fetcher(base + path, {
          method: body === undefined ? "GET" : "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
            "X-Adaptive-API-Version": MOBILE_API_VERSION,
            "X-Adaptive-App-Version": "0.1.0",
            "X-Adaptive-Platform": Platform.OS,
            "X-Request-ID": requestId,
          },
          body: body === undefined ? undefined : JSON.stringify(body),
          signal: controller.signal,
        });
      } catch {
        throw new ApiError("network", requestId);
      } finally {
        clearTimeout(timer);
      }
      if (response.status === 401 && attempt === 0) {
        const refreshed = await auth.refreshSession();
        if (refreshed.error || !refreshed.data.session)
          throw new ApiError("auth");
        session = refreshed.data.session;
        continue;
      }
      if (!response.ok)
        throw new ApiError(
          response.status === 401
            ? "auth"
            : response.status === 426
              ? "update"
              : "server",
          response.headers.get("x-request-id") ?? undefined,
        );
      try {
        return schema.parse(await response.json());
      } catch {
        throw new ApiError("server");
      }
    }
    throw new ApiError("auth");
  };
}
