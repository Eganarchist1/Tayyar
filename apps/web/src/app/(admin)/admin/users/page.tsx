"use client";

import React from "react";
import Link from "next/link";
import { Plus, Search } from "lucide-react";
import {
  Button,
  Card,
  DataTable,
  Input,
  InputWithIcon,
  PageShell,
  Sheet,
  SheetContent,
  StatusPill,
  useLocale,
} from "@tayyar/ui";
import { apiFetch } from "@/lib/api";

type UserRecord = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  role: "ADMIN" | "SUPERVISOR" | "MERCHANT_OWNER" | "BRANCH_MANAGER" | "HERO";
  adminScopes?: Array<"HEROES" | "FINANCE" | "USERS" | "MERCHANTS" | "BRANCHES" | "OPERATIONS" | "REPORTS" | "MAPS">;
  language: string;
  isActive: boolean;
  heroProfile?: {
    status?: string | null;
    zone?: { id: string; name: string; nameAr?: string | null } | null;
  } | null;
  merchantOwnership?: { id: string; name: string; nameAr?: string | null } | null;
  branchManagement?: Array<{ id: string; name: string; nameAr?: string | null; merchantName: string }>;
};

const roles = ["ALL", "ADMIN", "SUPERVISOR", "MERCHANT_OWNER", "BRANCH_MANAGER", "HERO"] as const;
const statuses = ["ALL", "ACTIVE", "INACTIVE"] as const;
const adminScopes = ["HEROES", "FINANCE", "USERS", "MERCHANTS", "BRANCHES", "OPERATIONS", "REPORTS", "MAPS"] as const;
type AdminScope = (typeof adminScopes)[number];

const tx = (locale: "ar" | "en", ar: string, en: string) => (locale === "ar" ? ar : en);

function roleLabel(locale: "ar" | "en", role: UserRecord["role"]) {
  const labels: Record<UserRecord["role"], { ar: string; en: string }> = {
    ADMIN: { ar: "مدير", en: "Admin" },
    SUPERVISOR: { ar: "مشرف", en: "Supervisor" },
    MERCHANT_OWNER: { ar: "تاجر", en: "Merchant owner" },
    BRANCH_MANAGER: { ar: "مدير فرع", en: "Branch manager" },
    HERO: { ar: "طيار", en: "Hero" },
  };
  return locale === "ar" ? labels[role].ar : labels[role].en;
}

function statusLabel(locale: "ar" | "en", active: boolean) {
  return active ? tx(locale, "نشط", "Active") : tx(locale, "موقوف", "Inactive");
}

