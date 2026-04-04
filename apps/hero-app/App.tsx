import React from "react";
import { I18nManager, Pressable, StatusBar, StyleSheet, Text, View } from "react-native";
import { DarkTheme, NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator, type BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import Ionicons from "react-native-vector-icons/Ionicons";
import DashboardScreen from "@/app/(tabs)/index";
import WalletScreen from "@/app/(tabs)/wallet";
import HrScreen from "@/app/(tabs)/explore";
import LoginScreen from "@/app/login";
import OrderDetailsScreen from "@/app/order/[id]";
import { HeroLoadingShell } from "@/components/tayyar-ui";
import { heroAppCopy } from "@/lib/copy";
import { getFontFamily, tayyarColors } from "@/lib/design";
import { HeroLocaleProvider, useHeroLocale } from "@/lib/locale";
import { registerHeroDevice } from "@/lib/device-registration";
import type { HeroMainTabParamList, HeroRootStackParamList } from "@/lib/navigation";
import { useAuthStore } from "@/store/authStore";

const RootStack = createNativeStackNavigator<HeroRootStackParamList>();
const Tabs = createBottomTabNavigator<HeroMainTabParamList>();

const navigationTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: tayyarColors.canvas,
    card: tayyarColors.surface,
    border: tayyarColors.border,
    primary: tayyarColors.gold,
    text: tayyarColors.textPrimary,
  },
};

function TayyarTabBar({ state, navigation }: BottomTabBarProps) {
  const { locale, direction, t } = useHeroLocale();
  const rowDirection = direction === "rtl" ? "row-reverse" : "row";

  return (
    <View style={styles.tabWrap}>
      <View style={[styles.tabBar, { flexDirection: rowDirection }]}>
        {state.routes.map((route, index) => {
          const isFocused = state.index === index;
          const label =
            route.name === "Dashboard"
              ? t(heroAppCopy.dashboard.title)
              : route.name === "Wallet"
                ? t(heroAppCopy.wallet.title)
                : locale === "ar"
                  ? "الموارد"
                  : "HR";

          const iconName =
            route.name === "Dashboard"
              ? "compass-outline"
              : route.name === "Wallet"
                ? "wallet-outline"
                : "calendar-outline";

          return (
            <Pressable
              key={route.key}
              onPress={() => navigation.navigate(route.name as never)}
              style={[styles.tabButton, isFocused && styles.tabButtonActive]}
            >
              <View style={[styles.tabIconWrap, isFocused && styles.tabIconWrapActive]}>
                <Ionicons
                  name={iconName}
                  size={20}
                  color={isFocused ? "#071019" : tayyarColors.textSecondary}
                />
              </View>
              <Text
                style={[
                  styles.tabLabel,
                  { fontFamily: getFontFamily(locale, "bodyMedium") },
                  isFocused && styles.tabLabelActive,
                ]}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function MainTabs() {
  return (
    <Tabs.Navigator screenOptions={{ headerShown: false }} tabBar={(props) => <TayyarTabBar {...props} />}>
      <Tabs.Screen name="Dashboard" component={DashboardScreen} />
      <Tabs.Screen name="Wallet" component={WalletScreen} />
      <Tabs.Screen name="Hr" component={HrScreen} />
    </Tabs.Navigator>
  );
}

function AppNavigator() {
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const hasHydrated = useAuthStore((state) => state.hasHydrated);

  React.useEffect(() => {
    I18nManager.allowRTL(true);
    I18nManager.swapLeftAndRightInRTL(true);
  }, []);

  React.useEffect(() => {
    if (!hasHydrated || !user || !token) {
      return;
    }

    registerHeroDevice(token).catch(() => undefined);
  }, [hasHydrated, token, user]);

  if (!hasHydrated) {
    return <HeroLoadingShell />;
  }

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor={tayyarColors.canvas} />
      <NavigationContainer theme={navigationTheme}>
        <RootStack.Navigator
          screenOptions={{ headerShown: false, contentStyle: { backgroundColor: tayyarColors.canvas } }}
        >
          {token ? (
            <>
              <RootStack.Screen name="MainTabs" component={MainTabs} />
              <RootStack.Screen name="OrderDetails" component={OrderDetailsScreen} />
            </>
          ) : (
            <RootStack.Screen name="Login" component={LoginScreen} />
          )}
        </RootStack.Navigator>
      </NavigationContainer>
    </>
  );
}

export default function App() {
  return (
    <HeroLocaleProvider>
      <AppNavigator />
    </HeroLocaleProvider>
  );
}

const styles = StyleSheet.create({
  tabWrap: {
    position: "absolute",
    bottom: 14,
    left: 16,
    right: 16,
  },
  tabBar: {
    borderRadius: 26,
    borderWidth: 1,
    borderColor: tayyarColors.border,
    backgroundColor: "rgba(17,24,39,0.96)",
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 12,
    gap: 10,
  },
  tabButton: {
    flex: 1,
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    borderRadius: 18,
  },
  tabButtonActive: {
    backgroundColor: "rgba(41,182,246,0.08)",
  },
  tabIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  tabIconWrapActive: {
    backgroundColor: tayyarColors.gold,
  },
  tabLabel: {
    fontSize: 11,
    color: tayyarColors.textTertiary,
  },
  tabLabelActive: {
    color: tayyarColors.textPrimary,
  },
});
