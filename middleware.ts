import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyValue } from "@/lib/crypto";

const AUTH_COOKIE = "authenticated";
const ROLE_COOKIE = "user_role";

function isPublicRoute(pathname: string): boolean {
  return (
    pathname === "/login" ||
    pathname === "/api/auth/login" ||
    pathname === "/api/health" ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/auth")
  );
}

function isApiRoute(pathname: string): boolean {
  return pathname.startsWith("/api/");
}

function isAdminRoute(pathname: string): boolean {
  return pathname.startsWith("/admin");
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const authPayload = await verifyValue(
    request.cookies.get(AUTH_COOKIE)?.value ?? "",
  );
  const authenticated = authPayload === "true";
  const userRole = await verifyValue(
    request.cookies.get(ROLE_COOKIE)?.value ?? "",
  );

  if (isPublicRoute(pathname)) {
    if (authenticated && pathname === "/login") {
      return NextResponse.redirect(new URL("/app/identity", request.url));
    }
    return NextResponse.next();
  }

  if (!authenticated) {
    if (isApiRoute(pathname)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // RBAC: non-admins cannot access /admin/* routes
  if (isAdminRoute(pathname) && userRole !== "admin") {
    return NextResponse.redirect(new URL("/app/calendar", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
