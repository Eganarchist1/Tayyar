"use client";

import React from "react";
import { Building2, MapPin, Phone, RefreshCw, ShieldCheck } from "lucide-react";
import {
  Button,
  Card,
  EmptyStateCard,
  PageHeader,
  PageShell,
  StatCard,
  StatusPill,
  useLocale,
} from "@tayyar/ui";
import { apiFetch } from "@/lib/api";
import MapLibreMap from "@/components/map/MapLibreMap";

type Branch = {
  id: string;
  name: string;
  nameAr?: string | null;
  address: string;
  lat: number;
  lng: number;
  phone?: string | null;
  isActive?: boolean;
};

const tx = (locale: "ar" | "en", ar: string, en: string) => (locale === "ar" ? ar : en);

export default function MerchantBranchesPage() {
  const { locale } = useLocale();
  const [branches, setBranches] = React.useState<Branch[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const loadBranches = React.useCallback(async () => {
    const data = await apiFetch<Branch[]>("/v1/merchants/branches");
    setBranches(data);
  }, []);

  React.useEffect(() => {
    loadBranches()
      .catch((nextError: Error) => setError(nextError.message))
      .finally(() => setLoading(false));
  }, [loadBranches]);

  async function handleRefresh() {
    setRefreshing(true);
    setMessage(null);
    setError(null);
    try {
      await loadBranches();
      setMessage(tx(locale, "تم تحديث الفروع.", "Branches updated."));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : tx(locale, "تعذر تحديث الفروع.", "Could not refresh branches."));
    } finally {
      setRefreshing(false);
    }
  }

  const mapCenter = branches[0] ? { lat: branches[0].lat, lng: branches[0].lng } : { lat: 30.0444, lng: 31.2357 };

  return (
    <PageShell
      role="MERCHANT_OWNER"
      user={{ name: { ar: "مالك المتجر", en: "Store owner" }, email: "owner@merchant.com" }}
      pageTitle={{ ar: "الفروع", en: "Branches" }}
      pageSubtitle={{ ar: "راجع الفروع وبيانات التشغيل.", en: "Review branches and operating details." }}
      topbarActions={
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" size="sm" loading={refreshing} icon={<RefreshCw className="h-4 w-4" />} onClick={handleRefresh}>
            {tx(locale, "تحديث", "Refresh")}
          </Button>
        </div>
      }
    >
      <div className="space-y-6 md:space-y-8">
        <PageHeader
          eyebrow={{ ar: "شبكة الفروع", en: "Branch network" }}
          title={{ ar: "الفروع الحالية", en: "Current branches" }}
          subtitle={{
            ar: "عرض فقط. إضافة الفروع الجديدة أو تعديل التغطية تتم الآن من لوحة الإدارة.",
            en: "View only. New branch creation and coverage updates are now handled from the admin panel.",
          }}
          breadcrumbs={[
            { label: { ar: "لوحة التحكم", en: "Dashboard" }, href: "/merchant" },
            { label: { ar: "الفروع", en: "Branches" } },
          ]}
          chips={[
            { label: { ar: `${branches.length} فرع`, en: `${branches.length} branches` }, tone: "primary" },
            { label: { ar: "إضافة الفروع من الإدارة", en: "Branch creation handled by admin" }, tone: "gold" },
          ]}
        />

        {message ? <Card className="border-emerald-500/20 bg-emerald-500/10 text-emerald-100">{message}</Card> : null}
        {error ? <Card className="border-danger-500/20 bg-danger-500/10 text-red-100">{error}</Card> : null}

        <section className="panel-grid">
          <StatCard label={{ ar: "إجمالي الفروع", en: "Total branches" }} value={branches.length} icon={<Building2 className="h-5 w-5" />} loading={loading} />
          <StatCard
            label={{ ar: "فروع شغالة", en: "Active branches" }}
            value={branches.filter((branch) => branch.isActive !== false).length}
            icon={<MapPin className="h-5 w-5" />}
            accentColor="success"
            loading={loading}
          />
          <StatCard
            label={{ ar: "بدون رقم", en: "Missing phone" }}
            value={branches.filter((branch) => !branch.phone).length}
            icon={<Phone className="h-5 w-5" />}
            accentColor="gold"
            loading={loading}
          />
          <StatCard
            label={{ ar: "إدارة الفروع", en: "Branch control" }}
            value={tx(locale, "من الإدارة", "Admin only")}
            icon={<ShieldCheck className="h-5 w-5" />}
            accentColor="primary"
            loading={loading}
          />
        </section>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <Card variant="elevated" className="space-y-5 xl:order-2">
            <div className="space-y-2">
              <p className="subtle-label">{tx(locale, "إدارة الفروع", "Branch management")}</p>
              <h2 className="text-2xl font-black text-text-primary">{tx(locale, "التعديل يتم من الإدارة", "Changes are handled from admin")}</h2>
              <p className="text-sm leading-7 text-text-secondary">
                {tx(
                  locale,
                  "أبقينا هذه الشاشة للعرض السريع فقط. إذا احتجت فرعًا جديدًا أو تعديلًا على الموقع أو بيانات التشغيل، استخدم لوحة الإدارة حتى تبقى التغطية والإسناد متسقين.",
                  "This screen is now view-only. If you need a new branch or a change to location or operating details, use the admin panel so coverage and dispatch stay consistent.",
                )}
              </p>
            </div>

            <div className="rounded-[20px] border border-[var(--border-default)] bg-[var(--bg-surface)] px-4 py-4">
              <div className="text-sm font-bold text-text-primary">{tx(locale, "خريطة الفروع", "Branch map")}</div>
              <div className="mt-1 text-xs leading-6 text-text-secondary">
                {tx(locale, "هذه الخريطة تعرض مواقع الفروع الحالية فقط.", "This map shows your current branch locations only.")}
              </div>
            </div>

            <MapLibreMap
              center={mapCenter}
              zoom={11}
              points={branches.map((branch) => ({
                id: branch.id,
                lat: branch.lat,
                lng: branch.lng,
                label: locale === "ar" ? branch.nameAr || branch.name : branch.name || branch.nameAr || branch.name,
                color: branch.isActive === false ? "#f59e0b" : "#38bdf8",
              }))}
              className="h-[19rem] sm:h-80"
            />
          </Card>

          <div className="space-y-5 xl:order-1">
            <Card className="space-y-3">
              <p className="subtle-label">{tx(locale, "الفروع الحالية", "Current branches")}</p>
              <h2 className="text-xl font-black text-text-primary">{tx(locale, "ملخص تشغيل الفروع", "Branch operating snapshot")}</h2>
              <p className="text-sm leading-7 text-text-secondary">
                {tx(
                  locale,
                  "كل بطاقة تعرض حالة الفرع ومكانه وأساسيات التشغيل. الإضافة الجديدة أو تعديل البيانات أصبحا من صلاحيات الإدارة فقط.",
                  "Each card shows the branch status, location, and core operating details. New creation and branch editing are now admin-only.",
                )}
              </p>
            </Card>

            {loading ? (
              <div className="grid gap-3">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="h-28 animate-pulse rounded-[24px] bg-white/[0.05]" />
                ))}
              </div>
            ) : branches.length ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {branches.map((branch) => (
                  <Card key={branch.id} className="space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-bold text-text-primary">{locale === "ar" ? branch.nameAr || branch.name : branch.name || branch.nameAr}</div>
                        <div className="mt-1 text-sm leading-6 text-text-secondary">{branch.address}</div>
                      </div>
                      <StatusPill
                        label={{ ar: branch.isActive === false ? "موقوف" : "شغال", en: branch.isActive === false ? "Inactive" : "Active" }}
                        tone={branch.isActive === false ? "gold" : "success"}
                      />
                    </div>

                    <div className="grid gap-3 text-sm text-text-secondary">
                      <div className="rounded-[18px] border border-[var(--border-default)] bg-[var(--bg-surface-2)] px-4 py-3">
                        <div className="text-xs text-text-tertiary">{tx(locale, "الهاتف", "Phone")}</div>
                        <div className="mt-1 text-text-primary">{branch.phone || tx(locale, "غير مسجل", "Not recorded")}</div>
                      </div>
                      <div className="rounded-[18px] border border-[var(--border-default)] bg-[var(--bg-surface-2)] px-4 py-3">
                        <div className="text-xs text-text-tertiary">{tx(locale, "الإحداثيات", "Coordinates")}</div>
                        <div className="mt-1 font-mono text-text-primary" dir="ltr">
                          {branch.lat.toFixed(5)}, {branch.lng.toFixed(5)}
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <EmptyStateCard
                title={{ ar: "لا توجد فروع بعد", en: "No branches yet" }}
                description={{ ar: "تواصل مع الإدارة لإضافة أول فرع والبدء في التشغيل.", en: "Contact the admin team to create the first branch and start operations." }}
              />
            )}
          </div>
        </section>
      </div>
    </PageShell>
  );
}
