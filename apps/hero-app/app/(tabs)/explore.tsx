import React from "react";
import { Alert, RefreshControl, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  GlassPanel,
  LocaleTogglePill,
  SectionHeading,
  TayyarButton,
  TayyarScreen,
  TopBrandBar,
} from "@/components/tayyar-ui";
import { formatCurrency, getFontFamily, tayyarColors, tayyarFonts, typeRamp } from "@/lib/design";
import { heroFetch } from "@/lib/api";
import { useHeroLocale } from "@/lib/locale";
import { useAuthStore } from "@/store/authStore";

type CompensationSummary = {
  heroId: string;
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
  totals: {
    deliveredOrders: number;
    accruedCommissions: number;
    pendingPayoutAmount: number;
    walletBalance: number;
  };
};

type VacationAllowance = {
  id: string;
  type: "ANNUAL" | "SICK" | "EMERGENCY" | "UNPAID";
  totalDays: number;
  usedDays: number;
  remainingDays: number;
  isActive: boolean;
  notes?: string | null;
};

type VacationRequestRecord = {
  id: string;
  type: VacationAllowance["type"];
  startDate: string;
  endDate: string;
  requestedDays: number;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  reason?: string | null;
  decisionNote?: string | null;
  requestedAt: string;
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
  requests: VacationRequestRecord[];
};

const vacationTypes: VacationAllowance["type"][] = ["ANNUAL", "SICK", "EMERGENCY", "UNPAID"];

const tx = (locale: "ar" | "en", ar: string, en: string) => (locale === "ar" ? ar : en);

