"use client";

import React from "react";
import { Crosshair, Move, Navigation } from "lucide-react";
import MapLibreMap from "@/components/map/MapLibreMap";

type MapPoint = {
  lat: number;
  lng: number;
  label: string;
  secondaryLabel?: string | null;
};

type Props = {
  locale: "ar" | "en";
  point: MapPoint;
  onChange: (next: MapPoint) => void;
};

const tx = (locale: "ar" | "en", ar: string, en: string) => (locale === "ar" ? ar : en);

export default function InlineAddressMap({ locale, point, onChange }: Props) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] px-4 py-3 text-center text-xs font-bold text-[var(--text-primary)]">
        {tx(locale, "حرّك العلامة لو محتاجة تعديل", "Drag the pin if it needs adjustment")}
      </div>

      <MapLibreMap
        center={{ lat: point.lat, lng: point.lng }}
        zoom={15}
        editablePoint={{ lat: point.lat, lng: point.lng }}
        onEditablePointChange={(next) => onChange({ ...point, lat: next.lat, lng: next.lng })}
        className="h-[18rem] sm:h-72"
      />

      <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] px-4 py-3 text-xs text-text-secondary">
        <div className="flex items-center gap-2 text-text-primary">
          <Navigation className="h-4 w-4 text-primary-300" />
          <span>{point.label}</span>
        </div>
        {point.secondaryLabel ? <div className="mt-1">{point.secondaryLabel}</div> : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-[18px] border border-[var(--border-default)] bg-[var(--bg-surface-2)] px-4 py-3 text-sm">
          <div className="text-xs text-text-tertiary">{tx(locale, "خط العرض", "Latitude")}</div>
          <div className="mt-1 font-mono text-text-primary">{point.lat.toFixed(6)}</div>
        </div>
        <div className="rounded-[18px] border border-[var(--border-default)] bg-[var(--bg-surface-2)] px-4 py-3 text-sm">
          <div className="text-xs text-text-tertiary">{tx(locale, "خط الطول", "Longitude")}</div>
          <div className="mt-1 font-mono text-text-primary">{point.lng.toFixed(6)}</div>
        </div>
        <div className="rounded-[18px] border border-[var(--border-default)] bg-[var(--bg-surface-2)] px-4 py-3 text-sm sm:col-span-2 lg:col-span-1">
          <div className="text-xs text-text-tertiary">{tx(locale, "حالة التثبيت", "Pin state")}</div>
          <div className="mt-1 inline-flex items-center gap-2 font-bold text-text-primary">
            <Move className="h-4 w-4 text-accent-400" />
            {tx(locale, "تم التأكيد على الخريطة", "Confirmed on map")}
          </div>
        </div>
      </div>

      <div className="rounded-[18px] border border-[var(--border-default)] bg-[var(--bg-surface)] px-4 py-3 text-sm text-text-secondary">
        <div className="inline-flex items-center gap-2 text-text-primary">
          <Crosshair className="h-4 w-4 text-primary-300" />
          {tx(
            locale,
            "اسحب العلامة لتعديل المكان قبل تأكيد الطلب.",
            "Drag the pin to adjust the location before confirming the order.",
          )}
        </div>
      </div>
    </div>
  );
}
