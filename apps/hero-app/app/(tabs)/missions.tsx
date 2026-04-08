import React from "react";
import { Alert, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { HeroSymbol } from "@/components/hero-symbol";
import {
  EmptyState,
  GlassPanel,
  SectionHeading,
  StatusPill,
  TayyarButton,
  TayyarScreen,
  TopBrandBar,
} from "@/components/tayyar-ui";
import { heroAppCopy } from "@/lib/copy";
import { getFontFamily, tayyarColors } from "@/lib/design";
import { heroFetch } from "@/lib/api";
import { useHeroLocale } from "@/lib/locale";
import { useAuthStore } from "@/store/authStore";

type ActiveOrder = {
  id: string;
  orderNumber: string;
  status: string;
  deliveryAddress?: string | null;
  branch?: { name?: string | null } | null;
};

export default function MissionsScreen() {
  const navigation = useNavigation<any>();
  const token = useAuthStore((state) => state.token);
  const { locale, direction, t } = useHeroLocale();
  const [missions, setMissions] = React.useState<ActiveOrder[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);

  const loadMissions = React.useCallback(async () => {
    const payload = await heroFetch<ActiveOrder[]>("/v1/heroes/orders/active", undefined, token);
    setMissions(payload);
  }, [token]);

  React.useEffect(() => {
    loadMissions()
      .catch((error: unknown) => {
        Alert.alert(
          t(heroAppCopy.missions.title),
          error instanceof Error ? error.message : t(heroAppCopy.common.unexpectedError),
        );
      })
      .finally(() => setLoading(false));
  }, [loadMissions, t]);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      await loadMissions();
    } catch (error) {
      Alert.alert(
        t(heroAppCopy.common.refresh),
        error instanceof Error ? error.message : t(heroAppCopy.common.unexpectedError),
      );
    } finally {
      setRefreshing(false);
    }
  }, [loadMissions, t]);

  const align = direction === "rtl" ? "right" : "left";
  const rowDirection = direction === "rtl" ? "row-reverse" : "row";

  return (
    <TayyarScreen
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={tayyarColors.gold} />}
    >
      <TopBrandBar title={t(heroAppCopy.missions.title)} subtitle={t(heroAppCopy.missions.subtitle)} />
      <SectionHeading
        eyebrow={`${missions.length}`}
        title={t(heroAppCopy.missions.title)}
        subtitle={loading ? t(heroAppCopy.common.loading) : t(heroAppCopy.missions.subtitle)}
      />

      {missions.length ? (
        <View style={styles.list}>
          {missions.map((mission) => (
            <GlassPanel key={mission.id} style={styles.card}>
              <View style={[styles.cardTop, { flexDirection: rowDirection }]}>
                <View style={styles.cardCopy}>
                  <Text style={[styles.orderNumber, { textAlign: align, fontFamily: getFontFamily("en", "bodySemi") }]}>
                    {mission.orderNumber}
                  </Text>
                  <Text style={[styles.branchName, { textAlign: align, fontFamily: getFontFamily(locale, "bodySemi") }]}>
                    {mission.branch?.name || t(heroAppCopy.missions.branch)}
                  </Text>
                </View>
                <StatusPill label={statusLabel(mission.status, locale)} tone={mission.status} />
              </View>
              <Text style={[styles.address, { textAlign: align, fontFamily: getFontFamily(locale, "body") }]}>
                {mission.deliveryAddress || t(heroAppCopy.common.noData)}
              </Text>
              <TayyarButton
                label={t(heroAppCopy.missions.open)}
                onPress={() => navigation.navigate("OrderDetails", { id: mission.id })}
                icon={<HeroSymbol name="route" size={18} color="#071019" />}
              />
            </GlassPanel>
          ))}
        </View>
      ) : (
        <EmptyState icon="map-outline" title={t(heroAppCopy.missions.emptyTitle)} body={t(heroAppCopy.missions.emptyBody)} />
      )}
    </TayyarScreen>
  );
}

function statusLabel(status: string, locale: "ar" | "en") {
  switch (status) {
    case "ARRIVED":
      return locale === "ar" ? "عند العميل" : "Arrived";
    case "PICKED_UP":
    case "ON_WAY":
    case "IN_TRANSIT":
      return locale === "ar" ? "في الطريق" : "En route";
    default:
      return locale === "ar" ? "استلام" : "Pickup";
  }
}

const styles = StyleSheet.create({
  list: {
    gap: 14,
  },
  card: {
    gap: 14,
  },
  cardTop: {
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  cardCopy: {
    flex: 1,
    gap: 6,
  },
  orderNumber: {
    color: tayyarColors.textPrimary,
    fontSize: 19,
  },
  branchName: {
    color: tayyarColors.textSecondary,
    fontSize: 14,
  },
  address: {
    color: tayyarColors.textPrimary,
    fontSize: 15,
    lineHeight: 22,
  },
});
