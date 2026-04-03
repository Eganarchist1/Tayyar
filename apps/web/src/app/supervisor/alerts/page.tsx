"use client";

import React from "react";
import { AlertTriangle } from "lucide-react";
import { Card, PageHeader, PageShell, StatusPill, text, useLocale } from "@tayyar/ui";
import type { OperationalAlertItem } from "@tayyar/types";
import { formatLocalizedDateTime } from "@tayyar/utils";
import { apiFetch } from "@/lib/api";
import { localizeAlertMessage, localizeAlertTitle } from "@/lib/ops";

type AlertRecord = OperationalAlertItem;
const alertTone = (severity: string): "primary" | "gold" | "neutral" =>
  severity === "high" ? "primary" : severity === "medium" ? "gold" : "neutral";

export default function SupervisorAlertsPage() {
  const { locale } = useLocale();
  const [alerts, setAlerts] = React.useState<AlertRecord[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    apiFetch<AlertRecord[]>("/v1/supervisors/alerts", undefined, "SUPERVISOR")
      .then(setAlerts)
      .finally(() => setLoading(false));
  }, []);

  const shellNotifications = React.useMemo(
    () =>
      alerts.slice(0, 4).map((alert) => ({
        id: alert.id,
        title: localizeAlertTitle(alert, locale),
        description: localizeAlertMessage(alert, locale),
        href: alert.actionHref || "/supervisor/alerts",
        tone: alertTone(alert.severity),
        meta: formatLocalizedDateTime(alert.createdAt, locale),
      })),
    [alerts, locale],
  );

  return (
    <PageShell
      role="SUPERVISOR"
      notifications={shellNotifications}
      notificationsLoading={loading}
      user={{ name: text("مشرف المنطقة", "Zone supervisor"), email: "supervisor@tayyar.app" }}
      pageTitle={text("التنبيهات", "Alerts")}
      pageSubtitle={text("كل ما يحتاج متابعة الآن.", "Everything that needs follow-up right now.")}
    >
      <div className="space-y-8">
        <PageHeader
          eyebrow={text("التنبيهات", "Alerts")}
          title={text("تنبيهات الإشراف", "Supervisor alerts")}
          subtitle={text("راجع الحالات المفتوحة من شاشة واحدة.", "Review open cases from one screen.")}
          breadcrumbs={[
            { label: text("الإشراف", "Supervisor"), href: "/supervisor/map" },
            { label: text("التنبيهات", "Alerts") },
          ]}
        />

        <div className="grid gap-4">
          {alerts.map((alert) => (
            <Card key={alert.id} className="flex items-center justify-between gap-4">
              <div className="flex gap-3" style={{ alignItems: "flex-start" }}>
                <div className="rounded-2xl border border-accent-500/20 bg-accent-500/10 p-3 text-amber-200">
                  <AlertTriangle className="h-4 w-4" />
                </div>
                <div>
                  <div className="font-bold text-text-primary">{localizeAlertTitle(alert, locale)}</div>
                  <div className="mt-1 text-sm text-text-secondary">{localizeAlertMessage(alert, locale)}</div>
                </div>
              </div>
              <StatusPill label={text("يحتاج متابعة", "Needs follow-up")} tone={alert.severity === "high" ? "primary" : "gold"} />
            </Card>
          ))}
        </div>
      </div>
    </PageShell>
  );
}
