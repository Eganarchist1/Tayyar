"use client";

import React from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowUpRight,
  Bell,
  Building2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Clock3,
  CreditCard,
  FileText,
  LayoutDashboard,
  Map as MapIcon,
  Menu,
  MoonStar,
  Package,
  Radar,
  Rocket,
  Settings,
  ShieldAlert,
  SunMedium,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { cn } from "../lib/cn";
import { resolveText, useLocale, type LocalizedText } from "../locale-context";
import { shellCopy } from "../copy";
import {
  findRouteMeta,
  getRoutesForRole,
  type AppRole,
  type AppRouteMeta,
  type NavigationIconKey,
} from "../navigation";
import { useShellState } from "../hooks/useShellState";
import { useTheme } from "../theme-context";
import { Sheet, SheetContent } from "./Sheet";

type NavItem = AppRouteMeta & { badge?: string | number };
type NavGroup = { title?: LocalizedText; items: NavItem[] };
type ShellShortcut = { href: string; label: LocalizedText; icon: NavigationIconKey };
export type ShellNotificationItem = {
  id: string;
  title: string | LocalizedText;
  description?: string | LocalizedText;
  href?: string;
  tone?: "primary" | "gold" | "success" | "neutral";
  meta?: string | LocalizedText;
  ctaLabel?: string | LocalizedText;
};

export type BreadcrumbItem = {
  label?: string | LocalizedText;
  href?: string;
};

interface PageShellProps {
  role: AppRole;
  user: { name?: LocalizedText; email: string };
  pageTitle?: LocalizedText;
  pageSubtitle?: LocalizedText;
  topbarActions?: React.ReactNode;
  showLive?: boolean;
  navGroups?: NavGroup[];
  notifications?: ShellNotificationItem[];
  notificationsLoading?: boolean;
  children: React.ReactNode;
}

interface PageHeaderProps {
  eyebrow?: string | LocalizedText;
  title?: string | LocalizedText;
  subtitle?: string | LocalizedText;
  breadcrumbs?: BreadcrumbItem[];
  actions?: React.ReactNode;
  chips?: Array<{ label?: string | LocalizedText; tone?: "primary" | "gold" | "success" | "neutral" }>;
}

interface EmptyStateProps {
  title?: string | LocalizedText;
  description?: string | LocalizedText;
  action?: React.ReactNode;
  className?: string;
}

const DESKTOP_SIDEBAR_COLLAPSED_WIDTH = 108;
const NOTIFICATIONS_PANEL_WIDTH = 352;
const NOTIFICATIONS_PANEL_GUTTER = 12;
const MOBILE_BREAKPOINT = 768;

const iconMap: Record<NavigationIconKey, React.ComponentType<{ className?: string }>> = {
  dashboard: LayoutDashboard,
  orders: Package,
  rocket: Rocket,
  branches: Building2,
  heroes: Radar,
  customers: Users,
  wallet: Wallet,
  settings: Settings,
  map: MapIcon,
  reports: Radar,
  finance: CreditCard,
  invoices: FileText,
  alerts: ShieldAlert,
  users: Users,
};

const roleLabel: Record<AppRole, LocalizedText> = {
  ADMIN: { ar: "إدارة المنصة", en: "Platform admin" },
  SUPERVISOR: { ar: "الإشراف الميداني", en: "Field supervision" },
  MERCHANT_OWNER: { ar: "حساب التاجر", en: "Merchant workspace" },
  BRANCH_MANAGER: { ar: "إدارة الفرع", en: "Branch operations" },
};

const defaultGroupTitle: LocalizedText = shellCopy.navigation;

function localize(value: string | LocalizedText | undefined, locale: "ar" | "en", fallback = "") {
  if (!value) return fallback;
  return resolveText(value, locale);
}

function shellText(locale: "ar" | "en", ar: string, en: string) {
  return locale === "ar" ? ar : en;
}

function edgeStyles(direction: "rtl" | "ltr", edge: "start" | "end", offset = 0) {
  if (direction === "rtl") {
    return edge === "start" ? { right: offset } : { left: offset };
  }
  return edge === "start" ? { left: offset } : { right: offset };
}

function formatCairoTime(locale: "ar" | "en") {
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-EG-u-nu-latn" : "en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Africa/Cairo",
  }).format(new Date());
}

function buildNavGroups(role: AppRole): NavGroup[] {
  const grouped = new Map<string, NavGroup>();
  for (const route of getRoutesForRole(role)) {
    const group = route.group || defaultGroupTitle;
    const key = `${group.ar}-${group.en}`;
    const current = grouped.get(key) || { title: group, items: [] };
    current.items.push(route);
    grouped.set(key, current);
  }
  return Array.from(grouped.values());
}

