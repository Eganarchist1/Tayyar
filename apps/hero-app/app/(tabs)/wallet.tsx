import React from "react";
import { Alert, RefreshControl, StyleSheet, Text, View } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import {
  EmptyState,
  GlassPanel,
  LocaleTogglePill,
  MetricTile,
  SectionHeading,
  TayyarButton,
  TayyarScreen,
  TopBrandBar,
} from "@/components/tayyar-ui";
import { formatCurrency, getFontFamily, tayyarColors, typeRamp } from "@/lib/design";
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

  const incomeTotal = React.useMemo(
    () => wallet.transactions.filter((item) => item.amount > 0).reduce((sum, item) => sum + item.amount, 0),
    [wallet.transactions],
  );
  const expenseTotal = React.useMemo(
    () => wallet.transactions.filter((item) => item.amount < 0).reduce((sum, item) => sum + Math.abs(item.amount), 0),
    [wallet.transactions],
  );

  async function handleCashout() {
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
  }

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

      <GlassPanel tone="warning" style={styles.balanceCard}>
        <Text style={[styles.balanceLabel, { fontFamily: getFontFamily(locale, "bodyMedium"), textAlign: align }]}>
          {t(heroAppCopy.wallet.availableBalance)}
        </Text>
        <Text style={[styles.balanceValue, { textAlign: align }]}>
          {loading ? "..." : formatCurrency(wallet.balance, locale)}
        </Text>
        <Text style={[styles.balanceHint, { fontFamily: getFontFamily(locale, "body"), textAlign: align }]}>
          {t(heroAppCopy.wallet.withdrawNote)}
        </Text>
        <TayyarButton
          label={t(heroAppCopy.wallet.fullCashout)}
          onPress={handleCashout}
          loading={cashoutLoading}
          icon={<Ionicons name="wallet-outline" size={18} color="#071019" />}
        />
      </GlassPanel>

      <View style={[styles.metricRow, { flexDirection: rowDirection }]}>
        <MetricTile label={t(heroAppCopy.wallet.totalIncome)} value={formatCurrency(incomeTotal, locale)} tone="success" />
        <MetricTile label={t(heroAppCopy.wallet.totalDeductions)} value={formatCurrency(expenseTotal, locale)} tone="accent" />
      </View>

      <SectionHeading
        eyebrow={t(heroAppCopy.wallet.ledger)}
        title={t(heroAppCopy.wallet.latestMoves)}
        subtitle={t(heroAppCopy.wallet.latestMovesSubtitle)}
      />

      <View style={styles.list}>
        {wallet.transactions.length ? (
          wallet.transactions.slice(0, 12).map((transaction) => {
            const positive = transaction.amount >= 0;
            return (
              <GlassPanel key={transaction.id} style={styles.transactionCard}>
                <View style={[styles.transactionRow, { flexDirection: rowDirection }]}>
                  <View style={[styles.transactionBadge, positive ? styles.incomingBadge : styles.outgoingBadge]}>
                    <Ionicons
                      name={positive ? "arrow-down-outline" : "arrow-up-outline"}
                      size={18}
                      color={positive ? tayyarColors.success : tayyarColors.warning}
                    />
                  </View>
                  <View style={styles.transactionCopy}>
                    <Text style={[styles.transactionTitle, { fontFamily: getFontFamily(locale, "heading"), textAlign: align }]}>
                      {transaction.description || humanizeType(transaction.type)}
                    </Text>
                    <Text style={[styles.transactionMeta, { fontFamily: getFontFamily(locale, "body"), textAlign: align }]}>
                      {new Date(transaction.createdAt).toLocaleString(locale === "ar" ? "ar-EG-u-nu-latn" : "en-GB", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </Text>
                  </View>
                  <Text style={[styles.transactionAmount, positive ? styles.amountIn : styles.amountOut]}>
                    {`${positive ? "+" : "-"} ${formatCurrency(Math.abs(transaction.amount), locale)}`}
                  </Text>
                </View>
              </GlassPanel>
            );
          })
        ) : (
          <EmptyState
            icon="receipt-outline"
            title={t(heroAppCopy.wallet.emptyTitle)}
            body={t(heroAppCopy.wallet.emptyBody)}
          />
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
  balanceLabel: {
    ...typeRamp.label,
    color: tayyarColors.goldLight,
  },
  balanceValue: {
    fontFamily: "monospace",
    fontSize: 32,
    color: tayyarColors.textPrimary,
  },
  balanceHint: {
    ...typeRamp.body,
    color: tayyarColors.textSecondary,
  },
  metricRow: {
    gap: 12,
  },
  list: {
    gap: 12,
    paddingBottom: 20,
  },
  transactionCard: {
    gap: 8,
  },
  transactionRow: {
    alignItems: "center",
    gap: 12,
  },
  transactionBadge: {
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  incomingBadge: {
    backgroundColor: "rgba(34, 197, 94, 0.12)",
  },
  outgoingBadge: {
    backgroundColor: "rgba(245, 158, 11, 0.12)",
  },
  transactionCopy: {
    flex: 1,
    gap: 4,
  },
  transactionTitle: {
    fontSize: 17,
    color: tayyarColors.textPrimary,
  },
  transactionMeta: {
    ...typeRamp.body,
    color: tayyarColors.textSecondary,
  },
  transactionAmount: {
    fontFamily: "monospace",
    fontSize: 13,
  },
  amountIn: {
    color: tayyarColors.success,
  },
  amountOut: {
    color: tayyarColors.warning,
  },
});
