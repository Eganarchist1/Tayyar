import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const targets = [
  "apps/web/src/app",
  "apps/hero-app/app",
  "packages/ui/src/components",
];

const ignoreFiles = new Set([
  "packages/ui/src/copy.ts",
  "packages/ui/src/navigation.ts",
  "apps/web/src/lib/order-status.ts",
  "apps/hero-app/lib/copy.ts",
]);

const legacyLocalePropPattern = /\b(pageTitleAr|pageSubtitleAr|titleAr|descriptionAr|labelAr)\s*(=|\?:)/;
const physicalDirectionPattern =
  /\b(text-left|text-right|left-\d|right-\d|left-\[|right-\[|ml-\d|mr-\d|pl-\d|pr-\d|justify-start|justify-end)\b/;
const arabicLiteralPattern = /(["'`])([^"'`]*[\u0600-\u06FF][^"'`]*)\1/g;

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const resolved = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(resolved));
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      files.push(resolved);
    }
  }
  return files;
}

function relative(file) {
  return path.relative(root, file).replaceAll("\\", "/");
}

function createIssue(id, category, severity, file, line, problem, fix, status = "open") {
  return {
    id,
    category,
    severity,
    file,
    line,
    problem,
    fix,
    status,
  };
}

const issues = [];
const routeFiles = [];

for (const target of targets) {
  const absTarget = path.join(root, target);
  if (!fs.existsSync(absTarget)) continue;
  for (const file of walk(absTarget)) {
    const rel = relative(file);
    const source = fs.readFileSync(file, "utf8");
    const lines = source.split(/\r?\n/);

    if (rel.startsWith("apps/web/src/app/") && rel.endsWith("/page.tsx")) {
      routeFiles.push(rel);
    }
    if (rel.startsWith("apps/hero-app/app/") && rel.endsWith(".tsx") && !rel.endsWith("_layout.tsx")) {
      routeFiles.push(rel);
    }

    lines.forEach((line, index) => {
      if (legacyLocalePropPattern.test(line)) {
        issues.push(
          createIssue(
            `I18N-${issues.length + 1}`,
            "Phase 1 - Internationalization",
            "high",
            rel,
            index + 1,
            "Legacy locale-specific prop naming keeps copy ownership fragmented in page files.",
            "Move visible copy to shared bilingual keys and use locale-neutral props.",
          ),
        );
      }

      if (
        physicalDirectionPattern.test(line) &&
        !line.includes("direction ===") &&
        !line.includes("locale ===") &&
        !line.includes("isRtl ?") &&
        !line.includes("direction === \"rtl\"")
      ) {
        issues.push(
          createIssue(
            `DIR-${issues.length + 1}`,
            "Phase 1 - Direction",
            "medium",
            rel,
            index + 1,
            "Physical direction class detected; this may not mirror correctly between RTL and LTR.",
            "Use locale-aware logic or shared direction-safe components.",
          ),
        );
      }

      if (
        !ignoreFiles.has(rel) &&
        /[\u0600-\u06FF]/.test(line) &&
        !legacyLocalePropPattern.test(line) &&
        !line.includes("tx(locale") &&
        !line.includes("text(") &&
        !line.includes("t(") &&
        !line.includes("locale === \"ar\"") &&
        !line.includes("locale === 'ar'") &&
        !line.includes("isArabic ?") &&
        !/\bar\s*:/.test(line) &&
        !line.includes("nameAr") &&
        !line.includes("titleAr") &&
        !line.includes("descriptionAr")
      ) {
        const matches = [...line.matchAll(arabicLiteralPattern)];
        if (matches.length) {
          issues.push(
            createIssue(
              `COPY-${issues.length + 1}`,
              "Phase 1 - Internationalization",
              "medium",
              rel,
              index + 1,
              "Inline Arabic literal found outside the shared copy registry.",
              "Move this string into shared localized content or a local typed dictionary.",
            ),
          );
        }
      }
    });
  }
}

const summary = {
  generatedAt: new Date().toISOString(),
  totalRoutesScanned: routeFiles.length,
  totalIssues: issues.length,
  byCategory: issues.reduce((acc, issue) => {
    acc[issue.category] = (acc[issue.category] || 0) + 1;
    return acc;
  }, {}),
  bySeverity: issues.reduce((acc, issue) => {
    acc[issue.severity] = (acc[issue.severity] || 0) + 1;
    return acc;
  }, {}),
};

const docsDir = path.join(root, "docs", "audits");
fs.mkdirSync(docsDir, { recursive: true });

const jsonPath = path.join(docsDir, "production-readiness.json");
fs.writeFileSync(
  jsonPath,
  JSON.stringify(
    {
      summary,
      routes: routeFiles,
      issues,
    },
    null,
    2,
  ),
);

const markdown = [
  "# Tayyar Production Readiness Audit",
  "",
  `Generated: ${summary.generatedAt}`,
  "",
  "## Summary",
  "",
  `- Routes scanned: ${summary.totalRoutesScanned}`,
  `- Total issues: ${summary.totalIssues}`,
  `- Phase 1 - Internationalization: ${summary.byCategory["Phase 1 - Internationalization"] || 0}`,
  `- Phase 1 - Direction: ${summary.byCategory["Phase 1 - Direction"] || 0}`,
  `- High severity: ${summary.bySeverity.high || 0}`,
  `- Medium severity: ${summary.bySeverity.medium || 0}`,
  "",
  "## Issue Ledger",
  "",
  ...issues.map(
    (issue) =>
      `- ${issue.id} | ${issue.category} | ${issue.severity.toUpperCase()} | ${issue.file}:${issue.line} | ${issue.problem} | ${issue.fix}`,
  ),
  "",
];

fs.writeFileSync(path.join(docsDir, "production-readiness.md"), markdown.join("\n"));

console.log(`Wrote ${issues.length} issues to ${relative(jsonPath)}`);
