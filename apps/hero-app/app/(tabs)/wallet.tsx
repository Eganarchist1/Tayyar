import React from "react";
import { Alert, RefreshControl, StyleSheet, Text, View } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import {
  GlassPanel,
  LocaleTogglePill,
  MetricTile,
  SectionHeading,
  TayyarButton,
  TayyarScreen,
  TopBrandBar,
} from "@/components/tayyar-ui";
import { formatCurrency, getFontFamily, tayyarColors, tayyarFonts, typeRamp } from "@/lib/design";
import { heroAppCopy } from "@/lib/copy";
import { useHeroLocale } from "@/lib/locale";
import { heroFetch } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";

type WalletTransaction = {
  id: string;
  type: string;
  amount: number;
  description?: string | null;
  createdAt: string;
  status?: string;
};

type WalletPayload = {
  balance: number;
  transactions: WalletTransaction[];
};

export default function WalletScreen() {
  const { token } = useAuthStore();
  const { locale, direction, t } = useHeroLocale();
  const [wallet, setWallet] = React.useState<WalletPayload>({ balance: 0, transactions: [] });
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [cashoutLoading, setCashoutLoading] = React.useState(false);
  const [filter, setFilter] = React.useState<"ALL" | "IN" | "OUT" | "PAYOUT">("ALL");

  const incomeTotal = React.useMemo(
    () =>
      wallet.transactions
        .filter((transaction) => transaction.amount > 0)
        .reduce((sum, transaction) => sum + transaction.amount, 0),
    [wallet.transactions],
  );

  const expenseTotal = React.useMemo(
    () =>
      wallet.transactions
        .filter((transaction) => transaction.amount < 0)
        .reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0),
    [wallet.transactions],
  );

  const filteredTransactions = React.useMemo(() => {
    if (filter === "ALL") return wallet.transactions;
    if (filter === "IN") return wallet.transactions.filter((transaction) => transaction.amount > 0);
    if (filter === "OUT") return wallet.transactions.filter((transaction) => transaction.amount < 0);
    return wallet.transactions.filter((transaction) => transaction.type.toUpperCase().includes("WITHDRAW"));
  }, [filter, wallet.transactions]);

  const loadWallet = React.useCallback(async () => {
    const payload = await heroFetch<WalletPayload>("/v1/billing/wallet", undefined, token);
    setWallet(payload);
  }, [token]);

  React.useEffect(() => {
    loadWallet()
      .catch((error: unknown) => {
        Alert.alert(
          t(heroAppCopy.wallet.title),
          error instanceof Error ? error.message : t(heroAppCopy.common.unexpectedError),
        );
      })
      .finally(() => setLoading(false));
  }, [loadWallet, t]);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      await loadWallet();
    } catch (error) {
      Alert.alert(
        t(heroAppCopy.common.refresh),
        error instanceof Error ? error.message : t(heroAppCopy.common.unexpectedError),
      );
    } finally {
      setRefreshing(false);
    }
  }, [loadWallet, t]);

  const handleCashout = React.useCallback(async () => {
    if (!wallet.balance) {
      Alert.alert(t(heroAppCopy.wallet.noBalanceTitle), t(heroAppCopy.wallet.noBalanceBody));
      return;
    }

    setCashoutLoading(true);
    try {
      await heroFetch(
        "/v1/billing/hero/withdraw",
        {
          method: "POST",
          body: JSON.stringify({ amount: wallet.balance }),
        },
        token,
      );
      await loadWallet();
      Alert.alert(t(heroAppCopy.wallet.createdTitle), t(heroAppCopy.wallet.createdBody));
    } catch (error) {
      Alert.alert(
        t(heroAppCopy.wallet.fullCashout),
        error instanceof Error ? error.message : t(heroAppCopy.common.unexpectedError),
      );
    } finally {
      setCashoutLoading(false);
    }
  }, [loadWallet, t, token, wallet.balance]);

  const rowDirection = direction === "rtl" ? "row-reverse" : "row";
  const align = direction === "rtl" ? "right" : "left";

  return (
    <TayyarScreen
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={tayyarColors.gold} />}
    >
      <TopBrandBar
        title={t(heroAppCopy.wallet.title)}
        subtitle={t(heroAppCopy.wallet.subtitle)}
        rightSlot={<LocaleTogglePill />}
      />

      <GlassPanel style={styles.balanceCard} tone="gold">
        <Text style={[styles.balanceEyebrow, { fontFamily: getFontFamily(locale, "bodyMedium"), textAlign: align }]}>
          {t(heroAppCopy.wallet.availableBalance)}
        </Text>
        <Text style={styles.balanceValue}>{loading ? "..." : formatCurrency(wallet.balance, locale)}</Text>
        <Text style={[styles.balanceCopy, { fontFamily: getFontFamily(locale, "body"), textAlign: align }]}>
          {t(heroAppCopy.wallet.withdrawNote)}
        </Text>
        <TayyarButton
          label={t(heroAppCopy.wallet.fullCashout)}
          onPress={handleCashout}
          loading={cashoutLoading}
          icon={<Ionicons name="wallet-outline" size={18} color="#071019" />}
        />
      </GlassPanel>

      <View style={[styles.metricsRow, { flexDirection: rowDirection }]}>
        <MetricTile label={t(heroAppCopy.wallet.totalIncome)} value={formatCurrency(incomeTotal, locale)} tone="success" />
        <MetricTile label={t(heroAppCopy.wallet.totalDeductions)} value={formatCurrency(expenseTotal, locale)} tone="sky" />
      </View>

      <SectionHeading
        eyebrow={t(heroAppCopy.wallet.ledger)}
        title={t(heroAppCopy.wallet.latestMoves)}
        subtitle={t(heroAppCopy.wallet.latestMovesSubtitle)}
      />

      <View style={[styles.filterRow, { flexDirection: rowDirection }]}>
        {([
          { key: "ALL", label: t(heroAppCopy.wallet.filterAll) },
          { key: "IN", label: t(heroAppCopy.wallet.filterIn) },
          { key: "OUT", label: t(heroAppCopy.wallet.filterOut) },
          { key: "PAYOUT", label: t(heroAppCopy.wallet.filterPayout) },
        ] as const).map((item) => {
          const active = filter === item.key;
          return (
            <TayyarButton
              key={item.key}
              label={item.label}
              variant={active ? "primary" : "outline"}
              onPress={() => setFilter(item.key)}
              style={styles.filterButton}
            />
          );
        })}
      </View>

      <View style={styles.transactionList}>
        {filteredTransactions.length ? (
          filteredTransactions.map((transaction) => {
            const isPositive = transaction.amount >= 0;
            return (
              <GlassPanel key={transaction.id} style={styles.transactionCard}>
                <View style={styles.transactionIcon}>
                  <Ionicons
                    name={isPositive ? "arrow-down-circle" : "arrow-up-circle"}
                    size={20}
                    color={isPositive ? tayyarColors.success : tayyarColors.warning}
                  />
                </View>
                <View style={styles.transactionContent}>
                  <View style={[styles.transactionTopRow, { flexDirection: rowDirection }]}>
                    <Text style={[styles.transactionTitle, { textAlign: align }]}>
                      {transaction.description || humanizeType(transaction.type)}
                    </Text>
                    <Text style={[styles.transactionAmount, isPositive ? styles.positiveAmount : styles.negativeAmount]}>
                      {`${isPositive ? "+" : "-"} ${formatCurrency(Math.abs(transaction.amount), locale)}`}
                    </Text>
                  </View>
                  <View style={[styles.transactionBottomRow, { flexDirection: rowDirection }]}>
                    <Text style={styles.transactionDate}>
                      {new Date(transaction.createdAt).toLocaleString(locale === "ar" ? "ar-EG-u-nu-latn" : "en-GB", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </Text>
                    <Text style={styles.transactionStatus}>
                      {transaction.status === "SUCCESS"
                        ? t(heroAppCopy.wallet.completed)
                        : transaction.status || t(heroAppCopy.wallet.recorded)}
                    </Text>
                  </View>
                </View>
              </GlassPanel>
            );
          })
        ) : wallet.transactions.length ? (
          <GlassPanel style={styles.emptyCard}>
            <Ionicons name="filter-outline" size={26} color={tayyarColors.goldLight} />
            <Text style={[styles.emptyTitle, { fontFamily: getFontFamily(locale, "heading") }]}>
              {t(heroAppCopy.wallet.filteredEmptyTitle)}
            </Text>
            <Text style={[styles.emptyCopy, { fontFamily: getFontFamily(locale, "body") }]}>
              {t(heroAppCopy.wallet.filteredEmptyBody)}
            </Text>
          </GlassPanel>
        ) : (
          <GlassPanel style={styles.emptyCard}>
            <Ionicons name="receipt-outline" size={26} color={tayyarColors.goldLight} />
            <Text style={[styles.emptyTitle, { fontFamily: getFontFamily(locale, "heading") }]}>
              {t(heroAppCopy.wallet.emptyTitle)}
            </Text>
            <Text style={[styles.emptyCopy, { fontFamily: getFontFamily(locale, "body") }]}>
              {t(heroAppCopy.wallet.emptyBody)}
            </Text>
          </GlassPanel>
        )}
      </View>
    </TayyarScreen>
  );
}

