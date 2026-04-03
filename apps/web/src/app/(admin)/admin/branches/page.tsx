"use client";

import React from "react";
import { Archive, MapPin, Phone, Plus, RotateCcw, Search, Store, User2 } from "lucide-react";
import { Button, Card, DataTable, Input, InputWithIcon, PageShell, Sheet, SheetContent, StatusPill, useLocale } from "@tayyar/ui";
import { apiFetch } from "@/lib/api";
import MapLibreMap from "@/components/map/MapLibreMap";

type MerchantOption = {
  id: string;
  name: string;
  nameAr?: string | null;
};

type BranchRecord = {
  id: string;
  name: string;
  nameAr?: string | null;
  address: string;
  lat: number;
  lng: number;
  phone?: string | null;
  whatsappNumber?: string | null;
  isActive: boolean;
  orderCount: number;
  activeHeroAssignments: number;
  merchant: {
    id: string;
    name: string;
    nameAr?: string | null;
    owner?: {
      name?: string | null;
      email?: string | null;
      phone?: string | null;
    } | null;
  };
  manager?: {
    id: string;
    name?: string | null;
    email?: string | null;
    phone?: string | null;
  } | null;
};

const initialForm = {
  merchantId: "",
  name: "",
  nameAr: "",
  address: "",
  phone: "",
  whatsappNumber: "",
  managerName: "",
  managerEmail: "",
  managerPhone: "",
};

const cairoCenter = { lat: 30.0444, lng: 31.2357 };
const tx = (locale: "ar" | "en", ar: string, en: string) => (locale === "ar" ? ar : en);
const pickLabel = (locale: "ar" | "en", ar?: string | null, en?: string | null) => (locale === "ar" ? ar || en || "--" : en || ar || "--");

