import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";

const baseUrl = process.env.BASE_URL || "http://127.0.0.1:3000";
const apiUrl = process.env.API_URL || baseUrl.replace(":3000", ":3001");
const viewport = { width: 390, height: 844 };

const roles = [
  {
    role: "merchant",
    login: { email: "owner@merchant.com", password: "Tayyar@123" },
    routes: [
      "/merchant",
      "/merchant/orders/new",
      "/merchant/orders",
      "/merchant/customers",
      "/merchant/branches",
      "/merchant/heroes",
      "/merchant/invoices",
      "/merchant/settings",
    ],
  },
  {
    role: "admin",
    login: { email: "admin@tayyar.app", password: "Tayyar@123" },
    routes: [
      "/admin",
      "/admin/map",
      "/admin/orders",
      "/admin/heroes",
      "/admin/merchants",
      "/admin/branches",
      "/admin/users",
      "/admin/customers",
      "/admin/invoices",
      "/admin/payouts",
      "/admin/finance",
      "/admin/reports",
      "/admin/settings",
      "/admin/zones",
    ],
  },
  {
    role: "supervisor",
    login: { email: "supervisor@tayyar.app", password: "Tayyar@123" },
    routes: ["/supervisor/map", "/supervisor/orders", "/supervisor/heroes", "/supervisor/alerts"],
  },
  {
    role: "branch_manager",
    login: { email: "branch.manager@tayyar.app", password: "Tayyar@123" },
    routes: ["/branch/orders"],
  },
];

function isRelevantConsoleEntry(message) {
  const text = message.text();
  if (!text) {
    return false;
  }

  return !text.includes("WebSocket is closed before the connection is established");
}

async function login(roleConfig) {
  const response = await fetch(`${apiUrl}/v1/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(roleConfig.login),
  });

  if (!response.ok) {
    throw new Error(`Login failed for ${roleConfig.role}: ${response.status}`);
  }

  return response.json();
}

async function prepareContext(browser, roleConfig) {
  const session = await login(roleConfig);
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded" });
  await page.evaluate((payload) => {
    localStorage.setItem("tayyar.session", JSON.stringify(payload));
    document.cookie = `tayyar.accessToken=${payload.accessToken}; path=/`;
    document.cookie = `tayyar.refreshToken=${payload.refreshToken}; path=/`;
  }, session);
  return { context, page };
}

async function auditRoute(page, route) {
  const consoleErrors = [];
  const pageErrors = [];
  const onConsole = (message) => {
    if (message.type() === "error" && isRelevantConsoleEntry(message)) {
      consoleErrors.push(message.text());
    }
  };
  const onPageError = (error) => pageErrors.push(error.message);

  page.on("console", onConsole);
  page.on("pageerror", onPageError);

  await page.goto(`${baseUrl}${route}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);

  const metrics = await page.evaluate(() => {
    const title = document.title;
    const clientWidth = document.documentElement.clientWidth;
    const scrollWidth = document.documentElement.scrollWidth;
    const bodyWidth = document.body?.scrollWidth || 0;
    const errorBoundary = Array.from(document.querySelectorAll("*"))
      .some((node) => node.textContent?.includes("حصل خطأ أثناء فتح الصفحة") || node.textContent?.includes("Something went wrong"));
    return {
      title,
      overflow: Math.max(scrollWidth, bodyWidth) - clientWidth,
      errorBoundary,
    };
  });

  let drawerOpen = null;
  const drawerSummary = await page.evaluate(() => {
    const trigger = document.querySelector('button[aria-label*="sidebar"], button[aria-label*="القائمة"]');
    return {
      hasTrigger: Boolean(trigger),
    };
  });

  if (drawerSummary.hasTrigger) {
    await page.locator('button[aria-label*="sidebar"], button[aria-label*="القائمة"]').first().click();
    await page.waitForTimeout(250);
    drawerOpen = await page.evaluate(() => {
      const drawer = document.querySelector('[aria-hidden="false"][class*="fixed"][class*="md:hidden"]');
      return Boolean(drawer);
    });
    if (drawerOpen) {
      const close = page.locator('button[aria-label*="Close sidebar"], button[aria-label*="إغلاق القائمة"]').first();
      if (await close.count()) {
        await close.click();
        await page.waitForTimeout(150);
      }
    }
  }

  page.off("console", onConsole);
  page.off("pageerror", onPageError);

  return {
    route,
    title: metrics.title,
    overflowPx: metrics.overflow,
    drawerOpen,
    errorBoundary: metrics.errorBoundary,
    consoleErrors,
    pageErrors,
  };
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const results = [];

  try {
    for (const roleConfig of roles) {
      const { context, page } = await prepareContext(browser, roleConfig);
      try {
        for (const route of roleConfig.routes) {
          const routeResult = await auditRoute(page, route);
          results.push({ role: roleConfig.role, ...routeResult });
        }
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }

  const summary = {
    baseUrl,
    checkedAt: new Date().toISOString(),
    totalRoutes: results.length,
    overflowRoutes: results.filter((entry) => entry.overflowPx > 4).length,
    drawerFailures: results.filter((entry) => entry.drawerOpen === false).length,
    errorRoutes: results.filter((entry) => entry.errorBoundary || entry.consoleErrors.length || entry.pageErrors.length).length,
    results,
  };

  const outputDir = path.join(process.cwd(), "docs", "audits");
  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(path.join(outputDir, "mobile-web-audit.json"), JSON.stringify(summary, null, 2));

  const lines = [
    "# Mobile Web Audit",
    "",
    `- Base URL: ${summary.baseUrl}`,
    `- Checked at: ${summary.checkedAt}`,
    `- Routes checked: ${summary.totalRoutes}`,
    `- Overflow routes: ${summary.overflowRoutes}`,
    `- Drawer failures: ${summary.drawerFailures}`,
    `- Error routes: ${summary.errorRoutes}`,
    "",
    "| Role | Route | Overflow px | Drawer | Errors |",
    "| --- | --- | ---: | --- | --- |",
    ...results.map((entry) => {
      const errorCount = entry.consoleErrors.length + entry.pageErrors.length + (entry.errorBoundary ? 1 : 0);
      return `| ${entry.role} | ${entry.route} | ${entry.overflowPx} | ${entry.drawerOpen === null ? "n/a" : entry.drawerOpen ? "ok" : "fail"} | ${errorCount} |`;
    }),
  ];

  await fs.writeFile(path.join(outputDir, "mobile-web-audit.md"), lines.join("\n"));

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