function formatShortDate(value: string, locale: "ar" | "en") {
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-EG-u-nu-latn" : "en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function vacationTypeLabel(locale: "ar" | "en", type: VacationAllowance["type"]) {
  switch (type) {
    case "ANNUAL":
      return tx(locale, "سنوية", "Annual");
    case "SICK":
      return tx(locale, "مرضية", "Sick");
    case "EMERGENCY":
      return tx(locale, "طارئة", "Emergency");
    default:
      return tx(locale, "غير مدفوعة", "Unpaid");
  }
}

function requestStatusLabel(locale: "ar" | "en", status: VacationRequestRecord["status"]) {
  switch (status) {
    case "APPROVED":
      return tx(locale, "موافق عليها", "Approved");
    case "REJECTED":
      return tx(locale, "مرفوضة", "Rejected");
    case "CANCELLED":
      return tx(locale, "ملغية", "Cancelled");
    default:
      return tx(locale, "قيد المراجعة", "Pending");
  }
}

export default function HeroHrScreen() {
  const token = useAuthStore((state) => state.token);
  const { locale, direction } = useHeroLocale();
  const [compensation, setCompensation] = React.useState<CompensationSummary | null>(null);
  const [vacation, setVacation] = React.useState<VacationPayload | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [requestType, setRequestType] = React.useState<VacationAllowance["type"]>("ANNUAL");
  const [startDate, setStartDate] = React.useState("");
  const [endDate, setEndDate] = React.useState("");
  const [reason, setReason] = React.useState("");

  const loadData = React.useCallback(async () => {
    const [compensationData, vacationData] = await Promise.all([
      heroFetch<CompensationSummary>("/v1/heroes/me/compensation-summary", undefined, token),
      heroFetch<VacationPayload>("/v1/heroes/me/vacation", undefined, token),
    ]);
    setCompensation(compensationData);
    setVacation(vacationData);
  }, [token]);

  React.useEffect(() => {
    loadData()
      .catch((error: unknown) => {
        Alert.alert(tx(locale, "الموارد البشرية", "HR"), error instanceof Error ? error.message : tx(locale, "تعذر تحميل البيانات.", "Could not load data."));
      })
      .finally(() => setLoading(false));
  }, [loadData, locale]);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      await loadData();
    } catch (error) {
      Alert.alert(tx(locale, "تحديث", "Refresh"), error instanceof Error ? error.message : tx(locale, "تعذر تحديث البيانات.", "Could not refresh data."));
    } finally {
      setRefreshing(false);
    }
  }, [loadData, locale]);

  async function submitVacationRequest() {
    if (!startDate || !endDate) {
      Alert.alert(
        tx(locale, "الاجازات", "Vacation"),
        tx(locale, "اكتب تاريخ البداية والنهاية بصيغة YYYY-MM-DD.", "Enter start and end dates in YYYY-MM-DD format."),
      );
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
      await loadData();
      Alert.alert(
        tx(locale, "تم الإرسال", "Submitted"),
        tx(locale, "تم إرسال طلب الاجازة للمراجعة.", "Vacation request sent for review."),
      );
    } catch (error) {
      Alert.alert(tx(locale, "طلب الاجازة", "Vacation request"), error instanceof Error ? error.message : tx(locale, "تعذر إرسال الطلب.", "Could not submit the request."));
    } finally {
      setSubmitting(false);
    }
  }

  const align = direction === "rtl" ? "right" : "left";
  const rowDirection = direction === "rtl" ? "row-reverse" : "row";

  return (
    <TayyarScreen
      scroll
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={tayyarColors.gold} />}
    >
      <TopBrandBar
        title={tx(locale, "الموارد البشرية", "HR & finance")}
        subtitle={tx(locale, "الراتب والعمولات والاجازات.", "Compensation, commission, and leave.")}
        rightSlot={<LocaleTogglePill />}
      />

      <GlassPanel style={styles.summaryCard} tone="sky">
        <Text style={[styles.sectionEyebrow, { fontFamily: getFontFamily(locale, "bodyMedium"), textAlign: align }]}>
          {tx(locale, "ملف التعويض", "Compensation profile")}
        </Text>
        <Text style={[styles.sectionTitle, { fontFamily: getFontFamily(locale, "heading"), textAlign: align }]}>
          {compensation?.compensation.mode === "BASIC_PLUS_COMMISSION"
            ? tx(locale, "راتب أساسي + عمولة", "Base salary + commission")
            : tx(locale, "عمولة فقط", "Commission only")}
        </Text>
        <View style={[styles.summaryRow, { flexDirection: rowDirection }]}>
          <View style={styles.summaryTile}>
            <Text style={styles.summaryValue}>{formatCurrency(compensation?.compensation.baseSalary || 0, locale)}</Text>
            <Text style={[styles.summaryLabel, { fontFamily: getFontFamily(locale, "bodyMedium") }]}>{tx(locale, "الراتب الأساسي", "Base salary")}</Text>
          </View>
          <View style={styles.summaryTile}>
            <Text style={styles.summaryValue}>{formatCurrency(compensation?.compensation.commissionPerOrder || 0, locale)}</Text>
            <Text style={[styles.summaryLabel, { fontFamily: getFontFamily(locale, "bodyMedium") }]}>{tx(locale, "عمولة الطلب", "Commission / order")}</Text>
          </View>
        </View>
        <View style={[styles.summaryRow, { flexDirection: rowDirection }]}>
          <View style={styles.summaryTile}>
            <Text style={styles.summaryValue}>{compensation?.totals.deliveredOrders || 0}</Text>
            <Text style={[styles.summaryLabel, { fontFamily: getFontFamily(locale, "bodyMedium") }]}>{tx(locale, "طلبات مكتملة", "Delivered orders")}</Text>
          </View>
          <View style={styles.summaryTile}>
            <Text style={styles.summaryValue}>{formatCurrency(compensation?.totals.pendingPayoutAmount || 0, locale)}</Text>
            <Text style={[styles.summaryLabel, { fontFamily: getFontFamily(locale, "bodyMedium") }]}>{tx(locale, "قيد الصرف", "Pending payout")}</Text>
          </View>
        </View>
        <Text style={[styles.assignmentNote, { fontFamily: getFontFamily(locale, "body"), textAlign: align }]}>
          {compensation?.compensation.branchName
            ? `${locale === "ar" ? compensation.compensation.branchNameAr || compensation.compensation.branchName : compensation.compensation.branchName || compensation.compensation.branchNameAr} • ${locale === "ar" ? compensation.compensation.merchantNameAr || compensation.compensation.merchantName || "" : compensation.compensation.merchantName || compensation.compensation.merchantNameAr || ""}`
            : tx(locale, "لم يتم ربط تعويض بفرع نشط بعد.", "No active branch compensation is linked yet.")}
        </Text>
      </GlassPanel>

      <SectionHeading
        eyebrow={tx(locale, "الاجازات", "Vacation")}
        title={tx(locale, "الرصيد والطلبات", "Balance and requests")}
        subtitle={tx(locale, "راجع الرصيد وقدّم طلب جديد من هنا.", "Review your balance and submit a new request here.")}
      />

      <View style={styles.allowanceGrid}>
        {(vacation?.allowances || []).map((allowance) => (
          <GlassPanel key={allowance.id} style={styles.allowanceCard}>
            <Text style={[styles.allowanceTitle, { fontFamily: getFontFamily(locale, "heading"), textAlign: align }]}>
              {vacationTypeLabel(locale, allowance.type)}
            </Text>
            <Text style={styles.allowanceValue}>{allowance.remainingDays}</Text>
            <Text style={[styles.allowanceMeta, { fontFamily: getFontFamily(locale, "bodyMedium"), textAlign: align }]}>
              {tx(locale, "المتبقي من", "Remaining from")} {allowance.totalDays}
            </Text>
          </GlassPanel>
        ))}
      </View>

      {vacation?.activeVacationRequest ? (
        <GlassPanel style={styles.activeVacationCard} tone="gold">
          <Text style={[styles.sectionEyebrow, { fontFamily: getFontFamily(locale, "bodyMedium"), textAlign: align }]}>
            {tx(locale, "اجازة نشطة", "Active leave")}
          </Text>
          <Text style={[styles.sectionTitle, { fontFamily: getFontFamily(locale, "heading"), textAlign: align }]}>
            {vacationTypeLabel(locale, vacation.activeVacationRequest.type)}
          </Text>
          <Text style={[styles.assignmentNote, { fontFamily: getFontFamily(locale, "body"), textAlign: align }]}>
            {`${formatShortDate(vacation.activeVacationRequest.startDate, locale)} - ${formatShortDate(vacation.activeVacationRequest.endDate, locale)}`}
          </Text>
        </GlassPanel>
      ) : null}

      <GlassPanel style={styles.requestCard}>
        <Text style={[styles.sectionEyebrow, { fontFamily: getFontFamily(locale, "bodyMedium"), textAlign: align }]}>
          {tx(locale, "طلب جديد", "New request")}
        </Text>
        <View style={[styles.typeRow, { flexDirection: rowDirection }]}>
          {vacationTypes.map((type) => {
            const active = type === requestType;
            return (
              <TayyarButton
                key={type}
                label={vacationTypeLabel(locale, type)}
                variant={active ? "primary" : "outline"}
                onPress={() => setRequestType(type)}
                style={styles.typeButton}
              />
            );
          })}
        </View>
        <TextInput
          style={[styles.input, { textAlign: align, fontFamily: getFontFamily(locale, "body") }]}
          placeholder={tx(locale, "تاريخ البداية YYYY-MM-DD", "Start date YYYY-MM-DD")}
          placeholderTextColor={tayyarColors.textTertiary}
          value={startDate}
          onChangeText={setStartDate}
        />
        <TextInput
          style={[styles.input, { textAlign: align, fontFamily: getFontFamily(locale, "body") }]}
          placeholder={tx(locale, "تاريخ النهاية YYYY-MM-DD", "End date YYYY-MM-DD")}
          placeholderTextColor={tayyarColors.textTertiary}
          value={endDate}
          onChangeText={setEndDate}
        />
        <TextInput
          multiline
          style={[styles.input, styles.textArea, { textAlign: align, fontFamily: getFontFamily(locale, "body") }]}
          placeholder={tx(locale, "سبب الاجازة (اختياري)", "Reason for leave (optional)")}
          placeholderTextColor={tayyarColors.textTertiary}
          value={reason}
          onChangeText={setReason}
        />
        <TayyarButton
          label={tx(locale, "إرسال الطلب", "Submit request")}
          onPress={submitVacationRequest}
          loading={submitting}
          icon={<Ionicons name="send-outline" size={18} color="#071019" />}
        />
      </GlassPanel>

      <SectionHeading
        eyebrow={tx(locale, "السجل", "History")}
        title={tx(locale, "آخر الطلبات", "Latest requests")}
        subtitle={tx(locale, "كل طلب اجازة بحالته الحالية.", "Each vacation request with its current status.")}
      />

      <View style={styles.requestList}>
        {(vacation?.requests || []).length ? (
          vacation!.requests.map((request) => (
            <GlassPanel key={request.id} style={styles.requestItem}>
              <View style={[styles.requestTopRow, { flexDirection: rowDirection }]}>
                <Text style={[styles.requestTitle, { fontFamily: getFontFamily(locale, "heading"), textAlign: align }]}>
                  {vacationTypeLabel(locale, request.type)}
                </Text>
                <Text style={[styles.requestStatus, { fontFamily: getFontFamily(locale, "bodyMedium") }]}>
                  {requestStatusLabel(locale, request.status)}
                </Text>
              </View>
              <Text style={[styles.requestMeta, { fontFamily: getFontFamily(locale, "body"), textAlign: align }]}>
                {`${formatShortDate(request.startDate, locale)} - ${formatShortDate(request.endDate, locale)} • ${request.requestedDays} ${tx(locale, "يوم", "days")}`}
              </Text>
              {request.reason ? (
                <Text style={[styles.requestMeta, { fontFamily: getFontFamily(locale, "body"), textAlign: align }]}>
                  {request.reason}
                </Text>
              ) : null}
            </GlassPanel>
          ))
        ) : (
          <GlassPanel style={styles.emptyCard}>
            <Text style={[styles.emptyTitle, { fontFamily: getFontFamily(locale, "heading") }]}>
              {tx(locale, "لا توجد طلبات اجازة بعد", "No leave requests yet")}
            </Text>
            <Text style={[styles.requestMeta, { fontFamily: getFontFamily(locale, "body"), textAlign: "center" }]}>
              {tx(locale, "عندما ترسل طلباً سيظهر هنا للمراجعة والمتابعة.", "Your requests will appear here for review and follow-up.")}
            </Text>
          </GlassPanel>
        )}
      </View>
    </TayyarScreen>
  );
}

