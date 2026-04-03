"use client";

import React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowUpRight, Archive, Building2, Clock3, MapPin, Phone, RefreshCcw, Save, Store, UserRound } from "lucide-react";
import { Button, Card, EmptyStateCard, Input, PageHeader, PageShell, StatusPill, useLocale } from "@tayyar/ui";
import type { AdminBranchDetail } from "@tayyar/types";
import { apiFetch } from "@/lib/api";
import MapLibreMap from "@/components/map/MapLibreMap";
import { auditSummaryLine, localizeAlertMessage, localizeAlertTitle, localizeAuditAction } from "@/lib/ops";

const tx = (locale: "ar" | "en", ar: string, en: string) => (locale === "ar" ? ar : en);

function formatDate(value: string, locale: "ar" | "en") {
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function AdminBranchDetailPage() {
  const { locale } = useLocale();
  const params = useParams<{ id: string }>();
  const [branch, setBranch] = React.useState<AdminBranchDetail | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [archiving, setArchiving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);
  const [mapPoint, setMapPoint] = React.useState({ lat: 30.0444, lng: 31.2357 });
  const [form, setForm] = React.useState({
    name: "",
    nameAr: "",
    address: "",
    phone: "",
    whatsappNumber: "",
    managerName: "",
    managerEmail: "",
    managerPhone: "",
    isActive: true,
  });

  const loadBranch = React.useCallback(async () => {
    if (!params?.id) return;
    const data = await apiFetch<AdminBranchDetail>(`/v1/admin/branches/${params.id}`, undefined, "ADMIN");
    setBranch(data);
    setMapPoint({ lat: data.lat, lng: data.lng });
    setForm({
      name: data.name,
      nameAr: data.nameAr || "",
      address: data.address,
      phone: data.phone || "",
      whatsappNumber: data.whatsappNumber || "",
      managerName: data.manager?.name || "",
      managerEmail: data.manager?.email || "",
      managerPhone: data.manager?.phone || "",
      isActive: data.isActive,
    });
  }, [params?.id]);

  React.useEffect(() => {
    loadBranch()
      .catch((err) => setError(err instanceof Error ? err.message : tx(locale, "تعذر تحميل بيانات الفرع.", "Could not load branch details.")))
      .finally(() => setLoading(false));
  }, [loadBranch, locale]);

  React.useEffect(() => {
    if (!branch) {
      return;
    }

    const interval = window.setInterval(() => {
      setRefreshing(true);
      loadBranch().finally(() => setRefreshing(false));
    }, 30000);

    return () => window.clearInterval(interval);
  }, [branch, loadBranch]);

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    if (!params?.id) return;

    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const data = await apiFetch<AdminBranchDetail>(
        `/v1/admin/branches/${params.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...form,
            lat: mapPoint.lat,
            lng: mapPoint.lng,
          }),
        },
        "ADMIN",
      );
      setBranch(data);
      setMapPoint({ lat: data.lat, lng: data.lng });
      setMessage(tx(locale, "تم حفظ بيانات الفرع.", "Branch record saved."));
    } catch (err) {
      setError(err instanceof Error ? err.message : tx(locale, "تعذر حفظ بيانات الفرع.", "Could not save branch changes."));
    } finally {
      setSaving(false);
    }
  }

  async function handleArchiveToggle() {
    if (!params?.id || !branch) return;
    setArchiving(true);
    setError(null);
    setMessage(null);

    try {
      const data = await apiFetch<AdminBranchDetail>(
        `/v1/admin/branches/${params.id}/archive`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ archived: branch.isActive }),
        },
        "ADMIN",
      );
      setBranch(data);
      setForm((current) => ({ ...current, isActive: data.isActive }));
      setMessage(
        data.isActive
          ? tx(locale, "تمت إعادة تفعيل الفرع.", "Branch restored.")
          : tx(locale, "تمت أرشفة الفرع ومنع الإسناد الجديد عليه.", "Branch archived and blocked from new operations."),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : tx(locale, "تعذر تحديث حالة الفرع.", "Could not update branch state."));
    } finally {
      setArchiving(false);
    }
  }

  return (
    <PageShell
      role="ADMIN"
      user={{ name: { ar: "مدير المنصة", en: "Platform admin" }, email: "admin@tayyar.app" }}
      pageTitle={{ ar: "ملف الفرع", en: "Branch record" }}
      pageSubtitle={{ ar: "راجع بيانات الفرع والموقع والتنبيهات من شاشة واحدة.", en: "Review branch data, location, and alerts from one screen." }}
      showLive
      topbarActions={
        branch ? (
          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" size="sm" icon={<RefreshCcw className="h-4 w-4" />} onClick={() => {
              setRefreshing(true);
              loadBranch().finally(() => setRefreshing(false));
            }} loading={refreshing}>
              {tx(locale, "تحديث", "Refresh")}
            </Button>
            <Link href={`/admin/merchants/${branch.merchant.id}`}>
              <Button variant="secondary" size="sm" icon={<Store className="h-4 w-4" />}>
                {tx(locale, "ملف التاجر", "Merchant record")}
              </Button>
            </Link>
            <Button
              variant={branch.isActive ? "outline" : "secondary"}
              size="sm"
              icon={<Archive className="h-4 w-4" />}
              onClick={handleArchiveToggle}
              loading={archiving}
            >
              {branch.isActive ? tx(locale, "أرشفة الفرع", "Archive branch") : tx(locale, "إعادة التفعيل", "Reactivate branch")}
            </Button>
          </div>
        ) : null
      }
    >
      <div className="space-y-8">
        <PageHeader
          eyebrow={{ ar: "ملف الفرع", en: "Branch record" }}
          title={{ ar: branch?.nameAr || branch?.name || "تفاصيل الفرع", en: branch?.name || "Branch details" }}
          subtitle={{ ar: "عدّل بيانات الفرع، ثبّت موقعه على الخريطة، وراجع آخر النشاط.", en: "Edit branch data, confirm its map location, and review recent activity." }}
          breadcrumbs={[
            { label: { ar: "لوحة التحكم", en: "Dashboard" }, href: "/admin" },
            { label: { ar: "الفروع", en: "Branches" }, href: "/admin/branches" },
            { label: { ar: "ملف الفرع", en: "Branch record" } },
          ]}
          chips={branch ? [
            { label: { ar: branch.isActive ? "شغال" : "مؤرشف", en: branch.isActive ? "Active" : "Archived" }, tone: branch.isActive ? "success" : "gold" },
            { label: { ar: `${branch.stats.orders} طلب`, en: `${branch.stats.orders} orders` }, tone: "primary" },
          ] : undefined}
        />

        {message ? <Card className="border border-emerald-500/20 bg-emerald-500/10 text-sm text-emerald-100">{message}</Card> : null}
        {error ? <Card className="border border-danger-500/20 bg-danger-500/10 text-sm text-red-100">{error}</Card> : null}

        {loading ? (
          <div className="grid gap-6 xl:grid-cols-[0.88fr_1.12fr]">
            <Card className="h-72 animate-pulse bg-white/[0.04]" />
            <Card className="h-72 animate-pulse bg-white/[0.04]" />
          </div>
        ) : null}

        {!loading && !branch ? (
          <EmptyStateCard
            title={{ ar: "ملف الفرع غير موجود", en: "Branch record not found" }}
            description={{ ar: "ممكن الفرع اتحذف أو الرابط غير صحيح.", en: "The branch may have been removed or the link is invalid." }}
          />
        ) : null}

        {!loading && branch ? (
          <form className="grid gap-6 xl:grid-cols-[0.88fr_1.12fr]" onSubmit={handleSave}>
            <div className="space-y-6">
              <Card variant="elevated" className="space-y-5">
                <div>
                  <p className="subtle-label">{tx(locale, "بيانات الفرع", "Branch data")}</p>
                  <h2 className="mt-2 text-2xl font-black">{tx(locale, "عدّل بيانات الفرع", "Edit branch details")}</h2>
                </div>

                <Input placeholder={tx(locale, "اسم الفرع بالإنجليزية", "Branch name")} value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required />
                <Input placeholder={tx(locale, "اسم الفرع بالعربي", "Arabic branch name")} value={form.nameAr} onChange={(event) => setForm((current) => ({ ...current, nameAr: event.target.value }))} />
                <Input placeholder={tx(locale, "العنوان", "Address")} value={form.address} onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))} required />
                <div className="grid gap-4 md:grid-cols-2">
                  <Input placeholder={tx(locale, "هاتف الفرع", "Branch phone")} value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} />
                  <Input placeholder={tx(locale, "واتساب الفرع", "Branch WhatsApp")} value={form.whatsappNumber} onChange={(event) => setForm((current) => ({ ...current, whatsappNumber: event.target.value }))} />
                </div>

                <div className="space-y-3 rounded-[24px] border border-white/8 bg-white/[0.03] p-4">
                  <div>
                    <p className="subtle-label">{tx(locale, "موقع الفرع", "Branch location")}</p>
                    <h3 className="mt-2 text-lg font-black">{tx(locale, "ثبّت مكان الفرع على الخريطة", "Confirm branch pin on the map")}</h3>
                    <p className="mt-2 text-sm leading-7 text-text-secondary">
                      {tx(locale, "اسحب العلامة أو اضغط على الخريطة لتعديل مكان الفرع. الإحداثيات تتحدث تلقائي.", "Drag the pin or click the map to adjust the branch location. Coordinates update automatically.")}
                    </p>
                  </div>

                  <MapLibreMap center={mapPoint} zoom={14} editablePoint={mapPoint} onEditablePointChange={setMapPoint} onMapClick={setMapPoint} className="h-80" />

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-[18px] border border-white/8 bg-white/[0.03] px-4 py-3">
                      <div className="text-xs text-text-tertiary">{tx(locale, "خط العرض", "Latitude")}</div>
                      <div className="mt-1 font-mono text-sm font-bold text-text-primary">{mapPoint.lat.toFixed(6)}</div>
                    </div>
                    <div className="rounded-[18px] border border-white/8 bg-white/[0.03] px-4 py-3">
                      <div className="text-xs text-text-tertiary">{tx(locale, "خط الطول", "Longitude")}</div>
                      <div className="mt-1 font-mono text-sm font-bold text-text-primary">{mapPoint.lng.toFixed(6)}</div>
                    </div>
                  </div>
                </div>

                <div className="rounded-[24px] border border-white/8 bg-white/[0.03] p-4">
                  <p className="subtle-label">{tx(locale, "مدير الفرع", "Branch manager")}</p>
                  <div className="mt-4 grid gap-4 md:grid-cols-3">
                    <Input placeholder={tx(locale, "اسم المدير", "Manager name")} value={form.managerName} onChange={(event) => setForm((current) => ({ ...current, managerName: event.target.value }))} />
                    <Input placeholder={tx(locale, "بريد المدير", "Manager email")} value={form.managerEmail} onChange={(event) => setForm((current) => ({ ...current, managerEmail: event.target.value }))} />
                    <Input placeholder={tx(locale, "رقم المدير", "Manager phone")} value={form.managerPhone} onChange={(event) => setForm((current) => ({ ...current, managerPhone: event.target.value }))} />
                  </div>
                </div>

                <label className="flex items-center justify-between gap-3 rounded-[22px] border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-text-primary">
                  <span>{tx(locale, "الفرع شغال", "Branch is active")}</span>
                  <input type="checkbox" checked={form.isActive} onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))} className="h-4 w-4 accent-sky-500" />
                </label>

                <Button type="submit" variant="gold" size="lg" fullWidth loading={saving} icon={<Save className="h-4 w-4" />}>
                  {tx(locale, "حفظ التعديلات", "Save changes")}
                </Button>
              </Card>
            </div>

            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-3">
                <Card className="space-y-3">
                  <Store className="h-5 w-5 text-primary-300" />
                  <div className="text-xs text-text-tertiary">{tx(locale, "الطلبات", "Orders")}</div>
                  <div className="font-mono text-2xl font-black">{branch.stats.orders}</div>
                </Card>
                <Card className="space-y-3">
                  <Building2 className="h-5 w-5 text-amber-200" />
                  <div className="text-xs text-text-tertiary">{tx(locale, "العملاء", "Customers")}</div>
                  <div className="font-mono text-2xl font-black">{branch.stats.customers}</div>
                </Card>
                <Card className="space-y-3">
                  <UserRound className="h-5 w-5 text-emerald-300" />
                  <div className="text-xs text-text-tertiary">{tx(locale, "ربط الطيارين", "Hero assignments")}</div>
                  <div className="font-mono text-2xl font-black">{branch.stats.activeHeroAssignments}</div>
                </Card>
              </div>

              <Card className="space-y-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="subtle-label">{tx(locale, "الربط", "Links")}</p>
                    <h2 className="mt-2 text-2xl font-black">{tx(locale, "التاجر ومدير الفرع", "Merchant and manager")}</h2>
                  </div>
                  <Link href={`/admin/merchants/${branch.merchant.id}`} className="text-sm font-bold text-primary-300">
                    <span className="inline-flex items-center gap-2">{tx(locale, "فتح ملف التاجر", "Open merchant record")}<ArrowUpRight className="h-4 w-4" /></span>
                  </Link>
                </div>

                <div className="rounded-[22px] border border-white/8 bg-white/[0.03] p-4 text-sm text-text-secondary">
                  <div className="mb-2 text-text-primary">{branch.merchant.nameAr || branch.merchant.name}</div>
                  <div className="mb-2 inline-flex items-center gap-2"><MapPin className="h-4 w-4 text-primary-300" />{branch.address}</div>
                  <div className="inline-flex items-center gap-2"><Phone className="h-4 w-4 text-primary-300" />{branch.phone || tx(locale, "غير مسجل", "Not recorded")}</div>
                </div>

                <div className="rounded-[22px] border border-white/8 bg-white/[0.03] p-4 text-sm text-text-secondary">
                  <div className="mb-2 text-text-primary">{branch.manager?.name || tx(locale, "لا يوجد مدير معين", "No manager assigned")}</div>
                  <div>{branch.manager?.email || tx(locale, "لا يوجد بريد", "No email")}</div>
                  <div className="mt-2">{branch.manager?.phone || tx(locale, "لا يوجد رقم", "No phone")}</div>
                </div>
              </Card>

              <Card className="space-y-5">
                <div>
                  <p className="subtle-label">{tx(locale, "آخر الطلبات", "Recent orders")}</p>
                  <h2 className="mt-2 text-2xl font-black">{tx(locale, "النشاط الأخير", "Recent activity")}</h2>
                </div>
                {branch.recentOrders.length ? (
                  <div className="space-y-3">
                    {branch.recentOrders.map((order) => (
                      <div key={order.id} className="rounded-[22px] border border-white/8 bg-white/[0.03] p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-bold text-text-primary">{order.orderNumber}</div>
                            <div className="mt-1 text-sm text-text-secondary">{order.deliveryAddress}</div>
                          </div>
                          <StatusPill label={order.status} tone="primary" />
                        </div>
                        <div className="mt-3 inline-flex items-center gap-2 text-xs text-text-tertiary"><Clock3 className="h-3.5 w-3.5" />{formatDate(order.requestedAt, locale)}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-[22px] border border-dashed border-white/10 bg-white/[0.02] p-4 text-sm text-text-secondary">
                    {tx(locale, "لا توجد طلبات حديثة.", "No recent orders.")}
                  </div>
                )}
              </Card>

              <Card className="space-y-5">
                <div>
                  <p className="subtle-label">{tx(locale, "تنبيهات تشغيلية", "Operational alerts")}</p>
                  <h2 className="mt-2 text-2xl font-black">{tx(locale, "الحاجات التي تحتاج متابعة", "Items that need follow-up")}</h2>
                </div>
                {branch.alerts?.length ? (
                  <div className="space-y-3">
                    {branch.alerts.map((alert) => (
                      <div key={alert.id} className="rounded-[22px] border border-white/8 bg-white/[0.03] p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-bold text-text-primary">{localizeAlertTitle(alert, locale)}</div>
                            <div className="mt-1 text-sm text-text-secondary">{localizeAlertMessage(alert, locale)}</div>
                            {alert.actionHref ? (
                              <Link href={alert.actionHref} className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-primary-300">
                                {tx(locale, "فتح التفاصيل", "Open details")}
                                <ArrowUpRight className="h-4 w-4" />
                              </Link>
                            ) : null}
                          </div>
                          <div className="text-xs text-text-tertiary">{formatDate(alert.createdAt, locale)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-[22px] border border-dashed border-white/10 bg-white/[0.02] p-4 text-sm text-text-secondary">
                    {tx(locale, "لا توجد تنبيهات مفتوحة الآن.", "No open alerts right now.")}
                  </div>
                )}
              </Card>

              <Card className="space-y-5">
                <div>
                  <p className="subtle-label">{tx(locale, "سجل التعديلات", "Audit trail")}</p>
                  <h2 className="mt-2 text-2xl font-black">{tx(locale, "آخر التعديلات الإدارية", "Recent admin changes")}</h2>
                </div>
                {branch.auditTrail?.length ? (
                  <div className="space-y-3">
                    {branch.auditTrail.map((event) => (
                      <div key={event.id} className="rounded-[22px] border border-white/8 bg-white/[0.03] p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-bold text-text-primary">{localizeAuditAction(event.action, locale)}</div>
                            <div className="mt-1 text-sm text-text-secondary">{auditSummaryLine(event, locale)}</div>
                            <div className="mt-2 text-xs text-text-tertiary">{event.actorEmail || tx(locale, "إجراء إداري", "Admin action")}</div>
                          </div>
                          <div className="text-xs text-text-tertiary">{formatDate(event.createdAt, locale)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-[22px] border border-dashed border-white/10 bg-white/[0.02] p-4 text-sm text-text-secondary">
                    {tx(locale, "لا يوجد سجل تعديلات بعد.", "No audit events yet.")}
                  </div>
                )}
              </Card>
            </div>
          </form>
        ) : null}
      </div>
    </PageShell>
  );
}
