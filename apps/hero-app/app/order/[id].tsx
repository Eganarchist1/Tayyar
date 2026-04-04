import React from "react";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Alert, Linking, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { GlassPanel, SectionHeading, StatusPill, TayyarButton, TayyarScreen } from "@/components/tayyar-ui";
import MissionMap from "@/components/MissionMap";
import { getOrderStage, getFontFamily, tayyarColors, tayyarFonts, typeRamp } from "@/lib/design";
import { heroAppCopy } from "@/lib/copy";
import { useHeroLocale } from "@/lib/locale";
import { heroFetch, isRetryableHeroError } from "@/lib/api";
import { enqueueHeroAction, flushQueuedHeroActions, getQueuedHeroActionCount } from "@/lib/action-queue";
import { heroFeedback } from "@/lib/feedback";
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
  const [feedback, setFeedback] = React.useState<{ tone: "success" | "gold"; message: string } | null>(null);
  const otpInputRef = React.useRef<TextInput | null>(null);
  const rowDirection = direction === "rtl" ? "row-reverse" : "row";
  const align = direction === "rtl" ? "right" : "left";

  const loadOrder = React.useCallback(async () => {
    const activeOrders = await heroFetch<OrderDetails[]>("/v1/heroes/orders/active", undefined, token);
    const activeOrder = activeOrders.find((item) => item.id === id);

    if (!activeOrder) {
      throw new Error(t(heroAppCopy.order.unavailable));
    }

    setOrder(activeOrder);
  }, [id, t, token]);

  const refreshQueuedState = React.useCallback(async () => {
    setPendingSyncCount(await getQueuedHeroActionCount());
  }, []);

  const loadScreenData = React.useCallback(async () => {
    await flushQueuedHeroActions(token).catch(() => ({ processed: 0, dropped: 0, remaining: 0 }));
    await loadOrder();
    await refreshQueuedState();
  }, [loadOrder, refreshQueuedState, token]);

  const syncQueuedActions = React.useCallback(async () => {
    setSyncingQueue(true);
    try {
      const result = await flushQueuedHeroActions(token);
      await loadOrder();
      await refreshQueuedState();
      if (result.processed > 0) {
        setFeedback({ tone: "success", message: t(heroAppCopy.common.syncedNow) });
      }
    } finally {
      setSyncingQueue(false);
    }
  }, [loadOrder, refreshQueuedState, t, token]);

  React.useEffect(() => {
    loadScreenData().catch((error: unknown) => {
      Alert.alert(
        t(heroAppCopy.order.currentMission),
        error instanceof Error ? error.message : t(heroAppCopy.common.unexpectedError),
      );
      navigation.goBack();
    });
  }, [loadScreenData, navigation, t]);

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

  const stage = getOrderStage(order?.status);
  const actionLabel =
    stage === "pickup"
      ? t(heroAppCopy.order.confirmPickup)
      : stage === "enroute"
        ? t(heroAppCopy.order.arrivedCustomer)
        : stage === "handoff"
          ? t(heroAppCopy.order.confirmDelivery)
          : t(heroAppCopy.common.back);

  const actionIcon =
    stage === "pickup"
      ? "cube-outline"
      : stage === "enroute"
        ? "navigate-circle-outline"
        : stage === "handoff"
          ? "shield-checkmark-outline"
          : "arrow-back";

  const missionStages = [
    { key: "pickup", label: stageLabel("pickup", locale) },
    { key: "enroute", label: stageLabel("enroute", locale) },
    { key: "handoff", label: stageLabel("handoff", locale) },
    { key: "done", label: stageLabel("done", locale) },
  ] as const;

  const currentStageIndex = Math.max(0, missionStages.findIndex((item) => item.key === stage));

  async function handlePrimaryAction() {
    if (!order) {
      return;
    }

    setSubmitting(true);
    setFeedback(null);

    try {
      if (stage === "pickup") {
        await heroFetch(
          `/v1/heroes/orders/${order.id}/status`,
          {
            method: "PATCH",
            body: JSON.stringify({ status: "PICKED_UP" }),
          },
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
          {
            method: "POST",
            body: JSON.stringify({ otp }),
          },
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
    } catch (error) {
      if (isRetryableHeroError(error) && stage !== "handoff") {
        const queuedAction =
          stage === "pickup"
            ? {
                kind: "ORDER_STATUS" as const,
                path: `/v1/heroes/orders/${order.id}/status`,
                method: "PATCH" as const,
                body: JSON.stringify({ status: "PICKED_UP" }),
              }
            : {
                kind: "ORDER_ARRIVED" as const,
                path: `/v1/orders/${order.id}/arrived`,
                method: "POST" as const,
              };

        await enqueueHeroAction(queuedAction);
        setOrder((current) =>
          current
            ? {
                ...current,
                status: stage === "pickup" ? "PICKED_UP" : "ARRIVED",
              }
            : current,
        );
        await refreshQueuedState();
        heroFeedback.warning();
        setFeedback({ tone: "gold", message: t(heroAppCopy.order.offlineQueuedBody) });
        return;
      }

      if (isRetryableHeroError(error) && stage === "handoff") {
        heroFeedback.warning();
        Alert.alert(t(heroAppCopy.common.pendingSync), t(heroAppCopy.order.verifyNeedsConnection));
        return;
      }

      heroFeedback.error();
      Alert.alert(
        t(heroAppCopy.common.refresh),
        error instanceof Error ? error.message : t(heroAppCopy.common.unexpectedError),
      );
    } finally {
      setSubmitting(false);
    }
  }

  function callBranch() {
    if (!order?.branch?.phone) {
      Alert.alert(t(heroAppCopy.order.noPhoneTitle), t(heroAppCopy.order.noPhoneBody));
      return;
    }
    Linking.openURL(`tel:${order.branch.phone}`).catch(() => {
      Alert.alert(t(heroAppCopy.order.noPhoneTitle), t(heroAppCopy.order.callError));
    });
  }

  function openMaps() {
    if (!order) {
      return;
    }

    const lat = stage === "pickup" ? order.pickupLat : order.deliveryLat;
    const lng = stage === "pickup" ? order.pickupLng : order.deliveryLng;
    const label = stage === "pickup" ? order.branch?.name || "Pickup" : order.deliveryAddress || "Customer";
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lng} ${label}`)}`;

    Linking.openURL(url).catch(() => {
      Alert.alert(t(heroAppCopy.order.routeTitle), t(heroAppCopy.order.mapsError));
    });
  }

  function callCustomer() {
    if (!order?.customerPhone) {
      Alert.alert(t(heroAppCopy.order.noPhoneTitle), t(heroAppCopy.order.noPhoneBody));
      return;
    }

    Linking.openURL(`tel:${order.customerPhone}`).catch(() => {
      Alert.alert(t(heroAppCopy.order.noPhoneTitle), t(heroAppCopy.order.callError));
    });
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
        <View style={[styles.headerCopy, { alignItems: direction === "rtl" ? "flex-end" : "flex-start" }]}>
          <Text style={[styles.headerEyebrow, { fontFamily: getFontFamily(locale, "bodyMedium"), textAlign: align }]}>
            {t(heroAppCopy.order.currentMission)}
          </Text>
          <Text style={[styles.headerTitle, { fontFamily: getFontFamily(locale, "display"), textAlign: align }]}>
            {order.orderNumber}
          </Text>
        </View>
      </View>

      <GlassPanel style={styles.statusCard} tone="sky">
        <View style={[styles.statusTopRow, { flexDirection: rowDirection }]}>
          <StatusPill label={stageLabel(stage, locale)} />
          <Text style={styles.statusTracking}>#{order.trackingId.slice(0, 8)}</Text>
        </View>
        <Text style={[styles.statusHeadline, { fontFamily: getFontFamily(locale, "heading"), textAlign: align }]}>
          {stage === "pickup"
            ? t(heroAppCopy.order.pickupFirst)
            : stage === "enroute"
              ? t(heroAppCopy.order.enroute)
              : stage === "handoff"
                ? t(heroAppCopy.order.handoff)
                : t(heroAppCopy.order.completed)}
        </Text>
        <Text style={[styles.statusCopy, { fontFamily: getFontFamily(locale, "body"), textAlign: align }]}>
          {stage === "pickup"
            ? order.branch?.address || t(heroAppCopy.order.unavailableAddress)
            : order.deliveryAddress || t(heroAppCopy.order.unavailableAddress)}
        </Text>
      </GlassPanel>

      {pendingSyncCount ? (
        <GlassPanel style={styles.syncCard} tone="gold">
          <Text style={[styles.syncTitle, { fontFamily: getFontFamily(locale, "heading"), textAlign: align }]}>
            {`${pendingSyncCount} ${t(heroAppCopy.common.pendingSync)}`}
          </Text>
          <Text style={[styles.syncCopy, { fontFamily: getFontFamily(locale, "body"), textAlign: align }]}>
            {t(heroAppCopy.order.offlineQueuedBody)}
          </Text>
          <TayyarButton
            label={t(heroAppCopy.common.syncNow)}
            variant="secondary"
            loading={syncingQueue}
            onPress={syncQueuedActions}
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

      <GlassPanel style={styles.progressCard}>
        <Text style={[styles.progressTitle, { fontFamily: getFontFamily(locale, "bodyMedium"), textAlign: align }]}>
          {locale === "ar" ? "مراحل المهمة" : "Mission stages"}
        </Text>
        <View style={[styles.progressRow, { flexDirection: rowDirection }]}>
          {missionStages.map((item, index) => {
            const completed = index < currentStageIndex || stage === "done";
            const active = index === currentStageIndex && stage !== "done";
            return (
              <React.Fragment key={item.key}>
                <View style={styles.progressNode}>
                  <View
                    style={[
                      styles.progressDot,
                      completed && styles.progressDotComplete,
                      active && styles.progressDotActive,
                    ]}
                  >
                    <Text style={styles.progressDotText}>{index + 1}</Text>
                  </View>
                  <Text
                    style={[
                      styles.progressLabel,
                      { fontFamily: getFontFamily(locale, "bodyMedium"), textAlign: "center" },
                      completed && styles.progressLabelComplete,
                      active && styles.progressLabelActive,
                    ]}
                  >
                    {item.label}
                  </Text>
                </View>
                {index < missionStages.length - 1 ? (
                  <View style={[styles.progressLine, (completed || active) && styles.progressLineActive]} />
                ) : null}
              </React.Fragment>
            );
          })}
        </View>
      </GlassPanel>

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
            <Text style={[styles.routeTitle, { textAlign: align }]}>{order.branch?.name || t(heroAppCopy.order.branch)}</Text>
            <Text style={[styles.routeCopy, { fontFamily: getFontFamily(locale, "body"), textAlign: align }]}>
              {order.branch?.address || t(heroAppCopy.order.unavailableAddress)}
            </Text>
          </View>
        </View>

        <View style={[styles.routeLine, direction === "rtl" ? { marginRight: 6 } : { marginLeft: 6 }]} />

        <View style={[styles.routeStep, { flexDirection: rowDirection }]}>
          <View style={[styles.routeMarker, { backgroundColor: tayyarColors.sky }]} />
          <View style={styles.routeContent}>
            <Text style={[styles.routeLabel, { fontFamily: getFontFamily(locale, "bodyMedium"), textAlign: align }]}>
              {t(heroAppCopy.order.dropoff)}
            </Text>
            <Text style={[styles.routeTitle, { textAlign: align }]}>{order.customerPhone}</Text>
            <Text style={[styles.routeCopy, { fontFamily: getFontFamily(locale, "body"), textAlign: align }]}>
              {order.deliveryAddress || t(heroAppCopy.order.unavailableAddress)}
            </Text>
          </View>
        </View>
      </GlassPanel>

      <SectionHeading
        eyebrow={locale === "ar" ? "الخريطة" : "Map"}
        title={locale === "ar" ? "المسار على الخريطة" : "Route on the map"}
        subtitle={
          locale === "ar"
            ? "نقطة الاستلام والتسليم ظاهرتان على الخريطة."
            : "Pickup and drop-off are shown on the map."
        }
      />

      <MissionMap
        pickupLat={order.pickupLat}
        pickupLng={order.pickupLng}
        deliveryLat={order.deliveryLat}
        deliveryLng={order.deliveryLng}
      />

      <View style={[styles.actionRow, { flexDirection: rowDirection }]}>
        <TayyarButton
          label={t(heroAppCopy.order.callBranch)}
          variant="secondary"
          onPress={callBranch}
          style={styles.flexButton}
          icon={<Ionicons name="call-outline" size={18} color={tayyarColors.textPrimary} />}
        />
        <TayyarButton
          label={t(heroAppCopy.order.callCustomer)}
          variant="secondary"
          onPress={callCustomer}
          style={styles.flexButton}
          icon={<Ionicons name="call-outline" size={18} color={tayyarColors.textPrimary} />}
        />
      </View>

      <View style={[styles.actionRow, { flexDirection: rowDirection }]}>
        <TayyarButton
          label={t(heroAppCopy.order.openMaps)}
          variant="secondary"
          onPress={openMaps}
          style={styles.flexButton}
          icon={<Ionicons name="navigate-outline" size={18} color={tayyarColors.textPrimary} />}
        />
      </View>

      {stage === "handoff" ? (
        <GlassPanel style={styles.otpCard} tone="gold">
          <Text style={[styles.otpTitle, { fontFamily: getFontFamily(locale, "heading") }]}>
            {t(heroAppCopy.order.otpTitle)}
          </Text>
          <Text style={[styles.otpCopy, { fontFamily: getFontFamily(locale, "body") }]}>
            {t(heroAppCopy.order.otpBody)}
          </Text>
          <Pressable style={[styles.otpPreviewRow, { flexDirection: rowDirection }]} onPress={() => otpInputRef.current?.focus()}>
            {Array.from({ length: 4 }).map((_, index) => {
              const digit = otp[index] || "";
              const filled = Boolean(digit);
              return (
                <View key={index} style={[styles.otpPreviewCell, filled && styles.otpPreviewCellFilled]}>
                  <Text style={styles.otpPreviewText}>{digit || "•"}</Text>
                </View>
              );
            })}
          </Pressable>
          <TextInput
            ref={otpInputRef}
            value={otp}
            onChangeText={(value) => {
              const next = value.replace(/\D/g, "").slice(0, 4);
              if (next.length > otp.length) {
                heroFeedback.selection();
              }
              setOtp(next);
            }}
            keyboardType="number-pad"
            maxLength={4}
            placeholder="1234"
            placeholderTextColor={tayyarColors.textTertiary}
            style={styles.otpInput}
            textAlign="center"
          />
        </GlassPanel>
      ) : null}

      <TayyarButton
        label={actionLabel}
        onPress={handlePrimaryAction}
        loading={submitting}
        icon={<Ionicons name={actionIcon as never} size={18} color="#071019" />}
      />
    </TayyarScreen>
  );
}

function stageLabel(stage: string, locale: "ar" | "en") {
  switch (stage) {
    case "pickup":
      return locale === "ar" ? heroAppCopy.order.pickupStage.ar : heroAppCopy.order.pickupStage.en;
    case "enroute":
      return locale === "ar" ? heroAppCopy.order.enrouteStage.ar : heroAppCopy.order.enrouteStage.en;
    case "handoff":
      return locale === "ar" ? heroAppCopy.order.handoffStage.ar : heroAppCopy.order.handoffStage.en;
    case "done":
      return locale === "ar" ? heroAppCopy.order.doneStage.ar : heroAppCopy.order.doneStage.en;
    default:
      return locale === "ar" ? heroAppCopy.order.reviewStage.ar : heroAppCopy.order.reviewStage.en;
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
  },
  header: {
    justifyContent: "space-between",
    alignItems: "center",
    gap: 14,
  },
  headerCopy: {
    gap: 4,
  },
  headerEyebrow: {
    ...typeRamp.label,
  },
  headerTitle: {
    fontSize: 24,
    color: tayyarColors.textPrimary,
  },
  statusCard: {
    gap: 10,
  },
  statusTopRow: {
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  statusTracking: {
    fontFamily: tayyarFonts.mono,
    fontSize: 12,
    color: tayyarColors.textTertiary,
  },
  statusHeadline: {
    fontSize: 22,
    color: tayyarColors.textPrimary,
  },
  statusCopy: {
    ...typeRamp.body,
  },
  syncCard: {
    gap: 10,
  },
  syncTitle: {
    fontSize: 18,
    color: tayyarColors.textPrimary,
  },
  syncCopy: {
    ...typeRamp.body,
  },
  feedbackCard: {
    gap: 8,
  },
  feedbackText: {
    ...typeRamp.bodyStrong,
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
    marginTop: 6,
  },
  routeContent: {
    flex: 1,
    gap: 4,
  },
  routeLabel: {
    ...typeRamp.label,
  },
  routeTitle: {
    ...typeRamp.bodyStrong,
    fontSize: 16,
  },
  routeCopy: {
    ...typeRamp.body,
  },
  routeLine: {
    width: 2,
    height: 28,
    backgroundColor: tayyarColors.borderStrong,
  },
  progressCard: {
    gap: 14,
  },
  progressTitle: {
    ...typeRamp.label,
  },
  progressRow: {
    alignItems: "flex-start",
    gap: 0,
  },
  progressNode: {
    width: 72,
    alignItems: "center",
    gap: 8,
  },
  progressDot: {
    width: 34,
    height: 34,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: tayyarColors.borderStrong,
    backgroundColor: "rgba(255,255,255,0.04)",
    alignItems: "center",
    justifyContent: "center",
  },
  progressDotActive: {
    backgroundColor: "rgba(41,182,246,0.18)",
    borderColor: tayyarColors.skyLight,
  },
  progressDotComplete: {
    backgroundColor: "rgba(34,197,94,0.18)",
    borderColor: tayyarColors.success,
  },
  progressDotText: {
    fontFamily: tayyarFonts.mono,
    fontSize: 12,
    color: tayyarColors.textPrimary,
  },
  progressLabel: {
    ...typeRamp.label,
    width: "100%",
  },
  progressLabelActive: {
    color: tayyarColors.skyLight,
  },
  progressLabelComplete: {
    color: "#D1FAE5",
  },
  progressLine: {
    flex: 1,
    height: 2,
    marginTop: 16,
    backgroundColor: tayyarColors.border,
  },
  progressLineActive: {
    backgroundColor: tayyarColors.skyLight,
  },
  actionRow: {
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
  otpCopy: {
    ...typeRamp.body,
  },
  otpPreviewRow: {
    justifyContent: "space-between",
    gap: 10,
  },
  otpPreviewCell: {
    flex: 1,
    minHeight: 58,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: tayyarColors.border,
    backgroundColor: "rgba(255,255,255,0.03)",
    alignItems: "center",
    justifyContent: "center",
  },
  otpPreviewCellFilled: {
    borderColor: tayyarColors.goldLight,
    backgroundColor: "rgba(245,182,64,0.12)",
  },
  otpPreviewText: {
    fontFamily: tayyarFonts.mono,
    fontSize: 24,
    color: tayyarColors.textPrimary,
  },
  otpInput: {
    minHeight: 64,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: tayyarColors.borderStrong,
    backgroundColor: "rgba(255,255,255,0.05)",
    color: tayyarColors.textPrimary,
    fontFamily: tayyarFonts.mono,
    fontSize: 28,
    letterSpacing: 8,
  },
});
