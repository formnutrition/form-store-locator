import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE, readSessionToken } from "@/lib/auth";
import { publicUrl } from "@/lib/request-url";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(ADMIN_COOKIE)?.value;
  const signedIn = await readSessionToken(token);

  if (pathname === "/admin/login") {
    if (signedIn) {
      return NextResponse.redirect(publicUrl(request, "/admin"));
    }
    return NextResponse.next();
  }

  if (pathname.startsWith("/admin")) {
    if (!signedIn) {
      const login = publicUrl(request, "/admin/login");
      login.searchParams.set("next", pathname);
      return NextResponse.redirect(login);
    }
  }

  if (pathname.startsWith("/api/admin") && !pathname.startsWith("/api/admin/login")) {
    if (!signedIn) {
      return NextResponse.json({ error: "Please sign in." }, { status: 401 });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
