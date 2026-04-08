import React from "react";
import { Alert, Linking, RefreshControl, StyleSheet, Text, TextInput, View } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import Ionicons from "react-native-vector-icons/Ionicons";
import {
  Banner,
  BottomActionDock,
  GlassPanel,
  OtpCodeInput,
  SectionHeading,
  StatusPill,
  TayyarButton,
  TayyarScreen,
} from "@/components/tayyar-ui";
import MissionMap from "@/components/MissionMap";
import { heroAppCopy } from "@/lib/copy";
import { enqueueHeroAction, flushQueuedHeroActions, getQueuedHeroActionCount } from "@/lib/action-queue";
import { heroFetch, isRetryableHeroError } from "@/lib/api";
import { heroFeedback } from "@/lib/feedback";
import { formatAppTime, getFontFamily, getOrderStage, tayyarColors, typeRamp } from "@/lib/design";
import { useHeroLocale } from "@/lib/locale";
import { useAuthStore } from "@/store/authStore";

type OrderDetails = {
  id: string;
  orderNumber: string;
  trackingId: string;
  status: string;
  deliveryAddress?: string | null;
  deliveryLat: number;
  deliveryLng: number;
  pickupLat: number;
  pickupLng: number;
  customerPhone: string;
  branch?: {
    name?: string | null;
    address?: string | null;
    phone?: string | null;
  } | null;
};

