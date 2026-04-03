import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const PUBLIC_PREFIXES = ["/login", "/forgot-password", "/reset-password", "/activate-account", "/track"];

function isProtectedPath(pathname: string) {
  return ["/admin", "/merchant", "/supervisor", "/branch"].some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function expectedRoleForPath(pathname: string) {
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return "ADMIN";
  if (pathname === "/supervisor" || pathname.startsWith("/supervisor/")) return "SUPERVISOR";
  if (pathname === "/branch" || pathname.startsWith("/branch/")) return "BRANCH_MANAGER";
  if (pathname === "/merchant" || pathname.startsWith("/merchant/")) return "MERCHANT_OWNER";
  return null;
}

function homePathForRole(role: string | undefined) {
  if (role === "ADMIN") return "/admin";
  if (role === "SUPERVISOR") return "/supervisor/map";
  if (role === "BRANCH_MANAGER") return "/branch/orders";
  if (role === "HERO") return "/hero";
  return "/merchant";
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  const isPublic = PUBLIC_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  const accessToken = request.cookies.get("tayyar_access_token")?.value;
  const role = request.cookies.get("tayyar_user_role")?.value;

  if (pathname === "/login" && accessToken && role) {
    return NextResponse.redirect(new URL(homePathForRole(role), request.url));
  }

  if (!isProtectedPath(pathname) || isPublic) {
    return NextResponse.next();
  }

  if (!accessToken || !role) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const expectedRole = expectedRoleForPath(pathname);
  if (expectedRole && role !== expectedRole) {
    return NextResponse.redirect(new URL(homePathForRole(role), request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
