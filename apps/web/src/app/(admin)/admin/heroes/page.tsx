"use client";

import React from "react";
import Image from "next/image";
import { Loader2, MapPin, Plus, Search, Upload, X } from "lucide-react";
import { Button, Card, DataTable, Input, InputWithIcon, PageShell, Sheet, SheetContent, StatusPill, useLocale } from "@tayyar/ui";
import { apiFetch, apiUpload, resolveApiAssetUrl } from "@/lib/api";

type HeroRecord = {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  avatarUrl?: string | null;
  isActive?: boolean;
  dispatchReady?: boolean;
  dispatchIssues?: Array<"INACTIVE_ACCOUNT" | "MISSING_ZONE" | "MISSING_BRANCH_ASSIGNMENT" | "PENDING_VERIFICATION">;
  heroProfile?: {
    id: string;
    zoneId?: string | null;
    status?: string | null;
    totalDeliveries?: number | null;
    bloodType?: string | null;
    nationalId?: string | null;
    licenseUrl?: string | null;
    nationalIdFrontUrl?: string | null;
    nationalIdBackUrl?: string | null;
    verificationStatus?: string | null;
    verificationNote?: string | null;
    zone?: { id: string; name: string; nameAr?: string | null } | null;
    assignments?: Array<{
      id: string;
      model: string;
      baseSalary?: number | null;
      bonusPerOrder?: number | null;
      branch: {
        id: string;
        name: string;
        nameAr?: string | null;
        merchantName: string;
      };
    }>;
  } | null;
};

type BranchRecord = {
  id: string;
  name: string;
  nameAr?: string | null;
  merchant: { id: string; name: string; nameAr?: string | null };
};

type ZoneRecord = {
  id: string;
  name: string;
  nameAr?: string;
};

type FeedbackTone = "success" | "gold";
type AccountFilter = "ALL" | "ACTIVE" | "ARCHIVED";
type HeroDocumentField = "avatarUrl" | "licenseUrl" | "nationalIdFrontUrl" | "nationalIdBackUrl";
const MAX_DOCUMENT_UPLOAD_BYTES = 8 * 1024 * 1024;
type UploadState = Record<
  HeroDocumentField,
  {
    uploading: boolean;
    error?: string | null;
    name?: string | null;
  }
>;

type HeroHrDetail = {
  compensation: {
    mode: "BASIC_PLUS_COMMISSION" | "COMMISSION_ONLY";
    baseSalary: number;
    commissionPerOrder: number;
    branchId?: string | null;
    branchName?: string | null;
    branchNameAr?: string | null;
    merchantName?: string | null;
    merchantNameAr?: string | null;
    isActive: boolean;
    notes?: string | null;
    effectiveFrom?: string | null;
    effectiveTo?: string | null;
  };
  vacationAllowances: Array<{
    id: string;
    type: "ANNUAL" | "SICK" | "EMERGENCY" | "UNPAID";
    totalDays: number;
    usedDays: number;
    remainingDays: number;
    notes?: string | null;
    isActive: boolean;
  }>;
  vacationRequests: Array<{
    id: string;
    type: "ANNUAL" | "SICK" | "EMERGENCY" | "UNPAID";
    startDate: string;
    endDate: string;
    requestedDays: number;
    status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
    reason?: string | null;
    decisionNote?: string | null;
    requestedAt: string;
    decidedAt?: string | null;
    decidedBy?: { id: string; name: string; email: string } | null;
  }>;
  activeVacationRequest?: {
    id: string;
    type: "ANNUAL" | "SICK" | "EMERGENCY" | "UNPAID";
    startDate: string;
    endDate: string;
    requestedDays: number;
  } | null;
};

const tx = (locale: "ar" | "en", ar: string, en: string) => (locale === "ar" ? ar : en);

const statusOptions = ["OFFLINE", "ONLINE", "ON_DELIVERY", "ON_BREAK"] as const;
const accountFilters: AccountFilter[] = ["ALL", "ACTIVE", "ARCHIVED"];
const bloodTypeOptions = [
  { value: "UNKNOWN", label: "Unknown" },
  { value: "A_POS", label: "A+" },
  { value: "A_NEG", label: "A-" },
  { value: "B_POS", label: "B+" },
  { value: "B_NEG", label: "B-" },
  { value: "AB_POS", label: "AB+" },
  { value: "AB_NEG", label: "AB-" },
  { value: "O_POS", label: "O+" },
  { value: "O_NEG", label: "O-" },
] as const;
const verificationOptions = ["PENDING", "APPROVED", "REJECTED"] as const;
const vacationTypes = ["ANNUAL", "SICK", "EMERGENCY", "UNPAID"] as const;

const panelFieldClass =
  "h-12 w-full rounded-[18px] border border-[var(--border-default)] bg-[var(--bg-surface)] px-4 text-sm text-[var(--text-primary)]";

function HeroStatusPill({ locale, value }: { locale: "ar" | "en"; value?: string | null }) {
  const normalized = value || "OFFLINE";
  const label =
    normalized === "ONLINE"
      ? { ar: "متصل", en: "Online" }
      : normalized === "ON_DELIVERY"
        ? { ar: "في التوصيل", en: "On delivery" }
        : normalized === "ON_BREAK"
          ? { ar: "استراحة", en: "On break" }
          : { ar: "غير متصل", en: "Offline" };
  const tone = normalized === "ONLINE" ? "success" : normalized === "ON_DELIVERY" ? "primary" : "neutral";
  return <StatusPill label={locale === "ar" ? label.ar : label.en} tone={tone} />;
}

function VerificationPill({ locale, value }: { locale: "ar" | "en"; value?: string | null }) {
  const status = value || "PENDING";
  const label =
    status === "APPROVED"
      ? { ar: "موثق", en: "Approved" }
      : status === "REJECTED"
        ? { ar: "مرفوض", en: "Rejected" }
        : { ar: "قيد المراجعة", en: "Pending" };
  const tone = status === "APPROVED" ? "success" : status === "REJECTED" ? "gold" : "primary";
  return <StatusPill label={locale === "ar" ? label.ar : label.en} tone={tone} />;
}

function dispatchIssueLabel(
  locale: "ar" | "en",
  issue: "INACTIVE_ACCOUNT" | "MISSING_ZONE" | "MISSING_BRANCH_ASSIGNMENT" | "PENDING_VERIFICATION",
) {
  if (issue === "INACTIVE_ACCOUNT") return tx(locale, "الحساب غير نشط", "Inactive account");
  if (issue === "MISSING_ZONE") return tx(locale, "بدون منطقة", "Missing zone");
  if (issue === "MISSING_BRANCH_ASSIGNMENT") return tx(locale, "بدون ربط فرع", "Missing branch assignment");
  return tx(locale, "قيد التوثيق", "Pending verification");
}


function createUploadState(): UploadState {
  return {
    avatarUrl: { uploading: false, error: null, name: null },
    licenseUrl: { uploading: false, error: null, name: null },
    nationalIdFrontUrl: { uploading: false, error: null, name: null },
    nationalIdBackUrl: { uploading: false, error: null, name: null },
  };
}