function humanizeType(type: string) {
  return type
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

const styles = StyleSheet.create({
  balanceCard: {
    gap: 12,
  },
  balanceEyebrow: {
    ...typeRamp.label,
    color: tayyarColors.goldLight,
  },
  balanceValue: {
    fontFamily: tayyarFonts.mono,
    fontSize: 34,
    color: tayyarColors.textPrimary,
  },
  balanceCopy: {
    ...typeRamp.body,
  },
  metricsRow: {
    gap: 12,
  },
  filterRow: {
    gap: 10,
    flexWrap: "wrap",
  },
  filterButton: {
    minHeight: 44,
  },
  transactionList: {
    gap: 12,
    paddingBottom: 20,
  },
  transactionCard: {
    flexDirection: "row-reverse",
    gap: 14,
    alignItems: "center",
  },
  transactionIcon: {
    width: 48,
    height: 48,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: tayyarColors.border,
  },
  transactionContent: {
    flex: 1,
    gap: 8,
  },
  transactionTopRow: {
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  transactionBottomRow: {
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  transactionTitle: {
    ...typeRamp.bodyStrong,
    flex: 1,
  },
  transactionAmount: {
    fontFamily: tayyarFonts.mono,
    fontSize: 14,
  },
  positiveAmount: {
    color: tayyarColors.success,
  },
  negativeAmount: {
    color: tayyarColors.warning,
  },
  transactionDate: {
    ...typeRamp.label,
  },
  transactionStatus: {
    ...typeRamp.label,
    color: tayyarColors.textSecondary,
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
    textAlign: "center",
  },
});
