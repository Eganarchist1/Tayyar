import React from "react";
import { useNavigation } from "@react-navigation/native";
import { Alert, RefreshControl, StyleSheet, Text, View } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import {
  GlassPanel,
  LocaleTogglePill,
  MetricTile,
  SectionHeading,
  StatusPill,
  TayyarButton,
  TayyarScreen,
  TopBrandBar,
} from "@/components/tayyar-ui";
import { formatCurrency, getFontFamily, getHeroStatusMeta, tayyarColors, tayyarFonts, typeRamp } from "@/lib/design";
import { heroAppCopy } from "@/lib/copy";
import { useHeroLocale } from "@/lib/locale";
import { heroFetch, heroLogout, isRetryableHeroError } from "@/lib/api";
import { enqueueHeroAction, flushQueuedHeroActions, getQueuedHeroActionCount } from "@/lib/action-queue";
import { heroFeedback } from "@/lib/feedback";
import { initBackgroundLocation, stopLocationTracking } from "@/hooks/useLocationTracking";
import { useAuthStore } from "@/store/authStore";

type HeroProfile = {
  id: string;
  status: "ONLINE" | "OFFLINE" | "ON_DELIVERY" | "ON_BREAK";
  walletBalance?: number;
  totalDeliveries?: number;
  user?: {
    name?: string | null;
  };
};

type ActiveOrder = {
  id: string;
  orderNumber: string;
  status: string;
  deliveryAddress?: string | null;
  trackingId: string;
  branch?: {
    name?: string | null;
    address?: string | null;
  } | null;
};

type EarningsSummary = {
  deliveredOrders: number;
  pendingPayoutAmount: number;
  totalOrderEarnings: number;
};

const defaultEarnings: EarningsSummary = {
  deliveredOrders: 0,
  pendingPayoutAmount: 0,
  totalOrderEarnings: 0,
};

