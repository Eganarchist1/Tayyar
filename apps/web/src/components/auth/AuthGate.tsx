"use client";

import React from "react";
import { usePathname, useRouter } from "next/navigation";
import { getStoredSession } from "@/lib/session";

const publicPrefixes = ["/login", "/forgot-password", "/reset-password", "/activate-account", "/track"];

function isProtectedPath(pathname: string) {
  return ["/admin", "/merchant", "/supervisor", "/branch"].some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function expectedRoleForPath(pathname: string) {
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return "ADMIN";
  if (pathname === "/supervisor" || pathname.startsWith("/supervisor/")) return "SUPERVISOR";
  if (pathname === "/branch" || pathname.startsWith("/branch/")) return "BRANCH_MANAGER";
  if (pathname === "/merchant" || pathname.startsWith("/merchant/")) return "MERCHANT_OWNER";
  return null;
}

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const currentPath = pathname || "/";
  const bypassGate =
    publicPrefixes.some((prefix) => currentPath === prefix || currentPath.startsWith(`${prefix}/`)) ||
    !isProtectedPath(currentPath);
  const [ready, setReady] = React.useState(bypassGate);

  React.useEffect(() => {
    if (bypassGate) {
      setReady(true);
      return;
    }

    const session = getStoredSession();
    const expectedRole = expectedRoleForPath(currentPath);

    if (!session?.accessToken || !session.user) {
      router.replace(`/login?next=${encodeURIComponent(currentPath)}`);
      return;
    }

    if (expectedRole && session.user.role !== expectedRole) {
      if (session.user.role === "ADMIN") {
        router.replace("/admin");
      } else if (session.user.role === "SUPERVISOR") {
        router.replace("/supervisor/map");
      } else if (session.user.role === "BRANCH_MANAGER") {
        router.replace("/branch/orders");
      } else {
        router.replace("/merchant");
      }
      return;
    }

    setReady(true);
  }, [bypassGate, currentPath, router]);

  if (bypassGate) {
    return <>{children}</>;
  }

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="w-full max-w-md rounded-[32px] border border-white/10 bg-white/[0.04] p-8 text-center shadow-[0_30px_80px_-48px_rgba(14,165,233,0.8)] backdrop-blur-2xl">
          <div className="app-font-display text-3xl font-black text-text-primary">Tayyar</div>
          <div className="app-font-body mt-3 text-sm text-text-secondary">Preparing your workspace</div>
          <div className="mx-auto mt-5 h-9 w-9 animate-spin rounded-full border-2 border-primary-400/50 border-t-primary-300" />
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
