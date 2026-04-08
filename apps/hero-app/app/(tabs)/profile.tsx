import React from "react";
import { Alert, RefreshControl, StyleSheet, Text, TextInput, View } from "react-native";
import { check, PERMISSIONS, RESULTS } from "react-native-permissions";
import Ionicons from "react-native-vector-icons/Ionicons";
import {
  EmptyState,
  GlassPanel,
  LocaleTogglePill,
  SectionHeading,
  StatusPill,
  TayyarButton,
  TayyarScreen,
  TopBrandBar,
} from "@/components/tayyar-ui";
import { heroAppCopy } from "@/lib/copy";
import { heroFetch } from "@/lib/api";
import { heroBuildConfig } from "@/lib/build-config";
import { getFontFamily, tayyarColors, typeRamp } from "@/lib/design";
import { useHeroLocale } from "@/lib/locale";
import { useAuthStore } from "@/store/authStore";

type VacationAllowance = {
  id: string;
  type: "ANNUAL" | "SICK" | "EMERGENCY" | "UNPAID";
  totalDays: number;
  usedDays: number;
  remainingDays: number;
};

type VacationRequest = {
  id: string;
  type: VacationAllowance["type"];
  startDate: string;
  endDate: string;
  requestedDays: number;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  reason?: string | null;
};

type VacationPayload = {
  activeVacationRequest?: {
    id: string;
    type: VacationAllowance["type"];
    startDate: string;
    endDate: string;
    requestedDays: number;
  } | null;
  allowances: VacationAllowance[];
  requests: VacationRequest[];
};

const vacationTypes: VacationAllowance["type"][] = ["ANNUAL", "SICK", "EMERGENCY", "UNPAID"];

