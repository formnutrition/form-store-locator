import type { NextRequest } from "next/server";

/**
 * Next's request.url can say "localhost" even when the browser used another
 * host, which drops the login cookie on the redirect. Prefer the Host header.
 */
export function publicUrl(request: NextRequest, pathname: string): URL {
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  if (!host) return new URL(pathname, request.url);
  const forwarded = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const proto = forwarded || request.nextUrl.protocol.replace(":", "") || "https";
  return new URL(pathname, `${proto}://${host}`);
}
