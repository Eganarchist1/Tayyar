import type { LocalizedText } from "./locale-context";

export type AppRole = "ADMIN" | "SUPERVISOR" | "MERCHANT_OWNER" | "BRANCH_MANAGER";

export type NavigationIconKey =
  | "dashboard"
  | "orders"
  | "rocket"
  | "branches"
  | "heroes"
  | "customers"
  | "wallet"
  | "settings"
  | "map"
  | "reports"
  | "finance"
  | "invoices"
  | "alerts"
  | "users";

export type AppRouteMeta = {
  href: string;
  role: AppRole;
  navLabel: LocalizedText;
  title: LocalizedText;
  subtitle: LocalizedText;
  icon: NavigationIconKey;
  group?: LocalizedText;
  exact?: boolean;
};

const text = (ar: string, en: string): LocalizedText => ({ ar, en });

export const appRoutes: AppRouteMeta[] = [
  {
    href: "/admin",
    role: "ADMIN",
    navLabel: text("لوحة التحكم", "Dashboard"),
    title: text("لوحة تحكم المنصة", "Platform dashboard"),
    subtitle: text("التشغيل والتنبيهات وحالة المنصة.", "Operations, alerts, and platform health."),
    icon: "dashboard",
    group: text("المنصة", "Platform"),
    exact: true,
  },
  {
    href: "/admin/map",
    role: "ADMIN",
    navLabel: text("الخريطة المباشرة", "Live map"),
    title: text("الخريطة المباشرة", "Live map"),
    subtitle: text("حركة الطلبات والطيارين.", "Live order and hero movement."),
    icon: "map",
    group: text("المنصة", "Platform"),
  },
  {
    href: "/admin/orders",
    role: "ADMIN",
    navLabel: text("الطلبات", "Orders"),
    title: text("إدارة الطلبات", "Order operations"),
    subtitle: text("حالة الطلبات والإجراء التالي.", "Order status and next action."),
    icon: "orders",
    group: text("المنصة", "Platform"),
  },
  {
    href: "/admin/heroes",
    role: "ADMIN",
    navLabel: text("الطيارين", "Heroes"),
    title: text("إدارة الطيارين", "Hero operations"),
    subtitle: text("الجاهزية والحمل الحالي.", "Readiness and current load."),
    icon: "heroes",
    group: text("المنصة", "Platform"),
  },
  {
    href: "/admin/merchants",
    role: "ADMIN",
    navLabel: text("التجار", "Merchants"),
    title: text("حسابات التجار", "Merchant accounts"),
    subtitle: text("بيانات التجار وحالة التشغيل.", "Merchant accounts and operating status."),
    icon: "branches",
    group: text("المنصة", "Platform"),
  },
  {
    href: "/admin/branches",
    role: "ADMIN",
    navLabel: text("الفروع", "Branches"),
    title: text("إدارة الفروع", "Branch management"),
    subtitle: text("الفروع والمديرون والجاهزية.", "Branches, managers, and readiness."),
    icon: "branches",
    group: text("المنصة", "Platform"),
  },
  {
    href: "/admin/users",
    role: "ADMIN",
    navLabel: text("المستخدمون", "Users"),
    title: text("إدارة المستخدمين", "User management"),
    subtitle: text("الحسابات والأدوار وحالة التفعيل.", "Accounts, roles, and activation state."),
    icon: "users",
    group: text("المنصة", "Platform"),
  },
  {
    href: "/admin/customers",
    role: "ADMIN",
    navLabel: text("العملاء", "Customers"),
    title: text("قاعدة العملاء", "Customer base"),
    subtitle: text("بحث وتعديل بيانات العملاء.", "Search and edit customer records."),
    icon: "customers",
    group: text("المنصة", "Platform"),
  },
  {
    href: "/admin/zones",
    role: "ADMIN",
    navLabel: text("المناطق", "Zones"),
    title: text("المناطق التشغيلية", "Operating zones"),
    subtitle: text("التغطية والضغط والجاهزية.", "Coverage, load, and readiness."),
    icon: "map",
    group: text("المنصة", "Platform"),
  },
  {
    href: "/admin/invoices",
    role: "ADMIN",
    navLabel: text("الفواتير", "Invoices"),
    title: text("فواتير المنصة", "Invoices"),
    subtitle: text("الفواتير والتحصيلات.", "Invoices and collections."),
    icon: "invoices",
    group: text("المالية", "Finance"),
  },
  {
    href: "/admin/payouts",
    role: "ADMIN",
    navLabel: text("المدفوعات", "Payouts"),
    title: text("مدفوعات الطيارين", "Hero payouts"),
    subtitle: text("طلبات السحب والتسويات.", "Withdrawal requests and settlements."),
    icon: "wallet",
    group: text("المالية", "Finance"),
  },
  {
    href: "/admin/finance",
    role: "ADMIN",
    navLabel: text("المالية", "Finance"),
    title: text("الصورة المالية", "Financial overview"),
    subtitle: text("الرصيد والحركة والإيراد.", "Balances, movement, and revenue."),
    icon: "finance",
    group: text("المالية", "Finance"),
  },
  {
    href: "/admin/reports",
    role: "ADMIN",
    navLabel: text("التقارير", "Reports"),
    title: text("التقارير", "Reports"),
    subtitle: text("تقارير الأداء والمالية.", "Performance and finance reports."),
    icon: "reports",
    group: text("المالية", "Finance"),
  },
  {
    href: "/admin/settings",
    role: "ADMIN",
    navLabel: text("الإعدادات", "Settings"),
    title: text("إعدادات المنصة", "Platform settings"),
    subtitle: text("الإعدادات الأساسية والحسابات.", "Core settings and accounts."),
    icon: "settings",
    group: text("المالية", "Finance"),
  },
  {
    href: "/supervisor/map",
    role: "SUPERVISOR",
    navLabel: text("الخريطة المباشرة", "Live map"),
    title: text("لوحة الإشراف", "Supervisor console"),
    subtitle: text("الطلبات والحركة داخل المنطقة.", "Zone activity and orders needing action."),
    icon: "map",
    group: text("الإشراف", "Supervisor"),
    exact: true,
  },
  {
    href: "/supervisor/orders",
    role: "SUPERVISOR",
    navLabel: text("الطلبات النشطة", "Active orders"),
    title: text("الطلبات النشطة", "Active orders"),
    subtitle: text("الطلبات التي تحتاج متابعة.", "Orders that need attention."),
    icon: "orders",
    group: text("الإشراف", "Supervisor"),
  },
  {
    href: "/supervisor/heroes",
    role: "SUPERVISOR",
    navLabel: text("الطيارين", "Heroes"),
    title: text("الطيارين", "Heroes"),
    subtitle: text("الطيارون المتاحون وحالات الدعم.", "Available heroes and support cases."),
    icon: "heroes",
    group: text("الإشراف", "Supervisor"),
  },
  {
    href: "/supervisor/alerts",
    role: "SUPERVISOR",
    navLabel: text("التنبيهات", "Alerts"),
    title: text("التنبيهات", "Alerts"),
    subtitle: text("التنبيهات والحالات المفتوحة.", "Alerts and open cases."),
    icon: "alerts",
    group: text("الإشراف", "Supervisor"),
  },
  {
    href: "/merchant",
    role: "MERCHANT_OWNER",
    navLabel: text("لوحة التحكم", "Dashboard"),
    title: text("لوحة التحكم", "Merchant dashboard"),
    subtitle: text("الطلبات والرصيد والفواتير.", "Orders, balance, and billing."),
    icon: "dashboard",
    group: text("التاجر", "Merchant"),
    exact: true,
  },
  {
    href: "/merchant/orders/new",
    role: "MERCHANT_OWNER",
    navLabel: text("طلب جديد", "New order"),
    title: text("طلب جديد", "New order"),
    subtitle: text("إنشاء طلب جديد.", "Create a new order."),
    icon: "rocket",
    group: text("التاجر", "Merchant"),
  },
  {
    href: "/merchant/orders",
    role: "MERCHANT_OWNER",
    navLabel: text("الطلبات", "Orders"),
    title: text("الطلبات", "Orders"),
    subtitle: text("كل الطلبات وحالتها.", "All orders and their current status."),
    icon: "orders",
    group: text("التاجر", "Merchant"),
  },
  {
    href: "/merchant/customers",
    role: "MERCHANT_OWNER",
    navLabel: text("العملاء", "Customers"),
    title: text("عملاء المتجر", "Store customers"),
    subtitle: text("بيانات العملاء والعناوين.", "Customer records and saved addresses."),
    icon: "customers",
    group: text("التاجر", "Merchant"),
  },
  {
    href: "/merchant/branches",
    role: "MERCHANT_OWNER",
    navLabel: text("الفروع", "Branches"),
    title: text("فروع المتجر", "Store branches"),
    subtitle: text("بيانات الفروع والتشغيل.", "Branch details and operating setup."),
    icon: "branches",
    group: text("التاجر", "Merchant"),
  },
  {
    href: "/merchant/heroes",
    role: "MERCHANT_OWNER",
    navLabel: text("الطيارين", "Heroes"),
    title: text("فريق التوصيل", "Delivery team"),
    subtitle: text("فريق التوصيل المرتبط بمتجرك.", "The delivery team assigned to your store."),
    icon: "heroes",
    group: text("التاجر", "Merchant"),
  },
  {
    href: "/merchant/invoices",
    role: "MERCHANT_OWNER",
    navLabel: text("الفواتير والرصيد", "Billing"),
    title: text("الفواتير والرصيد", "Billing"),
    subtitle: text("الرصيد والحركة والفواتير.", "Balance, transactions, and invoices."),
    icon: "wallet",
    group: text("التاجر", "Merchant"),
  },
  {
    href: "/merchant/settings",
    role: "MERCHANT_OWNER",
    navLabel: text("الإعدادات", "Settings"),
    title: text("إعدادات المتجر", "Store settings"),
    subtitle: text("بيانات المتجر والحساب.", "Store and account settings."),
    icon: "settings",
    group: text("التاجر", "Merchant"),
  },
  {
    href: "/branch/orders",
    role: "BRANCH_MANAGER",
    navLabel: text("طلبات الفرع", "Branch orders"),
    title: text("طلبات الفرع", "Branch orders"),
    subtitle: text("طلبات الفرع وحالتها.", "Branch orders and status."),
    icon: "orders",
    group: text("الفرع", "Branch"),
    exact: true,
  },
];

export function getRoutesForRole(role: AppRole) {
  return appRoutes.filter((route) => route.role === role);
}

export function findRouteMeta(pathname: string, role?: AppRole) {
  const candidates = appRoutes
    .filter((route) => (!role || route.role === role) && (route.exact ? pathname === route.href : pathname === route.href || pathname.startsWith(`${route.href}/`)))
    .sort((left, right) => right.href.length - left.href.length);

  return candidates[0] || null;
}
