import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE, readSessionToken } from "./auth";
import { SupabaseConfigError } from "./supabase-env";

export async function requireAdmin(request: NextRequest): Promise<NextResponse | null> {
  const ok = await readSessionToken(request.cookies.get(ADMIN_COOKIE)?.value);
  if (!ok) {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }
  const origin = request.headers.get("origin");
  if (origin) {
    const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
    try {
      if (new URL(origin).host !== host) {
        return NextResponse.json({ error: "That request was blocked." }, { status: 403 });
      }
    } catch {
      return NextResponse.json({ error: "That request was blocked." }, { status: 403 });
    }
  }
  return null;
}

export function databaseErrorResponse(error: unknown): NextResponse {
  if (error instanceof SupabaseConfigError) {
    return NextResponse.json(
      { error: "The store database is not connected yet." },
      { status: 503 }
    );
  }
  console.error("[admin]", error);
  const message = error instanceof Error ? error.message : "Something went wrong.";
  return NextResponse.json({ error: message }, { status: 500 });
}