export default function ProfileScreen() {
  const { token, logout, user } = useAuthStore();
  const { locale, direction, t } = useHeroLocale();
  const [vacation, setVacation] = React.useState<VacationPayload | null>(null);
  const [refreshing, setRefreshing] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);
  const [permissionGranted, setPermissionGranted] = React.useState<boolean | null>(null);
  const [requestType, setRequestType] = React.useState<VacationAllowance["type"]>("ANNUAL");
  const [startDate, setStartDate] = React.useState("");
  const [endDate, setEndDate] = React.useState("");
  const [reason, setReason] = React.useState("");

  const load = React.useCallback(async () => {
    const [vacationPayload, permission] = await Promise.all([
      heroFetch<VacationPayload>("/v1/heroes/me/vacation", undefined, token),
      check(PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION),
    ]);
    setVacation(vacationPayload);
    setPermissionGranted(permission === RESULTS.GRANTED);
  }, [token]);

  React.useEffect(() => {
    load()
      .catch((error: unknown) => {
        Alert.alert(
          t(heroAppCopy.profile.title),
          error instanceof Error ? error.message : t(heroAppCopy.common.unexpectedError),
        );
      })
      .finally(() => setLoading(false));
  }, [load, t]);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } catch (error) {
      Alert.alert(
        t(heroAppCopy.common.refresh),
        error instanceof Error ? error.message : t(heroAppCopy.common.unexpectedError),
      );
    } finally {
      setRefreshing(false);
    }
  }, [load, t]);

  async function submitVacationRequest() {
    if (!startDate || !endDate) {
      Alert.alert(t(heroAppCopy.profile.requestVacation), `${t(heroAppCopy.profile.startDate)} / ${t(heroAppCopy.profile.endDate)}`);
      return;
    }

    setSubmitting(true);
    try {
      await heroFetch(
        "/v1/heroes/me/vacation-requests",
        {
          method: "POST",
          body: JSON.stringify({
            type: requestType,
            startDate,
            endDate,
            reason: reason || undefined,
          }),
        },
        token,
      );
      setReason("");
      setStartDate("");
      setEndDate("");
      await load();
      Alert.alert(t(heroAppCopy.profile.requestSent), t(heroAppCopy.profile.requestSent));
    } catch (error) {
      Alert.alert(
        t(heroAppCopy.profile.requestVacation),
        error instanceof Error ? error.message : t(heroAppCopy.common.unexpectedError),
      );
    } finally {
      setSubmitting(false);
    }
  }

  const align = direction === "rtl" ? "right" : "left";
  const rowDirection = direction === "rtl" ? "row-reverse" : "row";

  return (
    <TayyarScreen
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={tayyarColors.gold} />}
    >
      <TopBrandBar
        title={t(heroAppCopy.profile.title)}
        subtitle={t(heroAppCopy.profile.subtitle)}
        rightSlot={<LocaleTogglePill />}
      />

      <GlassPanel>
        <SectionHeading
          eyebrow={t(heroAppCopy.profile.session)}
          title={user?.name || t(heroAppCopy.common.heroBrand)}
          subtitle={user?.phone || heroBuildConfig.qaHeroPhone}
        />
        <View style={[styles.infoRow, { flexDirection: rowDirection }]}>
          <StatusPill label={t(heroAppCopy.profile.trustedDevice)} tone="ONLINE" />
          <StatusPill
            label={permissionGranted ? t(heroAppCopy.profile.permissionsGranted) : t(heroAppCopy.profile.permissionsMissing)}
            tone={permissionGranted ? "ONLINE" : "OFFLINE"}
          />
        </View>
        <TayyarButton
          label={t(heroAppCopy.common.signOut)}
          variant="outline"
          onPress={logout}
          icon={<Ionicons name="log-out-outline" size={18} color={tayyarColors.textPrimary} />}
        />
      </GlassPanel>

      <SectionHeading
        eyebrow={t(heroAppCopy.profile.vacation)}
        title={t(heroAppCopy.profile.vacationBalance)}
        subtitle={t(heroAppCopy.profile.requestVacation)}
      />

      <View style={styles.allowanceList}>
        {vacation?.allowances?.length ? (
          vacation.allowances.map((allowance) => (
            <GlassPanel key={allowance.id} style={styles.allowanceCard}>
              <Text style={[styles.allowanceTitle, { fontFamily: getFontFamily(locale, "heading"), textAlign: align }]}>
                {vacationTypeLabel(locale, allowance.type, t)}
              </Text>
              <Text style={styles.allowanceValue}>{allowance.remainingDays}</Text>
              <Text style={[styles.allowanceMeta, { fontFamily: getFontFamily(locale, "body"), textAlign: align }]}>
                {`${allowance.usedDays}/${allowance.totalDays}`}
              </Text>
            </GlassPanel>
          ))
        ) : loading ? null : (
          <EmptyState icon="calendar-outline" title={t(heroAppCopy.common.noData)} body={t(heroAppCopy.profile.vacationBalance)} />
        )}
      </View>

      <GlassPanel tone="accent" style={styles.requestCard}>
        <Text style={[styles.cardTitle, { fontFamily: getFontFamily(locale, "heading"), textAlign: align }]}>
          {t(heroAppCopy.profile.requestVacation)}
        </Text>
        <View style={[styles.typeRow, { flexDirection: rowDirection }]}>
          {vacationTypes.map((type) => (
            <TayyarButton
              key={type}
              label={vacationTypeLabel(locale, type, t)}
              variant={requestType === type ? "primary" : "outline"}
              onPress={() => setRequestType(type)}
              style={styles.typeButton}
            />
          ))}
        </View>
        <TextInput
          value={startDate}
          onChangeText={setStartDate}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={tayyarColors.textTertiary}
          style={[styles.input, { textAlign: align, fontFamily: getFontFamily("en", "mono") }]}
        />
        <TextInput
          value={endDate}
          onChangeText={setEndDate}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={tayyarColors.textTertiary}
          style={[styles.input, { textAlign: align, fontFamily: getFontFamily("en", "mono") }]}
        />
        <TextInput
          value={reason}
          onChangeText={setReason}
          placeholder={t(heroAppCopy.profile.reason)}
          placeholderTextColor={tayyarColors.textTertiary}
          style={[styles.input, styles.textArea, { textAlign: align, fontFamily: getFontFamily(locale, "body") }]}
          multiline
        />
        <TayyarButton
          label={t(heroAppCopy.profile.sendRequest)}
          onPress={submitVacationRequest}
          loading={submitting}
          icon={<Ionicons name="send-outline" size={18} color="#071019" />}
        />
      </GlassPanel>

      <SectionHeading
        eyebrow={t(heroAppCopy.profile.history)}
        title={t(heroAppCopy.profile.activeRequest)}
        subtitle={t(heroAppCopy.profile.subtitle)}
      />

      <View style={styles.historyList}>
        {vacation?.requests?.length ? (
          vacation.requests.map((request) => (
            <GlassPanel key={request.id} style={styles.historyCard}>
              <View style={[styles.historyTop, { flexDirection: rowDirection }]}>
                <Text style={[styles.historyTitle, { fontFamily: getFontFamily(locale, "heading"), textAlign: align }]}>
                  {vacationTypeLabel(locale, request.type, t)}
                </Text>
                <StatusPill label={vacationStatusLabel(locale, request.status, t)} tone={request.status === "APPROVED" ? "ONLINE" : request.status === "PENDING" ? "ON_BREAK" : "OFFLINE"} />
              </View>
              <Text style={[styles.historyMeta, { fontFamily: getFontFamily(locale, "body"), textAlign: align }]}>
                {`${request.startDate} → ${request.endDate}`}
              </Text>
              {request.reason ? (
                <Text style={[styles.historyMeta, { fontFamily: getFontFamily(locale, "body"), textAlign: align }]}>
                  {request.reason}
                </Text>
              ) : null}
            </GlassPanel>
          ))
        ) : (
          <EmptyState icon="document-text-outline" title={t(heroAppCopy.profile.history)} body={t(heroAppCopy.common.noData)} />
        )}
      </View>
    </TayyarScreen>
  );
}