export default function HeroDashboard() {
  const navigation = useNavigation<any>();
  const { user, token, refreshToken, logout } = useAuthStore();
  const { locale, direction, t } = useHeroLocale();
  const [hero, setHero] = React.useState<HeroProfile | null>(null);
  const [orders, setOrders] = React.useState<ActiveOrder[]>([]);
  const [earnings, setEarnings] = React.useState<EarningsSummary>(defaultEarnings);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [statusLoading, setStatusLoading] = React.useState(false);
  const [syncingQueue, setSyncingQueue] = React.useState(false);
  const [pendingSyncCount, setPendingSyncCount] = React.useState(0);
  const [lastSyncAt, setLastSyncAt] = React.useState<Date | null>(null);
  const [feedback, setFeedback] = React.useState<{ tone: "success" | "gold"; message: string } | null>(null);

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

  const refreshQueuedState = React.useCallback(async () => {
    setPendingSyncCount(await getQueuedHeroActionCount());
  }, []);

  const syncQueuedActions = React.useCallback(
    async (showFeedback = false) => {
      setSyncingQueue(true);
      try {
        const result = await flushQueuedHeroActions(token);
        await loadData();
        await refreshQueuedState();
        if (showFeedback && result.processed > 0) {
          setFeedback({ tone: "success", message: t(heroAppCopy.common.syncedNow) });
        }
      } finally {
        setSyncingQueue(false);
      }
    },
    [loadData, refreshQueuedState, t, token],
  );

  React.useEffect(() => {
    let mounted = true;

    Promise.all([
      flushQueuedHeroActions(token).catch(() => ({ processed: 0, dropped: 0, remaining: 0 })),
      loadData(),
      refreshQueuedState(),
    ])
      .catch((error: unknown) => {
        if (mounted) {
          Alert.alert(
            t(heroAppCopy.common.noData),
            error instanceof Error ? error.message : t(heroAppCopy.common.unexpectedError),
          );
        }
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [loadData, refreshQueuedState, t, token]);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      await syncQueuedActions();
    } catch (error) {
      Alert.alert(
        t(heroAppCopy.common.refresh),
        error instanceof Error ? error.message : t(heroAppCopy.common.unexpectedError),
      );
    } finally {
      setRefreshing(false);
    }
  }, [syncQueuedActions, t]);

  const handleToggleStatus = React.useCallback(async () => {
    if (!hero) {
      return;
    }

    const nextStatus = hero.status === "OFFLINE" ? "ONLINE" : "OFFLINE";
    setStatusLoading(true);
    setFeedback(null);

    try {
      if (nextStatus === "ONLINE") {
        await initBackgroundLocation();
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
      setFeedback({ tone: "success", message: t(heroAppCopy.dashboard.statusUpdated) });
    } catch (error) {
      if (isRetryableHeroError(error)) {
        await enqueueHeroAction({
          kind: "HERO_STATUS",
          path: "/v1/heroes/me/status",
          method: "PATCH",
          body: JSON.stringify({ status: nextStatus }),
        });
        setHero((current) => (current ? { ...current, status: nextStatus } : current));
        await refreshQueuedState();
        heroFeedback.warning();
        setFeedback({ tone: "gold", message: t(heroAppCopy.common.queuedForSync) });
        setStatusLoading(false);
        return;
      }

      if (nextStatus === "ONLINE") {
        await stopLocationTracking().catch(() => undefined);
      }
      heroFeedback.error();
      setFeedback({
        tone: "gold",
        message: error instanceof Error ? error.message : t(heroAppCopy.common.unexpectedError),
      });
      Alert.alert(
        t(heroAppCopy.common.refresh),
        error instanceof Error ? error.message : t(heroAppCopy.common.unexpectedError),
      );
    } finally {
      setStatusLoading(false);
    }
  }, [hero, loadData, refreshQueuedState, t, token]);

  const activeStatus = getHeroStatusMeta(hero?.status, locale);
  const pilotName = user?.name || hero?.user?.name || (locale === "ar" ? "أحمد" : "Ahmed");
  const rowDirection = direction === "rtl" ? "row-reverse" : "row";
  const align = direction === "rtl" ? "right" : "left";
  const syncLabel = lastSyncAt
    ? new Intl.DateTimeFormat(locale === "ar" ? "ar-EG-u-nu-latn" : "en-GB", {
        hour: "2-digit",
        minute: "2-digit",
      }).format(lastSyncAt)
    : "--";

  return (
    <TayyarScreen
      contentContainerStyle={styles.content}
      scroll
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={tayyarColors.gold} />}
    >
      <TopBrandBar
        title={locale === "ar" ? `أهلاً ${pilotName.split(" ")[0]}` : `Hello ${pilotName.split(" ")[0]}`}
        subtitle={t(heroAppCopy.dashboard.subtitle)}
        rightSlot={
          <View style={{ gap: 10 }}>
            <LocaleTogglePill />
            <TayyarButton
              label={t(heroAppCopy.common.signOut)}
              variant="outline"
              onPress={async () => {
                await heroLogout(refreshToken);
                logout();
              }}
              icon={<Ionicons name="log-out-outline" size={18} color={tayyarColors.textPrimary} />}
            />
          </View>
        }
      />

      <GlassPanel style={styles.heroCard} tone="sky">
        <View style={[styles.heroCardHeader, { flexDirection: rowDirection }]}>
          <View style={styles.heroCopy}>
            <Text style={[styles.heroEyebrow, { fontFamily: getFontFamily(locale, "bodyMedium"), textAlign: align }]}>
              {t(heroAppCopy.dashboard.workState)}
            </Text>
            <Text style={[styles.heroTitle, { fontFamily: getFontFamily(locale, "display"), textAlign: align }]}>
              {hero?.status === "OFFLINE" ? t(heroAppCopy.dashboard.readyQuestion) : t(heroAppCopy.dashboard.onlineNow)}
            </Text>
            <Text style={[styles.heroSubtitle, { fontFamily: getFontFamily(locale, "body"), textAlign: align }]}>
              {hero?.status === "OFFLINE"
                ? t(heroAppCopy.dashboard.offlineBody)
                : t(heroAppCopy.dashboard.onlineBody)}
            </Text>
          </View>
          <StatusPill label={activeStatus.label} />
        </View>

        <View style={[styles.heroMetaRow, { flexDirection: rowDirection }]}>
          <View style={styles.heroMetaItem}>
            <Text style={styles.heroMetaValue}>{orders.length}</Text>
            <Text style={[styles.heroMetaLabel, { fontFamily: getFontFamily(locale, "bodyMedium") }]}>
              {t(heroAppCopy.dashboard.activeMissions)}
            </Text>
          </View>
          <View style={styles.heroMetaDivider} />
          <View style={styles.heroMetaItem}>
            <Text style={styles.heroMetaValue}>{earnings.deliveredOrders}</Text>
            <Text style={[styles.heroMetaLabel, { fontFamily: getFontFamily(locale, "bodyMedium") }]}>
              {t(heroAppCopy.dashboard.completedToday)}
            </Text>
          </View>
          <View style={styles.heroMetaDivider} />
          <View style={styles.heroMetaItem}>
            <Text style={styles.heroMetaValue}>
              {loading ? "..." : formatCurrency(earnings.totalOrderEarnings, locale)}
            </Text>
            <Text style={[styles.heroMetaLabel, { fontFamily: getFontFamily(locale, "bodyMedium") }]}>
              {t(heroAppCopy.dashboard.todayIncome)}
            </Text>
          </View>
        </View>

        <TayyarButton
          label={hero?.status === "OFFLINE" ? t(heroAppCopy.dashboard.turnOn) : t(heroAppCopy.dashboard.turnOff)}
          onPress={handleToggleStatus}
          loading={statusLoading}
          icon={<Ionicons name={hero?.status === "OFFLINE" ? "power" : "pause-circle"} size={18} color="#071019" />}
        />
        <Text style={[styles.syncStamp, { fontFamily: getFontFamily(locale, "bodyMedium"), textAlign: align }]}>
          {`${t(heroAppCopy.dashboard.lastSync)}: ${syncLabel}`}
        </Text>
      </GlassPanel>

      {pendingSyncCount ? (
        <GlassPanel style={styles.syncCard} tone="gold">
          <Text style={[styles.syncCardTitle, { fontFamily: getFontFamily(locale, "heading"), textAlign: align }]}>
            {`${pendingSyncCount} ${t(heroAppCopy.common.pendingSync)}`}
          </Text>
          <Text style={[styles.syncCardCopy, { fontFamily: getFontFamily(locale, "body"), textAlign: align }]}>
            {t(heroAppCopy.dashboard.pendingSyncBody)}
          </Text>
          <TayyarButton
            label={t(heroAppCopy.common.syncNow)}
            variant="secondary"
            loading={syncingQueue}
            onPress={() => syncQueuedActions(true)}
            icon={<Ionicons name="sync-outline" size={18} color={tayyarColors.textPrimary} />}
          />
        </GlassPanel>
      ) : null}

      {feedback ? (
        <GlassPanel style={styles.feedbackCard} tone={feedback.tone === "success" ? "success" : "gold"}>
          <Text style={[styles.feedbackText, { fontFamily: getFontFamily(locale, "bodyMedium"), textAlign: align }]}>
            {feedback.message}
          </Text>
        </GlassPanel>
      ) : null}

      <View style={[styles.metricsRow, { flexDirection: rowDirection }]}>
        <MetricTile
          label={t(heroAppCopy.dashboard.totalEarnings)}
          value={loading ? "..." : formatCurrency(earnings.totalOrderEarnings, locale)}
          tone="gold"
        />
        <MetricTile
          label={t(heroAppCopy.dashboard.payoutDue)}
          value={loading ? "..." : formatCurrency(earnings.pendingPayoutAmount, locale)}
          tone="sky"
        />
      </View>

      <SectionHeading
        eyebrow={t(heroAppCopy.dashboard.quickView)}
        title={t(heroAppCopy.dashboard.todayMetrics)}
        subtitle={t(heroAppCopy.dashboard.subtitle)}
      />

      <View style={[styles.metricsRow, { flexDirection: rowDirection }]}>
        <MetricTile label={t(heroAppCopy.dashboard.completedToday)} value={earnings.deliveredOrders} tone="success" />
        <MetricTile label={t(heroAppCopy.wallet.availableBalance)} value={formatCurrency(hero?.walletBalance || 0, locale)} />
      </View>

      <SectionHeading
        eyebrow={t(heroAppCopy.dashboard.missionFlow)}
        title={t(heroAppCopy.dashboard.currentMissions)}
        subtitle={t(heroAppCopy.dashboard.missionsSubtitle)}
      />

      <View style={styles.orderList}>
        {orders.length ? (
          orders.map((order) => (
            <GlassPanel key={order.id} style={styles.orderCard}>
              <View style={[styles.orderTopRow, { flexDirection: rowDirection }]}>
                <View style={styles.orderBadge}>
                  <Ionicons name="paper-plane-outline" size={16} color={tayyarColors.skyLight} />
                  <Text style={styles.orderBadgeText}>{order.orderNumber}</Text>
                </View>
                <StatusPill label={order.status} tone={hero?.status} />
              </View>

              <Text style={[styles.orderMerchant, { fontFamily: getFontFamily(locale, "heading"), textAlign: align }]}>
                {order.branch?.name || t(heroAppCopy.dashboard.activeMissions)}
              </Text>
              <Text style={[styles.orderAddress, { fontFamily: getFontFamily(locale, "body"), textAlign: align }]}>
                {order.deliveryAddress || order.branch?.address || t(heroAppCopy.common.noAddress)}
              </Text>

              <View style={[styles.orderFooter, { flexDirection: rowDirection }]}>
                <Text style={styles.orderTracking}>#{order.trackingId.slice(0, 8)}</Text>
                <TayyarButton
                  label={t(heroAppCopy.dashboard.openMission)}
                  variant="secondary"
                  onPress={() => navigation.navigate("OrderDetails", { id: order.id })}
                  icon={<Ionicons name={direction === "rtl" ? "arrow-forward" : "arrow-back"} size={16} color={tayyarColors.textPrimary} />}
                />
              </View>
            </GlassPanel>
          ))
        ) : (
          <GlassPanel style={styles.emptyCard}>
            <Ionicons name="sparkles-outline" size={28} color={tayyarColors.goldLight} />
            <Text style={[styles.emptyTitle, { fontFamily: getFontFamily(locale, "heading"), textAlign: "center" }]}>
              {hero?.status === "OFFLINE" ? t(heroAppCopy.common.offline) : t(heroAppCopy.dashboard.noMissionsOnline)}
            </Text>
            <Text style={[styles.emptyCopy, { fontFamily: getFontFamily(locale, "body"), textAlign: "center" }]}>
              {hero?.status === "OFFLINE"
                ? t(heroAppCopy.dashboard.noMissionsOffline)
                : t(heroAppCopy.dashboard.noMissionsOnline)}
            </Text>
          </GlassPanel>
        )}
      </View>

      <View style={styles.bottomSpacer} />
    </TayyarScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 18,
  },
  heroCard: {
    gap: 18,
  },
  heroCardHeader: {
    justifyContent: "space-between",
    gap: 16,
    alignItems: "flex-start",
  },
  heroCopy: {
    flex: 1,
    gap: 6,
  },
  heroEyebrow: {
    ...typeRamp.label,
    color: tayyarColors.goldLight,
  },
  heroTitle: {
    fontSize: 28,
    color: tayyarColors.textPrimary,
  },
  heroSubtitle: {
    ...typeRamp.body,
  },
  heroMetaRow: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: tayyarColors.border,
    backgroundColor: "rgba(255,255,255,0.03)",
    paddingVertical: 16,
    paddingHorizontal: 12,
    alignItems: "center",
  },
  heroMetaItem: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  heroMetaDivider: {
    width: 1,
    height: 42,
    backgroundColor: tayyarColors.border,
  },
  heroMetaValue: {
    fontFamily: tayyarFonts.mono,
    fontSize: 18,
    color: tayyarColors.textPrimary,
  },
  heroMetaLabel: {
    ...typeRamp.label,
  },
  syncStamp: {
    ...typeRamp.label,
    color: tayyarColors.textSecondary,
  },
  syncCard: {
    gap: 10,
  },
  syncCardTitle: {
    fontSize: 18,
    color: tayyarColors.textPrimary,
  },
  syncCardCopy: {
    ...typeRamp.body,
  },
  feedbackCard: {
    gap: 8,
  },
  feedbackText: {
    ...typeRamp.bodyStrong,
  },
  metricsRow: {
    gap: 12,
  },
  orderList: {
    gap: 12,
  },
  orderCard: {
    gap: 14,
  },
  orderTopRow: {
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  orderBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(41,182,246,0.10)",
    borderWidth: 1,
    borderColor: "rgba(41,182,246,0.18)",
  },
  orderBadgeText: {
    fontFamily: tayyarFonts.mono,
    color: tayyarColors.skyLight,
    fontSize: 12,
  },
  orderMerchant: {
    fontSize: 18,
    color: tayyarColors.textPrimary,
  },
  orderAddress: {
    ...typeRamp.body,
  },
  orderFooter: {
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  orderTracking: {
    fontFamily: tayyarFonts.mono,
    fontSize: 12,
    color: tayyarColors.textTertiary,
  },
  emptyCard: {
    alignItems: "center",
    gap: 10,
    paddingVertical: 28,
  },
  emptyTitle: {
    fontSize: 18,
    color: tayyarColors.textPrimary,
  },
  emptyCopy: {
    ...typeRamp.body,
  },
  bottomSpacer: {
    height: 8,
  },
});