function DocumentUploadField({
  locale,
  label,
  helper,
  value,
  state,
  onSelect,
}: {
  locale: "ar" | "en";
  label: string;
  helper: string;
  value?: string | null;
  state: UploadState[HeroDocumentField];
  onSelect: (file: File) => void;
}) {
  const inputId = React.useId();
  const previewUrl = resolveApiAssetUrl(value);
  const isImage = previewUrl && !previewUrl.toLowerCase().endsWith(".pdf");

  return (
    <div className="rounded-[20px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-bold text-text-primary">{label}</div>
          <div className="mt-1 text-xs text-text-secondary">{helper}</div>
        </div>
        {previewUrl ? (
          <a
            href={previewUrl}
            target="_blank"
            rel="noreferrer"
            className="shrink-0 rounded-full border border-[var(--border-default)] px-3 py-2 text-xs font-bold text-primary-200 transition hover:border-primary-400"
          >
            {tx(locale, "معاينة", "Preview")}
          </a>
        ) : null}
      </div>

      {previewUrl ? (
        isImage ? (
          <Image
            src={previewUrl}
            alt={label}
            width={800}
            height={320}
            unoptimized
            className="mt-3 h-28 w-full rounded-[16px] border border-[var(--border-default)] object-cover"
          />
        ) : (
          <div className="mt-3 rounded-[16px] border border-[var(--border-default)] bg-[var(--bg-base)] px-4 py-3 text-sm text-text-secondary">
            {tx(locale, "تم رفع ملف PDF", "PDF uploaded")}
          </div>
        )
      ) : (
        <div className="mt-3 rounded-[16px] border border-dashed border-[var(--border-default)] bg-[var(--bg-base)] px-4 py-5 text-sm text-text-secondary">
          {tx(locale, "لم يتم رفع ملف بعد.", "No file uploaded yet.")}
        </div>
      )}

      <label
        htmlFor={inputId}
        className="mt-3 inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-[16px] border border-[var(--border-default)] bg-[var(--bg-base)] px-4 py-3 text-sm font-bold text-text-primary transition hover:border-primary-400"
      >
        {state.uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
        {state.uploading
          ? tx(locale, "جارٍ الرفع...", "Uploading...")
          : previewUrl
            ? tx(locale, "استبدال الملف", "Replace file")
            : tx(locale, "رفع ملف", "Upload file")}
      </label>
      <input
        id={inputId}
        type="file"
        accept="image/*,.pdf"
        className="hidden"
        disabled={state.uploading}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            onSelect(file);
          }
          event.currentTarget.value = "";
        }}
      />

      {state.name ? <div className="mt-2 text-xs text-text-tertiary">{state.name}</div> : null}
      <div className="mt-2 text-xs text-text-tertiary">
        {tx(locale, "JPG أو PNG أو WebP أو PDF حتى 8 م.ب.", "JPG, PNG, WebP, or PDF up to 8 MB.")}
      </div>
      {state.error ? <div className="mt-2 text-xs font-bold text-amber-300">{state.error}</div> : null}
    </div>
  );
}

