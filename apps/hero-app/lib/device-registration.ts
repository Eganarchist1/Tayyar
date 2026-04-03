import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { heroFetch } from "./api";

const INSTALLATION_ID_KEY = "tayyar-hero-installation-id";
const LAST_REGISTERED_KEY = "tayyar-hero-device-registered";

async function getInstallationId() {
  const existing = await AsyncStorage.getItem(INSTALLATION_ID_KEY);
  if (existing) {
    return existing;
  }

  const next = `hero-${Platform.OS}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  await AsyncStorage.setItem(INSTALLATION_ID_KEY, next);
  return next;
}

export async function registerHeroDevice(token?: string | null) {
  if (!token) {
    return null;
  }

  const installationId = await getInstallationId();
  const registrationFingerprint = `${installationId}:${Platform.OS}:${Constants.expoConfig?.version || "dev"}`;
  const lastRegistered = await AsyncStorage.getItem(LAST_REGISTERED_KEY);

  if (lastRegistered === registrationFingerprint) {
    return installationId;
  }

  await heroFetch(
    "/v1/heroes/me/device",
    {
      method: "POST",
      body: JSON.stringify({
        installationId,
        pushToken: null,
        platform: Platform.OS,
        appVersion: Constants.expoConfig?.version || "dev",
      }),
    },
    token,
  );

  await AsyncStorage.setItem(LAST_REGISTERED_KEY, registrationFingerprint);
  return installationId;
}
