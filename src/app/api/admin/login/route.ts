import { NextResponse, type NextRequest } from "next/server";
import {
  ADMIN_COOKIE,
  adminConfigured,
  clearLoginFailures,
  createSessionToken,
  loginRateLimited,
  passwordMatches,
  recordLoginFailure,
  sessionCookieOptions,
} from "@/lib/auth";
import { publicUrl } from "@/lib/request-url";

export const runtime = "nodejs";

function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-real-ip") || "unknown";
}

export async function POST(request: NextRequest) {
  const ip = clientIp(request);
  const back = publicUrl(request, "/admin/login");
  if (!adminConfigured()) {
    back.searchParams.set("error", "setup");
    return NextResponse.redirect(back, 303);
  }
  if (loginRateLimited(ip)) {
    back.searchParams.set("error", "rate");
    return NextResponse.redirect(back, 303);
  }

  const form = await request.formData();
  const password = String(form.get("password") ?? "");
  if (!(await passwordMatches(password))) {
    recordLoginFailure(ip);
    back.searchParams.set("error", "password");
    return NextResponse.redirect(back, 303);
  }

  clearLoginFailures(ip);
  const token = await createSessionToken();
  const next = String(form.get("next") ?? "/admin");
  const safeNext = next.startsWith("/admin") ? next : "/admin";
  const response = NextResponse.redirect(publicUrl(request, safeNext), 303);
  const forwarded = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const secure = forwarded ? forwarded === "https" : request.nextUrl.protocol === "https:";
  if (token) response.cookies.set(ADMIN_COOKIE, token, sessionCookieOptions(secure));
  return response;
}
