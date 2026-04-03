"use client";

import React from "react";
import { MapPinned, Navigation, Plus, RotateCcw, Search, Trash2, Users } from "lucide-react";
import { Button, Card, EmptyStateCard, Input, InputWithIcon, PageShell, StatusPill, text, useLocale } from "@tayyar/ui";
import { formatLocalizedNumber } from "@tayyar/utils";
import { apiFetch } from "@/lib/api";
import MapLibreMap from "@/components/map/MapLibreMap";

type ZoneRecord = {
  id: string;
  name: string;
  nameAr?: string | null;
  boundaryWkt?: string;
  city: string;
  _count?: { supervisors?: number; heroProfiles?: number };
};

type CoordinatePoint = {
  lat: number;
  lng: number;
};

const tx = (locale: "ar" | "en", ar: string, en: string) => (locale === "ar" ? ar : en);

function polygonToWkt(points: CoordinatePoint[]) {
  if (points.length < 3) {
    return "";
  }

  const ring = [...points, points[0]].map((point) => `${point.lng} ${point.lat}`).join(",");
  return `POLYGON((${ring}))`;
}

export default function AdminZonesPage() {
  const { locale } = useLocale();
  const [zones, setZones] = React.useState<ZoneRecord[]>([]);
  const [query, setQuery] = React.useState("");
  const [newZone, setNewZone] = React.useState({ name: "", nameAr: "", city: "Cairo" });
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [status, setStatus] = React.useState<{ tone: "success" | "gold" | "neutral"; label: string } | null>(null);
  const [boundaryPoints, setBoundaryPoints] = React.useState<CoordinatePoint[]>([]);
  const [selectedPointIndex, setSelectedPointIndex] = React.useState<number | null>(null);
  const defaultCenter = React.useMemo(() => ({ lat: 30.0485, lng: 31.2335 }), []);
  const mapCenter = boundaryPoints[selectedPointIndex ?? 0] || boundaryPoints[0] || defaultCenter;
  const boundaryWkt = React.useMemo(() => polygonToWkt(boundaryPoints), [boundaryPoints]);
  const isBoundaryValid = boundaryPoints.length >= 3;

  const loadZones = React.useCallback(async () => {
    setLoading(true);
    try {
      const nextZones = await apiFetch<ZoneRecord[]>("/v1/admin/zones", undefined, "ADMIN");
      setZones(nextZones);
    } catch (error) {
      setStatus({
        tone: "gold",
        label: error instanceof Error ? error.message : tx(locale, "تعذر تحميل المناطق.", "Unable to load zones."),
      });
    } finally {
      setLoading(false);
    }
  }, [locale]);

  React.useEffect(() => {
    void loadZones();
  }, [loadZones]);

  const filtered = zones.filter((zone) =>
    `${zone.name} ${zone.nameAr || ""} ${zone.city}`.toLowerCase().includes(query.toLowerCase()),
  );

  const handleAddPoint = React.useCallback((point: CoordinatePoint) => {
    setBoundaryPoints((current) => {
      const next = [...current, point];
      setSelectedPointIndex(next.length - 1);
      return next;
    });
  }, []);

  const handleRemoveSelected = React.useCallback(() => {
    setBoundaryPoints((current) => {
      if (selectedPointIndex == null || !current[selectedPointIndex]) {
        return current;
      }

      const next = current.filter((_, index) => index !== selectedPointIndex);
      setSelectedPointIndex(next.length ? Math.min(selectedPointIndex, next.length - 1) : null);
      return next;
    });
  }, [selectedPointIndex]);

  const handleUndoLast = React.useCallback(() => {
    setBoundaryPoints((current) => {
      if (!current.length) {
        return current;
      }

      const next = current.slice(0, -1);
      setSelectedPointIndex(next.length ? Math.min(selectedPointIndex ?? next.length - 1, next.length - 1) : null);
      return next;
    });
  }, [selectedPointIndex]);

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!isBoundaryValid || !boundaryWkt) {
      setStatus({
        tone: "gold",
        label: tx(locale, "أضف 3 نقاط على الأقل قبل الحفظ.", "Add at least 3 points before saving."),
      });
      return;
    }

    setSaving(true);
    setStatus(null);
    try {
      await apiFetch(
        "/v1/admin/zones",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...newZone,
            boundaryWkt,
          }),
        },
        "ADMIN",
      );
      setNewZone({ name: "", nameAr: "", city: "Cairo" });
      setBoundaryPoints([]);
      setSelectedPointIndex(null);
      setStatus({
        tone: "success",
        label: tx(locale, "تم حفظ المنطقة.", "Zone saved."),
      });
      await loadZones();
    } catch (error) {
      setStatus({
        tone: "gold",
        label: error instanceof Error ? error.message : tx(locale, "تعذر حفظ المنطقة.", "Unable to save zone."),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageShell
      role="ADMIN"
      user={{ name: text("مدير النظام", "Platform admin"), email: "admin@tayyar.app" }}
      pageTitle={text("المناطق", "Zones")}
      pageSubtitle={text("إدارة حدود الخدمة والتغطية.", "Manage service boundaries and coverage.")}
      showLive
    >
      <div className="space-y-6 md:space-y-8">
        <section className="grid gap-5 xl:grid-cols-[minmax(0,0.88fr)_minmax(0,1.12fr)]">
          <Card variant="elevated" className="space-y-5">
            <div className="space-y-2">
              <p className="subtle-label">{tx(locale, "منطقة جديدة", "New zone")}</p>
              <h2 className="text-2xl font-black text-[var(--text-primary)]">{tx(locale, "ارسم حدود المنطقة", "Draw the zone boundary")}</h2>
              <p className="text-sm leading-7 text-[var(--text-secondary)]">
                {tx(locale, "اضغط على الخريطة لإضافة النقاط، ثم اختر أي نقطة واسحبها لتعديل الحدود.", "Tap the map to add points, then select any point and drag it to reshape the boundary.")}
              </p>
            </div>

            <form className="space-y-4" onSubmit={handleCreate}>
              <Input
                placeholder={tx(locale, "اسم المنطقة بالإنجليزية", "Zone name in English")}
                value={newZone.name}
                onChange={(event) => setNewZone({ ...newZone, name: event.target.value })}
                required
              />
              <Input
                placeholder={tx(locale, "اسم المنطقة بالعربية", "Zone name in Arabic")}
                value={newZone.nameAr}
                onChange={(event) => setNewZone({ ...newZone, nameAr: event.target.value })}
                required
              />
              <Input
                placeholder={tx(locale, "المدينة", "City")}
                value={newZone.city}
                onChange={(event) => setNewZone({ ...newZone, city: event.target.value })}
                required
              />

              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill
                    tone={isBoundaryValid ? "success" : "gold"}
                    label={isBoundaryValid ? tx(locale, "الحد جاهز للحفظ", "Boundary ready to save") : tx(locale, "أضف 3 نقاط على الأقل", "Add at least 3 points")}
                  />
                  <StatusPill
                    tone={selectedPointIndex == null ? "neutral" : "primary"}
                    label={selectedPointIndex == null ? tx(locale, "لا توجد نقطة محددة", "No point selected") : tx(locale, `النقطة ${selectedPointIndex + 1}`, `Point ${selectedPointIndex + 1}`)}
                  />
                </div>

                {status ? <StatusPill tone={status.tone} label={status.label} /> : null}

                <div className="relative overflow-hidden rounded-[20px] border border-[var(--border-default)] shadow-sm">
                  <MapLibreMap
                    center={mapCenter}
                    zoom={12}
                    editablePolygon={boundaryPoints}
                    selectedEditablePointIndex={selectedPointIndex}
                    onEditablePolygonChange={setBoundaryPoints}
                    onEditablePolygonPointSelect={setSelectedPointIndex}
                    onMapClick={handleAddPoint}
                    className="h-[22rem] w-full sm:h-[28rem]"
                  />

                  <div className="absolute left-3 top-3 z-10 flex flex-col gap-2">
                    <Button
                      type="button"
                      className="border-[var(--border-default)] bg-[var(--bg-elevated)] text-[var(--text-primary)] shadow-md hover:bg-[var(--bg-surface-2)]"
                      size="sm"
                      icon={<Plus className="h-4 w-4" />}
                      onClick={() => handleAddPoint(mapCenter)}
                    >
                      {tx(locale, "إضافة نقطة وسطية", "Center point")}
                    </Button>
                  </div>

                  <div className="pointer-events-none absolute inset-x-3 bottom-3 z-10 flex flex-wrap justify-between gap-2">
                    <div className="pointer-events-auto flex w-fit items-center gap-3 rounded-[12px] border border-[var(--border-default)] bg-[var(--bg-elevated)] px-3 py-2 shadow-md">
                      <div>
                        <p className="text-[10px] uppercase text-[var(--text-tertiary)]">{tx(locale, "النقاط", "Points")}</p>
                        <p className="font-mono text-sm font-bold text-[var(--primary-600)]">{formatLocalizedNumber(boundaryPoints.length, locale)}</p>
                      </div>
                    </div>

                    <div className="pointer-events-auto flex gap-2">
                      <Button
                        type="button"
                        className="border-[var(--border-default)] bg-[var(--bg-elevated)] text-[var(--text-primary)] shadow-md hover:bg-[var(--bg-surface-2)]"
                        size="sm"
                        disabled={selectedPointIndex == null}
                        onClick={handleRemoveSelected}
                        icon={<Trash2 className="h-4 w-4 text-[var(--danger-500)]" />}
                      />
                      <Button
                        type="button"
                        className="border-[var(--border-default)] bg-[var(--bg-elevated)] text-[var(--text-primary)] shadow-md hover:bg-[var(--bg-surface-2)]"
                        size="sm"
                        disabled={!boundaryPoints.length}
                        onClick={handleUndoLast}
                        icon={<RotateCcw className="h-4 w-4 text-[var(--primary-500)]" />}
                      >
                        {tx(locale, "تراجع", "Undo")}
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-[22px] border border-[var(--border-default)] bg-[var(--bg-surface-2)] px-4 py-4 text-sm leading-7 text-[var(--text-secondary)]">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--primary-500)] text-[var(--primary-100)] dark:text-white">
                    <Navigation className="h-3 w-3" />
                  </span>
                  {tx(locale, "النقاط البرتقالية هي رؤوس الحدود. اضغط على أي نقطة لتحديدها، ثم اسحبها لتعديل شكل المنطقة. استخدم أزرار الخريطة لتسريع الرسم.", "Orange handles are the boundary vertices. Tap any point to select it, then drag it to reshape the zone. Use the floating map tools to speed up drawing.")}
                </div>
              </div>

              <Button
                type="submit"
                variant="gold"
                fullWidth
                loading={saving}
                disabled={!isBoundaryValid}
                icon={<Plus className="h-4 w-4" />}
              >
                {saving ? tx(locale, "جارٍ الحفظ", "Saving") : tx(locale, "حفظ المنطقة", "Save zone")}
              </Button>
            </form>
          </Card>

          <div className="space-y-5">
            <Card className="space-y-4">
              <div className="space-y-1">
                <p className="subtle-label">{tx(locale, "التصفية", "Filter")}</p>
                <h2 className="text-xl font-black text-[var(--text-primary)]">{tx(locale, "المناطق الحالية", "Current zones")}</h2>
              </div>
              <div className="flex flex-col gap-3 md:flex-row md:items-center">
                <div className="min-w-0 flex-1">
                  <InputWithIcon
                    icon={<Search className="h-4 w-4" />}
                    placeholder={tx(locale, "ابحث باسم المنطقة أو المدينة", "Search by zone or city")}
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                </div>
                <Button type="button" variant="secondary" size="sm" loading={loading} icon={<RotateCcw className="h-4 w-4" />} onClick={() => void loadZones()}>
                  {tx(locale, "تحديث", "Refresh")}
                </Button>
              </div>
            </Card>

            {loading ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {Array.from({ length: 4 }).map((_, index) => (
                  <Card key={index} className="space-y-5">
                    <div className="h-6 w-36 animate-pulse rounded-xl bg-[var(--bg-surface-2)]" />
                    <div className="grid grid-cols-2 gap-3">
                      <div className="h-24 animate-pulse rounded-[20px] bg-[var(--bg-surface-2)]" />
                      <div className="h-24 animate-pulse rounded-[20px] bg-[var(--bg-surface-2)]" />
                    </div>
                  </Card>
                ))}
              </div>
            ) : filtered.length ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {filtered.map((zone) => (
                  <Card key={zone.id} className="space-y-5 border-[var(--border-default)] transition-shadow hover:shadow-[var(--shadow-lg)]">
                    <div className="flex items-start gap-3">
                      <div className="rounded-2xl bg-[var(--primary-600)] bg-opacity-10 p-3 text-[var(--primary-600)] dark:bg-[var(--primary-900)] dark:text-[var(--primary-200)]">
                        <MapPinned className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-lg font-black text-[var(--text-primary)]">{locale === "ar" ? zone.nameAr || zone.name : zone.name || zone.nameAr}</h3>
                        <p className="mt-1 text-sm text-[var(--text-secondary)]">{zone.city}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-[20px] border border-[var(--border-default)] bg-[var(--bg-surface-2)] p-4">
                        <div className="text-xs text-[var(--text-tertiary)]">{tx(locale, "الطيارون", "Heroes")}</div>
                        <div className="mt-2 inline-flex items-center gap-2 font-mono text-lg font-black text-[var(--text-primary)]">
                          <Users className="h-4 w-4 text-[var(--primary-400)]" />
                          {formatLocalizedNumber(zone._count?.heroProfiles || 0, locale)}
                        </div>
                      </div>
                      <div className="rounded-[20px] border border-[var(--border-default)] bg-[var(--bg-surface-2)] p-4">
                        <div className="text-xs text-[var(--text-tertiary)]">{tx(locale, "المشرفون", "Supervisors")}</div>
                        <div className="mt-2 inline-flex items-center gap-2 font-mono text-lg font-black text-[var(--text-primary)]">
                          <Navigation className="h-4 w-4 text-[var(--primary-400)]" />
                          {formatLocalizedNumber(zone._count?.supervisors || 0, locale)}
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <EmptyStateCard
                title={{ ar: "لا توجد مناطق مطابقة", en: "No matching zones" }}
                description={{
                  ar: "جرّب بحثًا آخر أو أنشئ منطقة جديدة من لوحة التحرير.",
                  en: "Try a different search or create a new zone from the editor.",
                }}
              />
            )}
          </div>
        </section>
      </div>
    </PageShell>
  );
}