function buildQuickActions(role: AppRole, pathname: string): ShellShortcut[] {
  return getRoutesForRole(role)
    .filter((route) => route.href !== pathname)
    .slice(0, 4)
    .map((route) => ({
      href: route.href,
      label: route.navLabel,
      icon: route.icon,
    }));
}

function buildMobileQuickActions(role: AppRole): ShellShortcut[] {
  const preferredRoutes: Record<AppRole, string[]> = {
    ADMIN: ["/admin", "/admin/orders", "/admin/map", "/admin/heroes"],
    SUPERVISOR: ["/supervisor/map", "/supervisor/orders", "/supervisor/heroes", "/supervisor/alerts"],
    MERCHANT_OWNER: ["/merchant", "/merchant/orders/new", "/merchant/orders", "/merchant/branches"],
    BRANCH_MANAGER: ["/branch/orders"],
  };

  const routeLookup = new Map(getRoutesForRole(role).map((route) => [route.href, route]));
  return preferredRoutes[role]
    .map((href) => routeLookup.get(href))
    .filter((route): route is AppRouteMeta => Boolean(route))
    .map((route) => ({
      href: route.href,
      label: route.navLabel,
      icon: route.icon,
    }));
}

function isActiveItem(pathname: string, item: NavItem) {
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function ToneChip({
  label,
  tone = "neutral",
}: {
  label?: string | LocalizedText;
  tone?: "primary" | "gold" | "success" | "neutral";
}) {
  const { locale } = useLocale();
  const toneClass =
    tone === "primary"
      ? "border-[var(--border-strong)] bg-[var(--primary-100)] text-[var(--primary-800)]"
      : tone === "gold"
        ? "border-[var(--border-gold)] bg-[var(--accent-50)] text-[var(--accent-800)]"
        : tone === "success"
          ? "border-[color:rgba(21,128,61,0.22)] bg-[color:rgba(21,128,61,0.1)] text-[var(--success-500)]"
          : "border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--text-secondary)]";
  return (
    <span className={cn("app-font-body rounded-full border px-3 py-1 text-xs font-bold", toneClass)}>
      {localize(label, locale)}
    </span>
  );
}

function TayyarLogo({ collapsed = false }: { collapsed?: boolean }) {
  const { locale } = useLocale();
  return (
    <div className="flex items-center gap-3">
      <div className="relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-[20px] border border-[var(--border-strong)] bg-[linear-gradient(135deg,var(--primary-600),var(--primary-700)_65%,var(--primary-900))] shadow-[0_24px_52px_-24px_rgba(13,148,136,0.55)]">
        <Rocket className="h-5 w-5 text-white" />
      </div>
      {!collapsed ? (
        <div>
          <div className="app-font-display text-2xl font-black tracking-tight text-text-primary">
            {localize(shellCopy.brandName, locale)}
          </div>
          <div className="app-font-body text-[10px] font-bold uppercase tracking-[0.28em] text-text-tertiary">
            {localize(shellCopy.brandTagline, locale)}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SidebarNavItem({
  item,
  pathname,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  pathname: string;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const { locale, direction } = useLocale();
  const active = isActiveItem(pathname, item);
  const Icon = iconMap[item.icon];
  const Chevron = direction === "rtl" ? ChevronLeft : ChevronRight;

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      title={localize(item.navLabel, locale)}
      className={cn(
        "group relative mx-3 flex items-center gap-3 rounded-[22px] border px-4 py-3.5 text-sm transition-all duration-300",
        collapsed && "justify-center px-0",
        active
          ? "border-[var(--border-active)] bg-[var(--primary-600)] text-white shadow-[var(--shadow-glow-sky)]"
          : "border-transparent text-[var(--text-secondary)] hover:border-[var(--border-default)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]",
      )}
    >
      {active ? (
        <span
          className="absolute inset-y-3 w-1 bg-accent-500 shadow-[var(--shadow-glow-gold)]"
          style={
            direction === "rtl"
              ? { right: 0, borderTopLeftRadius: 999, borderBottomLeftRadius: 999 }
              : { left: 0, borderTopRightRadius: 999, borderBottomRightRadius: 999 }
          }
        />
      ) : null}
      <div
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-2xl border transition-colors",
          active
            ? "border-white/18 bg-white/12 text-white"
            : "border-[var(--border-default)] bg-[var(--bg-base)] text-[var(--text-tertiary)] group-hover:text-[var(--text-primary)]",
        )}
      >
        <Icon className="h-4.5 w-4.5" />
      </div>
      {!collapsed ? <span className="app-font-body flex-1 font-bold">{localize(item.navLabel, locale)}</span> : null}
      {!collapsed && item.badge ? (
        <span className="rounded-full border border-[var(--border-gold)] bg-[var(--accent-50)] px-2 py-0.5 text-[10px] font-bold text-[var(--accent-800)]">
          {item.badge}
        </span>
      ) : null}
      {!collapsed ? (
        <Chevron className={cn("h-4 w-4 transition-transform", active ? "text-white/85" : "text-[var(--text-tertiary)]")} />
      ) : null}
    </Link>
  );
}

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const { locale } = useLocale();
  return (
    <button
      onClick={toggleTheme}
      className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--border-default)] bg-[var(--bg-base)] text-[var(--text-secondary)] transition-all duration-300 hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]"
      title={theme === "midnight" ? localize(shellCopy.lightTheme, locale) : localize(shellCopy.darkTheme, locale)}
      type="button"
    >
      {theme === "midnight" ? <SunMedium className="h-4.5 w-4.5" /> : <MoonStar className="h-4.5 w-4.5" />}
    </button>
  );
}

