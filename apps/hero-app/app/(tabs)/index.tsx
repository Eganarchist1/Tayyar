import React from "react";
import { Alert, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { HeroSymbol } from "@/components/hero-symbol";
import {
  Banner,
  BottomActionDock,
  EmptyState,
  GlassPanel,
  MetricTile,
  SectionHeading,
  StatusPill,
  TayyarButton,
  TayyarScreen,
  TopBrandBar,
} from "@/components/tayyar-ui";
import { enqueueHeroAction, flushQueuedHeroActions, getQueuedHeroActionCount } from "@/lib/action-queue";
import { heroFetch, isRetryableHeroError } from "@/lib/api";
import { heroAppCopy } from "@/lib/copy";
import { formatAppTime, formatCurrency, tayyarColors } from "@/lib/design";
import { heroFeedback } from "@/lib/feedback";
import { initBackgroundLocation, stopLocationTracking } from "@/hooks/useLocationTracking";
import { useHeroLocale } from "@/lib/locale";
import { useAuthStore } from "@/store/authStore";

type HeroProfile = {
  id: string;
  status: "ONLINE" | "OFFLINE" | "ON_DELIVERY" | "ON_BREAK";
  activeVacationRequest?: { id: string } | null;
  user?: { name?: string | null };
};

type ActiveOrder = {
  id: string;
  orderNumber: string;
  status: string;
  trackingId: string;
  deliveryAddress?: string | null;
  branch?: { name?: string | null } | null;
};

type EarningsSummary = {
  deliveredOrders: number;
  pendingPayoutAmount: number;
  totalOrderEarnings: number;
};

export default function HeroHomeScreen() {
  const navigation = useNavigation<any>();
  const { user, token } = useAuthStore();
  const { locale, direction, t } = useHeroLocale();
  const [hero, setHero] = React.useState<HeroProfile | null>(null);
  const [orders, setOrders] = React.useState<ActiveOrder[]>([]);
  const [earnings, setEarnings] = React.useState<EarningsSummary>({
    deliveredOrders: 0,
    pendingPayoutAmount: 0,
    totalOrderEarnings: 0,
  });
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [statusLoading, setStatusLoading] = React.useState(false);
  const [pendingSyncCount, setPendingSyncCount] = React.useState(0);
  const [lastSyncAt, setLastSyncAt] = React.useState<Date | null>(null);
  const [feedback, setFeedback] = React.useState<{ tone: "accent" | "warning" | "success"; title: string; body: string } | null>(null);

  const loadData = React.useCallback(async () => {
    const [heroData, orderData, earningsData] = await Promise.all([
      heroFetch<HeroProfile>("/v1/heroes/me", undefined, token),
      heroFetch<ActiveOrder[]>("/v1/heroes/orders/active", undefined, token),
      heroFetch<EarningsSummary>("/v1/heroes/earnings/summary", undefined, token),
    ]);
    setHero(heroData);
    setOrders(orderData);
    setEarnings(earningsData);
    setLastSyncAt(new Date());
  }, [token]);

  const refreshQueue = React.useCallback(async () => {
    setPendingSyncCount(await getQueuedHeroActionCount());
  }, []);

  React.useEffect(() => {
    let active = true;
    Promise.all([
      flushQueuedHeroActions(token).catch(() => ({ processed: 0, dropped: 0, remaining: 0 })),
      loadData(),
      refreshQueue(),
    ])
      .catch((error: unknown) => {
        if (active) {
          setFeedback({
            tone: "warning",
            title: t(heroAppCopy.common.retry),
            body: error instanceof Error ? error.message : t(heroAppCopy.common.unexpectedError),
          });
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [loadData, refreshQueue, t, token]);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      await loadData();
      await refreshQueue();
    } catch (error) {
      Alert.alert(
        t(heroAppCopy.common.refresh),
        error instanceof Error ? error.message : t(heroAppCopy.common.unexpectedError),
      );
    } finally {
      setRefreshing(false);
    }
  }, [loadData, refreshQueue, t]);

  async function handleToggleStatus() {
    if (!hero) return;
    const nextStatus = hero.status === "OFFLINE" ? "ONLINE" : "OFFLINE";
    setStatusLoading(true);
    setFeedback(null);

    try {
      if (nextStatus === "ONLINE") {
        await initBackgroundLocation(token);
      } else {
        await stopLocationTracking();
      }

      await heroFetch(
        "/v1/heroes/me/status",
        {
          method: "PATCH",
          body: JSON.stringify({ status: nextStatus }),
        },
        token,
      );

      await loadData();
      heroFeedback.success();
      setFeedback({
        tone: "success",
        title: t(heroAppCopy.home.ready),
        body: t(heroAppCopy.common.syncedNow),
      });
    } catch (error) {
      if (isRetryableHeroError(error)) {
        await enqueueHeroAction({
          kind: "HERO_STATUS",
          path: "/v1/heroes/me/status",
          method: "PATCH",
          body: JSON.stringify({ status: nextStatus }),
        });
        setHero((current) => (current ? { ...current, status: nextStatus } : current));
        await refreshQueue();
        setFeedback({
          tone: "warning",
          title: t(heroAppCopy.common.pendingSync),
          body: t(heroAppCopy.common.queuedForSync),
        });
      } else {
        heroFeedback.warning();
        setFeedback({
          tone: "warning",
          title: t(heroAppCopy.common.retry),
          body: error instanceof Error ? error.message : t(heroAppCopy.common.unexpectedError),
        });
      }
    } finally {
      setStatusLoading(false);
    }
  }

  const pilotName = user?.name || hero?.user?.name || (locale === "ar" ? "الطيار" : "Pilot");
  const currentMission = orders[0] || null;
  const activeStatus = hero?.status === "OFFLINE" ? "OFFLINE" : "ONLINE";
  const rowDirection = direction === "rtl" ? "row-reverse" : "row";
  const align = direction === "rtl" ? "right" : "left";

  if (loading) {
    return (
      <TayyarScreen scroll={false}>
        <View />
      </TayyarScreen>
    );
  }

  return (
    <TayyarScreen
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={tayyarColors.gold} />}
    >
      <TopBrandBar
        title={locale === "ar" ? `أهلاً ${pilotName.split(" ")[0]}` : `Hello ${pilotName.split(" ")[0]}`}
        subtitle={t(heroAppCopy.home.subtitle)}
        rightSlot={<StatusPill label={hero?.status === "OFFLINE" ? (locale === "ar" ? "غير متصل" : "Offline") : (locale === "ar" ? "جاهز" : "Online")} tone={activeStatus} />}
      />

      {feedback ? <Banner title={feedback.title} body={feedback.body} tone={feedback.tone} /> : null}
      {pendingSyncCount > 0 ? (
        <Banner title={t(heroAppCopy.common.pendingSync)} body={t(heroAppCopy.common.queuedForSync)} tone="warning" />
      ) : null}
      {hero?.activeVacationRequest ? (
        <Banner
          title={t(heroAppCopy.profile.activeRequest)}
          body={locale === "ar" ? "لديك إجازة معتمدة حالياً." : "You currently have an approved vacation."}
          tone="accent"
        />
      ) : null}

      <GlassPanel tone="accent">
        <SectionHeading
          eyebrow={t(heroAppCopy.home.ready)}
          title={hero?.status === "OFFLINE" ? t(heroAppCopy.home.readyBody) : t(heroAppCopy.home.onlineBody)}
          subtitle={lastSyncAt ? `${t(heroAppCopy.home.syncState)} • ${formatAppTime(lastSyncAt, locale)}` : t(heroAppCopy.common.loading)}
        />
        <BottomActionDock
          primary={
            <TayyarButton
              label={hero?.status === "OFFLINE" ? t(heroAppCopy.home.goOnline) : t(heroAppCopy.home.goOffline)}
              onPress={handleToggleStatus}
              loading={statusLoading}
              icon={<HeroSymbol name={hero?.status === "OFFLINE" ? "power" : "pause"} size={18} color="#071019" />}
            />
          }
        />
      </GlassPanel>

      <View style={[styles.metricRow, { flexDirection: rowDirection }]}>
        <MetricTile label={t(heroAppCopy.home.deliveriesToday)} value={earnings.deliveredOrders} />
        <MetricTile label={t(heroAppCopy.home.pendingPayout)} value={formatCurrency(earnings.pendingPayoutAmount, locale)} tone="accent" />
      </View>

      <MetricTile label={t(heroAppCopy.home.totalEarnings)} value={formatCurrency(earnings.totalOrderEarnings, locale)} tone="success" />

      <SectionHeading
        eyebrow={t(heroAppCopy.home.currentMission)}
        title={currentMission ? currentMission.orderNumber : t(heroAppCopy.home.noMissionTitle)}
        subtitle={currentMission ? (currentMission.deliveryAddress || t(heroAppCopy.missions.address)) : t(heroAppCopy.home.noMissionBody)}
      />

      {currentMission ? (
        <GlassPanel>
          <View style={[styles.missionTop, { flexDirection: rowDirection }]}>
            <View style={styles.missionCopy}>
              <Text style={[styles.missionNumber, { textAlign: align }]}>{currentMission.orderNumber}</Text>
              <Text style={[styles.missionBranch, { textAlign: align }]}>{currentMission.branch?.name || t(heroAppCopy.missions.branch)}</Text>
            </View>
            <StatusPill label={statusLabel(currentMission.status, locale)} tone={currentMission.status} />
          </View>
          <Text style={[styles.missionAddress, { textAlign: align }]}>{currentMission.deliveryAddress || t(heroAppCopy.common.noData)}</Text>
          <BottomActionDock
            primary={
              <TayyarButton
                label={t(heroAppCopy.home.openMission)}
                onPress={() => navigation.navigate("OrderDetails", { id: currentMission.id })}
                icon={<HeroSymbol name="route" size={18} color="#071019" />}
              />
            }
          />
        </GlassPanel>
      ) : (
        <EmptyState icon="cube-outline" title={t(heroAppCopy.home.noMissionTitle)} body={t(heroAppCopy.home.noMissionBody)} />
      )}
    </TayyarScreen>
  );
}

function statusLabel(status: string, locale: "ar" | "en") {
  switch (status) {
    case "PICKED_UP":
    case "ON_WAY":
    case "IN_TRANSIT":
      return locale === "ar" ? "في الطريق" : "On the way";
    case "ARRIVED":
      return locale === "ar" ? "وصل" : "Arrived";
    default:
      return locale === "ar" ? "استلام" : "Pickup";
  }
}

const styles = StyleSheet.create({
  metricRow: {
    gap: 12,
  },
  missionTop: {
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  missionCopy: {
    flex: 1,
    gap: 6,
  },
  missionNumber: {
    color: tayyarColors.textPrimary,
    fontSize: 20,
    fontWeight: "700",
  },
  missionBranch: {
    color: tayyarColors.textSecondary,
    fontSize: 14,
  },
  missionAddress: {
    color: tayyarColors.textPrimary,
    fontSize: 15,
    lineHeight: 23,
  },
});
