"use client";

import React from "react";
import { Building2, MapPin, Phone, Plus, RefreshCw } from "lucide-react";
import {
  Button,
  Card,
  EmptyStateCard,
  Input,
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
  const [creating, setCreating] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [form, setForm] = React.useState({
    name: "",
    nameAr: "",
    address: "",
    phone: "",
  });
  const [mapPoint, setMapPoint] = React.useState<{ lat: number; lng: number } | null>(null);
  const [mapReady, setMapReady] = React.useState(false);

  const loadBranches = React.useCallback(async () => {
    const data = await apiFetch<Branch[]>("/v1/merchants/branches");
    setBranches(data);
  }, []);

  React.useEffect(() => {
    loadBranches()
      .catch((nextError: Error) => setError(nextError.message))
      .finally(() => setLoading(false));
  }, [loadBranches]);

  React.useEffect(() => {
    if (mapReady || mapPoint || !branches.length) {
      return;
    }

    setMapPoint({ lat: branches[0].lat, lng: branches[0].lng });
  }, [branches, mapPoint, mapReady]);

  const mapCenter = mapPoint ?? (branches[0] ? { lat: branches[0].lat, lng: branches[0].lng } : { lat: 30.0444, lng: 31.2357 });

  function confirmMapPoint(next: { lat: number; lng: number }) {
    setMapPoint(next);
    setMapReady(true);
  }

  async function handleRefresh() {
    setRefreshing(true);
    setMessage(null);
    setError(null);
    try {
      await loadBranches();
      setMessage(tx(locale, "تم تحديث الفروع.", "Branches updated."));
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : tx(locale, "تعذر تحديث الفروع.", "Could not refresh branches."),
      );
    } finally {
      setRefreshing(false);
    }
  }

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    setCreating(true);
    setError(null);
    setMessage(null);

    try {
      if (!mapPoint || !mapReady) {
        throw new Error(tx(locale, "حدد موقع الفرع على الخريطة قبل الحفظ.", "Confirm the branch location on the map before saving."));
      }

      await apiFetch("/v1/merchants/branches", {
        method: "POST",
        body: JSON.stringify({
          name: form.name,
          nameAr: form.nameAr || undefined,
          address: form.address,
          phone: form.phone || undefined,
          lat: mapPoint.lat,
          lng: mapPoint.lng,
        }),
      });

      setForm({
        name: "",
        nameAr: "",
        address: "",
        phone: "",
      });
      setMapPoint(branches[0] ? { lat: branches[0].lat, lng: branches[0].lng } : null);
      setMapReady(false);
      await loadBranches();
      setMessage(tx(locale, "تم حفظ الفرع.", "Branch saved."));
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : tx(locale, "تعذر حفظ الفرع.", "Could not save the branch."),
      );
    } finally {
      setCreating(false);
    }
  }

  return (
    <PageShell
      role="MERCHANT_OWNER"
      user={{ name: { ar: "مالك المتجر", en: "Store owner" }, email: "owner@merchant.com" }}
      pageTitle={{ ar: "الفروع", en: "Branches" }}
      pageSubtitle={{ ar: "راجع الفروع وبيانات التشغيل.", en: "Review branches and operating details." }}
      topbarActions={
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            loading={refreshing}
            icon={<RefreshCw className="h-4 w-4" />}
            onClick={handleRefresh}
          >
            {tx(locale, "تحديث", "Refresh")}
          </Button>
          <Button
            variant="gold"
            size="sm"
            icon={<Plus className="h-4 w-4" />}
            onClick={() => document.getElementById("merchant-branch-name")?.focus()}
          >
            {tx(locale, "إضافة فرع", "Add branch")}
          </Button>
        </div>
      }
    >
      <div className="space-y-6 md:space-y-8">
        <PageHeader
          eyebrow={{ ar: "إدارة الفروع", en: "Branch control" }}
          title={{ ar: "الفروع الحالية", en: "Current branches" }}
          subtitle={{
            ar: "راجع حالة كل فرع وحدد موقع الفرع الجديد مباشرة من الخريطة.",
            en: "Review the status of each branch and set the next branch location directly on the map.",
          }}
          breadcrumbs={[
            { label: { ar: "لوحة التحكم", en: "Dashboard" }, href: "/merchant" },
            { label: { ar: "الفروع", en: "Branches" } },
          ]}
          chips={[
            { label: { ar: `${branches.length} فرع`, en: `${branches.length} branches` }, tone: "primary" },
            { label: { ar: "تأكيد الموقع على الخريطة", en: "Map-confirmed locations" }, tone: "gold" },
          ]}
        />

        {message ? <Card className="border-emerald-500/20 bg-emerald-500/10 text-emerald-100">{message}</Card> : null}
        {error ? <Card className="border-danger-500/20 bg-danger-500/10 text-red-100">{error}</Card> : null}

        <section className="panel-grid">
          <StatCard
            label={{ ar: "إجمالي الفروع", en: "Total branches" }}
            value={branches.length}
            icon={<Building2 className="h-5 w-5" />}
            loading={loading}
          />
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
            label={{ ar: "جاهزية التغطية", en: "Coverage readiness" }}
            value={branches.length ? 100 : 0}
            suffix="%"
            icon={<Building2 className="h-5 w-5" />}
            accentColor="primary"
            loading={loading}
          />
        </section>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <Card variant="elevated" className="space-y-5 xl:order-2">
            <div className="space-y-2">
              <p className="subtle-label">{tx(locale, "إضافة فرع", "Add branch")}</p>
              <h2 className="text-2xl font-black text-text-primary">{tx(locale, "بيانات الفرع", "Branch details")}</h2>
              <p className="text-sm leading-7 text-text-secondary">
                {tx(
                  locale,
                  "اكتب الاسم والعنوان ثم اضغط أو اسحب العلامة على الخريطة لاختيار موقع الفرع.",
                  "Enter the name and address, then tap or drag the pin on the map to place the branch.",
                )}
              </p>
            </div>

            <form className="space-y-4" onSubmit={handleCreate}>
              <Input
                id="merchant-branch-name"
                placeholder={tx(locale, "اسم الفرع بالإنجليزية", "Branch name")}
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                required
              />
              <Input
                placeholder={tx(locale, "اسم الفرع بالعربي", "Arabic branch name")}
                value={form.nameAr}
                onChange={(event) => setForm((current) => ({ ...current, nameAr: event.target.value }))}
              />
              <Input
                placeholder={tx(locale, "العنوان الكامل", "Full address")}
                value={form.address}
                onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))}
                required
              />
              <Input
                placeholder={tx(locale, "هاتف الفرع", "Branch phone")}
                value={form.phone}
                onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
              />

              <div className="space-y-3">
                <div className="rounded-[20px] border border-[var(--border-default)] bg-[var(--bg-surface)] px-4 py-4">
                  <div className="text-sm font-bold text-text-primary">
                    {tx(locale, "موقع الفرع على الخريطة", "Branch location on the map")}
                  </div>
                  <div className="mt-1 text-xs leading-6 text-text-secondary">
                    {tx(
                      locale,
                      "اضغط على الخريطة لتغيير الموقع بسرعة أو اسحب العلامة لتعديل أدق.",
                      "Tap the map for a quick move or drag the pin for precise adjustment.",
                    )}
                  </div>
                </div>

                <MapLibreMap
                  center={mapCenter}
                  zoom={13}
                  editablePoint={mapReady ? mapPoint : null}
                  onEditablePointChange={confirmMapPoint}
                  onMapClick={confirmMapPoint}
                  points={branches.map((branch) => ({
                    id: branch.id,
                    lat: branch.lat,
                    lng: branch.lng,
                    label: branch.name,
                    color: "#38bdf8",
                  }))}
                  className="h-[19rem] sm:h-80"
                />

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[18px] border border-[var(--border-default)] bg-[var(--bg-surface-2)] px-4 py-3">
                    <div className="text-xs text-text-tertiary">{tx(locale, "خط العرض", "Latitude")}</div>
                    <div className="mt-1 font-mono text-sm text-text-primary">
                      {mapPoint ? mapPoint.lat.toFixed(6) : tx(locale, "لم يتم التأكيد", "Not confirmed")}
                    </div>
                  </div>
                  <div className="rounded-[18px] border border-[var(--border-default)] bg-[var(--bg-surface-2)] px-4 py-3">
                    <div className="text-xs text-text-tertiary">{tx(locale, "خط الطول", "Longitude")}</div>
                    <div className="mt-1 font-mono text-sm text-text-primary">
                      {mapPoint ? mapPoint.lng.toFixed(6) : tx(locale, "لم يتم التأكيد", "Not confirmed")}
                    </div>
                  </div>
                </div>
              </div>

              <Button type="submit" variant="gold" size="lg" fullWidth loading={creating} disabled={!mapReady}>
                {tx(locale, "حفظ الفرع", "Save branch")}
              </Button>
            </form>
          </Card>

          <div className="space-y-5 xl:order-1">
            <Card className="space-y-3">
              <p className="subtle-label">{tx(locale, "شبكة الفروع", "Branch network")}</p>
              <h2 className="text-xl font-black text-text-primary">{tx(locale, "كل الفروع الحالية", "Current branches")}</h2>
              <p className="text-sm leading-7 text-text-secondary">
                {tx(
                  locale,
                  "كل بطاقة تعرض حالة الفرع ومكانه وأساسيات التشغيل بشكل مناسب للموبايل.",
                  "Each card shows the branch status, location, and core operating details in a mobile-friendly layout.",
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
                        <div className="font-bold text-text-primary">
                          {locale === "ar" ? branch.nameAr || branch.name : branch.name || branch.nameAr}
                        </div>
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
                description={{ ar: "أضف أول فرع لبدء التشغيل.", en: "Add your first branch to start operations." }}
              />
            )}
          </div>
        </section>
      </div>
    </PageShell>
  );
}
