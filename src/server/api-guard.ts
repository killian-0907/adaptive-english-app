import { NextResponse } from "next/server";
import {
  MOBILE_API_VERSION,
  mutationOriginAllowed,
} from "@/domain/auth/request";
export function apiGuard(request: Request) {
  const version = request.headers.get("x-adaptive-api-version");
  if (version && version !== MOBILE_API_VERSION)
    return NextResponse.json(
      { error: "Please update the app.", code: "UPDATE_REQUIRED" },
      { status: 426 },
    );
  if (
    !["GET", "HEAD"].includes(request.method) &&
    !mutationOriginAllowed(request.headers)
  )
    return NextResponse.json(
      { error: "Invalid request origin." },
      { status: 403 },
    );
  return null;
}
