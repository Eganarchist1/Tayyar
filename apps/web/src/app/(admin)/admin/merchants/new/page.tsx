"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Building2, MapPin, Save, Store, User2 } from "lucide-react";
import { Button, Card, Input, PageHeader, PageShell, useLocale } from "@tayyar/ui";
import { apiFetch } from "@/lib/api";
import MapLibreMap from "@/components/map/MapLibreMap";

const tx = (locale: "ar" | "en", ar: string, en: string) => (locale === "ar" ? ar : en);

const initialForm = {
  name: "",
  nameAr: "",
  ownerName: "",
  ownerEmail: "",
  ownerPhone: "",
  logoUrl: "",
  branchName: "",
  branchNameAr: "",
  branchAddress: "",
  branchPhone: "",
  branchWhatsappNumber: "",
  managerName: "",
  managerEmail: "",
  managerPhone: "",
};

const cairoCenter = { lat: 30.0444, lng: 31.2357 };

export default function AdminMerchantOnboardingPage() {
  const { locale } = useLocale();
  const router = useRouter();
  const [form, setForm] = React.useState(initialForm);
  const [mapPoint, setMapPoint] = React.useState<{ lat: number; lng: number } | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    if (!mapPoint) {
      setSaving(false);
      setError(tx(locale, "حدد موقع الفرع على الخريطة أولًا.", "Pick the branch location on the map first."));
      return;
    }

    try {
      const result = await apiFetch<{ merchantId: string }>(
        "/v1/admin/onboarding/merchant",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...form,
            branchLat: mapPoint.lat,
            branchLng: mapPoint.lng,
          }),
        },
        "ADMIN",
      );

      router.push(`/admin/merchants/${result.merchantId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : tx(locale, "تعذر إنشاء التاجر.", "Could not create the merchant."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <PageShell
      role="ADMIN"
      user={{ name: { ar: "مدير المنصة", en: "Platform admin" }, email: "admin@tayyar.app" }}
      pageTitle={{ ar: "إضافة تاجر", en: "New merchant" }}
      pageSubtitle={{ ar: "بيانات التاجر وصاحب الحساب وأول فرع في مسار واحد.", en: "Merchant, owner, and first branch in one flow." }}
      showLive
    >
      <div className="space-y-8">
        <PageHeader
          eyebrow={{ ar: "مسار الإنشاء", en: "Onboarding flow" }}
          title={{ ar: "إضافة تاجر جديد", en: "Create a new merchant" }}
          subtitle={{ ar: "اكتب بيانات التاجر وصاحب الحساب وأول فرع. مدير الفرع اختياري.", en: "Fill merchant, owner, and first branch details. Branch manager is optional." }}
          breadcrumbs={[
            { label: { ar: "لوحة التحكم", en: "Dashboard" }, href: "/admin" },
            { label: { ar: "التجار", en: "Merchants" }, href: "/admin/merchants" },
            { label: { ar: "إضافة تاجر", en: "New merchant" } },
          ]}
          actions={
            <Button variant="outline" icon={<ArrowLeft className="h-4 w-4" />} onClick={() => router.push("/admin/merchants")}>
              {tx(locale, "رجوع", "Back")}
            </Button>
          }
        />

        {error ? <Card className="border border-danger-500/20 bg-danger-500/10 text-red-100">{error}</Card> : null}

        <form className="space-y-6" onSubmit={handleSubmit}>
          <div className="grid gap-6 xl:grid-cols-3">
            <Card variant="elevated" className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-accent-500/12 text-amber-200">
                  <Store className="h-5 w-5" />
                </div>
                <div>
                  <p className="subtle-label">{tx(locale, "التاجر", "Merchant")}</p>
                  <h2 className="text-xl font-black">{tx(locale, "بيانات النشاط", "Merchant profile")}</h2>
                </div>
              </div>
              <Input placeholder={tx(locale, "اسم التاجر بالإنجليزية", "Merchant name")} value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required />
              <Input placeholder={tx(locale, "اسم التاجر بالعربية", "Merchant Arabic name")} value={form.nameAr} onChange={(event) => setForm((current) => ({ ...current, nameAr: event.target.value }))} />
              <Input placeholder={tx(locale, "رابط الشعار", "Logo URL")} value={form.logoUrl} onChange={(event) => setForm((current) => ({ ...current, logoUrl: event.target.value }))} />
            </Card>

            <Card variant="elevated" className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-primary-500/12 text-primary-200">
                  <User2 className="h-5 w-5" />
                </div>
                <div>
                  <p className="subtle-label">{tx(locale, "صاحب الحساب", "Owner")}</p>
                  <h2 className="text-xl font-black">{tx(locale, "بيانات الدخول", "Owner account")}</h2>
                </div>
              </div>
              <Input placeholder={tx(locale, "اسم صاحب الحساب", "Owner name")} value={form.ownerName} onChange={(event) => setForm((current) => ({ ...current, ownerName: event.target.value }))} required />
              <Input placeholder={tx(locale, "بريد صاحب الحساب", "Owner email")} value={form.ownerEmail} onChange={(event) => setForm((current) => ({ ...current, ownerEmail: event.target.value }))} required />
              <Input placeholder={tx(locale, "هاتف صاحب الحساب", "Owner phone")} value={form.ownerPhone} onChange={(event) => setForm((current) => ({ ...current, ownerPhone: event.target.value }))} />
            </Card>

            <Card variant="elevated" className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-emerald-500/12 text-emerald-300">
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <p className="subtle-label">{tx(locale, "أول فرع", "First branch")}</p>
                  <h2 className="text-xl font-black">{tx(locale, "جاهزية التشغيل", "Launch branch")}</h2>
                </div>
              </div>
              <Input placeholder={tx(locale, "اسم الفرع بالإنجليزية", "Branch name")} value={form.branchName} onChange={(event) => setForm((current) => ({ ...current, branchName: event.target.value }))} required />
              <Input placeholder={tx(locale, "اسم الفرع بالعربية", "Branch Arabic name")} value={form.branchNameAr} onChange={(event) => setForm((current) => ({ ...current, branchNameAr: event.target.value }))} />
              <Input placeholder={tx(locale, "عنوان الفرع", "Branch address")} value={form.branchAddress} onChange={(event) => setForm((current) => ({ ...current, branchAddress: event.target.value }))} required />
              <div className="grid gap-3 md:grid-cols-2">
                <Input placeholder={tx(locale, "هاتف الفرع", "Branch phone")} value={form.branchPhone} onChange={(event) => setForm((current) => ({ ...current, branchPhone: event.target.value }))} />
                <Input placeholder={tx(locale, "واتساب الفرع", "Branch WhatsApp")} value={form.branchWhatsappNumber} onChange={(event) => setForm((current) => ({ ...current, branchWhatsappNumber: event.target.value }))} />
              </div>
            </Card>
          </div>

          <Card className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-white/[0.06] text-text-primary">
                <MapPin className="h-5 w-5" />
              </div>
              <div>
                <p className="subtle-label">{tx(locale, "الموقع", "Location")}</p>
                <h2 className="text-xl font-black">{tx(locale, "حدد الفرع على الخريطة", "Pick the branch on the map")}</h2>
              </div>
            </div>
            <p className="text-sm text-text-secondary">
              {tx(locale, "اضغط على الخريطة أو اسحب العلامة لتأكيد موقع الفرع. لن يتم حفظ التاجر بدون موقع مؤكد.", "Tap the map or drag the pin to confirm the branch location. The merchant will not be created without a confirmed point.")}
            </p>
            <MapLibreMap
              center={mapPoint || cairoCenter}
              zoom={13}
              editablePoint={mapPoint}
              onEditablePointChange={setMapPoint}
              onMapClick={setMapPoint}
              className="h-[360px]"
            />
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-[18px] border border-[var(--border-default)] bg-[var(--bg-surface)] px-4 py-3">
                <div className="text-xs text-text-tertiary">{tx(locale, "خط العرض", "Latitude")}</div>
                <div className="mt-1 font-mono text-sm font-bold text-text-primary">{mapPoint ? mapPoint.lat.toFixed(6) : "--"}</div>
              </div>
              <div className="rounded-[18px] border border-[var(--border-default)] bg-[var(--bg-surface)] px-4 py-3">
                <div className="text-xs text-text-tertiary">{tx(locale, "خط الطول", "Longitude")}</div>
                <div className="mt-1 font-mono text-sm font-bold text-text-primary">{mapPoint ? mapPoint.lng.toFixed(6) : "--"}</div>
              </div>
            </div>
          </Card>

          <Card className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-white/[0.06] text-text-primary">
                <MapPin className="h-5 w-5" />
              </div>
              <div>
                <p className="subtle-label">{tx(locale, "اختياري", "Optional")}</p>
                <h2 className="text-xl font-black">{tx(locale, "مدير الفرع", "Branch manager")}</h2>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <Input placeholder={tx(locale, "اسم مدير الفرع", "Manager name")} value={form.managerName} onChange={(event) => setForm((current) => ({ ...current, managerName: event.target.value }))} />
              <Input placeholder={tx(locale, "بريد مدير الفرع", "Manager email")} value={form.managerEmail} onChange={(event) => setForm((current) => ({ ...current, managerEmail: event.target.value }))} />
              <Input placeholder={tx(locale, "هاتف مدير الفرع", "Manager phone")} value={form.managerPhone} onChange={(event) => setForm((current) => ({ ...current, managerPhone: event.target.value }))} />
            </div>
          </Card>

          <div className="flex gap-3">
            <Button type="button" variant="outline" onClick={() => router.push("/admin/merchants")}>
              {tx(locale, "إلغاء", "Cancel")}
            </Button>
            <Button type="submit" variant="gold" loading={saving} icon={<Save className="h-4 w-4" />}>
              {tx(locale, "إنشاء التاجر", "Create merchant")}
            </Button>
          </div>
        </form>
      </div>
    </PageShell>
  );
}
