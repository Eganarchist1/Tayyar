"use client";

import React from "react";
import { PageScaffoldSkeleton, PageShell, type AppRole, type LocalizedText } from "@tayyar/ui";

const roleUsers: Record<AppRole, { name: LocalizedText; email: string }> = {
  ADMIN: {
    name: { ar: "مدير المنصة", en: "Platform admin" },
    email: "admin@tayyar.app",
  },
  MERCHANT_OWNER: {
    name: { ar: "مالك التاجر", en: "Merchant owner" },
    email: "owner@merchant.com",
  },
  SUPERVISOR: {
    name: { ar: "المشرف الميداني", en: "Field supervisor" },
    email: "supervisor@tayyar.app",
  },
  BRANCH_MANAGER: {
    name: { ar: "مدير الفرع", en: "Branch manager" },
    email: "branch.manager@tayyar.app",
  },
};

export function RouteLoadingShell({
  role,
  title,
  subtitle,
  compact,
}: {
  role: AppRole;
  title: LocalizedText;
  subtitle: LocalizedText;
  compact?: boolean;
}) {
  return (
    <PageShell
      role={role}
      user={roleUsers[role]}
      pageTitle={title}
      pageSubtitle={subtitle}
      showLive
    >
      <PageScaffoldSkeleton compact={compact} />
    </PageShell>
  );
}
