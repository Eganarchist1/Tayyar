import React from "react";
import { DarkTheme, NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator, type BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useFonts } from "expo-font";
import { StatusBar } from "expo-status-bar";
import { Cairo_700Bold, Cairo_900Black } from "@expo-google-fonts/cairo";
import { DMSans_400Regular, DMSans_500Medium, DMSans_700Bold } from "@expo-google-fonts/dm-sans";
import {
  IBMPlexSansArabic_400Regular,
  IBMPlexSansArabic_500Medium,
  IBMPlexSansArabic_600SemiBold,
} from "@expo-google-fonts/ibm-plex-sans-arabic";
import { DMMono_500Medium } from "@expo-google-fonts/dm-mono";
import { Syne_700Bold } from "@expo-google-fonts/syne";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import DashboardScreen from "@/app/(tabs)/index";
import WalletScreen from "@/app/(tabs)/wallet";
import HrScreen from "@/app/(tabs)/explore";
import LoginScreen from "@/app/login";
import OrderDetailsScreen from "@/app/order/[id]";
import "./global.css";
import { HeroLocaleProvider, useHeroLocale } from "@/lib/locale";
import { heroAppCopy } from "@/lib/copy";
import { getFontFamily, tayyarColors } from "@/lib/design";
import { registerHeroDevice } from "@/lib/device-registration";
import { useAuthStore } from "@/store/authStore";
import type { HeroMainTabParamList, HeroRootStackParamList } from "@/lib/navigation";

const RootStack = createNativeStackNavigator<HeroRootStackParamList>();
const Tabs = createBottomTabNavigator<HeroMainTabParamList>();

function TayyarTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { locale, direction, t } = useHeroLocale();

  return (
    <View style={[styles.tabWrap, { paddingBottom: Math.max(insets.bottom, 16) }]}>
      <LinearGradient
        colors={["rgba(7,11,20,0.98)", "rgba(7,11,20,0.9)"]}
        style={[styles.tabBar, { flexDirection: direction === "rtl" ? "row-reverse" : "row" }]}
      >
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
              style={styles.tabButton}
            >
              <View style={[styles.tabIconWrap, isFocused && styles.tabIconWrapActive]}>
                <Ionicons
                  name={iconName}
                  size={20}
                  color={isFocused ? tayyarColors.goldLight : tayyarColors.textTertiary}
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
      </LinearGradient>
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
    if (!hasHydrated || !user || !token) {
      return;
    }

    registerHeroDevice(token).catch(() => undefined);
  }, [hasHydrated, token, user]);

  if (!hasHydrated) {
    return null;
  }

  return (
    <NavigationContainer theme={DarkTheme}>
      <RootStack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#030509" } }}>
        {token ? (
          <>
            <RootStack.Screen name="MainTabs" component={MainTabs} />
            <RootStack.Screen name="OrderDetails" component={OrderDetailsScreen} />
          </>
        ) : (
          <RootStack.Screen name="Login" component={LoginScreen} />
        )}
      </RootStack.Navigator>
      <StatusBar style="light" />
    </NavigationContainer>
  );
}

export default function App() {
  const [loaded] = useFonts({
    "Cairo-700": Cairo_700Bold,
    "Cairo-900": Cairo_900Black,
    "IBMPlexSansArabic-400": IBMPlexSansArabic_400Regular,
    "IBMPlexSansArabic-500": IBMPlexSansArabic_500Medium,
    "IBMPlexSansArabic-600": IBMPlexSansArabic_600SemiBold,
    "DMSans-400": DMSans_400Regular,
    "DMSans-500": DMSans_500Medium,
    "DMSans-700": DMSans_700Bold,
    "Syne-700": Syne_700Bold,
    "DMMono-500": DMMono_500Medium,
  });

  if (!loaded) {
    return null;
  }

  return (
    <HeroLocaleProvider>
      <AppNavigator />
    </HeroLocaleProvider>
  );
}

const styles = StyleSheet.create({
  tabWrap: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 18,
  },
  tabBar: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: tayyarColors.border,
    paddingHorizontal: 12,
    paddingTop: 10,
    gap: 10,
  },
  tabButton: {
    flex: 1,
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
  },
  tabIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  tabIconWrapActive: {
    backgroundColor: "rgba(245,158,11,0.12)",
  },
  tabLabel: {
    fontSize: 11,
    color: tayyarColors.textTertiary,
  },
  tabLabelActive: {
    color: tayyarColors.textPrimary,
  },
});