const styles = StyleSheet.create({
  summaryCard: {
    gap: 12,
  },
  sectionEyebrow: {
    ...typeRamp.label,
    color: tayyarColors.goldLight,
  },
  sectionTitle: {
    fontSize: 22,
    color: tayyarColors.textPrimary,
  },
  summaryRow: {
    gap: 12,
  },
  summaryTile: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: tayyarColors.border,
    backgroundColor: "rgba(255,255,255,0.03)",
    padding: 14,
    gap: 6,
  },
  summaryValue: {
    fontFamily: tayyarFonts.mono,
    fontSize: 20,
    color: tayyarColors.textPrimary,
  },
  summaryLabel: {
    ...typeRamp.label,
    color: tayyarColors.textSecondary,
  },
  assignmentNote: {
    ...typeRamp.body,
    color: tayyarColors.textSecondary,
  },
  allowanceGrid: {
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
    fontFamily: tayyarFonts.mono,
    fontSize: 30,
    color: tayyarColors.gold,
  },
  allowanceMeta: {
    ...typeRamp.label,
    color: tayyarColors.textSecondary,
  },
  activeVacationCard: {
    gap: 8,
  },
  requestCard: {
    gap: 12,
  },
  typeRow: {
    gap: 8,
    flexWrap: "wrap",
  },
  typeButton: {
    minHeight: 42,
  },
  input: {
    minHeight: 48,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: tayyarColors.border,
    backgroundColor: "rgba(255,255,255,0.03)",
    color: tayyarColors.textPrimary,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  textArea: {
    minHeight: 96,
  },
  requestList: {
    gap: 12,
    paddingBottom: 20,
  },
  requestItem: {
    gap: 8,
  },
  requestTopRow: {
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  requestTitle: {
    fontSize: 18,
    color: tayyarColors.textPrimary,
    flex: 1,
  },
  requestStatus: {
    ...typeRamp.label,
    color: tayyarColors.goldLight,
  },
  requestMeta: {
    ...typeRamp.body,
    color: tayyarColors.textSecondary,
  },
  emptyCard: {
    alignItems: "center",
    gap: 10,
    paddingVertical: 26,
  },
  emptyTitle: {
    fontSize: 18,
    color: tayyarColors.textPrimary,
  },
});