function LocaleToggle() {
  const { locale, setLocale } = useLocale();
  return (
    <div className="flex items-center rounded-2xl border border-[var(--border-default)] bg-[var(--bg-base)] p-1 shadow-[var(--shadow-card)]">
      {([
        ["ar", shellCopy.languageArabic],
        ["en", shellCopy.languageEnglish],
      ] as const).map(([value, label]) => (
        <button
          key={value}
          type="button"
          onClick={() => setLocale(value)}
          className={cn(
            "app-font-body rounded-[14px] px-3 py-2 text-xs font-bold transition-all",
            locale === value
              ? "bg-[var(--primary-600)] text-white shadow-[var(--shadow-glow-sky)]"
              : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function SidebarPanel({
  pathname,
  role,
  user,
  navGroups,
  collapsed = false,
  mobile = false,
  onToggleCollapse,
  onNavigate,
}: {
  pathname: string;
  role: AppRole;
  user: { name?: LocalizedText; email: string };
  navGroups: NavGroup[];
  collapsed?: boolean;
  mobile?: boolean;
  onToggleCollapse?: () => void;
  onNavigate?: () => void;
}) {
  const { locale } = useLocale();
  const displayName = localize(user.name, locale, user.email);
  const initials = displayName
    .split(" ")
    .map((word) => word[0])
    .join("")
    .slice(0, 2);
  const CollapseIcon =
    collapsed ? (locale === "ar" ? ChevronsLeft : ChevronsRight) : locale === "ar" ? ChevronsRight : ChevronsLeft;

  return (
    <div
      className={cn(
        "flex h-full min-h-0 flex-col rounded-[34px] border border-[var(--border-default)] bg-[var(--bg-base)] shadow-[var(--shadow-raised)]",
        mobile ? "overflow-y-auto overscroll-contain" : "overflow-hidden",
      )}
    >
      <div className={cn("border-b border-[var(--border-default)]", collapsed ? "px-3 py-4" : "p-5")}>
        <div className={cn("flex items-center", collapsed ? "flex-col justify-center" : "justify-between gap-3")}>
          <TayyarLogo collapsed={collapsed} />
          {onToggleCollapse ? (
            <button
              type="button"
              onClick={onToggleCollapse}
              title={collapsed ? shellText(locale, "توسيع القائمة", "Expand sidebar") : shellText(locale, "طي القائمة", "Collapse sidebar")}
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-2xl border border-[var(--border-default)] bg-[var(--bg-base)] text-[var(--text-secondary)] transition-all duration-300 hover:border-[var(--border-strong)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]",
                collapsed && "mt-4",
              )}
            >
              <CollapseIcon className="h-4.5 w-4.5" />
            </button>
          ) : null}
        </div>
        {!collapsed ? (
          <div className="mt-5 rounded-[24px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 animate-fade-in">
            <div className="app-font-body text-[11px] font-bold uppercase tracking-[0.24em] text-[var(--text-tertiary)]">
              {localize(roleLabel[role], locale)}
            </div>
            <div className="app-font-body mt-2 text-sm text-[var(--text-secondary)]">
              {localize(shellCopy.roleDescription[role], locale)}
            </div>
          </div>
        ) : null}
      </div>

      <div className={cn(mobile ? "py-5" : "flex-1 min-h-0 overflow-y-auto overscroll-contain py-5")}>
        {navGroups.map((group, index) => (
          <div key={`${group.title?.ar || group.title?.en || "group"}-${index}`} className="mb-6">
            {group.title && !collapsed ? (
              <div className="app-font-body mb-3 px-6 text-[11px] font-bold uppercase tracking-[0.22em] text-text-tertiary">
                {localize(group.title, locale)}
              </div>
            ) : null}
            <div className="space-y-1">
              {group.items.map((item) => (
                <SidebarNavItem
                  key={item.href}
                  item={item}
                  pathname={pathname}
                  collapsed={collapsed}
                  onNavigate={onNavigate}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-[var(--border-default)] p-4">
        <div
          className={cn(
            "mb-3 flex items-center rounded-[24px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-3",
            collapsed ? "justify-center" : "gap-3",
          )}
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--border-gold)] bg-[var(--accent-50)] font-mono text-sm font-bold text-[var(--accent-800)]">
            {initials || "TA"}
          </div>
          {!collapsed ? (
            <div className="min-w-0 flex-1">
              <div className="app-font-body truncate font-bold text-[var(--text-primary)]">{displayName}</div>
              <div className="truncate text-xs text-[var(--text-tertiary)]">{user.email}</div>
            </div>
          ) : null}
        </div>
        {!collapsed ? (
          <div className="grid gap-3 md:hidden">
            <div className="flex items-center justify-between gap-3 rounded-[20px] border border-[var(--border-default)] bg-[var(--bg-base)] px-4 py-3">
              <div>
                <div className="app-font-body text-xs font-bold text-[var(--text-primary)]">
                  {shellText(locale, "إعدادات الواجهة", "Shell settings")}
                </div>
                <div className="app-font-body mt-1 text-[11px] text-[var(--text-tertiary)]">
                  {shellText(locale, "السمة واللغة من نفس المكان.", "Theme and language in one place.")}
                </div>
              </div>
              <ThemeToggle />
            </div>
            <LocaleToggle />
            <div className="flex items-center justify-between rounded-[20px] border border-[var(--border-default)] bg-[var(--bg-base)] px-4 py-3">
              <div className="app-font-body text-xs font-bold text-[var(--text-tertiary)]">
                {shellText(locale, "توقيت القاهرة", "Cairo time")}
              </div>
              <span className="font-mono text-sm font-bold text-[var(--text-primary)]" dir="ltr">
                {formatCairoTime(locale)}
              </span>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function CairoTimePill() {
  const { locale } = useLocale();
  const [time, setTime] = React.useState(() => formatCairoTime(locale));

  React.useEffect(() => {
    setTime(formatCairoTime(locale));
    const timer = window.setInterval(() => {
      setTime(formatCairoTime(locale));
    }, 30000);
    return () => window.clearInterval(timer);
  }, [locale]);

  return (
    <div className="hidden items-center gap-2 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface-2)] px-3 py-2 shadow-[var(--shadow-card)] md:flex">
      <Clock3 className="h-4 w-4 text-[var(--primary-700)]" />
      <span className="font-mono text-sm font-bold text-[var(--text-primary)]" dir="ltr">
        {time}
      </span>
      <span className="app-font-body text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
        {shellText(locale, "القاهرة", "Cairo")}
      </span>
    </div>
  );
}

function MobileQuickActionBar({
  role,
  pathname,
  hidden = false,
}: {
  role: AppRole;
  pathname: string;
  hidden?: boolean;
}) {
  const { locale } = useLocale();
  const shortcuts = React.useMemo(() => buildMobileQuickActions(role), [role]);

  if (!shortcuts.length) {
    return null;
  }

  if (hidden) {
    return null;
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-[55] border-t border-[var(--border-default)] bg-[var(--bg-glass-strong)] px-3 pb-[calc(env(safe-area-inset-bottom)+0.9rem)] pt-2 shadow-[var(--shadow-xl)] backdrop-blur-2xl md:hidden">
      <div className="mx-auto grid max-w-3xl grid-cols-4 gap-2">
        {shortcuts.map((action) => {
          const Icon = iconMap[action.icon];
          const exactOnly =
            action.href === "/admin" ||
            action.href === "/merchant" ||
            action.href === "/supervisor/map" ||
            action.href === "/branch/orders";
          const active = pathname === action.href || (!exactOnly && pathname.startsWith(`${action.href}/`));

          return (
            <Link
              key={action.href}
              href={action.href}
              className={cn(
                "flex min-h-[4.25rem] flex-col items-center justify-center rounded-[22px] border px-2 py-2 text-center transition-all duration-300",
                active
                  ? "border-[var(--border-active)] bg-[var(--primary-600)] text-white shadow-[var(--shadow-glow-sky)]"
                  : "border-[var(--border-default)] bg-[var(--bg-base)] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]",
              )}
            >
              <Icon className="h-4.5 w-4.5" />
              <span className="app-font-body mt-1 text-[10px] font-bold leading-4">{localize(action.label, locale)}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function NotificationsFlyout({
  open,
  role,
  pathname,
  notifications,
  notificationsLoading = false,
  onClose,
}: {
  open: boolean;
  role: AppRole;
  pathname: string;
  triggerRef?: any;
  notifications?: ShellNotificationItem[];
  notificationsLoading?: boolean;
  onClose: () => void;
}) {
  const { locale } = useLocale();
  const quickActions = React.useMemo(() => buildQuickActions(role, pathname), [role, pathname]);

  const alertToneLabel = (tone?: "primary" | "gold" | "success" | "neutral") => {
    if (tone === "success") return shellText(locale, "محدث", "Fresh");
    if (tone === "primary") return shellText(locale, "عاجل", "Urgent");
    if (tone === "gold") return shellText(locale, "تابع", "Follow up");
    return shellText(locale, "مفتوح", "Open");
  };

  const alertsSection = notificationsLoading ? (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, index) => (
        <div
          key={`notification-loading-${index}`}
          className="rounded-[20px] border border-[var(--border-default)] bg-[var(--bg-base)] px-4 py-4"
        >
          <div className="animate-shimmer h-3.5 rounded-full" />
          <div className="animate-shimmer mt-3 h-3 rounded-full opacity-80" />
          <div className="animate-shimmer mt-2 h-3 w-2/3 rounded-full opacity-65" />
        </div>
      ))}
    </div>
  ) : notifications?.length ? (
    <div className="space-y-3">
      {notifications.slice(0, 4).map((item) => (
        <div
          key={item.id}
          className="rounded-[22px] border border-[var(--border-default)] bg-[var(--bg-base)] px-4 py-4 shadow-[var(--shadow-card)]"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="app-font-body font-bold text-[var(--text-primary)]">{localize(item.title, locale)}</div>
              {item.description ? (
                <div className="app-font-body mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                  {localize(item.description, locale)}
                </div>
              ) : null}
            </div>
            <ToneChip label={alertToneLabel(item.tone)} tone={item.tone || "neutral"} />
          </div>
          <div className="mt-3 flex items-center justify-between gap-3">
            <div className="app-font-body text-xs text-[var(--text-tertiary)]">{localize(item.meta, locale)}</div>
            {item.href ? (
              <Link
                href={item.href}
                onClick={onClose}
                className="app-font-body inline-flex items-center gap-2 text-xs font-bold text-[var(--primary-700)] transition-colors hover:text-[var(--primary-800)]"
              >
                {localize(item.ctaLabel, locale, shellText(locale, "افتح", "Open"))}
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  ) : (
    <div className="rounded-[22px] border border-dashed border-[var(--border-default)] bg-[var(--bg-base)] px-4 py-5 text-center">
      <div className="app-font-body font-bold text-[var(--text-primary)]">
        {shellText(locale, "لا توجد تنبيهات مفتوحة الآن.", "There are no open alerts right now.")}
      </div>
      <div className="app-font-body mt-2 text-sm leading-6 text-[var(--text-secondary)]">
        {shellText(locale, "لو ظهر شيء يحتاج متابعة ستجده هنا.", "Anything that needs follow-up will appear here.")}
      </div>
    </div>
  );

  return (
    <Sheet open={open} onOpenChange={(val) => !val && onClose()}>
      <SheetContent side="right" className="flex flex-col w-full sm:max-w-md p-0" hideCloseBtn>
        <div className="border-b border-[var(--border-default)] px-5 py-4 shrink-0">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="app-font-display text-lg font-black text-[var(--text-primary)]">
                {shellText(locale, "التنبيهات السريعة", "Quick Alerts")}
              </div>
              <div className="app-font-body mt-1 text-xs text-[var(--text-tertiary)]">
                {shellText(locale, "اختصارات وحالة الواجهة من مكان واحد.", "Shortcuts and shell status in one place.")}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="live-tag text-xs font-bold">{shellText(locale, "مباشر", "Live")}</span>
              <button
                type="button"
                onClick={onClose}
                className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[var(--border-default)] bg-[var(--bg-base)] text-[var(--text-primary)]"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-5 pb-10">
          <div className="rounded-[24px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 shadow-[var(--shadow-card)]">
            <div className="app-font-body text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
              {shellText(locale, "المتابعة الآن", "Needs follow-up")}
            </div>
            <div className="mt-3">{alertsSection}</div>
          </div>

          <div className="rounded-[24px] border border-[var(--border-default)] bg-[var(--bg-base)] p-4 shadow-[var(--shadow-card)]">
            <div className="app-font-body text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
              {shellText(locale, "إجراءات سريعة", "Quick actions")}
            </div>
            <div className="mt-3 space-y-2">
              {quickActions.map((action) => {
                const Icon = iconMap[action.icon];
                return (
                  <Link
                    key={action.href}
                    href={action.href}
                    onClick={onClose}
                    className="group flex items-center gap-3 rounded-[20px] border border-transparent px-3 py-3 text-sm transition-all duration-300 hover:border-[var(--border-default)] hover:bg-[var(--bg-surface)]"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--primary-700)] shadow-[var(--shadow-card)]">
                      <Icon className="h-4.5 w-4.5" />
                    </div>
                    <span className="app-font-body flex-1 font-bold text-[var(--text-primary)]">{localize(action.label, locale)}</span>
                    <ArrowUpRight className="h-4 w-4 text-[var(--text-tertiary)] transition-transform duration-300 group-hover:translate-x-[2px] group-hover:-translate-y-[2px] group-hover:text-[var(--text-primary)]" />
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function PageHeader({ eyebrow, title, subtitle, breadcrumbs, actions, chips }: PageHeaderProps) {
  const { locale, direction } = useLocale();
  return (
    <div className="overflow-hidden rounded-[26px] border border-[var(--border-default)] bg-[linear-gradient(135deg,var(--bg-base),var(--bg-surface)_72%,rgba(var(--accent-rgb),0.12))] p-4 shadow-[var(--shadow-raised)] sm:p-5 lg:rounded-[34px] lg:p-8">
      {breadcrumbs?.length ? (
        <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-text-tertiary">
          {breadcrumbs.map((crumb, index) => (
            <React.Fragment key={`${localize(crumb.label, locale)}-${index}`}>
              {crumb.href ? (
                <Link href={crumb.href} className="app-font-body transition-colors hover:text-text-primary">
                  {localize(crumb.label, locale)}
                </Link>
              ) : (
                <span className="app-font-body text-text-secondary">{localize(crumb.label, locale)}</span>
              )}
              {index < breadcrumbs.length - 1 ? <span>/</span> : null}
            </React.Fragment>
          ))}
        </div>
      ) : null}
      <div className="flex flex-col gap-4 xl:flex-row" style={{ alignItems: "flex-start", justifyContent: "space-between" }}>
        <div className="max-w-3xl">
          {eyebrow ? <div className="subtle-label text-[var(--primary-700)]">{localize(eyebrow, locale)}</div> : null}
          <h2 className="app-font-display mt-2.5 text-[1.8rem] font-black leading-tight text-text-primary sm:text-3xl lg:mt-3 lg:text-4xl">
            {localize(title, locale)}
          </h2>
          {subtitle ? (
            <p className="app-font-body mt-2.5 max-w-3xl text-sm leading-6 text-text-secondary lg:mt-3 lg:text-base lg:leading-7">
              {localize(subtitle, locale)}
            </p>
          ) : null}
          {chips?.length ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {chips.map((chip) => (
                <ToneChip key={localize(chip.label, locale)} label={chip.label} tone={chip.tone} />
              ))}
            </div>
          ) : null}
        </div>
        {actions ? (
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:gap-3" style={{ justifyContent: direction === "rtl" ? "flex-start" : "flex-end" }}>
            {actions}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function EmptyStateCard({ title, description, action, className }: EmptyStateProps) {
  const { locale } = useLocale();
  return (
    <div
      className={cn(
        "rounded-[24px] border border-dashed border-[var(--border-default)] bg-[var(--bg-surface)] px-4 py-6 text-center shadow-[var(--shadow-card)] sm:px-6 sm:py-8",
        className,
      )}
    >
      <div className="mx-auto max-w-xl">
        <h3 className="app-font-display text-xl font-black text-text-primary">{localize(title, locale)}</h3>
        <p className="app-font-body mt-3 text-sm leading-7 text-text-secondary">{localize(description, locale)}</p>
        {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
      </div>
    </div>
  );
}


export function PageShell({
  role,
  user,
  pageTitle,
  pageSubtitle,
  topbarActions,
  showLive,
  navGroups,
  notifications,
  notificationsLoading,
  children,
}: PageShellProps) {
  const { locale, direction, t } = useLocale();
  const pathname = usePathname();
  const routeMeta = findRouteMeta(pathname, role);
  const navigation = navGroups ?? buildNavGroups(role);
  const {
    collapsed,
    mobileOpen,
    openMobile,
    closeMobile,
    mobileCloseRef,
    mobilePanelRef,
    mobileTriggerRef,
    setMobileOpen,
    toggleCollapsed,
  } = useShellState();
  const [notificationsOpen, setNotificationsOpen] = React.useState(false);
  const notificationsTriggerRef = React.useRef<HTMLButtonElement | null>(null);
  const sidebarWidth = React.useMemo(
    () => (collapsed ? `${DESKTOP_SIDEBAR_COLLAPSED_WIDTH}px` : "clamp(18rem, 22vw, 22rem)"),
    [collapsed],
  );
  const notificationCount = notifications?.length ?? 0;
  const mobileDrawerStyle = React.useMemo<React.CSSProperties>(
    () => ({
      ...edgeStyles(direction, "start"),
      transform: mobileOpen
        ? "translate3d(0, 0, 0)"
        : direction === "rtl"
          ? "translate3d(100%, 0, 0)"
          : "translate3d(-100%, 0, 0)",
      opacity: mobileOpen ? 1 : 0,
      visibility: mobileOpen ? "visible" : "hidden",
      pointerEvents: mobileOpen ? "auto" : "none",
    }),
    [direction, mobileOpen],
  );

  React.useEffect(() => {
    setMobileOpen(false);
    setNotificationsOpen(false);
  }, [pathname, setMobileOpen]);

  const resolvedTitle = localize(pageTitle || routeMeta?.title || shellCopy.brandName, locale);
  const resolvedSubtitle = pageSubtitle || routeMeta?.subtitle ? localize(pageSubtitle || routeMeta?.subtitle, locale) : "";

  React.useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    document.title = `${resolvedTitle} | ${t(shellCopy.brandName)}`;

    const description = resolvedSubtitle || t(shellCopy.brandTagline);
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "description");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", description);
  }, [resolvedTitle, resolvedSubtitle, t]);

  const mobileShellLayer =
    typeof document !== "undefined"
      ? createPortal(
          <>
            <button
              type="button"
              className={cn(
                "fixed inset-0 z-[58] bg-black/60 backdrop-blur-sm transition-opacity duration-300 md:hidden",
                mobileOpen ? "opacity-100" : "pointer-events-none opacity-0",
              )}
              onClick={closeMobile}
              aria-label={localize(shellCopy.closeSidebar, locale)}
            />
            <div
              ref={mobilePanelRef}
              role="dialog"
              aria-modal="true"
              className="fixed inset-y-0 z-[60] w-[min(24rem,calc(100vw-0.75rem))] overscroll-contain p-0 transition-[transform,opacity,visibility] duration-300 will-change-transform md:hidden"
              data-mobile-open={mobileOpen ? "true" : "false"}
              style={mobileDrawerStyle}
              aria-hidden={!mobileOpen}
              tabIndex={-1}
            >
              <div className="h-[100dvh] p-2 sm:p-3">
                <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[28px] border border-[var(--border-default)] bg-[var(--bg-glass-strong)] shadow-[var(--shadow-xl)] backdrop-blur-2xl">
                  <div className="flex items-center justify-between gap-3 border-b border-[var(--border-default)] px-4 py-3">
                    <div className="min-w-0">
                      <div className="app-font-body truncate text-sm font-black text-[var(--text-primary)]">{t(shellCopy.brandName)}</div>
                      <div className="app-font-body mt-1 text-[11px] text-[var(--text-tertiary)]">
                        {shellText(locale, "التنقل السريع لكل أقسام المنصة.", "Fast navigation for the whole platform.")}
                      </div>
                    </div>
                    <button
                      ref={mobileCloseRef}
                      type="button"
                      className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-[var(--shadow-card)]"
                      onClick={closeMobile}
                      aria-label={localize(shellCopy.closeSidebar, locale)}
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                  <div className="min-h-0 flex-1 px-2 py-2">
                    <SidebarPanel pathname={pathname} role={role} user={user} navGroups={navigation} mobile onNavigate={closeMobile} />
                  </div>
                </div>
              </div>
            </div>
          </>,
          document.body,
        )
      : null;

  return (
    <div className="min-h-screen bg-transparent" dir={direction}>
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(var(--primary-rgb),0.12),transparent_26%),radial-gradient(circle_at_18%_18%,rgba(var(--accent-rgb),0.08),transparent_22%)]" />
      {mobileShellLayer}

      <aside
        className="fixed inset-y-0 z-40 hidden overflow-hidden p-3 lg:p-4 md:block"
        style={{ width: sidebarWidth, ...edgeStyles(direction, "start") }}
      >
        <SidebarPanel
          pathname={pathname}
          role={role}
          user={user}
          navGroups={navigation}
          collapsed={collapsed}
          onToggleCollapse={toggleCollapsed}
        />
      </aside>

      <div
        className="mx-auto min-h-screen max-w-[1900px] transition-[padding] duration-300 md:[padding-inline-start:var(--shell-sidebar-width)]"
        style={{ ["--shell-sidebar-width" as string]: sidebarWidth }}
      >
        <header
          className="sticky top-0 z-30 border-b border-[var(--border-default)] bg-[var(--bg-glass-strong)] backdrop-blur-2xl"
          style={{ boxShadow: "0 1px 0 var(--border-subtle)" }}
        >
          <div className="flex items-start justify-between gap-3 px-3 py-3 sm:px-4 md:items-center md:gap-4 md:px-5 lg:px-7 lg:py-4">
            <div className="min-w-0 flex flex-1 items-start gap-3 md:items-center lg:gap-4">
              <button
                ref={mobileTriggerRef}
                type="button"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[var(--border-default)] bg-[var(--bg-base)] text-text-primary shadow-[var(--shadow-card)] transition-all duration-300 hover:border-[var(--border-strong)] hover:text-white md:hidden"
                onClick={mobileOpen ? closeMobile : openMobile}
                aria-label={localize(shellCopy.openSidebar, locale)}
              >
                {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 md:gap-3">
                  <h1 className="app-font-display truncate text-lg font-black tracking-tight text-text-primary sm:text-2xl lg:text-3xl">
                    {resolvedTitle}
                  </h1>
                  {showLive ? <span className="live-tag text-xs font-bold">{shellText(locale, "مباشر", "Live")}</span> : null}
                </div>
                {resolvedSubtitle ? (
                  <p className="app-font-body mt-1 line-clamp-2 max-w-[52rem] text-xs text-text-secondary sm:text-sm lg:text-base">
                    {resolvedSubtitle}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2 lg:gap-3">
              {topbarActions ? <div className="hidden items-center gap-3 xl:flex">{topbarActions}</div> : null}
              <CairoTimePill />
              <div className="hidden md:block">
                <LocaleToggle />
              </div>
              <div className="relative">
                <button
                  ref={notificationsTriggerRef}
                  type="button"
                  onClick={() => setNotificationsOpen((current) => !current)}
                  className="relative flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--border-default)] bg-[var(--bg-base)] text-[var(--text-secondary)] shadow-[var(--shadow-card)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]"
                  aria-label={shellText(locale, "فتح التنبيهات", "Open alerts")}
                >
                  <Bell className="h-4.5 w-4.5" />
                  {notificationCount > 0 ? (
                    <span
                      className="absolute top-1.5 flex min-h-5 min-w-5 items-center justify-center rounded-full border border-[var(--bg-base)] bg-[var(--accent-500)] px-1 text-[10px] font-black text-[var(--text-inverse)] shadow-[var(--shadow-glow-gold)]"
                      style={edgeStyles(direction, "start", 10)}
                    >
                      {notificationCount > 9 ? "9+" : notificationCount}
                    </span>
                  ) : (
                    <span className="absolute top-3 h-2 w-2 rounded-full bg-accent-500" style={edgeStyles(direction, "start", 12)} />
                  )}
                </button>
                <NotificationsFlyout
                  open={notificationsOpen}
                  role={role}
                  pathname={pathname}
                  triggerRef={notificationsTriggerRef}
                  notifications={notifications}
                  notificationsLoading={notificationsLoading}
                  onClose={() => setNotificationsOpen(false)}
                />
              </div>
              <div className="hidden md:block">
                <ThemeToggle />
              </div>
            </div>
          </div>
          {topbarActions ? (
            <div className="flex flex-wrap gap-2 border-t border-[var(--border-default)] px-3 py-3 sm:gap-3 sm:px-4 md:px-6 xl:hidden">
              {topbarActions}
            </div>
          ) : null}
        </header>

        <main className="route-fade-in px-3 py-4 pb-[calc(8rem+env(safe-area-inset-bottom))] sm:px-4 sm:py-5 sm:pb-[calc(8rem+env(safe-area-inset-bottom))] md:px-5 md:py-6 md:pb-8 lg:px-7 lg:py-8">
          {children}
        </main>
      </div>
      <MobileQuickActionBar role={role} pathname={pathname} hidden={mobileOpen} />
    </div>
  );
}

export const appNavigation = buildNavGroups;
export const Topbar = () => null;
export const Sidebar = () => null;
export { TayyarLogo };