export default function AdminUsersPage() {
  const { locale, direction } = useLocale();
  const [users, setUsers] = React.useState<UserRecord[]>([]);
  const [query, setQuery] = React.useState("");
  const [role, setRole] = React.useState<(typeof roles)[number]>("ALL");
  const [status, setStatus] = React.useState<(typeof statuses)[number]>("ALL");
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [activationUrl, setActivationUrl] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState<UserRecord | null>(null);
  const [panelOpen, setPanelOpen] = React.useState(false);
  const [form, setForm] = React.useState({
    name: "",
    email: "",
    phone: "",
    role: "MERCHANT_OWNER" as UserRecord["role"],
    adminScopes: [] as AdminScope[],
    language: "ar",
    password: "",
    isActive: true,
  });

  const activationManagedCreate = !editing && !form.password.trim();

  const loadUsers = React.useCallback(async () => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (role !== "ALL") params.set("role", role);
    if (status !== "ALL") params.set("status", status);
    const result = await apiFetch<UserRecord[]>(`/v1/admin/users${params.size ? `?${params.toString()}` : ""}`, undefined, "ADMIN");
    setUsers(result);
  }, [query, role, status]);

  React.useEffect(() => {
    loadUsers().finally(() => setLoading(false));
  }, [loadUsers]);

  React.useEffect(() => {
    const timer = window.setInterval(() => {
      setRefreshing(true);
      loadUsers().finally(() => setRefreshing(false));
    }, 30000);

    return () => window.clearInterval(timer);
  }, [loadUsers]);

  function resetForm() {
    setForm({
      name: "",
      email: "",
      phone: "",
      role: "MERCHANT_OWNER",
      adminScopes: [],
      language: locale,
      password: "",
      isActive: true,
    });
  }

  function openCreate() {
    setEditing(null);
    resetForm();
    setError(null);
    setMessage(null);
    setActivationUrl(null);
    setPanelOpen(true);
  }

  function openEdit(user: UserRecord) {
    setEditing(user);
    setForm({
      name: user.name,
      email: user.email,
      phone: user.phone || "",
      role: user.role,
      adminScopes: (user.adminScopes || []) as AdminScope[],
      language: user.language || "ar",
      password: "",
      isActive: user.isActive,
    });
    setError(null);
    setMessage(null);
    setActivationUrl(null);
    setPanelOpen(true);
  }

  function closePanel() {
    setPanelOpen(false);
    setEditing(null);
  }

  async function saveUser(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    setActivationUrl(null);

    try {
      if (editing) {
        await apiFetch(
          `/v1/admin/users/${editing.id}`,
          {
            method: "PATCH",
            body: JSON.stringify({
              ...form,
              adminScopes: form.role === "ADMIN" ? form.adminScopes : [],
              password: form.password || undefined,
            }),
          },
          "ADMIN",
        );

        setMessage(tx(locale, "تم حفظ التعديلات.", "Changes saved."));
      } else {
        const payload = await apiFetch<{ activationUrl?: string }>(
          "/v1/admin/users",
          {
            method: "POST",
            body: JSON.stringify({
              ...form,
              isActive: activationManagedCreate ? false : form.isActive,
              adminScopes: form.role === "ADMIN" ? form.adminScopes : [],
            }),
          },
          "ADMIN",
        );

        if (payload.activationUrl) {
          setActivationUrl(payload.activationUrl);
          setMessage(tx(locale, "تم إنشاء الحساب وهو بانتظار التفعيل.", "The account was created and is waiting for activation."));
        } else {
          setMessage(tx(locale, "تم إنشاء الحساب.", "The account was created."));
        }
      }

      closePanel();
      resetForm();
      await loadUsers();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : tx(locale, "تعذر حفظ المستخدم.", "Could not save user."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <PageShell
      role="ADMIN"
      user={{ name: { ar: "مدير المنصة", en: "Platform admin" }, email: "admin@tayyar.app" }}
      pageTitle={{ ar: "المستخدمون", en: "Users" }}
      pageSubtitle={{ ar: "الحسابات والأدوار وحالة التفعيل.", en: "Accounts, roles, and activation state." }}
      topbarActions={
        <Button variant="gold" size="sm" icon={<Plus className="h-4 w-4" />} onClick={openCreate}>
          {tx(locale, "إضافة مستخدم", "Add User")}
        </Button>
      }
    >
      <div className="grid gap-6 xl:grid-cols-[0.34fr_1fr]">
        <Card className="space-y-4">
          <div>
            <div className="subtle-label">{tx(locale, "التصفية", "Filters")}</div>
            <div className="mt-2 text-xl font-black">{tx(locale, "البحث والحالة", "Search & Status")}</div>
          </div>

          <InputWithIcon
            icon={<Search className="h-4 w-4" />}
            placeholder={tx(locale, "ابحث بالاسم أو البريد أو الهاتف", "Search by name, email, or phone")}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />

          <div className="grid gap-2">
            {roles.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setRole(item)}
                className={
                  role === item
                    ? "rounded-[18px] border border-[var(--primary-500)] bg-[var(--primary-600)] bg-opacity-10 px-4 py-3 text-sm font-bold text-[var(--primary-600)]"
                    : "rounded-[18px] border border-[var(--border-default)] bg-[var(--bg-surface)] px-4 py-3 text-sm font-bold text-[var(--text-secondary)] hover:bg-[var(--bg-surface-2)]"
                }
              >
                {item === "ALL" ? tx(locale, "كل الأدوار", "All roles") : roleLabel(locale, item)}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-2">
            {statuses.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setStatus(item)}
                className={
                  status === item
                    ? "rounded-[18px] border border-[var(--primary-500)] bg-[var(--primary-600)] bg-opacity-10 px-3 py-3 text-xs font-bold text-[var(--primary-600)]"
                    : "rounded-[18px] border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-3 text-xs font-bold text-[var(--text-secondary)] hover:bg-[var(--bg-surface-2)]"
                }
              >
                {item === "ALL"
                  ? tx(locale, "الكل", "All")
                  : item === "ACTIVE"
                    ? tx(locale, "نشط", "Active")
                    : tx(locale, "موقوف", "Inactive")}
              </button>
            ))}
          </div>

          <Button
            variant="secondary"
            onClick={() => {
              setRefreshing(true);
              loadUsers().finally(() => setRefreshing(false));
            }}
            loading={loading || refreshing}
          >
            {tx(locale, "تحديث القائمة", "Refresh List")}
          </Button>
        </Card>

        <div className="space-y-4">
          {message ? (
            <Card className="text-sm text-[var(--text-secondary)] border-[var(--success-500)] border bg-[var(--success-50)]">
              {message}
              {activationUrl ? (
                <div className="mt-3 break-all">
                  <Link href={activationUrl} className="font-bold text-[var(--primary-600)]">
                    {activationUrl}
                  </Link>
                </div>
              ) : null}
            </Card>
          ) : null}

          {error ? (
            <Card className="border border-[var(--danger-500)] bg-[var(--danger-50)] text-sm text-[var(--danger-600)]">
              {error}
            </Card>
          ) : null}

          <Card className="p-0 overflow-hidden border border-[var(--border-default)]">
            <DataTable
              data={users}
              keyExtractor={(item) => item.id}
              onRowClick={openEdit}
              emptyMessage={tx(locale, "لا توجد حسابات مطابقة.", "No matching accounts.")}
              columns={[
                {
                  key: "userInfo",
                  header: tx(locale, "المستخدم", "User"),
                  cell: (item: UserRecord) => (
                    <div className="min-w-[150px]">
                      <div className="font-bold text-[var(--text-primary)] truncate max-w-[200px]">{item.name}</div>
                      <div className="text-xs text-[var(--text-secondary)] mt-0.5 truncate max-w-[200px]">{item.email}</div>
                      <div className="text-xs text-[var(--text-tertiary)] mt-0.5">
                        {item.phone || tx(locale, "لا يوجد رقم", "No phone")}
                      </div>
                    </div>
                  ),
                },
                {
                  key: "role",
                  header: tx(locale, "الدور", "Role"),
                  cell: (item: UserRecord) => <StatusPill label={roleLabel(locale, item.role)} tone="primary" />,
                },
                {
                  key: "status",
                  header: tx(locale, "حالة التفعيل", "Status"),
                  cell: (item: UserRecord) => (
                    <StatusPill
                      label={{ ar: statusLabel("ar", item.isActive), en: statusLabel("en", item.isActive) }}
                      tone={item.isActive ? "success" : "gold"}
                    />
                  ),
                },
                {
                  key: "details",
                  header: tx(locale, "تفاصيل إضافية", "Details"),
                  cell: (item: UserRecord) => {
                    if (item.heroProfile?.zone) {
                      return (
                        <span className="text-xs font-bold text-[var(--text-secondary)] bg-[var(--bg-surface-2)] px-2 py-1 rounded-full">
                          {locale === "ar" ? item.heroProfile.zone.nameAr || item.heroProfile.zone.name : item.heroProfile.zone.name || item.heroProfile.zone.nameAr}
                        </span>
                      );
                    }

                    if (item.merchantOwnership) {
                      return (
                        <span className="text-xs font-bold text-[var(--text-secondary)] bg-[var(--bg-surface-2)] px-2 py-1 rounded-full">
                          {tx(locale, "تاجر مرتبط", "Attached merchant")}
                        </span>
                      );
                    }

                    if (item.branchManagement?.length) {
                      return (
                        <span className="text-xs font-bold text-[var(--text-secondary)] bg-[var(--bg-surface-2)] px-2 py-1 rounded-full">
                          {item.branchManagement.length} {tx(locale, "فروع", "branches")}
                        </span>
                      );
                    }

                    return <span className="text-xs text-[var(--text-tertiary)]">--</span>;
                  },
                },
              ]}
              mobileCardContent={(item: UserRecord) => (
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-bold text-[var(--text-primary)] text-base truncate">{item.name}</div>
                      <div className="text-xs text-[var(--text-secondary)] mt-1 truncate">{item.email}</div>
                    </div>
                    <StatusPill
                      label={{ ar: statusLabel("ar", item.isActive), en: statusLabel("en", item.isActive) }}
                      tone={item.isActive ? "success" : "gold"}
                    />
                  </div>
                  <div className="flex items-center justify-between border-t border-[var(--border-default)] pt-3 mt-3">
                    <StatusPill label={roleLabel(locale, item.role)} tone="primary" />
                    <span className="text-xs font-mono text-[var(--text-secondary)]">
                      {item.phone || tx(locale, "بدون هاتف", "No phone")}
                    </span>
                  </div>
                </div>
              )}
            />
          </Card>
        </div>
      </div>

      <Sheet
        open={panelOpen}
        onOpenChange={(open: boolean) => {
          if (!open) closePanel();
          else setPanelOpen(open);
        }}
      >
        <SheetContent
          side={direction === "rtl" ? "left" : "right"}
          className="w-full max-w-2xl sm:max-w-2xl p-2 sm:p-4 bg-transparent border-none shadow-none flex flex-col pt-[var(--safe-area-top)] pb-[var(--safe-area-bottom)] !duration-500"
        >
          <Card variant="elevated" className="flex h-full flex-col overflow-hidden shadow-[var(--shadow-2xl)]">
            <div className="flex items-start justify-between gap-3 border-b border-[var(--border-default)] pb-5">
              <div>
                <div className="subtle-label">{editing ? tx(locale, "تعديل", "Edit") : tx(locale, "إضافة", "Create")}</div>
                <div className="mt-2 text-[clamp(1.55rem,2vw,2.1rem)] font-black text-[var(--text-primary)]">
                  {editing ? tx(locale, "بيانات المستخدم", "User details") : tx(locale, "مستخدم جديد", "New user")}
                </div>
                <div className="mt-2 text-sm text-[var(--text-secondary)]">
                  {editing
                    ? tx(locale, "حدّث الاسم والدور وحالة الحساب من هنا.", "Update the profile, role, and account state here.")
                    : tx(locale, "أنشئ حسابًا جديدًا وجهّز تفعيله للاختبار.", "Create a new account and prepare it for activation.")}
                </div>
              </div>
            </div>

            <form className="flex-1 space-y-5 overflow-y-auto pt-5" onSubmit={saveUser}>
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  name="name"
                  placeholder={tx(locale, "الاسم", "Name")}
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  autoComplete="name"
                  required
                />
                <Input
                  name="phone"
                  type="tel"
                  inputMode="tel"
                  placeholder={tx(locale, "رقم الموبايل", "Phone")}
                  value={form.phone}
                  onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                  autoComplete="tel"
                />
                <Input
                  name="email"
                  type="email"
                  placeholder={tx(locale, "البريد الإلكتروني", "Email")}
                  value={form.email}
                  onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                  autoComplete="email"
                  spellCheck={false}
                  required
                />
                <Input
                  name="password"
                  type="password"
                  placeholder={editing ? tx(locale, "اتركها فارغة إذا لن تغيرها", "Leave blank to keep it") : tx(locale, "كلمة المرور", "Password")}
                  value={form.password}
                  onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                  autoComplete="new-password"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-2">
                  <span className="subtle-label">{tx(locale, "الدور", "Role")}</span>
                  <select
                    className="h-12 w-full rounded-[18px] border border-[var(--border-default)] bg-[var(--bg-surface)] px-4 text-sm text-[var(--text-primary)]"
                    value={form.role}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        role: event.target.value as UserRecord["role"],
                        adminScopes: event.target.value === "ADMIN" ? current.adminScopes : [],
                      }))
                    }
                  >
                    {roles
                      .filter((item) => item !== "ALL")
                      .map((item) => (
                        <option key={item} value={item}>
                          {roleLabel(locale, item)}
                        </option>
                      ))}
                  </select>
                </label>

                <label className="space-y-2">
                  <span className="subtle-label">{tx(locale, "اللغة", "Language")}</span>
                  <select
                    className="h-12 w-full rounded-[18px] border border-[var(--border-default)] bg-[var(--bg-surface)] px-4 text-sm text-[var(--text-primary)]"
                    value={form.language}
                    onChange={(event) => setForm((current) => ({ ...current, language: event.target.value }))}
                  >
                    <option value="ar">{tx(locale, "العربية", "Arabic")}</option>
                    <option value="en">English</option>
                  </select>
                </label>
              </div>

              {form.role === "ADMIN" ? (
                <div className="space-y-3 rounded-[20px] border border-[var(--border-default)] bg-[var(--bg-surface-2)] p-4">
                  <div>
                    <div className="subtle-label">{tx(locale, "صلاحيات الإدارة", "Admin scopes")}</div>
                    <div className="mt-1 text-sm text-[var(--text-secondary)]">
                      {tx(locale, "حدد المساحات التي يمكن لهذا المدير العمل عليها دون منحه كل شيء.", "Choose which admin areas this account can access without granting everything.")}
                    </div>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {adminScopes.map((scope) => {
                      const checked = form.adminScopes.includes(scope);
                      return (
                        <button
                          key={scope}
                          type="button"
                          onClick={() =>
                            setForm((current) => ({
                              ...current,
                              adminScopes: checked
                                ? current.adminScopes.filter((item) => item !== scope)
                                : [...current.adminScopes, scope],
                            }))
                          }
                          className={
                            checked
                              ? "rounded-[16px] border border-[var(--primary-500)] bg-[var(--primary-600)] bg-opacity-10 px-4 py-3 text-sm font-bold text-[var(--primary-600)]"
                              : "rounded-[16px] border border-[var(--border-default)] bg-[var(--bg-surface)] px-4 py-3 text-sm font-bold text-[var(--text-secondary)]"
                          }
                        >
                          {scope}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {!editing ? (
                <div className="rounded-[18px] border border-[var(--border-default)] bg-[var(--bg-surface-2)] px-4 py-3 text-xs text-[var(--text-secondary)]">
                  {form.role === "HERO"
                    ? tx(
                        locale,
                        "إنشاء الطيار من هنا سيجهز حساب المستخدم ويظهر مباشرة في شاشة الطيارين لاستكمال المستندات والتكليف.",
                        "Creating a hero here prepares the linked account and makes it immediately editable from the Heroes screen.",
                      )
                    : tx(
                        locale,
                        "إذا تركت كلمة المرور فارغة، سيتم إنشاء حساب غير مفعل وتجهيز وصلة التفعيل.",
                        "If you leave the password blank, the account will be created inactive and an activation link will be prepared.",
                      )}
                </div>
              ) : null}

              <button
                type="button"
                disabled={activationManagedCreate}
                onClick={() => setForm((current) => ({ ...current, isActive: !current.isActive }))}
                className={`flex w-full items-center justify-between rounded-[18px] border px-4 py-3 text-sm font-bold ${
                  form.isActive
                    ? "border-[var(--success-500)] bg-[var(--success-100)] text-[var(--success-700)] dark:border-[var(--success-600)] dark:bg-[var(--success-900)] dark:text-[var(--success-100)]"
                    : "border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--text-secondary)]"
                } ${activationManagedCreate ? "cursor-not-allowed opacity-70" : ""}`}
              >
                <span>{tx(locale, "حالة الحساب", "Account status")}</span>
                <span>{statusLabel(locale, activationManagedCreate ? false : form.isActive)}</span>
              </button>

              {activationManagedCreate ? (
                <div className="rounded-[18px] border border-[var(--border-default)] bg-[var(--bg-surface-2)] px-4 py-3 text-xs text-[var(--text-secondary)]">
                  {tx(
                    locale,
                    "بدون كلمة مرور سيُنشأ الحساب غير مفعل تلقائيًا، ثم تُجهّز وصلة التفعيل.",
                    "Without a password, the account is created inactive automatically and an activation link is prepared.",
                  )}
                </div>
              ) : null}

              <div className="sticky bottom-0 flex gap-3 border-t border-[var(--border-default)] bg-[var(--bg-base)] py-4">
                <Button type="button" variant="secondary" fullWidth onClick={closePanel}>
                  {tx(locale, "إغلاق", "Close")}
                </Button>
                <Button type="submit" variant="gold" fullWidth loading={saving}>
                  {editing ? tx(locale, "حفظ التعديلات", "Save Changes") : tx(locale, "إنشاء المستخدم", "Create User")}
                </Button>
              </div>
            </form>
          </Card>
        </SheetContent>
      </Sheet>
    </PageShell>
  );
}