function vacationTypeLabel(
  locale: "ar" | "en",
  type: VacationAllowance["type"],
  t: (value: string | { ar: string; en: string }) => string,
) {
  switch (type) {
    case "ANNUAL":
      return t(heroAppCopy.profile.annual);
    case "SICK":
      return t(heroAppCopy.profile.sick);
    case "EMERGENCY":
      return t(heroAppCopy.profile.emergency);
    default:
      return t(heroAppCopy.profile.unpaid);
  }
}

function vacationStatusLabel(
  locale: "ar" | "en",
  status: VacationRequest["status"],
  t: (value: string | { ar: string; en: string }) => string,
) {
  switch (status) {
    case "APPROVED":
      return t(heroAppCopy.profile.approved);
    case "REJECTED":
      return t(heroAppCopy.profile.rejected);
    case "CANCELLED":
      return t(heroAppCopy.profile.cancelled);
    default:
      return t(heroAppCopy.profile.pending);
  }
}

const styles = StyleSheet.create({
  infoRow: {
    gap: 10,
    flexWrap: "wrap",
  },
  allowanceList: {
    gap: 12,
  },
  allowanceCard: {
    gap: 6,
  },
  allowanceTitle: {
    fontSize: 18,
    color: tayyarColors.textPrimary,
  },
  allowanceValue: {
    fontFamily: "monospace",
    fontSize: 28,
    color: tayyarColors.gold,
  },
  allowanceMeta: {
    ...typeRamp.body,
    color: tayyarColors.textSecondary,
  },
  requestCard: {
    gap: 12,
  },
  cardTitle: {
    fontSize: 20,
    color: tayyarColors.textPrimary,
  },
  typeRow: {
    gap: 8,
    flexWrap: "wrap",
  },
  typeButton: {
    minHeight: 42,
  },
  input: {
    minHeight: 52,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: tayyarColors.border,
    backgroundColor: "rgba(255,255,255,0.04)",
    color: tayyarColors.textPrimary,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  textArea: {
    minHeight: 96,
  },
  historyList: {
    gap: 12,
    paddingBottom: 20,
  },
  historyCard: {
    gap: 8,
  },
  historyTop: {
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  historyTitle: {
    fontSize: 18,
    color: tayyarColors.textPrimary,
    flex: 1,
  },
  historyMeta: {
    ...typeRamp.body,
    color: tayyarColors.textSecondary,
  },
});