export default function OrderDetailsScreen() {
  const route = useRoute<any>();
  const id = route.params?.id as string | undefined;
  const navigation = useNavigation<any>();
  const { token } = useAuthStore();
  const { locale, direction, t } = useHeroLocale();
  const [order, setOrder] = React.useState<OrderDetails | null>(null);
  const [otp, setOtp] = React.useState("");
  const [refreshing, setRefreshing] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [syncingQueue, setSyncingQueue] = React.useState(false);
  const [pendingSyncCount, setPendingSyncCount] = React.useState(0);
  const [banner, setBanner] = React.useState<{ tone: "accent" | "warning" | "success"; title: string; body: string } | null>(null);
  const [lastSyncAt, setLastSyncAt] = React.useState<Date | null>(null);

  const loadOrder = React.useCallback(async () => {
    const activeOrders = await heroFetch<OrderDetails[]>("/v1/heroes/orders/active", undefined, token);
    const nextOrder = activeOrders.find((item) => item.id === id);
    if (!nextOrder) {
      throw new Error(t(heroAppCopy.order.unavailable));
    }
    setOrder(nextOrder);
    setLastSyncAt(new Date());
  }, [id, t, token]);

  const refreshQueuedState = React.useCallback(async () => {
    setPendingSyncCount(await getQueuedHeroActionCount());
  }, []);

  React.useEffect(() => {
    loadOrder()
      .then(refreshQueuedState)
      .catch((error: unknown) => {
        Alert.alert(
          t(heroAppCopy.order.currentMission),
          error instanceof Error ? error.message : t(heroAppCopy.common.unexpectedError),
        );
        navigation.goBack();
      });
  }, [loadOrder, navigation, refreshQueuedState, t]);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      await flushQueuedHeroActions(token).catch(() => ({ processed: 0, dropped: 0, remaining: 0 }));
      await loadOrder();
      await refreshQueuedState();
    } catch (error) {
      Alert.alert(
        t(heroAppCopy.common.refresh),
        error instanceof Error ? error.message : t(heroAppCopy.common.unexpectedError),
      );
    } finally {
      setRefreshing(false);
    }
  }, [loadOrder, refreshQueuedState, t, token]);

  async function syncQueuedActions() {
    setSyncingQueue(true);
    try {
      await flushQueuedHeroActions(token);
      await loadOrder();
      await refreshQueuedState();
      setBanner({
        tone: "success",
        title: t(heroAppCopy.common.syncedNow),
        body: t(heroAppCopy.common.syncedNow),
      });
    } finally {
      setSyncingQueue(false);
    }
  }

  function callPhone(phone?: string | null) {
    if (!phone) {
      Alert.alert(t(heroAppCopy.order.noPhoneTitle), t(heroAppCopy.order.noPhoneBody));
      return;
    }
    Linking.openURL(`tel:${phone}`).catch(() => {
      Alert.alert(t(heroAppCopy.order.noPhoneTitle), t(heroAppCopy.order.callError));
    });
  }

  function openMaps() {
    if (!order) return;
    const stage = getOrderStage(order.status);
    const lat = stage === "pickup" ? order.pickupLat : order.deliveryLat;
    const lng = stage === "pickup" ? order.pickupLng : order.deliveryLng;
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`).catch(() => {
      Alert.alert(t(heroAppCopy.order.routeTitle), t(heroAppCopy.order.mapsError));
    });
  }

  async function handlePrimaryAction() {
    if (!order) return;
    const stage = getOrderStage(order.status);
    setSubmitting(true);
    setBanner(null);
    try {
      if (stage === "pickup") {
        await heroFetch(
          `/v1/heroes/orders/${order.id}/status`,
          { method: "PATCH", body: JSON.stringify({ status: "PICKED_UP" }) },
          token,
        );
      } else if (stage === "enroute") {
        await heroFetch(`/v1/orders/${order.id}/arrived`, { method: "POST" }, token);
      } else if (stage === "handoff") {
        if (otp.length !== 4) {
          throw new Error(t(heroAppCopy.order.otpRequired));
        }
        await heroFetch(
          `/v1/orders/${order.id}/verify`,
          { method: "POST", body: JSON.stringify({ otp }) },
          token,
        );
        heroFeedback.success();
        navigation.goBack();
        return;
      } else {
        navigation.goBack();
        return;
      }

      heroFeedback.impact();
      await loadOrder();
      await refreshQueuedState();
    } catch (error) {
      if (isRetryableHeroError(error) && stage !== "handoff") {
        await enqueueHeroAction({
          kind: stage === "pickup" ? "ORDER_STATUS" : "ORDER_ARRIVED",
          path: stage === "pickup" ? `/v1/heroes/orders/${order.id}/status` : `/v1/orders/${order.id}/arrived`,
          method: stage === "pickup" ? "PATCH" : "POST",
          body: stage === "pickup" ? JSON.stringify({ status: "PICKED_UP" }) : undefined,
        });
        await refreshQueuedState();
        heroFeedback.warning();
        setBanner({
          tone: "warning",
          title: t(heroAppCopy.common.pendingSync),
          body: t(heroAppCopy.order.offlineQueuedBody),
        });
      } else {
        heroFeedback.error();
        Alert.alert(
          t(heroAppCopy.common.retry),
          error instanceof Error ? error.message : t(heroAppCopy.common.unexpectedError),
        );
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (!order) {
    return (
      <TayyarScreen scroll={false} contentContainerStyle={styles.loadingScreen}>
        <Text style={[styles.loadingText, { fontFamily: getFontFamily(locale, "body") }]}>
          {t(heroAppCopy.order.loading)}
        </Text>
      </TayyarScreen>
    );
  }

  const stage = getOrderStage(order.status);
  const actionLabel =
    stage === "pickup"
      ? t(heroAppCopy.order.confirmPickup)
      : stage === "enroute"
        ? t(heroAppCopy.order.arrivedCustomer)
        : stage === "handoff"
          ? t(heroAppCopy.order.confirmDelivery)
          : t(heroAppCopy.common.back);
  const align = direction === "rtl" ? "right" : "left";
  const rowDirection = direction === "rtl" ? "row-reverse" : "row";

  return (
    <TayyarScreen
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={tayyarColors.gold} />}
    >
      <View style={[styles.header, { flexDirection: rowDirection }]}>
        <TayyarButton
          label={t(heroAppCopy.common.back)}
          variant="outline"
          onPress={() => navigation.goBack()}
          icon={<Ionicons name={direction === "rtl" ? "arrow-forward" : "arrow-back"} size={16} color={tayyarColors.textPrimary} />}
        />
        <View style={styles.headerCopy}>
          <Text style={[styles.headerEyebrow, { fontFamily: getFontFamily(locale, "bodyMedium"), textAlign: align }]}>
            {t(heroAppCopy.order.currentMission)}
          </Text>
          <Text style={[styles.headerTitle, { fontFamily: getFontFamily(locale, "display"), textAlign: align }]}>
            {order.orderNumber}
          </Text>
          {lastSyncAt ? (
            <Text style={[styles.syncText, { fontFamily: getFontFamily(locale, "body"), textAlign: align }]}>
              {formatAppTime(lastSyncAt, locale)}
            </Text>
          ) : null}
        </View>
      </View>

      {banner ? <Banner title={banner.title} body={banner.body} tone={banner.tone} /> : null}

      <GlassPanel tone="accent" style={styles.heroCard}>
        <View style={[styles.heroTop, { flexDirection: rowDirection }]}>
          <StatusPill label={stageLabel(stage, locale)} tone={stage === "done" ? "ONLINE" : "ON_DELIVERY"} />
          <Text style={styles.trackingText}>#{order.trackingId.slice(0, 8)}</Text>
        </View>
        <Text style={[styles.heroHeadline, { fontFamily: getFontFamily(locale, "heading"), textAlign: align }]}>
          {stage === "pickup"
            ? t(heroAppCopy.order.pickupFirst)
            : stage === "enroute"
              ? t(heroAppCopy.order.enroute)
              : stage === "handoff"
                ? t(heroAppCopy.order.handoff)
                : t(heroAppCopy.order.completed)}
        </Text>
        <Text style={[styles.heroBody, { fontFamily: getFontFamily(locale, "body"), textAlign: align }]}>
          {order.deliveryAddress || t(heroAppCopy.order.unavailableAddress)}
        </Text>
      </GlassPanel>

      {pendingSyncCount ? (
        <GlassPanel tone="warning">
          <Text style={[styles.syncHeading, { fontFamily: getFontFamily(locale, "heading"), textAlign: align }]}>
            {`${pendingSyncCount} ${t(heroAppCopy.common.pendingSync)}`}
          </Text>
          <Text style={[styles.heroBody, { fontFamily: getFontFamily(locale, "body"), textAlign: align }]}>
            {t(heroAppCopy.order.offlineQueuedBody)}
          </Text>
          <TayyarButton
            label={t(heroAppCopy.common.refresh)}
            variant="secondary"
            loading={syncingQueue}
            onPress={syncQueuedActions}
            icon={<Ionicons name="sync-outline" size={18} color={tayyarColors.textPrimary} />}
          />
        </GlassPanel>
      ) : null}

      <SectionHeading
        eyebrow={t(heroAppCopy.order.route)}
        title={t(heroAppCopy.order.routeTitle)}
        subtitle={t(heroAppCopy.order.routeSubtitle)}
      />

      <GlassPanel style={styles.routeCard}>
        <View style={[styles.routeStep, { flexDirection: rowDirection }]}>
          <View style={[styles.routeMarker, { backgroundColor: tayyarColors.gold }]} />
          <View style={styles.routeContent}>
            <Text style={[styles.routeLabel, { fontFamily: getFontFamily(locale, "bodyMedium"), textAlign: align }]}>
              {t(heroAppCopy.order.pickup)}
            </Text>
            <Text style={[styles.routeTitle, { fontFamily: getFontFamily(locale, "heading"), textAlign: align }]}>
              {order.branch?.name || t(heroAppCopy.order.branch)}
            </Text>
            <Text style={[styles.routeText, { fontFamily: getFontFamily(locale, "body"), textAlign: align }]}>
              {order.branch?.address || t(heroAppCopy.order.unavailableAddress)}
            </Text>
          </View>
        </View>

        <View style={[styles.routeDivider, direction === "rtl" ? { marginRight: 7 } : { marginLeft: 7 }]} />

        <View style={[styles.routeStep, { flexDirection: rowDirection }]}>
          <View style={[styles.routeMarker, { backgroundColor: tayyarColors.sky }]} />
          <View style={styles.routeContent}>
            <Text style={[styles.routeLabel, { fontFamily: getFontFamily(locale, "bodyMedium"), textAlign: align }]}>
              {t(heroAppCopy.order.dropoff)}
            </Text>
            <Text style={[styles.routeTitle, { fontFamily: getFontFamily(locale, "heading"), textAlign: align }]}>
              {order.customerPhone}
            </Text>
            <Text style={[styles.routeText, { fontFamily: getFontFamily(locale, "body"), textAlign: align }]}>
              {order.deliveryAddress || t(heroAppCopy.order.unavailableAddress)}
            </Text>
          </View>
        </View>
      </GlassPanel>

      <MissionMap
        pickupLat={order.pickupLat}
        pickupLng={order.pickupLng}
        deliveryLat={order.deliveryLat}
        deliveryLng={order.deliveryLng}
      />

      <View style={[styles.rowActions, { flexDirection: rowDirection }]}>
        <TayyarButton
          label={t(heroAppCopy.order.callBranch)}
          variant="secondary"
          onPress={() => callPhone(order.branch?.phone)}
          style={styles.flexButton}
          icon={<Ionicons name="call-outline" size={18} color={tayyarColors.textPrimary} />}
        />
        <TayyarButton
          label={t(heroAppCopy.order.callCustomer)}
          variant="secondary"
          onPress={() => callPhone(order.customerPhone)}
          style={styles.flexButton}
          icon={<Ionicons name="call-outline" size={18} color={tayyarColors.textPrimary} />}
        />
      </View>

      <TayyarButton
        label={t(heroAppCopy.order.openMaps)}
        variant="outline"
        onPress={openMaps}
        icon={<Ionicons name="navigate-outline" size={18} color={tayyarColors.textPrimary} />}
      />

      {stage === "handoff" ? (
        <GlassPanel tone="warning" style={styles.otpCard}>
          <Text style={[styles.otpTitle, { fontFamily: getFontFamily(locale, "heading"), textAlign: align }]}>
            {t(heroAppCopy.order.otpTitle)}
          </Text>
          <Text style={[styles.heroBody, { fontFamily: getFontFamily(locale, "body"), textAlign: align }]}>
            {t(heroAppCopy.order.otpBody)}
          </Text>
          <OtpCodeInput value={otp} onChangeText={setOtp} />
          <TextInput
            value={otp}
            onChangeText={(value) => setOtp(value.replace(/[^\d]/g, "").slice(0, 4))}
            keyboardType="number-pad"
            maxLength={4}
            placeholder="1234"
            placeholderTextColor={tayyarColors.textTertiary}
            style={[styles.otpInput, { fontFamily: getFontFamily("en", "mono") }]}
          />
        </GlassPanel>
      ) : null}

      <BottomActionDock
        primary={
          <TayyarButton
            label={actionLabel}
            onPress={handlePrimaryAction}
            loading={submitting}
            icon={<Ionicons name="arrow-forward-circle-outline" size={18} color="#071019" />}
          />
        }
      />
    </TayyarScreen>
  );
}

function stageLabel(stage: string, locale: "ar" | "en") {
  switch (stage) {
    case "pickup":
      return locale === "ar" ? "استلام" : "Pickup";
    case "enroute":
      return locale === "ar" ? "في الطريق" : "En route";
    case "handoff":
      return locale === "ar" ? "تسليم" : "Handoff";
    case "done":
      return locale === "ar" ? "مكتملة" : "Done";
    default:
      return locale === "ar" ? "مراجعة" : "Review";
  }
}

const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    ...typeRamp.body,
    color: tayyarColors.textPrimary,
  },
  header: {
    justifyContent: "space-between",
    alignItems: "center",
    gap: 14,
  },
  headerCopy: {
    flex: 1,
    gap: 4,
  },
  headerEyebrow: {
    ...typeRamp.label,
    color: tayyarColors.textSecondary,
  },
  headerTitle: {
    fontSize: 26,
    color: tayyarColors.textPrimary,
  },
  syncText: {
    ...typeRamp.body,
    color: tayyarColors.textTertiary,
  },
  heroCard: {
    gap: 10,
  },
  heroTop: {
    justifyContent: "space-between",
    alignItems: "center",
  },
  trackingText: {
    fontFamily: "monospace",
    fontSize: 12,
    color: tayyarColors.textTertiary,
  },
  heroHeadline: {
    fontSize: 22,
    color: tayyarColors.textPrimary,
  },
  heroBody: {
    ...typeRamp.body,
    color: tayyarColors.textSecondary,
  },
  syncHeading: {
    fontSize: 18,
    color: tayyarColors.textPrimary,
  },
  routeCard: {
    gap: 8,
  },
  routeStep: {
    gap: 14,
    alignItems: "flex-start",
  },
  routeMarker: {
    width: 14,
    height: 14,
    borderRadius: 14,
    marginTop: 5,
  },
  routeContent: {
    flex: 1,
    gap: 4,
  },
  routeLabel: {
    ...typeRamp.label,
    color: tayyarColors.textSecondary,
  },
  routeTitle: {
    fontSize: 18,
    color: tayyarColors.textPrimary,
  },
  routeText: {
    ...typeRamp.body,
    color: tayyarColors.textSecondary,
  },
  routeDivider: {
    width: 2,
    height: 28,
    backgroundColor: tayyarColors.borderStrong,
  },
  rowActions: {
    gap: 12,
  },
  flexButton: {
    flex: 1,
  },
  otpCard: {
    gap: 10,
  },
  otpTitle: {
    fontSize: 20,
    color: tayyarColors.textPrimary,
  },
  otpInput: {
    minHeight: 58,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: tayyarColors.border,
    backgroundColor: "rgba(255,255,255,0.04)",
    color: tayyarColors.textPrimary,
    textAlign: "center",
    fontSize: 24,
    letterSpacing: 8,
  },
});
