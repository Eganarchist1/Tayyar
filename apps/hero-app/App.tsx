import React from "react";
import { I18nManager, Pressable, StatusBar, StyleSheet, Text, View } from "react-native";
import { DarkTheme, NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator, type BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import Ionicons from "react-native-vector-icons/Ionicons";
import HomeScreen from "@/app/(tabs)/index";
import MissionsScreen from "@/app/(tabs)/missions";
import WalletScreen from "@/app/(tabs)/wallet";
import ProfileScreen from "@/app/(tabs)/profile";
import LoginScreen from "@/app/login";
import OrderDetailsScreen from "@/app/order/[id]";
import { HeroLoadingShell } from "@/components/tayyar-ui";
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

function DriverTabBar({ state, navigation }: BottomTabBarProps) {
  const { locale, direction } = useHeroLocale();
  const row = direction === "rtl" ? "row-reverse" : "row";

  const labels: Record<keyof HeroMainTabParamList, string> = {
    Home: locale === "ar" ? "الرئيسية" : "Home",
    Missions: locale === "ar" ? "المهام" : "Missions",
    Wallet: locale === "ar" ? "المحفظة" : "Wallet",
    Profile: locale === "ar" ? "الحساب" : "Profile",
  };

  const icons: Record<keyof HeroMainTabParamList, string> = {
    Home: "grid-outline",
    Missions: "map-outline",
    Wallet: "wallet-outline",
    Profile: "person-outline",
  };

  return (
    <View style={styles.tabWrap}>
      <View style={[styles.tabBar, { flexDirection: row }]}>
        {state.routes.map((route, index) => {
          const tabName = route.name as keyof HeroMainTabParamList;
          const focused = state.index === index;
          return (
            <View key={route.key} style={styles.tabItem}>
              <Pressable
                onPress={() => navigation.navigate(route.name as never)}
                style={({ pressed }) => [styles.tabPressable, pressed && styles.tabPressablePressed]}
              >
                <View style={[styles.tabPressFrame, focused && styles.tabPressFrameActive]}>
                  <Ionicons
                    name={icons[tabName]}
                    size={22}
                    color={focused ? "#071019" : tayyarColors.textSecondary}
                  />
                </View>
                <Text
                  style={[
                    styles.tabText,
                    { fontFamily: getFontFamily(locale, "bodySemi") },
                    focused && styles.tabTextActive,
                  ]}
                >
                  {labels[tabName]}
                </Text>
              </Pressable>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function MainTabs() {
  return (
    <Tabs.Navigator screenOptions={{ headerShown: false }} tabBar={(props) => <DriverTabBar {...props} />}>
      <Tabs.Screen name="Home" component={HomeScreen} />
      <Tabs.Screen name="Missions" component={MissionsScreen} />
      <Tabs.Screen name="Wallet" component={WalletScreen} />
      <Tabs.Screen name="Profile" component={ProfileScreen} />
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
    if (!hasHydrated || !user || !token) return;
    registerHeroDevice(token).catch(() => undefined);
  }, [hasHydrated, token, user]);

  if (!hasHydrated) {
    return <HeroLoadingShell />;
  }

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor={tayyarColors.canvas} />
      <NavigationContainer theme={navigationTheme}>
        <RootStack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: tayyarColors.canvas } }}>
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
    left: 14,
    right: 14,
    bottom: 14,
  },
  tabBar: {
    borderRadius: 28,
    paddingHorizontal: 10,
    paddingTop: 12,
    paddingBottom: 14,
    backgroundColor: "rgba(12, 21, 33, 0.98)",
    borderWidth: 1,
    borderColor: tayyarColors.border,
    gap: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
  },
  tabPressable: {
    width: "100%",
    alignItems: "center",
    gap: 6,
  },
  tabPressablePressed: {
    opacity: 0.92,
  },
  tabPressFrame: {
    width: 48,
    height: 48,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  tabPressFrameActive: {
    backgroundColor: tayyarColors.gold,
  },
  tabText: {
    fontSize: 11,
    color: tayyarColors.textTertiary,
  },
  tabTextActive: {
    color: tayyarColors.textPrimary,
  },
});