export default function AdminHeroesPage() {
  const { locale, direction } = useLocale();
  const [heroes, setHeroes] = React.useState<HeroRecord[]>([]);
  const [zones, setZones] = React.useState<ZoneRecord[]>([]);
  const [branches, setBranches] = React.useState<BranchRecord[]>([]);
  const [query, setQuery] = React.useState("");
  const [merchantFilter, setMerchantFilter] = React.useState("");
  const [branchFilter, setBranchFilter] = React.useState("");
  const [zoneFilter, setZoneFilter] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("ALL");
  const [accountFilter, setAccountFilter] = React.useState<AccountFilter>("ACTIVE");
  const [editing, setEditing] = React.useState<HeroRecord | null>(null);
  const [panelOpen, setPanelOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [archiving, setArchiving] = React.useState(false);
  const [feedback, setFeedback] = React.useState<{ tone: FeedbackTone; message: string } | null>(null);
  const [refreshing, setRefreshing] = React.useState(false);
  const [uploadState, setUploadState] = React.useState<UploadState>(createUploadState);
  const [hrDetail, setHrDetail] = React.useState<HeroHrDetail | null>(null);
  const [loadingHr, setLoadingHr] = React.useState(false);
  const [savingCompensation, setSavingCompensation] = React.useState(false);
  const [savingAllowance, setSavingAllowance] = React.useState(false);
  const [decidingRequestId, setDecidingRequestId] = React.useState<string | null>(null);
  const [form, setForm] = React.useState({
    name: "",
    phone: "",
    email: "",
    avatarUrl: "",
    zoneId: "",
    status: "ONLINE",
    isActive: true,
    nationalId: "",
    nationalIdFrontUrl: "",
    nationalIdBackUrl: "",
    licenseUrl: "",
    bloodType: "UNKNOWN",
    verificationStatus: "APPROVED",
    verificationNote: "",
  });
  const [assignment, setAssignment] = React.useState({
    branchId: "",
    model: "POOL" as "POOL" | "DEDICATED",
    baseSalary: "",
    bonusPerOrder: "",
  });
  const [compensationForm, setCompensationForm] = React.useState({
    mode: "COMMISSION_ONLY" as "BASIC_PLUS_COMMISSION" | "COMMISSION_ONLY",
    baseSalary: "",
    commissionPerOrder: "",
    branchId: "",
    isActive: true,
    notes: "",
  });
  const [vacationForm, setVacationForm] = React.useState({
    type: "ANNUAL" as "ANNUAL" | "SICK" | "EMERGENCY" | "UNPAID",
    totalDays: "",
    notes: "",
    isActive: true,
  });

  const loadData = React.useCallback(async () => {
    const heroParams = new URLSearchParams();
    if (merchantFilter) {
      heroParams.set("merchantId", merchantFilter);
    }
    if (branchFilter) {
      heroParams.set("branchId", branchFilter);
    }
    if (zoneFilter) {
      heroParams.set("zoneId", zoneFilter);
    }
    if (statusFilter !== "ALL") {
      heroParams.set("status", statusFilter);
    }

    const [heroesData, zonesData, branchesData] = await Promise.all([
      apiFetch<HeroRecord[]>(
        heroParams.size ? `/v1/admin/heroes?${heroParams.toString()}` : "/v1/admin/heroes",
        undefined,
        "ADMIN",
      ),
      apiFetch<ZoneRecord[]>("/v1/admin/zones", undefined, "ADMIN"),
      apiFetch<BranchRecord[]>("/v1/admin/branches?status=ACTIVE", undefined, "ADMIN"),
    ]);

    setHeroes(heroesData);
    setZones(zonesData);
    setBranches(branchesData);
    setEditing((current) => (current ? heroesData.find((hero) => hero.id === current.id) || null : null));
  }, [branchFilter, merchantFilter, statusFilter, zoneFilter]);

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

  React.useEffect(() => {
    if (!editing || !panelOpen) {
      setHrDetail(null);
      return;
    }

    let cancelled = false;
    setLoadingHr(true);
    apiFetch<HeroHrDetail>(`/v1/admin/heroes/${editing.id}/hr`, undefined, "ADMIN")
      .then((payload) => {
        if (cancelled) {
          return;
        }
        setHrDetail(payload);
        setCompensationForm({
          mode: payload.compensation.mode || "COMMISSION_ONLY",
          baseSalary: payload.compensation.baseSalary?.toString() || "",
          commissionPerOrder: payload.compensation.commissionPerOrder?.toString() || "",
          branchId: payload.compensation.branchId || editing.heroProfile?.assignments?.[0]?.branch.id || "",
          isActive: payload.compensation.isActive,
          notes: payload.compensation.notes || "",
        });
      })
      .catch(() => {
        if (!cancelled) {
          setHrDetail(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingHr(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [editing, panelOpen]);

  const filteredHeroes = heroes.filter((hero) => {
    const matchesQuery = `${hero.name} ${hero.phone} ${hero.email || ""}`.toLowerCase().includes(query.toLowerCase());
    const matchesAccount =
      accountFilter === "ALL" ||
      (accountFilter === "ACTIVE" ? hero.isActive !== false : hero.isActive === false);
    return matchesQuery && matchesAccount;
  });
  const merchantOptions = React.useMemo(() => {
    const seen = new Map<string, { value: string; label: string }>();
    for (const branch of branches) {
      if (!seen.has(branch.merchant.id)) {
        seen.set(branch.merchant.id, {
          value: branch.merchant.id,
          label: locale === "ar" ? branch.merchant.nameAr || branch.merchant.name : branch.merchant.name || branch.merchant.nameAr || branch.merchant.name,
        });
      }
    }
    return Array.from(seen.values()).sort((left, right) => left.label.localeCompare(right.label, locale));
  }, [branches, locale]);
  const branchOptions = React.useMemo(() => {
    return branches
      .filter((branch) => !merchantFilter || branch.merchant.id === merchantFilter)
      .map((branch) => ({
        value: branch.id,
        label: `${locale === "ar" ? branch.nameAr || branch.name : branch.name || branch.nameAr || branch.name} • ${
          locale === "ar" ? branch.merchant.nameAr || branch.merchant.name : branch.merchant.name || branch.merchant.nameAr || branch.merchant.name
        }`,
      }))
      .sort((left, right) => left.label.localeCompare(right.label, locale));
  }, [branches, locale, merchantFilter]);
  React.useEffect(() => {
    if (branchFilter && !branchOptions.some((branch) => branch.value === branchFilter)) {
      setBranchFilter("");
    }
  }, [branchFilter, branchOptions]);
  const hasPendingUploads = Object.values(uploadState).some((entry) => entry.uploading);
  const selectedVacationAllowance =
    hrDetail?.vacationAllowances.find((allowance) => allowance.type === vacationForm.type) || null;

  function resetPanelState() {
    setForm({
      name: "",
      phone: "",
      email: "",
      avatarUrl: "",
      zoneId: "",
      status: "ONLINE",
      isActive: true,
      nationalId: "",
      nationalIdFrontUrl: "",
      nationalIdBackUrl: "",
      licenseUrl: "",
      bloodType: "UNKNOWN",
      verificationStatus: "APPROVED",
      verificationNote: "",
    });
    setUploadState(createUploadState());
    setAssignment({
      branchId: "",
      model: "POOL",
      baseSalary: "",
      bonusPerOrder: "",
    });
    setCompensationForm({
      mode: "COMMISSION_ONLY",
      baseSalary: "",
      commissionPerOrder: "",
      branchId: "",
      isActive: true,
      notes: "",
    });
    setVacationForm({
      type: "ANNUAL",
      totalDays: "",
      notes: "",
      isActive: true,
    });
    setHrDetail(null);
  }

  function openCreate() {
    setEditing(null);
    resetPanelState();
    setPanelOpen(true);
    setFeedback(null);
  }

  function openEdit(hero: HeroRecord) {
    const activeAssignment = hero.heroProfile?.assignments?.[0];
    setEditing(hero);
    setForm({
      name: hero.name,
      phone: hero.phone,
      email: hero.email || "",
      avatarUrl: hero.avatarUrl || "",
      zoneId: hero.heroProfile?.zoneId || "",
      status: hero.heroProfile?.status || "OFFLINE",
      isActive: hero.isActive !== false,
      nationalId: hero.heroProfile?.nationalId || "",
      nationalIdFrontUrl: hero.heroProfile?.nationalIdFrontUrl || "",
      nationalIdBackUrl: hero.heroProfile?.nationalIdBackUrl || "",
      licenseUrl: hero.heroProfile?.licenseUrl || "",
      bloodType: hero.heroProfile?.bloodType || "UNKNOWN",
      verificationStatus: hero.heroProfile?.verificationStatus || "PENDING",
      verificationNote: hero.heroProfile?.verificationNote || "",
    });
    setAssignment({
      branchId: activeAssignment?.branch.id || "",
      model: (activeAssignment?.model as "POOL" | "DEDICATED" | undefined) || "POOL",
      baseSalary: activeAssignment?.baseSalary?.toString() || "",
      bonusPerOrder: activeAssignment?.bonusPerOrder?.toString() || "",
    });
    setUploadState(createUploadState());
    setPanelOpen(true);
    setFeedback(null);
  }

  function closePanel() {
    setPanelOpen(false);
    setEditing(null);
    setUploadState(createUploadState());
    setHrDetail(null);
  }

  async function refreshHr() {
    if (!editing) {
      return;
    }
    const payload = await apiFetch<HeroHrDetail>(`/v1/admin/heroes/${editing.id}/hr`, undefined, "ADMIN");
    setHrDetail(payload);
    setCompensationForm({
      mode: payload.compensation.mode || "COMMISSION_ONLY",
      baseSalary: payload.compensation.baseSalary?.toString() || "",
      commissionPerOrder: payload.compensation.commissionPerOrder?.toString() || "",
      branchId: payload.compensation.branchId || editing.heroProfile?.assignments?.[0]?.branch.id || "",
      isActive: payload.compensation.isActive,
      notes: payload.compensation.notes || "",
    });
  }

  async function uploadDocument(field: HeroDocumentField, file: File) {
    if (file.size > MAX_DOCUMENT_UPLOAD_BYTES) {
      setUploadState((current) => ({
        ...current,
        [field]: {
          ...current[field],
          uploading: false,
          error: tx(locale, "حجم الملف يجب أن يكون 8 م.ب. أو أقل.", "The file must be 8 MB or smaller."),
        },
      }));
      return;
    }

    if (file.type && file.type !== "application/pdf" && !file.type.startsWith("image/")) {
      setUploadState((current) => ({
        ...current,
        [field]: {
          ...current[field],
          uploading: false,
          error: tx(locale, "استخدم صورة أو ملف PDF فقط.", "Use an image or PDF file only."),
        },
      }));
      return;
    }

    setUploadState((current) => ({
      ...current,
      [field]: {
        ...current[field],
        uploading: true,
        error: null,
      },
    }));

    try {
      const formData = new FormData();
      formData.append("category", "hero-documents");
      formData.append("documentType", field);
      formData.append("entityId", editing?.id || form.email || form.phone || "draft");
      formData.append("file", file);

      const uploaded = await apiUpload<{ url: string; name: string }>("/v1/admin/uploads", formData, "ADMIN");
      setForm((current) => ({
        ...current,
        [field]: uploaded.url,
      }));
      setUploadState((current) => ({
        ...current,
        [field]: {
          uploading: false,
          error: null,
          name: uploaded.name,
        },
      }));
    } catch (error) {
      setUploadState((current) => ({
        ...current,
        [field]: {
          ...current[field],
          uploading: false,
          error:
            error instanceof Error
              ? error.message
              : tx(locale, "تعذر رفع الملف.", "Could not upload the file."),
        },
      }));
    }
  }

  async function saveHero(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setFeedback(null);
    try {
      const payload = {
        ...form,
        avatarUrl: form.avatarUrl || undefined,
        nationalId: form.nationalId || undefined,
        nationalIdFrontUrl: form.nationalIdFrontUrl || undefined,
        nationalIdBackUrl: form.nationalIdBackUrl || undefined,
        licenseUrl: form.licenseUrl || undefined,
        verificationNote: form.verificationNote || undefined,
        branchId: assignment.branchId || undefined,
        assignmentModel: assignment.branchId ? assignment.model : undefined,
        baseSalary: assignment.baseSalary ? Number(assignment.baseSalary) : undefined,
        bonusPerOrder: assignment.bonusPerOrder ? Number(assignment.bonusPerOrder) : undefined,
      };

      if (editing) {
        await apiFetch(
          `/v1/admin/heroes/${editing.id}`,
          {
            method: "PATCH",
            body: JSON.stringify(payload),
          },
          "ADMIN",
        );
      } else {
        await apiFetch(
          "/v1/admin/heroes",
          {
            method: "POST",
            body: JSON.stringify(payload),
          },
          "ADMIN",
        );
      }

      closePanel();
      resetPanelState();
      await loadData();
      setFeedback({
        tone: "success",
        message: tx(locale, "تم حفظ بيانات الطيار.", "Hero details saved."),
      });
    } catch (error) {
      setFeedback({
        tone: "gold",
        message:
          error instanceof Error ? error.message : tx(locale, "تعذر حفظ بيانات الطيار.", "Could not save hero details."),
      });
    } finally {
      setSaving(false);
    }
  }

  async function toggleArchiveHero() {
    if (!editing) {
      return;
    }

    setArchiving(true);
    setFeedback(null);
    try {
      if (editing.isActive === false) {
        await apiFetch(
          `/v1/admin/heroes/${editing.id}`,
          {
            method: "PATCH",
            body: JSON.stringify({ isActive: true }),
          },
          "ADMIN",
        );
      } else {
        await apiFetch(
          `/v1/admin/heroes/${editing.id}/archive`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ archived: true }),
          },
          "ADMIN",
        );
      }

      await loadData();
      closePanel();
      setFeedback({
        tone: "success",
        message:
          editing.isActive === false
            ? tx(locale, "تمت إعادة تفعيل الطيار.", "Hero reactivated.")
            : tx(locale, "تم أرشفة الطيار ومنع الإسناد الجديد له.", "Hero archived and removed from active assignment."),
      });
    } catch (error) {
      setFeedback({
        tone: "gold",
        message: error instanceof Error ? error.message : tx(locale, "تعذر تحديث حالة الطيار.", "Could not update hero state."),
      });
    } finally {
      setArchiving(false);
    }
  }

  async function saveCompensation() {
    if (!editing) {
      return;
    }

    setSavingCompensation(true);
    setFeedback(null);
    try {
      await apiFetch(
        `/v1/admin/heroes/${editing.id}/compensation`,
        {
          method: "PATCH",
          body: JSON.stringify({
            branchId: compensationForm.branchId || undefined,
            mode: compensationForm.mode,
            baseSalary: compensationForm.baseSalary ? Number(compensationForm.baseSalary) : 0,
            commissionPerOrder: compensationForm.commissionPerOrder ? Number(compensationForm.commissionPerOrder) : 0,
            isActive: compensationForm.isActive,
            notes: compensationForm.notes || undefined,
          }),
        },
        "ADMIN",
      );
      await refreshHr();
      setFeedback({
        tone: "success",
        message: tx(locale, "تم حفظ ملف التعويض.", "Compensation profile saved."),
      });
    } catch (error) {
      setFeedback({
        tone: "gold",
        message: error instanceof Error ? error.message : tx(locale, "تعذر حفظ ملف التعويض.", "Could not save compensation profile."),
      });
    } finally {
      setSavingCompensation(false);
    }
  }

  async function saveVacationAllowance() {
    if (!editing) {
      return;
    }

    setSavingAllowance(true);
    setFeedback(null);
    try {
      await apiFetch(
        `/v1/admin/heroes/${editing.id}/vacation-allowances/${vacationForm.type}`,
        {
          method: "PUT",
          body: JSON.stringify({
            totalDays: Number(vacationForm.totalDays || 0),
            notes: vacationForm.notes || undefined,
            isActive: vacationForm.isActive,
          }),
        },
        "ADMIN",
      );
      await refreshHr();
      setFeedback({
        tone: "success",
        message: tx(locale, "تم تحديث رصيد الاجازات.", "Vacation balance updated."),
      });
    } catch (error) {
      setFeedback({
        tone: "gold",
        message: error instanceof Error ? error.message : tx(locale, "تعذر تحديث رصيد الاجازات.", "Could not update vacation balance."),
      });
    } finally {
      setSavingAllowance(false);
    }
  }

  async function decideVacationRequest(requestId: string, status: "APPROVED" | "REJECTED") {
    setDecidingRequestId(requestId);
    setFeedback(null);
    try {
      await apiFetch(
        `/v1/admin/vacation-requests/${requestId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ status }),
        },
        "ADMIN",
      );
      await refreshHr();
      setFeedback({
        tone: "success",
        message:
          status === "APPROVED"
            ? tx(locale, "تمت الموافقة على الطلب.", "Vacation request approved.")
            : tx(locale, "تم رفض الطلب.", "Vacation request rejected."),
      });
    } catch (error) {
      setFeedback({
        tone: "gold",
        message: error instanceof Error ? error.message : tx(locale, "تعذر تحديث طلب الاجازة.", "Could not update vacation request."),
      });
    } finally {
      setDecidingRequestId(null);
    }
  }


  return (
    <PageShell
      role="ADMIN"
      user={{ name: { ar: "مدير المنصة", en: "Platform admin" }, email: "admin@tayyar.app" }}
      pageTitle={{ ar: "الطيارون", en: "Heroes" }}
      pageSubtitle={{ ar: "إدارة الحسابات والتوثيق والحالة والتوزيع.", en: "Manage hero accounts, KYC, status, and assignments." }}
      showLive
      topbarActions={
        <Button variant="gold" size="sm" icon={<Plus className="h-4 w-4" />} onClick={openCreate}>
          {tx(locale, "إضافة طيار", "Add hero")}
        </Button>
      }
    >
      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.36fr)_minmax(0,1fr)]">
        <Card className="space-y-5">
          <div>
            <p className="subtle-label">{tx(locale, "البحث والتصفية", "Search and filter")}</p>
            <h2 className="mt-2 text-xl font-black">{tx(locale, "الطيارون", "Heroes")}</h2>
          </div>
          <InputWithIcon
            icon={<Search className="h-4 w-4" />}
            placeholder={tx(locale, "ابحث بالاسم أو الهاتف", "Search by name or phone")}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <div className="grid gap-2">
            <select className={panelFieldClass} value={merchantFilter} onChange={(event) => setMerchantFilter(event.target.value)}>
              <option value="">{tx(locale, "كل التجار", "All merchants")}</option>
              {merchantOptions.map((merchant) => (
                <option key={merchant.value} value={merchant.value}>
                  {merchant.label}
                </option>
              ))}
            </select>
            <select className={panelFieldClass} value={branchFilter} onChange={(event) => setBranchFilter(event.target.value)}>
              <option value="">{tx(locale, "كل الفروع", "All branches")}</option>
              {branchOptions.map((branch) => (
                <option key={branch.value} value={branch.value}>
                  {branch.label}
                </option>
              ))}
            </select>
            <select className={panelFieldClass} value={zoneFilter} onChange={(event) => setZoneFilter(event.target.value)}>
              <option value="">{tx(locale, "كل المناطق", "All zones")}</option>
              {zones.map((zone) => (
                <option key={zone.id} value={zone.id}>
                  {locale === "ar" ? zone.nameAr || zone.name : zone.name || zone.nameAr || zone.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            {accountFilters.map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setAccountFilter(filter)}
                className={
                  accountFilter === filter
                    ? "rounded-[18px] border border-primary-500/24 bg-primary-500/10 px-4 py-3 text-sm font-bold text-primary-200"
                    : "rounded-[18px] border border-[var(--border-default)] bg-[var(--bg-surface)] px-4 py-3 text-sm font-bold text-text-secondary"
                }
              >
                {filter === "ALL"
                  ? tx(locale, "كل الحسابات", "All accounts")
                  : filter === "ACTIVE"
                    ? tx(locale, "الحسابات النشطة", "Active accounts")
                    : tx(locale, "المؤرشفة", "Archived")}
              </button>
            ))}
          </div>
          <div className="grid gap-2">
            {["ALL", "ONLINE", "OFFLINE", "ON_DELIVERY", "ON_BREAK"].map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter(status)}
                className={
                  statusFilter === status
                    ? "rounded-[18px] border border-primary-500/24 bg-primary-500/10 px-4 py-3 text-sm font-bold text-primary-200"
                    : "rounded-[18px] border border-[var(--border-default)] bg-[var(--bg-surface)] px-4 py-3 text-sm font-bold text-text-secondary"
                }
              >
                {status === "ALL" ? tx(locale, "كل الحالات التشغيلية", "All live statuses") : status}
              </button>
            ))}
          </div>
          <Button
            variant="secondary"
            onClick={() => {
              setRefreshing(true);
              loadData().finally(() => setRefreshing(false));
            }}
            loading={refreshing}
          >
            {tx(locale, "تحديث القائمة", "Refresh list")}
          </Button>
        </Card>

        <div className="space-y-4">
          {feedback ? (
            <div
              className={`rounded-[24px] border px-5 py-4 text-sm font-bold ${
                feedback.tone === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-amber-200 bg-amber-50 text-amber-800"
              }`}
            >
              {feedback.message}
            </div>
          ) : null}

          <Card className="p-0 overflow-hidden border-[var(--border-default)] border">
             <DataTable
                data={filteredHeroes}
                keyExtractor={(item) => item.id}
                onRowClick={openEdit}
                emptyMessage={tx(locale, "لا يوجد طيارون مطابقون.", "No matching heroes.")}
                columns={[
                  {
                    key: "heroInfo",
                    header: tx(locale, "الطيار", "Hero"),
                    cell: (item: HeroRecord) => (
                      <div className="flex items-center gap-3">
                        {item.avatarUrl ? (
                          <Image
                            src={resolveApiAssetUrl(item.avatarUrl)}
                            alt={item.name}
                            width={96}
                            height={96}
                            unoptimized
                            className="h-10 w-10 shrink-0 rounded-[12px] border border-[var(--border-default)] object-cover bg-[var(--bg-surface-2)]"
                          />
                        ) : (
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] border border-[var(--border-default)] bg-[var(--bg-surface)] text-sm font-black text-[var(--primary-600)]">
                            {item.name.slice(0, 1).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <div className="font-bold text-[var(--text-primary)]">{item.name}</div>
                          <div className="text-xs text-[var(--text-secondary)] mt-0.5">{item.phone}</div>
                        </div>
                      </div>
                    ),
                  },
                  {
                    key: "heroZone",
                    header: tx(locale, "المنطقة", "Zone"),
                    cell: (item: HeroRecord) => (
                      <div className="text-[var(--text-secondary)] flex items-center gap-1.5 min-w-[120px]">
                        <MapPin className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">
                          {locale === "ar"
                            ? item.heroProfile?.zone?.nameAr || item.heroProfile?.zone?.name || "بدون منطقة"
                            : item.heroProfile?.zone?.name || item.heroProfile?.zone?.nameAr || "No zone"}
                        </span>
                      </div>
                    ),
                  },
                  {
                    key: "heroStatus",
                    header: tx(locale, "حالة العمل", "Status"),
                    cell: (item: HeroRecord) => <HeroStatusPill locale={locale} value={item.heroProfile?.status} />,
                  },
                  {
                    key: "heroKyc",
                    header: tx(locale, "التوثيق", "KYC"),
                    cell: (item: HeroRecord) => <VerificationPill locale={locale} value={item.heroProfile?.verificationStatus} />,
                  },
                  {
                    key: "dispatchState",
                    header: tx(locale, "جاهزية الإسناد", "Dispatch readiness"),
                    cell: (item: HeroRecord) => (
                      <div className="space-y-2">
                        <StatusPill
                          label={item.dispatchReady ? tx(locale, "جاهز", "Ready") : tx(locale, "بحاجة لاستكمال", "Needs setup")}
                          tone={item.dispatchReady ? "success" : "gold"}
                        />
                        {!item.dispatchReady && item.dispatchIssues?.length ? (
                          <div className="flex flex-wrap gap-1">
                            {item.dispatchIssues.map((issue) => (
                              <span
                                key={`${item.id}-${issue}`}
                                className="rounded-full border border-[var(--gold-500)] border-opacity-30 bg-[var(--gold-500)] bg-opacity-10 px-2 py-1 text-[11px] font-bold text-[var(--gold-700)] dark:text-[var(--gold-200)]"
                              >
                                {dispatchIssueLabel(locale, issue)}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ),
                  },
                  {
                    key: "heroOrders",
                    header: tx(locale, "الطلبات", "Orders"),
                    cell: (item: HeroRecord) => (
                      <div className="font-mono text-[var(--text-primary)] font-medium">
                        {item.heroProfile?.totalDeliveries || 0}
                      </div>
                    ),
                  },
                ]}
                mobileCardContent={(item: HeroRecord) => (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      {item.avatarUrl ? (
                         <Image
                           src={resolveApiAssetUrl(item.avatarUrl)}
                           alt={item.name}
                           width={112}
                           height={112}
                           unoptimized
                           className="h-12 w-12 shrink-0 rounded-[14px] border border-[var(--border-default)] object-cover"
                         />
                       ) : (
                         <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] border border-[var(--border-default)] bg-[var(--bg-surface)] text-lg font-black text-[var(--primary-600)]">
                           {item.name.slice(0, 1).toUpperCase()}
                         </div>
                       )}
                       <div className="flex-1 min-w-0">
                         <div className="font-bold text-[var(--text-primary)] text-lg truncate">{item.name}</div>
                         <div className="text-sm text-[var(--text-secondary)] truncate">{item.phone}</div>
                       </div>
                       <div className="flex flex-col gap-1 items-end shrink-0">
                         <HeroStatusPill locale={locale} value={item.heroProfile?.status} />
                       </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 pt-3 border-t border-[var(--border-default)]">
                       <div>
                         <div className="text-xs text-[var(--text-tertiary)]">{tx(locale, "التوثيق", "Verification")}</div>
                         <div className="mt-1"><VerificationPill locale={locale} value={item.heroProfile?.verificationStatus} /></div>
                       </div>
                       <div>
                         <div className="text-xs text-[var(--text-tertiary)]">{tx(locale, "الطلبات", "Orders")}</div>
                         <div className="mt-1 font-mono text-[var(--text-primary)] font-medium">{item.heroProfile?.totalDeliveries || 0}</div>
                       </div>
                    </div>
                    {!item.dispatchReady && item.dispatchIssues?.length ? (
                      <div className="flex flex-wrap gap-2 pt-3 border-t border-[var(--border-default)]">
                        {item.dispatchIssues.map((issue) => (
                          <span
                            key={`${item.id}-${issue}`}
                            className="rounded-full border border-[var(--gold-500)] border-opacity-30 bg-[var(--gold-500)] bg-opacity-10 px-2 py-1 text-[11px] font-bold text-[var(--gold-700)] dark:text-[var(--gold-200)]"
                          >
                            {dispatchIssueLabel(locale, issue)}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <div className="pt-3 border-t border-[var(--border-default)]">
                        <StatusPill label={tx(locale, "جاهز للإسناد", "Dispatch ready")} tone="success" />
                      </div>
                    )}
                  </div>
                )}
             />
          </Card>
        </div>
      </div>

      <Sheet open={panelOpen} onOpenChange={(open: boolean) => { if (!open) closePanel(); else setPanelOpen(open); }}>
        <SheetContent side={direction === "rtl" ? "left" : "right"} className="w-full max-w-3xl sm:max-w-3xl p-2 sm:p-4 bg-transparent border-none shadow-none flex flex-col pt-[var(--safe-area-top)] pb-[var(--safe-area-bottom)] !duration-500">
          <Card variant="elevated" className="flex h-full min-h-0 flex-col space-y-4 overflow-hidden shadow-[var(--shadow-2xl)]">
              <div className="flex items-center justify-between gap-3 border-b border-[var(--border-default)] pb-4">
                <div>
                  <div className="subtle-label">{editing ? tx(locale, "إدارة", "Manage") : tx(locale, "إضافة", "Create")}</div>
                  <div className="mt-2 text-xl font-black">
                    {editing ? tx(locale, "بيانات الطيار", "Hero details") : tx(locale, "طيار جديد", "New hero")}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {editing ? (
                    <Button variant="ghost" size="sm" onClick={openCreate}>
                      {tx(locale, "إضافة جديد", "New")}
                    </Button>
                  ) : null}
                  <Button variant="ghost" size="icon" onClick={closePanel} icon={<X className="h-4 w-4" />} aria-label={tx(locale, "إغلاق", "Close")} />
                </div>
              </div>

              <div className="min-h-0 flex-1 space-y-5 overflow-y-auto pr-1">
                <form className="space-y-5" onSubmit={saveHero}>
                  <div className="space-y-3">
                    <div className="subtle-label">{tx(locale, "الهوية الأساسية", "Core identity")}</div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <Input placeholder={tx(locale, "الاسم", "Name")} value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required />
                      <Input placeholder={tx(locale, "الهاتف", "Phone")} value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} required />
                      <Input placeholder={tx(locale, "البريد الإلكتروني", "Email")} value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} required />
                      <select className={panelFieldClass} value={form.zoneId} onChange={(event) => setForm((current) => ({ ...current, zoneId: event.target.value }))}>
                        <option value="">{tx(locale, "بدون منطقة", "No zone")}</option>
                        {zones.map((zone) => (
                          <option key={zone.id} value={zone.id}>
                            {locale === "ar" ? zone.nameAr || zone.name : zone.name || zone.nameAr}
                          </option>
                        ))}
                      </select>
                      <select className={panelFieldClass} value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}>
                        {statusOptions.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </div>
                    <DocumentUploadField
                      locale={locale}
                      label={tx(locale, "الصورة الشخصية", "Profile photo")}
                      helper={tx(locale, "ارفع صورة واضحة لملف الطيار.", "Upload a clear profile image for the hero record.")}
                      value={form.avatarUrl}
                      state={uploadState.avatarUrl}
                      onSelect={(file) => void uploadDocument("avatarUrl", file)}
                    />
                  </div>

                  <div className="space-y-3 border-t border-[var(--border-default)] pt-4">
                    <div className="subtle-label">{tx(locale, "بيانات التوثيق", "KYC and verification")}</div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <Input placeholder={tx(locale, "رقم الهوية", "National ID")} value={form.nationalId} onChange={(event) => setForm((current) => ({ ...current, nationalId: event.target.value }))} />
                      <select className={panelFieldClass} value={form.bloodType} onChange={(event) => setForm((current) => ({ ...current, bloodType: event.target.value }))}>
                        {bloodTypeOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <select className={panelFieldClass} value={form.verificationStatus} onChange={(event) => setForm((current) => ({ ...current, verificationStatus: event.target.value }))}>
                        {verificationOptions.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </div>
                    <Input placeholder={tx(locale, "ملاحظة التحقق أو سبب الرفض", "Verification note or rejection reason")} value={form.verificationNote} onChange={(event) => setForm((current) => ({ ...current, verificationNote: event.target.value }))} />
                    <div className="grid gap-3 md:grid-cols-2">
                      <DocumentUploadField
                        locale={locale}
                        label={tx(locale, "الهوية الأمامية", "ID front")}
                        helper={tx(locale, "ارفع صورة الجهة الأمامية لبطاقة الهوية.", "Upload the front image of the national ID.")}
                        value={form.nationalIdFrontUrl}
                        state={uploadState.nationalIdFrontUrl}
                        onSelect={(file) => void uploadDocument("nationalIdFrontUrl", file)}
                      />
                      <DocumentUploadField
                        locale={locale}
                        label={tx(locale, "الهوية الخلفية", "ID back")}
                        helper={tx(locale, "ارفع صورة الجهة الخلفية لبطاقة الهوية.", "Upload the back image of the national ID.")}
                        value={form.nationalIdBackUrl}
                        state={uploadState.nationalIdBackUrl}
                        onSelect={(file) => void uploadDocument("nationalIdBackUrl", file)}
                      />
                      <DocumentUploadField
                        locale={locale}
                        label={tx(locale, "الرخصة", "License")}
                        helper={tx(locale, "ارفع صورة الرخصة أو نسخة PDF.", "Upload the driving license image or PDF.")}
                        value={form.licenseUrl}
                        state={uploadState.licenseUrl}
                        onSelect={(file) => void uploadDocument("licenseUrl", file)}
                      />
                    </div>
                  </div>

                  <div className="space-y-3 border-t border-[var(--border-default)] pt-4">
                    <div>
                      <div className="text-sm font-bold text-text-primary">
                        {tx(locale, "التاجر والفرع", "Merchant and branch")}
                      </div>
                      <div className="mt-1 text-sm text-text-secondary">
                        {tx(
                          locale,
                          "اختر الفرع ونوع الربط من البداية حتى يظهر الطيار في إسناد الطلبات المناسبة.",
                          "Choose the branch and assignment model now so this hero appears in the right dispatch pool.",
                        )}
                      </div>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <select className={panelFieldClass} value={assignment.branchId} onChange={(event) => setAssignment((current) => ({ ...current, branchId: event.target.value }))}>
                        <option value="">{tx(locale, "اختر التاجر والفرع", "Choose merchant and branch")}</option>
                        {branches.map((branch) => (
                          <option key={branch.id} value={branch.id}>
                            {(locale === "ar" ? branch.nameAr || branch.name : branch.name || branch.nameAr) +
                              " • " +
                              (locale === "ar" ? branch.merchant.nameAr || branch.merchant.name : branch.merchant.name || branch.merchant.nameAr || "")}
                          </option>
                        ))}
                      </select>
                      <select className={panelFieldClass} value={assignment.model} onChange={(event) => setAssignment((current) => ({ ...current, model: event.target.value as "POOL" | "DEDICATED" }))}>
                        <option value="POOL">POOL</option>
                        <option value="DEDICATED">DEDICATED</option>
                      </select>
                      <Input placeholder={tx(locale, "راتب أساسي اختياري", "Optional base salary")} value={assignment.baseSalary} onChange={(event) => setAssignment((current) => ({ ...current, baseSalary: event.target.value }))} />
                      <Input placeholder={tx(locale, "حافز لكل طلب", "Bonus per order")} value={assignment.bonusPerOrder} onChange={(event) => setAssignment((current) => ({ ...current, bonusPerOrder: event.target.value }))} />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setForm((current) => ({ ...current, isActive: !current.isActive }))}
                    className={`flex w-full items-center justify-between rounded-[18px] border px-4 py-3 text-sm font-bold ${
                      form.isActive ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-100" : "border-[var(--border-default)] bg-[var(--bg-surface)] text-text-secondary"
                    }`}
                  >
                    <span>{tx(locale, "حالة الحساب", "Account status")}</span>
                    <span>{form.isActive ? tx(locale, "نشط", "Active") : tx(locale, "مؤرشف", "Archived")}</span>
                  </button>
                  {hasPendingUploads ? (
                    <div className="rounded-[18px] border border-primary-500/20 bg-primary-500/10 px-4 py-3 text-sm text-primary-100">
                      {tx(locale, "انتظر حتى يكتمل رفع الملفات ثم احفظ البيانات.", "Wait for the uploads to finish before saving.")}
                    </div>
                  ) : null}
                  <div className="grid gap-3 md:grid-cols-2">
                    <Button type="submit" variant="gold" fullWidth loading={saving} disabled={hasPendingUploads}>
                      {editing ? tx(locale, "حفظ التعديلات", "Save changes") : tx(locale, "حفظ الطيار", "Save hero")}
                    </Button>
                    {editing ? (
                      <Button type="button" variant={editing.isActive === false ? "secondary" : "outline"} fullWidth loading={archiving} onClick={toggleArchiveHero}>
                        {editing.isActive === false ? tx(locale, "إعادة التفعيل", "Reactivate hero") : tx(locale, "أرشفة الطيار", "Archive hero")}
                      </Button>
                    ) : null}
                  </div>
                </form>

                {editing?.heroProfile ? (
                  <div className="space-y-4 border-t border-[var(--border-default)] pt-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-bold text-text-primary">
                        {tx(locale, "التعويض والموارد البشرية", "Compensation and HR")}
                      </div>
                      {loadingHr ? (
                        <div className="text-xs text-text-tertiary">{tx(locale, "جار التحميل...", "Loading...")}</div>
                      ) : null}
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <select
                        className={panelFieldClass}
                        value={compensationForm.branchId}
                        onChange={(event) =>
                          setCompensationForm((current) => ({ ...current, branchId: event.target.value }))
                        }
                      >
                        <option value="">{tx(locale, "فرع التعويض", "Compensation branch")}</option>
                        {branches.map((branch) => (
                          <option key={branch.id} value={branch.id}>
                            {(locale === "ar" ? branch.nameAr || branch.name : branch.name || branch.nameAr) +
                              " • " +
                              (locale === "ar"
                                ? branch.merchant.nameAr || branch.merchant.name
                                : branch.merchant.name || branch.merchant.nameAr || "")}
                          </option>
                        ))}
                      </select>
                      <select
                        className={panelFieldClass}
                        value={compensationForm.mode}
                        onChange={(event) =>
                          setCompensationForm((current) => ({
                            ...current,
                            mode: event.target.value as "BASIC_PLUS_COMMISSION" | "COMMISSION_ONLY",
                          }))
                        }
                      >
                        <option value="COMMISSION_ONLY">{tx(locale, "عمولة فقط", "Commission only")}</option>
                        <option value="BASIC_PLUS_COMMISSION">
                          {tx(locale, "راتب أساسي + عمولة", "Base salary + commission")}
                        </option>
                      </select>
                      <Input
                        placeholder={tx(locale, "الراتب الأساسي", "Base salary")}
                        value={compensationForm.baseSalary}
                        onChange={(event) =>
                          setCompensationForm((current) => ({ ...current, baseSalary: event.target.value }))
                        }
                      />
                      <Input
                        placeholder={tx(locale, "عمولة كل طلب", "Commission per order")}
                        value={compensationForm.commissionPerOrder}
                        onChange={(event) =>
                          setCompensationForm((current) => ({
                            ...current,
                            commissionPerOrder: event.target.value,
                          }))
                        }
                      />
                    </div>
                    <Input
                      placeholder={tx(locale, "ملاحظات التعويض", "Compensation notes")}
                      value={compensationForm.notes}
                      onChange={(event) =>
                        setCompensationForm((current) => ({ ...current, notes: event.target.value }))
                      }
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setCompensationForm((current) => ({ ...current, isActive: !current.isActive }))
                      }
                      className={`flex w-full items-center justify-between rounded-[18px] border px-4 py-3 text-sm font-bold ${
                        compensationForm.isActive
                          ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-100"
                          : "border-[var(--border-default)] bg-[var(--bg-surface)] text-text-secondary"
                      }`}
                    >
                      <span>{tx(locale, "حالة التعويض", "Compensation status")}</span>
                      <span>{compensationForm.isActive ? tx(locale, "مفعل", "Active") : tx(locale, "موقوف", "Paused")}</span>
                    </button>
                    <Button variant="secondary" fullWidth loading={savingCompensation} onClick={saveCompensation}>
                      {tx(locale, "حفظ التعويض", "Save compensation")}
                    </Button>

                    <div className="rounded-[18px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 text-sm text-text-secondary">
                      <div className="font-bold text-text-primary">{tx(locale, "التكوين الحالي", "Current setup")}</div>
                      <div className="mt-2">
                        {hrDetail?.compensation.branchName
                          ? `${locale === "ar" ? hrDetail.compensation.branchNameAr || hrDetail.compensation.branchName : hrDetail.compensation.branchName || hrDetail.compensation.branchNameAr} • ${locale === "ar" ? hrDetail.compensation.merchantNameAr || hrDetail.compensation.merchantName || "" : hrDetail.compensation.merchantName || hrDetail.compensation.merchantNameAr || ""}`
                          : tx(locale, "لا يوجد فرع تعويض محدد.", "No compensation branch selected.")}
                      </div>
                    </div>

                    <div className="space-y-3 border-t border-[var(--border-default)] pt-4">
                      <div className="text-sm font-bold text-text-primary">{tx(locale, "رصيد الإجازات", "Vacation balance")}</div>
                      <div className="grid gap-3 md:grid-cols-[minmax(0,180px)_minmax(0,1fr)]">
                        <select
                          className={panelFieldClass}
                          value={vacationForm.type}
                          onChange={(event) =>
                            setVacationForm((current) => ({
                              ...current,
                              type: event.target.value as "ANNUAL" | "SICK" | "EMERGENCY" | "UNPAID",
                              totalDays:
                                hrDetail?.vacationAllowances
                                  .find((allowance) => allowance.type === event.target.value)
                                  ?.totalDays?.toString() || "",
                              notes:
                                hrDetail?.vacationAllowances
                                  .find((allowance) => allowance.type === event.target.value)
                                  ?.notes || "",
                            }))
                          }
                        >
                          {vacationTypes.map((type) => (
                            <option key={type} value={type}>
                              {type}
                            </option>
                          ))}
                        </select>
                        <Input
                          placeholder={tx(locale, "إجمالي الأيام", "Total days")}
                          value={vacationForm.totalDays}
                          onChange={(event) =>
                            setVacationForm((current) => ({ ...current, totalDays: event.target.value }))
                          }
                        />
                      </div>
                      <Input
                        placeholder={tx(locale, "ملاحظات الرصيد", "Allowance notes")}
                        value={vacationForm.notes}
                        onChange={(event) =>
                          setVacationForm((current) => ({ ...current, notes: event.target.value }))
                        }
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setVacationForm((current) => ({ ...current, isActive: !current.isActive }))
                        }
                        className={`flex w-full items-center justify-between rounded-[18px] border px-4 py-3 text-sm font-bold ${
                          vacationForm.isActive
                            ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-100"
                            : "border-[var(--border-default)] bg-[var(--bg-surface)] text-text-secondary"
                        }`}
                    >
                        <span>{tx(locale, "حالة الرصيد", "Allowance status")}</span>
                        <span>{vacationForm.isActive ? tx(locale, "مفعل", "Active") : tx(locale, "موقوف", "Paused")}</span>
                      </button>
                      {selectedVacationAllowance ? (
                        <div className="rounded-[18px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 text-sm text-text-secondary">
                          <div>{tx(locale, "المستخدم", "Used")}: {selectedVacationAllowance.usedDays}</div>
                          <div className="mt-1">{tx(locale, "المتبقي", "Remaining")}: {selectedVacationAllowance.remainingDays}</div>
                        </div>
                      ) : null}
                      <Button variant="secondary" fullWidth loading={savingAllowance} onClick={saveVacationAllowance}>
                        {tx(locale, "حفظ رصيد الإجازة", "Save vacation balance")}
                      </Button>
                    </div>

                    <div className="space-y-3 border-t border-[var(--border-default)] pt-4">
                      <div className="text-sm font-bold text-text-primary">{tx(locale, "طلبات الإجازة", "Vacation requests")}</div>
                      {hrDetail?.vacationRequests?.length ? (
                        hrDetail.vacationRequests.map((request) => (
                          <div key={request.id} className="rounded-[18px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 text-sm text-text-secondary">
                            <div className="flex items-center justify-between gap-3">
                              <div className="font-bold text-text-primary">{request.type}</div>
                              <StatusPill
                                label={request.status}
                                tone={
                                  request.status === "APPROVED"
                                    ? "success"
                                    : request.status === "REJECTED"
                                      ? "gold"
                                      : "primary"
                                }
                              />
                            </div>
                            <div className="mt-2">
                              {new Date(request.startDate).toLocaleDateString()} - {new Date(request.endDate).toLocaleDateString()}
                            </div>
                            <div className="mt-1">
                              {tx(locale, "الأيام المطلوبة", "Requested days")}: {request.requestedDays}
                            </div>
                            {request.reason ? <div className="mt-1">{request.reason}</div> : null}
                            {request.status === "PENDING" ? (
                              <div className="mt-3 grid gap-2 md:grid-cols-2">
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  loading={decidingRequestId === request.id}
                                  onClick={() => void decideVacationRequest(request.id, "APPROVED")}
                                >
                                  {tx(locale, "موافقة", "Approve")}
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  loading={decidingRequestId === request.id}
                                  onClick={() => void decideVacationRequest(request.id, "REJECTED")}
                                >
                                  {tx(locale, "رفض", "Reject")}
                                </Button>
                              </div>
                            ) : null}
                          </div>
                        ))
                      ) : (
                        <div className="rounded-[18px] border border-dashed border-[var(--border-default)] px-4 py-6 text-sm text-text-secondary">
                          {tx(locale, "لا توجد طلبات إجازة مسجلة بعد.", "No vacation requests yet.")}
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            </Card>
        </SheetContent>
      </Sheet>
    </PageShell>
  );
}
