"use client";

import React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  MapPinned,
  MessageCircleMore,
  Package,
  Phone,
  RefreshCcw,
  Search,
  Truck,
  WalletCards,
} from "lucide-react";
import { Button, Card, PageShell, StatusPill, commonCopy, merchantOrderCopy, useLocale } from "@tayyar/ui";
import { formatLocalizedCurrency, formatLocalizedDateTime } from "@tayyar/utils";
import type {
  CustomerLocationRequest,
  GeocodeCandidate,
  MerchantCustomerContext,
} from "@tayyar/types";
import { apiFetch } from "@/lib/api";
import { orderStatusText, orderStatusTone } from "@/lib/order-status";
import { useSocket } from "@/hooks/useSocket";
import InlineAddressMap from "@/components/merchant/InlineAddressMap";

type MerchantBootstrap = {
  branches: Array<{ id: string; name: string; nameAr?: string | null; address: string; lat: number; lng: number }>;
  zones: Array<{ id: string; name: string; nameAr: string; baseFee: number }>;
};

type CreatedOrder = { id: string; orderNumber: string; trackingId: string; status: string };
type NoticeTone = "primary" | "gold" | "success" | "danger";
type PaymentMode = "COLLECT_ON_DELIVERY" | "PREPAID";
type ConfirmedMapPoint = { label: string; secondaryLabel?: string | null; lat: number; lng: number };
const LOCATION_EPSILON = 0.000001;

const sanitizePhone = (value: string) => value.replace(/[^\d+]/g, "");

function isSamePoint(
  left: { lat: number; lng: number } | null | undefined,
  right: { lat: number; lng: number } | null | undefined,
) {
  if (!left || !right) {
    return false;
  }

  return Math.abs(left.lat - right.lat) < LOCATION_EPSILON && Math.abs(left.lng - right.lng) < LOCATION_EPSILON;
}

function guessZoneId(
  branch: MerchantBootstrap["branches"][number] | null | undefined,
  zones: MerchantBootstrap["zones"] | null | undefined,
) {
  if (!branch || !zones?.length) {
    return "";
  }

  const branchTerms = [branch.name, branch.nameAr, branch.address]
    .filter(Boolean)
    .map((value) => String(value).toLowerCase());
  const matchedZone = zones.find((zone) =>
    [zone.name, zone.nameAr, zone.baseFee]
      .filter((value) => value !== null && value !== undefined)
      .map((value) => String(value).toLowerCase())
      .some((token) => branchTerms.some((term) => term.includes(token))),
  );

  return matchedZone?.id || zones[0]?.id || "";
}

function tx(locale: "ar" | "en", value: { ar: string; en: string }) {
  return locale === "ar" ? value.ar : value.en;
}

function noticeClass(tone: NoticeTone) {
  if (tone === "success") return "border-emerald-500/20 bg-emerald-500/10 text-emerald-100";
  if (tone === "gold") return "border-accent-500/20 bg-accent-500/10 text-amber-100";
  if (tone === "danger") return "border-danger-500/20 bg-danger-500/10 text-red-100";
  return "border-primary-500/20 bg-primary-500/10 text-primary-100";
}

function PaymentToggle({
  locale,
  value,
  onChange,
}: {
  locale: "ar" | "en";
  value: PaymentMode;
  onChange: (value: PaymentMode) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 rounded-[22px] border border-white/10 bg-white/[0.03] p-2">
      {[
        { value: "COLLECT_ON_DELIVERY" as const, label: merchantOrderCopy.collectOnDelivery },
        { value: "PREPAID" as const, label: merchantOrderCopy.alreadyPaid },
      ].map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`app-font-body rounded-[18px] px-4 py-3 text-sm font-bold transition-all ${
            value === option.value
              ? "bg-primary-500 text-white shadow-[0_16px_32px_-18px_rgba(14,165,233,0.9)]"
              : "text-text-secondary hover:bg-white/[0.05] hover:text-text-primary"
          }`}
        >
          {tx(locale, option.label)}
        </button>
      ))}
    </div>
  );
}