export default function AdminBranchesPage() {
  const { locale, direction } = useLocale();
  const [branches, setBranches] = React.useState<BranchRecord[]>([]);
  const [merchants, setMerchants] = React.useState<MerchantOption[]>([]);
  const [query, setQuery] = React.useState("");
  const [merchantFilter, setMerchantFilter] = React.useState("ALL");
  const [statusFilter, setStatusFilter] = React.useState<"ACTIVE" | "ARCHIVED">("ACTIVE");
  const [isAdding, setIsAdding] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);
  const [togglingId, setTogglingId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [feedback, setFeedback] = React.useState<string | null>(null);
  const [form, setForm] = React.useState(initialForm);
  const [mapPoint, setMapPoint] = React.useState<{ lat: number; lng: number } | null>(null);

  const loadData = React.useCallback(() => {
    return Promise.all([
      apiFetch<BranchRecord[]>(`/v1/admin/branches?status=${statusFilter}`, undefined, "ADMIN"),
      apiFetch<MerchantOption[]>("/v1/admin/merchants?status=ACTIVE", undefined, "ADMIN"),
    ]).then(([branchesData, merchantsData]) => {
      setBranches(branchesData);
      setMerchants(merchantsData);
      setForm((current) => ({
        ...current,
        merchantId: current.merchantId || merchantsData[0]?.id || "",
      }));
    });
  }, [statusFilter]);

  React.useEffect(() => {
    void loadData();
  }, [loadData]);

  React.useEffect(() => {
    const interval = window.setInterval(() => {
      setRefreshing(true);
      loadData().finally(() => setRefreshing(false));
    }, 30000);

    return () => window.clearInterval(interval);
  }, [loadData]);

  const filteredBranches = branches.filter((branch) => {
    const haystack = [
      branch.name,
      branch.nameAr || "",
      branch.address,
      branch.merchant.name,
      branch.merchant.nameAr || "",
      branch.manager?.name || "",
    ]
      .join(" ")
      .toLowerCase();

    const matchesQuery = haystack.includes(query.toLowerCase());
    const matchesMerchant = merchantFilter === "ALL" || branch.merchant.id === merchantFilter;
    return matchesQuery && matchesMerchant;
  });

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSaving(true);
    setError(null);

    if (!mapPoint) {
      setIsSaving(false);
      setError(tx(locale, "حدد موقع الفرع على الخريطة أولًا.", "Pick the branch location on the map first."));
      return;
    }

    try {
      await apiFetch(
        "/v1/admin/branches",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            merchantId: form.merchantId,
            name: form.name,
            nameAr: form.nameAr || undefined,
            address: form.address,
            phone: form.phone || undefined,
            whatsappNumber: form.whatsappNumber || undefined,
            lat: mapPoint.lat,
            lng: mapPoint.lng,
            managerName: form.managerName || undefined,
            managerEmail: form.managerEmail || undefined,
            managerPhone: form.managerPhone || undefined,
          }),
        },
        "ADMIN",
      );

      setIsAdding(false);
      setMapPoint(null);
      setForm({
        ...initialForm,
        merchantId: merchants[0]?.id || "",
      });
      setFeedback(tx(locale, "تم حفظ الفرع الجديد بنجاح.", "The new branch was saved successfully."));
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : tx(locale, "تعذر إنشاء الفرع.", "Could not create branch."));
    } finally {
      setIsSaving(false);
    }
  };

  async function toggleBranchArchive(branch: BranchRecord, archived: boolean) {
    setTogglingId(branch.id);
    setError(null);
    setFeedback(null);
    try {
      await apiFetch(
        `/v1/admin/branches/${branch.id}/archive`,
        {
          method: "PATCH",
          body: JSON.stringify({ archived }),
        },
        "ADMIN",
      );
      await loadData();
      setFeedback(
        archived
          ? tx(locale, "تمت أرشفة الفرع وإبعاده عن التشغيل النشط.", "Branch archived and removed from active operations.")
          : tx(locale, "تمت إعادة تفعيل الفرع.", "Branch reactivated."),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : tx(locale, "تعذر تحديث حالة الفرع.", "Could not update branch state."));
    } finally {
      setTogglingId(null);
    }
  }

  return (
    <PageShell
      role="ADMIN"
      user={{ name: { ar: "مدير المنصة", en: "Platform admin" }, email: "admin@tayyar.app" }}
      pageTitle={{ ar: "الفروع", en: "Branches" }}
      pageSubtitle={{ ar: "إدارة فروع التجار ومديري الفروع.", en: "Manage merchant branches and branch managers." }}
      showLive
      topbarActions={
        <Button
          variant="gold"
          size="sm"
          icon={<Plus className="h-4 w-4" />}
          onClick={() => {
            setIsAdding(true);
            setError(null);
            setFeedback(null);
          }}
        >
          {tx(locale, "إضافة فرع", "Add branch")}
        </Button>
      }
    >
      <div className="space-y-6">
        {feedback ? <Card className="border border-[var(--success-500)] bg-[var(--success-50)] text-sm text-[var(--success-700)]">{feedback}</Card> : null}
        {error ? <Card className="border border-[var(--danger-500)] bg-[var(--danger-50)] text-sm text-[var(--danger-600)]">{error}</Card> : null}

        <Card className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="subtle-label">{tx(locale, "شبكة الفروع", "Branch network")}</p>
            <h2 className="mt-2 text-xl font-black text-[var(--text-primary)]">{tx(locale, "إدارة الفروع على مستوى المنصة", "Platform branch management")}</h2>
          </div>
          <div className="grid w-full max-w-4xl gap-3 md:grid-cols-[1fr_220px_220px_auto]">
            <InputWithIcon
              icon={<Search className="h-4 w-4" />}
              placeholder={tx(locale, "ابحث باسم الفرع أو العنوان أو المدير", "Search by branch, address, or manager")}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <select
              value={merchantFilter}
              onChange={(event) => setMerchantFilter(event.target.value)}
              className="h-12 rounded-[18px] border border-[var(--border-default)] bg-[var(--bg-surface)] px-4 text-sm text-[var(--text-primary)] outline-none"
            >
              <option value="ALL">{tx(locale, "كل التجار", "All merchants")}</option>
              {merchants.map((merchant) => (
                <option key={merchant.id} value={merchant.id}>
                  {pickLabel(locale, merchant.nameAr, merchant.name)}
                </option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as "ACTIVE" | "ARCHIVED")}
              className="h-12 rounded-[18px] border border-[var(--border-default)] bg-[var(--bg-surface)] px-4 text-sm text-[var(--text-primary)] outline-none"
            >
              <option value="ACTIVE">{tx(locale, "الفروع النشطة", "Active branches")}</option>
              <option value="ARCHIVED">{tx(locale, "المؤرشفة", "Archived")}</option>
            </select>
            <Button
              variant="secondary"
              size="sm"
              loading={refreshing}
              onClick={() => {
                setRefreshing(true);
                loadData().finally(() => setRefreshing(false));
              }}
            >
              {tx(locale, "تحديث", "Refresh")}
            </Button>
          </div>
        </Card>

        <Card className="overflow-hidden border border-[var(--border-default)] p-0">
          <DataTable
            data={filteredBranches}
            keyExtractor={(item) => item.id}
            onRowClick={(item) => {
              window.location.href = `/admin/branches/${item.id}`;
            }}
            emptyMessage={tx(locale, "لا توجد فروع مطابقة للتصفية الحالية.", "No branches match the current filters.")}
            columns={[
              {
                key: "branchInfo",
                header: tx(locale, "الفرع", "Branch"),
                cell: (item: BranchRecord) => (
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-[var(--primary-100)] text-[var(--primary-700)] dark:bg-[var(--primary-900)] dark:text-[var(--primary-200)]">
                      <Store className="h-4.5 w-4.5" />
                    </div>
                    <div className="min-w-[150px]">
                      <div className="max-w-[200px] truncate font-bold text-[var(--text-primary)]">{pickLabel(locale, item.nameAr, item.name)}</div>
                      <div className="mt-0.5 max-w-[200px] truncate text-xs text-[var(--text-secondary)]">{pickLabel(locale, item.merchant.nameAr, item.merchant.name)}</div>
                    </div>
                  </div>
                ),
              },
              {
                key: "branchStatus",
                header: tx(locale, "الحالة", "Status"),
                cell: (item: BranchRecord) => (
                  <StatusPill label={item.isActive ? tx(locale, "نشط", "Active") : tx(locale, "مؤرشف", "Archived")} tone={item.isActive ? "success" : "neutral"} />
                ),
              },
              {
                key: "branchContact",
                header: tx(locale, "التواصل والموقع", "Contact & Location"),
                cell: (item: BranchRecord) => (
                  <div className="max-w-[200px] text-xs text-[var(--text-secondary)]">
                    <div className="flex items-start gap-1.5 truncate">
                      <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
                      <span className="truncate">{item.address}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-1.5">
                      <Phone className="h-3 w-3 shrink-0" />
                      <span>{item.phone || item.whatsappNumber || tx(locale, "بدون", "N/A")}</span>
                    </div>
                  </div>
                ),
              },
              {
                key: "branchManager",
                header: tx(locale, "المدير", "Manager"),
                cell: (item: BranchRecord) => (
                  <div className="max-w-[150px] truncate text-sm font-medium text-[var(--text-primary)]">
                    {item.manager?.name || <span className="italic text-[var(--text-tertiary)]">{tx(locale, "غير محدد", "Unassigned")}</span>}
                  </div>
                ),
              },
              {
                key: "branchStats",
                header: tx(locale, "إحصائيات", "Stats"),
                cell: (item: BranchRecord) => (
                  <div className="flex gap-4">
                    <div>
                      <div className="text-[10px] uppercase text-[var(--text-tertiary)]">{tx(locale, "طلبات", "Orders")}</div>
                      <div className="font-mono text-sm font-bold text-[var(--text-primary)]">{item.orderCount}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase text-[var(--text-tertiary)]">{tx(locale, "طيارون", "Heroes")}</div>
                      <div className="font-mono text-sm font-bold text-[var(--text-primary)]">{item.activeHeroAssignments}</div>
                    </div>
                  </div>
                ),
              },
              {
                key: "branchAction",
                header: tx(locale, "إجراء", "Action"),
                cell: (item: BranchRecord) => (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      void toggleBranchArchive(item, item.isActive !== false);
                    }}
                    disabled={togglingId === item.id}
                    className="inline-flex min-h-10 items-center gap-2 rounded-[14px] border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-2 text-xs font-bold text-[var(--text-primary)] transition hover:border-[var(--primary-500)] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {item.isActive === false ? <RotateCcw className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
                    {item.isActive === false ? tx(locale, "إعادة التفعيل", "Restore") : tx(locale, "أرشفة", "Archive")}
                  </button>
                ),
              },
            ]}
            mobileCardContent={(item: BranchRecord) => (
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="max-w-[250px] truncate text-base font-bold text-[var(--text-primary)]">{pickLabel(locale, item.nameAr, item.name)}</div>
                    <div className="mt-1 max-w-[250px] truncate text-xs text-[var(--text-secondary)]">{pickLabel(locale, item.merchant.nameAr, item.merchant.name)}</div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <StatusPill label={item.isActive ? tx(locale, "مفعل", "Active") : tx(locale, "مؤرشف", "Archived")} tone={item.isActive ? "success" : "neutral"} />
                  </div>
                </div>

                <div className="rounded-[14px] border border-[var(--border-default)] bg-[var(--bg-surface-2)] p-3 text-xs text-[var(--text-secondary)]">
                  <div className="flex items-start gap-2">
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--primary-500)]" />
                    <span className="line-clamp-2">{item.address}</span>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-[var(--border-default)] pt-3">
                  <div className="font-mono text-xs text-[var(--text-primary)]">
                    {item.orderCount} {tx(locale, "طلبات", "Orders")}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
                    <User2 className="h-3.5 w-3.5" />
                    {item.manager?.name || tx(locale, "بدون مدير", "No mgr")}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    void toggleBranchArchive(item, item.isActive !== false);
                  }}
                  disabled={togglingId === item.id}
                  className="flex min-h-11 w-full items-center justify-center gap-2 rounded-[16px] border border-[var(--border-default)] bg-[var(--bg-surface)] px-4 py-3 text-sm font-bold text-[var(--text-primary)] transition hover:border-[var(--primary-500)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {item.isActive === false ? <RotateCcw className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                  {item.isActive === false ? tx(locale, "إعادة تفعيل الفرع", "Restore branch") : tx(locale, "أرشفة الفرع", "Archive branch")}
                </button>
              </div>
            )}
          />
        </Card>
      </div>

      <Sheet
        open={isAdding}
        onOpenChange={(open: boolean) => {
          if (!open) {
            setIsAdding(false);
          }
        }}
      >
        <SheetContent
          side={direction === "rtl" ? "left" : "right"}
          className="flex h-full w-full max-w-3xl flex-col border-none bg-transparent p-2 pb-[var(--safe-area-bottom)] pt-[var(--safe-area-top)] shadow-none sm:max-w-3xl sm:p-4 !duration-500"
        >
          <Card variant="elevated" className="flex h-full flex-col overflow-hidden shadow-[var(--shadow-2xl)]">
            <div className="flex items-start justify-between gap-4 border-b border-[var(--border-default)] pb-4">
              <div>
                <p className="subtle-label">{tx(locale, "إضافة جديدة", "New branch")}</p>
                <h2 className="mt-2 text-2xl font-black text-[var(--text-primary)]">{tx(locale, "إضافة فرع جديد", "Create branch")}</h2>
              </div>
            </div>

            <form className="flex-1 space-y-5 overflow-y-auto pt-5" onSubmit={handleCreate}>
              <div className="grid gap-4 md:grid-cols-2">
                <select
                  value={form.merchantId}
                  onChange={(event) => setForm((current) => ({ ...current, merchantId: event.target.value }))}
                  className="h-12 w-full rounded-[18px] border border-[var(--border-default)] bg-[var(--bg-surface)] px-4 text-sm text-[var(--text-primary)] outline-none"
                  required
                >
                  <option value="">{tx(locale, "اختر التاجر", "Choose merchant")}</option>
                  {merchants.map((merchant) => (
                    <option key={merchant.id} value={merchant.id}>
                      {pickLabel(locale, merchant.nameAr, merchant.name)}
                    </option>
                  ))}
                </select>
                <Input placeholder={tx(locale, "اسم الفرع بالإنجليزية", "Branch name in English")} value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required />
                <Input placeholder={tx(locale, "اسم الفرع بالعربية", "Branch name in Arabic")} value={form.nameAr} onChange={(event) => setForm((current) => ({ ...current, nameAr: event.target.value }))} />
                <Input placeholder={tx(locale, "عنوان الفرع", "Branch address")} value={form.address} onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))} required />
                <Input placeholder={tx(locale, "هاتف الفرع", "Branch phone")} value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} />
                <Input placeholder={tx(locale, "واتساب الفرع", "Branch WhatsApp")} value={form.whatsappNumber} onChange={(event) => setForm((current) => ({ ...current, whatsappNumber: event.target.value }))} />
              </div>

              <div className="space-y-4 rounded-[24px] border border-[var(--border-default)] bg-[var(--bg-surface-2)] p-5">
                <div>
                  <p className="subtle-label">{tx(locale, "الموقع", "Location")}</p>
                  <h3 className="mt-2 text-lg font-black text-[var(--text-primary)]">{tx(locale, "حدد مكان الفرع على الخريطة", "Confirm branch location on the map")}</h3>
                  <p className="mt-2 text-sm text-[var(--text-secondary)]">
                    {tx(locale, "اضغط على الخريطة أو اسحب العلامة حتى تتأكد من مكان الفرع. لن يتم الحفظ بدون إحداثيات مؤكدة.", "Tap the map or drag the pin until the branch location is right. Saving is blocked until coordinates are confirmed.")}
                  </p>
                </div>
                <div className="overflow-hidden rounded-[20px] border border-[var(--border-default)]">
                  <MapLibreMap
                    center={mapPoint || cairoCenter}
                    zoom={13}
                    editablePoint={mapPoint}
                    onEditablePointChange={setMapPoint}
                    onMapClick={setMapPoint}
                    className="h-[320px] w-full"
                  />
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-[18px] border border-[var(--border-default)] bg-[var(--bg-base)] px-4 py-3">
                    <div className="text-xs text-[var(--text-tertiary)]">{tx(locale, "خط العرض", "Latitude")}</div>
                    <div className="mt-1 font-mono text-sm font-bold text-[var(--text-primary)]">{mapPoint ? mapPoint.lat.toFixed(6) : "--"}</div>
                  </div>
                  <div className="rounded-[18px] border border-[var(--border-default)] bg-[var(--bg-base)] px-4 py-3">
                    <div className="text-xs text-[var(--text-tertiary)]">{tx(locale, "خط الطول", "Longitude")}</div>
                    <div className="mt-1 font-mono text-sm font-bold text-[var(--text-primary)]">{mapPoint ? mapPoint.lng.toFixed(6) : "--"}</div>
                  </div>
                </div>
              </div>

              <div className="rounded-[24px] border border-[var(--border-default)] bg-[var(--bg-surface-2)] p-5">
                <p className="subtle-label">{tx(locale, "مدير الفرع", "Branch manager")}</p>
                <h3 className="mt-2 text-lg font-black text-[var(--text-primary)]">{tx(locale, "اختياري", "Optional")}</h3>
                <div className="mt-4 grid gap-4 md:grid-cols-3">
                  <Input placeholder={tx(locale, "اسم المدير", "Manager name")} value={form.managerName} onChange={(event) => setForm((current) => ({ ...current, managerName: event.target.value }))} />
                  <Input placeholder={tx(locale, "بريد المدير", "Manager email")} value={form.managerEmail} onChange={(event) => setForm((current) => ({ ...current, managerEmail: event.target.value }))} />
                  <Input placeholder={tx(locale, "هاتف المدير", "Manager phone")} value={form.managerPhone} onChange={(event) => setForm((current) => ({ ...current, managerPhone: event.target.value }))} />
                </div>
              </div>

              <div className="sticky bottom-0 flex gap-3 border-t border-[var(--border-default)] bg-[var(--bg-base)] py-4">
                <Button type="button" variant="secondary" onClick={() => setIsAdding(false)}>
                  {tx(locale, "إلغاء", "Cancel")}
                </Button>
                <Button type="submit" variant="gold" loading={isSaving} className="flex-1">
                  {tx(locale, "حفظ الفرع", "Save branch")}
                </Button>
              </div>
            </form>
          </Card>
        </SheetContent>
      </Sheet>
    </PageShell>
  );
}