export default function OrderComposer() {
  const { locale } = useLocale();
  const mapSectionRef = React.useRef<HTMLDivElement | null>(null);
  const [step, setStep] = React.useState<1 | 2 | 3>(1);
  const [boot, setBoot] = React.useState<MerchantBootstrap | null>(null);
  const [bootError, setBootError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<{ tone: NoticeTone; message: string } | null>(null);
  const [loadingBoot, setLoadingBoot] = React.useState(true);
  const [loadingLookup, setLoadingLookup] = React.useState(false);
  const [loadingRequest, setLoadingRequest] = React.useState(false);
  const [loadingRefresh, setLoadingRefresh] = React.useState(false);
  const [loadingCandidates, setLoadingCandidates] = React.useState(false);
  const [loadingSubmit, setLoadingSubmit] = React.useState(false);
  const [context, setContext] = React.useState<MerchantCustomerContext | null>(null);
  const [selectedAddressId, setSelectedAddressId] = React.useState("");
  const [selectedBranchId, setSelectedBranchId] = React.useState("");
  const [selectedZoneId, setSelectedZoneId] = React.useState("");
  const [locationRequest, setLocationRequest] = React.useState<CustomerLocationRequest | null>(null);
  const [createdOrder, setCreatedOrder] = React.useState<CreatedOrder | null>(null);
  const [phone, setPhone] = React.useState("");
  const [manualAddress, setManualAddress] = React.useState("");
  const [candidates, setCandidates] = React.useState<GeocodeCandidate[]>([]);
  const [selectedCandidateId, setSelectedCandidateId] = React.useState("");
  const [confirmedMapPoint, setConfirmedMapPoint] = React.useState<ConfirmedMapPoint | null>(null);
  const [paymentMode, setPaymentMode] = React.useState<PaymentMode>("COLLECT_ON_DELIVERY");
  const [collectionAmount, setCollectionAmount] = React.useState("");
  const [prepaidIncludesDeliveryFee, setPrepaidIncludesDeliveryFee] = React.useState(true);
  const [saveConfirmedAddress, setSaveConfirmedAddress] = React.useState(true);
  const [customerName, setCustomerName] = React.useState("");
  const phoneDigits = sanitizePhone(phone);
  const socketChannels = React.useMemo(
    () => (phoneDigits ? [`merchant-location-request:${phoneDigits}`] : ["global"]),
    [phoneDigits],
  );
  const { lastMessage, connectionState } = useSocket(socketChannels);
  const branch = boot?.branches.find((item) => item.id === selectedBranchId) || boot?.branches[0] || null;
  const zone = boot?.zones.find((item) => item.id === selectedZoneId) || boot?.zones[0] || null;
  const addresses = context?.addresses || [];
  const recentOrders = context?.recentOrders || [];
  const selectedAddress = addresses.find((item) => item.id === selectedAddressId) || null;
  const selectedCandidate = candidates.find((item) => item.id === selectedCandidateId) || null;
  const amount = Number(collectionAmount || "0");
  const derivedCollectionAmount =
    paymentMode === "PREPAID"
      ? prepaidIncludesDeliveryFee
        ? 0
        : zone?.baseFee || 0
      : Number.isFinite(amount)
        ? amount
        : 0;

  const selectedAddressAdjusted = Boolean(
    selectedAddress &&
      confirmedMapPoint &&
      !isSamePoint(confirmedMapPoint, { lat: selectedAddress.lat, lng: selectedAddress.lng }),
  );
  const resolvedLocationPoint =
    locationRequest?.status === "RESOLVED" && locationRequest.resolvedLat && locationRequest.resolvedLng
      ? {
          label: locationRequest.resolvedAddressLabel || manualAddress,
          secondaryLabel: locationRequest.branch.nameAr || locationRequest.branch.name,
          lat: locationRequest.resolvedLat,
          lng: locationRequest.resolvedLng,
        }
      : null;
  const mapPreviewPoint =
    confirmedMapPoint ||
    (selectedAddress
      ? {
          label: selectedAddress.addressLabel || `${selectedAddress.lat}, ${selectedAddress.lng}`,
          secondaryLabel: selectedAddress.branchNameAr || selectedAddress.branchName,
          lat: selectedAddress.lat,
          lng: selectedAddress.lng,
        }
      : resolvedLocationPoint);

  const confirmedLocation =
    confirmedMapPoint
      ? {
          label: confirmedMapPoint.label,
          lat: confirmedMapPoint.lat,
          lng: confirmedMapPoint.lng,
          source: "confirmed" as const,
        }
      : selectedAddress
        ? {
            label: selectedAddress.addressLabel || `${selectedAddress.lat}, ${selectedAddress.lng}`,
            lat: selectedAddress.lat,
            lng: selectedAddress.lng,
            source: "saved" as const,
          }
        : resolvedLocationPoint
          ? {
              label: resolvedLocationPoint.label,
              lat: resolvedLocationPoint.lat,
              lng: resolvedLocationPoint.lng,
              source: "whatsapp" as const,
            }
          : null;

  const canSubmit = Boolean(
    branch &&
      zone &&
      phoneDigits.length >= 10 &&
      confirmedLocation &&
      confirmedLocation.label.trim().length > 3 &&
      derivedCollectionAmount >= 0,
  );

  const scrollMapIntoView = React.useCallback(() => {
    window.requestAnimationFrame(() => {
      mapSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, []);

  React.useEffect(() => {
    apiFetch<MerchantBootstrap>("/v1/merchants/bootstrap")
      .then((data) => {
        setBoot(data);
        setSelectedBranchId((current) => current || data.branches[0]?.id || "");
        setSelectedZoneId((current) => current || guessZoneId(data.branches[0], data.zones) || data.zones[0]?.id || "");
      })
      .catch((error) => setBootError(error instanceof Error ? error.message : tx(locale, merchantOrderCopy.bootError)))
      .finally(() => setLoadingBoot(false));
  }, [locale]);

  React.useEffect(() => {
    if (!lastMessage || lastMessage.type !== "MERCHANT_LOCATION_REQUEST_UPDATE") return;
    const payload = lastMessage.payload as { request?: CustomerLocationRequest } | undefined;
    if (payload?.request?.customerPhone === phoneDigits) {
      setLocationRequest(payload.request);
      if (payload.request.resolvedAddressLabel) {
        setManualAddress(payload.request.resolvedAddressLabel);
        if (payload.request.resolvedLat && payload.request.resolvedLng) {
          const nextCandidate: GeocodeCandidate = {
            id: `resolved-${payload.request.id}`,
            label: payload.request.resolvedAddressLabel,
            secondaryLabel: payload.request.branch.nameAr || payload.request.branch.name,
            lat: payload.request.resolvedLat,
            lng: payload.request.resolvedLng,
            confidence: "high",
            source: "fallback",
          };
          setCandidates([nextCandidate]);
          setSelectedCandidateId(nextCandidate.id);
          setConfirmedMapPoint({
            label: nextCandidate.label,
            secondaryLabel: nextCandidate.secondaryLabel,
            lat: nextCandidate.lat,
            lng: nextCandidate.lng,
          });
          scrollMapIntoView();
        }
      }
      setNotice({ tone: "success", message: tx(locale, merchantOrderCopy.locationArrived) });
    }
  }, [lastMessage, locale, phoneDigits, scrollMapIntoView]);

  React.useEffect(() => {
    if (!selectedCandidate) {
      return;
    }

    setConfirmedMapPoint({
      label: selectedCandidate.label,
      secondaryLabel: selectedCandidate.secondaryLabel,
      lat: selectedCandidate.lat,
      lng: selectedCandidate.lng,
    });
    scrollMapIntoView();
  }, [selectedCandidate, scrollMapIntoView]);

  async function loadCustomerContext() {
    const data = await apiFetch<MerchantCustomerContext>(`/v1/merchants/customers/${encodeURIComponent(phoneDigits)}/context`);
    const preferredBranchId =
      data.addresses[0]?.branchId || data.recentOrders[0]?.branch.id || boot?.branches[0]?.id || "";
    const preferredZoneId =
      guessZoneId(
        boot?.branches.find((item) => item.id === preferredBranchId) || boot?.branches[0] || null,
        boot?.zones,
      ) || boot?.zones[0]?.id || "";
    setContext(data);
    setLocationRequest(data.locationRequest);
    setCustomerName(data.customer.name || "");
    setSelectedAddressId(data.addresses[0]?.id || "");
    setSelectedBranchId(preferredBranchId);
    setSelectedZoneId(preferredZoneId);
    setCandidates([]);
    setSelectedCandidateId("");
    setConfirmedMapPoint(null);
    setManualAddress("");
    setSaveConfirmedAddress(true);
    setStep(2);

    if (data.addresses.length) {
      setNotice({ tone: "success", message: tx(locale, merchantOrderCopy.savedAddresses) });
    } else if (data.locationRequest?.status === "PENDING") {
      setNotice({ tone: "primary", message: tx(locale, merchantOrderCopy.waitingCustomerLocation) });
    } else {
      setNotice({ tone: "gold", message: tx(locale, merchantOrderCopy.noSavedAddress) });
    }
  }

  async function sendLocationRequest() {
    if (!branch) return;
    setLoadingRequest(true);
    try {
      const requestState = await apiFetch<CustomerLocationRequest>("/v1/merchants/customers/location-request", {
        method: "POST",
        body: JSON.stringify({
          branchId: branch.id,
          customerPhone: phoneDigits,
          customerName: customerName || undefined,
        }),
      });
      setLocationRequest(requestState);
      setNotice({ tone: "primary", message: tx(locale, merchantOrderCopy.locationRequestSent) });
    } finally {
      setLoadingRequest(false);
    }
  }

  async function geocodeAddress() {
    if (!branch) return;
    if (!manualAddress.trim()) {
      setNotice({ tone: "danger", message: tx(locale, merchantOrderCopy.geocodeMissing) });
      return;
    }

    setLoadingCandidates(true);
    try {
      const response = await apiFetch<{ candidates: GeocodeCandidate[]; degraded: boolean }>("/v1/merchants/address-candidates", {
        method: "POST",
        body: JSON.stringify({
          branchId: branch.id,
          query: manualAddress.trim(),
        }),
      });
      setCandidates(response.candidates);
      setSelectedCandidateId(response.candidates[0]?.id || "");
      if (response.candidates[0]) {
        setConfirmedMapPoint({
          label: response.candidates[0].label,
          secondaryLabel: response.candidates[0].secondaryLabel,
          lat: response.candidates[0].lat,
          lng: response.candidates[0].lng,
        });
        scrollMapIntoView();
      }
      setNotice(
        response.degraded
          ? { tone: "gold", message: tx(locale, merchantOrderCopy.geocodeFallback) }
          : null,
      );
    } finally {
      setLoadingCandidates(false);
    }
  }

  async function reviewAddressOnMap() {
    if (selectedAddress) {
      setNotice({
        tone: "primary",
        message:
          locale === "ar"
            ? "راجع العنوان على الخريطة وعدّل العلامة لو محتاج."
            : "Review the address on the map and drag the pin if needed.",
      });
      scrollMapIntoView();
      return;
    }

    if (resolvedLocationPoint) {
      setConfirmedMapPoint(resolvedLocationPoint);
      setNotice({
        tone: "success",
        message:
          locale === "ar"
            ? "تم تحميل العنوان المرسل من العميل على الخريطة."
            : "The customer location is now shown on the map.",
      });
      scrollMapIntoView();
      return;
    }

    await geocodeAddress();
  }

  async function submit() {
    if (!branch || !zone || !confirmedLocation) {
      setNotice({ tone: "danger", message: tx(locale, merchantOrderCopy.geocodeMissing) });
      return;
    }

    setLoadingSubmit(true);
    try {
      const order = await apiFetch<CreatedOrder>("/v1/merchants/orders", {
        method: "POST",
        body: JSON.stringify({
          branchId: branch.id,
          zoneId: zone.id,
          customerPhone: phoneDigits,
          customerName: customerName || undefined,
          customerAddressId: selectedAddress && !selectedAddressAdjusted ? selectedAddress.id : undefined,
          deliveryAddress: confirmedLocation.label,
          deliveryLat: confirmedLocation.lat,
          deliveryLng: confirmedLocation.lng,
          pickupLat: branch.lat,
          pickupLng: branch.lng,
          collectionAmount: derivedCollectionAmount,
          paymentMode,
          saveConfirmedAddress: (!selectedAddress || selectedAddressAdjusted) && saveConfirmedAddress,
        }),
      });
      setCreatedOrder(order);
      setStep(3);
    } catch (error) {
      setNotice({
        tone: "danger",
        message: error instanceof Error ? error.message : tx(locale, merchantOrderCopy.bootError),
      });
    } finally {
      setLoadingSubmit(false);
    }
  }

  return (
    <PageShell
      role="MERCHANT_OWNER"
      user={{ name: { ar: "مالك المتجر", en: "Store owner" }, email: "owner@merchant.com" }}
      pageTitle={{ ar: "طلب جديد", en: "New order" }}
      pageSubtitle={{ ar: "رقم العميل ثم العنوان ثم الدفع.", en: "Phone, address, then payment." }}
      showLive
      topbarActions={
        <Button variant="secondary" size="sm" icon={<WalletCards className="h-4 w-4" />} onClick={() => window.location.reload()}>
          {tx(locale, merchantOrderCopy.reset)}
        </Button>
      }
    >
      <div className="space-y-6">
        {notice ? (
          <div className={`app-font-body rounded-[24px] border px-5 py-4 text-sm ${noticeClass(notice.tone)}`}>{notice.message}</div>
        ) : null}
        {connectionState !== "connected" && step === 2 ? (
          <div className={`app-font-body rounded-[24px] border px-5 py-4 text-sm ${noticeClass(connectionState === "reconnecting" ? "gold" : "primary")}`}>
            {connectionState === "reconnecting"
              ? tx(locale, merchantOrderCopy.connectionRetrying)
              : tx(locale, merchantOrderCopy.connectionOffline)}
          </div>
        ) : null}

        {loadingBoot ? <Card>{tx(locale, merchantOrderCopy.bootLoading)}</Card> : null}
        {bootError ? <Card>{bootError}</Card> : null}

        {!loadingBoot && !bootError && step === 1 ? (
          <Card className="space-y-5">
            <div>
              <div className="app-font-display text-2xl font-black">{tx(locale, merchantOrderCopy.startTitle)}</div>
              <div className="mt-2 text-sm text-text-secondary">{tx(locale, merchantOrderCopy.startSubtitle)}</div>
            </div>
            <input
              className="app-font-body h-14 w-full rounded-[22px] border border-white/10 bg-white/[0.03] px-4 text-base text-text-primary outline-none transition-colors focus:border-primary-400/60"
              placeholder={tx(locale, merchantOrderCopy.phonePlaceholder)}
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              inputMode="tel"
            />
            <Button
              size="lg"
              fullWidth
              loading={loadingLookup}
              icon={<Phone className="h-4 w-4" />}
              onClick={async () => {
                if (phoneDigits.length < 10) {
                  setNotice({ tone: "danger", message: tx(locale, merchantOrderCopy.invalidPhone) });
                  return;
                }
                setLoadingLookup(true);
                try {
                  await loadCustomerContext();
                } finally {
                  setLoadingLookup(false);
                }
              }}
            >
              {tx(locale, merchantOrderCopy.continue)}
            </Button>
          </Card>
        ) : null}

        {!loadingBoot && !bootError && step === 2 ? (
          <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
            <div className="space-y-6">
              <Card className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="subtle-label">{tx(locale, merchantOrderCopy.customerContext)}</div>
                    <div className="mt-2 text-xl font-black text-text-primary">{customerName || tx(locale, merchantOrderCopy.repeatCustomer)}</div>
                    <div className="mt-1 font-mono text-sm text-text-secondary">{phoneDigits}</div>
                  </div>
                  <StatusPill
                    label={{
                      ar: `${context?.customer.totalOrders || 0} طلب`,
                      en: `${context?.customer.totalOrders || 0} orders`,
                    }}
                    tone="primary"
                  />
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-[20px] border border-white/8 bg-white/[0.03] p-4">
                    <div className="text-xs text-text-tertiary">{tx(locale, merchantOrderCopy.lastAddress)}</div>
                    <div className="mt-2 text-sm text-text-primary">{context?.customer.lastAddress || tx(locale, merchantOrderCopy.noAddressYet)}</div>
                  </div>
                  <div className="rounded-[20px] border border-white/8 bg-white/[0.03] p-4">
                    <div className="text-xs text-text-tertiary">{tx(locale, merchantOrderCopy.lastOrder)}</div>
                    <div className="mt-2 text-sm text-text-primary">{context?.customer.lastOrderAt ? formatLocalizedDateTime(context.customer.lastOrderAt, locale) : tx(locale, commonCopy.pending)}</div>
                  </div>
                </div>

                {recentOrders.length ? (
                  <div className="space-y-3">
                    <div className="text-sm font-bold text-text-secondary">{tx(locale, merchantOrderCopy.recentOrders)}</div>
                    {recentOrders.map((order) => (
                      <div key={order.id} className="rounded-[18px] border border-white/8 bg-white/[0.02] p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-mono text-sm text-primary-300">{order.orderNumber}</div>
                            <div className="mt-1 text-sm text-text-primary">{order.deliveryAddress || tx(locale, merchantOrderCopy.noVisibleAddress)}</div>
                          </div>
                          <div className="text-xs text-text-tertiary">{formatLocalizedDateTime(order.requestedAt, locale)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </Card>

              <Card className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="app-font-display text-xl font-black">{tx(locale, merchantOrderCopy.savedAddresses)}</div>
                  {locationRequest ? (
                    <StatusPill
                      label={tx(locale, merchantOrderCopy.requestState[locationRequest.status])}
                      tone={locationRequest.status === "RESOLVED" ? "success" : locationRequest.status === "PENDING" ? "primary" : "gold"}
                    />
                  ) : null}
                </div>

                {addresses.length ? (
                  <div className="space-y-3">
                    {addresses.map((address) => (
                      <button
                        key={address.id}
                        type="button"
                        onClick={() => {
                          setSelectedAddressId(address.id);
                          setSelectedBranchId(address.branchId || "");
                          if (boot?.zones.length) {
                            const nextBranch = boot.branches.find((item) => item.id === address.branchId) || null;
                            setSelectedZoneId(guessZoneId(nextBranch, boot.zones) || boot.zones[0].id);
                          }
                          setManualAddress(address.addressLabel || "");
                          setSelectedCandidateId("");
                          setConfirmedMapPoint(null);
                          scrollMapIntoView();
                        }}
                        className={`w-full rounded-[20px] border p-4 text-start ${selectedAddressId === address.id ? "border-primary-500/24 bg-primary-500/10" : "border-white/8 bg-white/[0.03]"}`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="rounded-2xl bg-white/[0.05] p-3 text-text-secondary">
                            <MapPinned className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="font-bold text-text-primary">{address.addressLabel || `${address.lat}, ${address.lng}`}</div>
                            <div className="mt-1 text-sm text-text-secondary">{address.branchNameAr || address.branchName || ""}</div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-[20px] border border-dashed border-white/10 bg-white/[0.02] p-4 text-sm text-text-secondary">
                    {tx(locale, merchantOrderCopy.noSavedAddress)}
                  </div>
                )}

                <div className="rounded-[20px] border border-dashed border-white/10 bg-white/[0.02] p-4">
                  <div className="font-bold text-text-primary">{tx(locale, merchantOrderCopy.askCustomerForLocation)}</div>
                  <div className="mt-2 text-sm text-text-secondary">{tx(locale, merchantOrderCopy.askCustomerForLocationBody)}</div>
                  <div className="mt-4 flex gap-3">
                    <Button size="sm" variant="gold" loading={loadingRequest} icon={<MessageCircleMore className="h-4 w-4" />} onClick={sendLocationRequest}>
                      {tx(locale, merchantOrderCopy.sendLocationRequest)}
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      loading={loadingRefresh}
                      icon={<RefreshCcw className="h-4 w-4" />}
                      onClick={async () => {
                        setLoadingRefresh(true);
                        try {
                          const next = await apiFetch<CustomerLocationRequest | null>(`/v1/merchants/customers/${encodeURIComponent(phoneDigits)}/location-request`);
                          setLocationRequest(next);
                        } finally {
                          setLoadingRefresh(false);
                        }
                      }}
                    >
                      {tx(locale, merchantOrderCopy.refresh)}
                    </Button>
                  </div>
                </div>
              </Card>
            </div>

            <Card className="space-y-5">
              <div className="app-font-display text-xl font-black">{tx(locale, merchantOrderCopy.confirmAddressAndPayment)}</div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-text-secondary">
                    {locale === "ar" ? "الفرع المنفذ" : "Fulfilment branch"}
                  </label>
                  <select
                    value={selectedBranchId}
                    onChange={(event) => {
                      const nextBranchId = event.target.value;
                      const nextBranch = boot?.branches.find((item) => item.id === nextBranchId) || null;
                      setSelectedBranchId(nextBranchId);
                      if (boot?.zones.length) {
                        setSelectedZoneId(guessZoneId(nextBranch, boot.zones) || boot.zones[0].id);
                      }

                      if (selectedAddress && selectedAddress.branchId && selectedAddress.branchId !== nextBranchId) {
                        setSelectedAddressId("");
                        setManualAddress(selectedAddress.addressLabel || manualAddress);
                        setConfirmedMapPoint({
                          label: selectedAddress.addressLabel || `${selectedAddress.lat}, ${selectedAddress.lng}`,
                          secondaryLabel: selectedAddress.branchNameAr || selectedAddress.branchName,
                          lat: selectedAddress.lat,
                          lng: selectedAddress.lng,
                        });
                        scrollMapIntoView();
                      }
                    }}
                    className="app-font-body h-12 w-full rounded-[18px] border border-white/10 bg-white/[0.03] px-4 text-sm text-text-primary outline-none focus:border-primary-400/60"
                  >
                    {boot?.branches.map((item) => (
                      <option key={item.id} value={item.id}>
                        {locale === "ar" ? item.nameAr || item.name : item.name || item.nameAr}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-text-secondary">
                    {locale === "ar" ? "المنطقة" : "Zone"}
                  </label>
                  <select
                    value={selectedZoneId}
                    onChange={(event) => setSelectedZoneId(event.target.value)}
                    className="app-font-body h-12 w-full rounded-[18px] border border-white/10 bg-white/[0.03] px-4 text-sm text-text-primary outline-none focus:border-primary-400/60"
                  >
                    {boot?.zones.map((item) => (
                      <option key={item.id} value={item.id}>
                        {locale === "ar" ? item.nameAr || item.name : item.name || item.nameAr}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-bold text-text-secondary">{tx(locale, merchantOrderCopy.deliveryAddress)}</label>
                <textarea
                  className="app-font-body min-h-28 w-full rounded-[22px] border border-white/10 bg-white/[0.03] px-4 py-4 text-base text-text-primary outline-none transition-colors focus:border-primary-400/60"
                  placeholder={tx(locale, merchantOrderCopy.manualAddress)}
                  value={manualAddress}
                  onChange={(event) => {
                    setManualAddress(event.target.value);
                    setSelectedAddressId("");
                    setSelectedCandidateId("");
                    setConfirmedMapPoint(null);
                  }}
                />
                <Button size="sm" variant="secondary" loading={loadingCandidates} icon={<Search className="h-4 w-4" />} onClick={reviewAddressOnMap}>
                  {tx(locale, merchantOrderCopy.geocodeAddress)}
                </Button>
              </div>

              {candidates.length ? (
                <div className="space-y-3">
                  <div className="text-sm font-bold text-text-secondary">{tx(locale, merchantOrderCopy.geocodeCandidates)}</div>
                  {candidates.map((candidate) => (
                    <button
                      key={candidate.id}
                      type="button"
                      onClick={() => setSelectedCandidateId(candidate.id)}
                      className={`w-full rounded-[20px] border p-4 text-start ${selectedCandidateId === candidate.id ? "border-primary-500/24 bg-primary-500/10" : "border-white/8 bg-white/[0.03]"}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-bold text-text-primary">{candidate.label}</div>
                            <div className="mt-1 text-sm text-text-secondary">{candidate.secondaryLabel || tx(locale, merchantOrderCopy.noSecondaryLabel)}</div>
                          </div>
                        <StatusPill
                          label={{
                            ar: candidate.confidence === "high" ? "دقة عالية" : candidate.confidence === "medium" ? "دقة كويسة" : candidate.confidence === "low" ? "دقة محدودة" : "تقدير تقريبي",
                            en: candidate.confidence === "high" ? "High confidence" : candidate.confidence === "medium" ? "Good confidence" : candidate.confidence === "low" ? "Limited confidence" : "Approximate",
                          }}
                          tone={candidate.confidence === "high" ? "success" : candidate.confidence === "fallback" ? "gold" : "primary"}
                        />
                      </div>
                    </button>
                  ))}
                </div>
              ) : null}

              {mapPreviewPoint ? (
                <div ref={mapSectionRef} className="space-y-4">
                  <div className="text-sm font-bold text-text-secondary">
                    {locale === "ar" ? "ثبت المكان على الخريطة" : "Confirm the point on the map"}
                  </div>
                  <InlineAddressMap locale={locale} point={mapPreviewPoint} onChange={setConfirmedMapPoint} />
                  {!selectedAddress || selectedAddressAdjusted || confirmedMapPoint ? (
                    <button
                    type="button"
                    onClick={() => setSaveConfirmedAddress((value) => !value)}
                    className={`app-font-body flex w-full items-center justify-between rounded-[18px] border px-4 py-3 text-sm font-bold ${
                      saveConfirmedAddress
                        ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-100"
                        : "border-white/10 bg-white/[0.04] text-text-secondary"
                    }`}
                  >
                    <span>{locale === "ar" ? "احفظ العنوان للطلبات الجاية" : "Save this address for future orders"}</span>
                    <span>{saveConfirmedAddress ? tx(locale, commonCopy.yes) : tx(locale, commonCopy.no)}</span>
                    </button>
                  ) : null}
                </div>
              ) : null}

              <div className="space-y-3">
                <div className="text-sm font-bold text-text-secondary">{tx(locale, merchantOrderCopy.paymentState)}</div>
                <PaymentToggle locale={locale} value={paymentMode} onChange={setPaymentMode} />
              </div>

              {paymentMode === "COLLECT_ON_DELIVERY" ? (
                <input
                  className="app-font-body h-12 w-full rounded-[18px] border border-white/10 bg-white/[0.03] px-4 text-sm text-text-primary outline-none focus:border-primary-400/60"
                  value={collectionAmount}
                  onChange={(event) => setCollectionAmount(event.target.value.replace(/[^\d.]/g, ""))}
                  inputMode="decimal"
                  placeholder={tx(locale, merchantOrderCopy.amountToCollect)}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setPrepaidIncludesDeliveryFee((value) => !value)}
                  className={`app-font-body flex w-full items-center justify-between rounded-[18px] border px-4 py-3 text-sm font-bold ${
                    prepaidIncludesDeliveryFee
                      ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-100"
                      : "border-white/10 bg-white/[0.04] text-text-secondary"
                  }`}
                >
                  <span>{tx(locale, merchantOrderCopy.prepaidIncludesFee)}</span>
                  <span>{prepaidIncludesDeliveryFee ? tx(locale, commonCopy.yes) : tx(locale, commonCopy.no)}</span>
                </button>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <Card padding="sm" className="bg-white/[0.03]">
                  <div className="text-sm text-text-secondary">{tx(locale, merchantOrderCopy.deliveryFee)}</div>
                  <div className="mt-1 font-bold text-text-primary">{zone ? formatLocalizedCurrency(zone.baseFee, locale) : "--"}</div>
                </Card>
                <Card padding="sm" className="bg-white/[0.03]">
                  <div className="text-sm text-text-secondary">{tx(locale, merchantOrderCopy.amountToCollect)}</div>
                  <div className="mt-1 font-bold text-text-primary">{formatLocalizedCurrency(derivedCollectionAmount, locale)}</div>
                </Card>
              </div>

              {confirmedLocation ? (
                <div className="rounded-[20px] border border-white/8 bg-white/[0.03] p-4">
                  <div className="flex items-center gap-2 text-sm font-bold text-text-primary">
                    <Clock3 className="h-4 w-4 text-primary-300" />
                    {tx(locale, merchantOrderCopy.confirmedAddress)}
                  </div>
                  <div className="mt-2 text-sm text-text-secondary">{confirmedLocation.label}</div>
                  {branch ? (
                    <div className="mt-2 text-xs text-text-tertiary">
                      {locale === "ar"
                        ? `سيتم التنفيذ من ${branch.nameAr || branch.name}`
                        : `Fulfilled from ${branch.name || branch.nameAr}`}
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="rounded-[20px] border border-dashed border-white/10 bg-white/[0.02] p-4 text-sm text-text-secondary">
                  {tx(locale, merchantOrderCopy.chooseSavedOrReview)}
                </div>
              )}

              <div className="flex flex-wrap gap-3">
                <Button variant="outline" icon={<ArrowLeft className="h-4 w-4" />} onClick={() => setStep(1)}>
                  {tx(locale, merchantOrderCopy.back)}
                </Button>
                <Button variant="gold" loading={loadingSubmit} icon={<Package className="h-4 w-4" />} disabled={!canSubmit} onClick={submit}>
                  {tx(locale, merchantOrderCopy.createOrder)}
                </Button>
              </div>
            </Card>
          </div>
        ) : null}

        {step === 3 && createdOrder ? (
          <Card className="space-y-5">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl bg-emerald-500/12 p-3 text-emerald-300">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <div className="app-font-display text-2xl font-black">{tx(locale, merchantOrderCopy.orderCreated)}</div>
                <div className="mt-2">
                  <StatusPill label={orderStatusText(createdOrder.status)} tone={orderStatusTone(createdOrder.status)} />
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href={`/merchant/orders/${createdOrder.id}`}>
                <Button variant="secondary" icon={<Package className="h-4 w-4" />}>
                  {tx(locale, merchantOrderCopy.openOrder)}
                </Button>
              </Link>
              <Link href={`/track/${createdOrder.trackingId}`}>
                <Button variant="secondary" icon={<Truck className="h-4 w-4" />}>
                  {tx(locale, merchantOrderCopy.openTracking)}
                </Button>
              </Link>
            </div>
          </Card>
        ) : null}
      </div>
    </PageShell>
  );
}
