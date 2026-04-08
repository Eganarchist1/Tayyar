import Geolocation from "@react-native-community/geolocation";
import { Linking } from "react-native";
import { PERMISSIONS, RESULTS, check, request } from "react-native-permissions";
import { heroFetch } from "@/lib/api";

let watchId: number | null = null;

async function ensureLocationPermission() {
  const permission = PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION;
  const current = await check(permission);

  if (current === RESULTS.GRANTED) {
    return true;
  }

  const requested = await request(permission);
  return requested === RESULTS.GRANTED;
}

async function getCurrentFix() {
  return new Promise<{ coords: { latitude: number; longitude: number } }>((resolve, reject) => {
    Geolocation.getCurrentPosition(
      resolve,
      reject,
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 10000,
      },
    );
  });
}

export async function openLocationServicesSettings() {
  try {
    if (typeof Linking.sendIntent === "function") {
      await Linking.sendIntent("android.settings.LOCATION_SOURCE_SETTINGS");
      return;
    }
  } catch {
    // Fall through to app settings.
  }

  await Linking.openSettings();
}

export async function ensureLocationReady() {
  const granted = await ensureLocationPermission();
  if (!granted) {
    throw new Error("يرجى تفعيل إذن الموقع أولاً.");
  }

  try {
    return await getCurrentFix();
  } catch (error: any) {
    if (error?.code === 2 || error?.message?.toLowerCase?.().includes("location")) {
      await openLocationServicesSettings();
      throw new Error("فعّل خدمات الموقع ثم حاول مرة أخرى.");
    }

    throw error;
  }
}

async function postHeroLocation(latitude: number, longitude: number, token?: string | null) {
  try {
    await heroFetch("/v1/heroes/location", {
      method: "POST",
      body: JSON.stringify({
        lat: latitude,
        lng: longitude,
        reason: "MOVING_WITHOUT_ORDER",
      }),
    }, token);
  } catch (error) {
    console.error("Failed to post hero location", error);
  }
}

export async function initBackgroundLocation(token?: string | null) {
  const position = await ensureLocationReady();

  if (watchId !== null) {
    await postHeroLocation(position.coords.latitude, position.coords.longitude, token);
    return watchId;
  }

  await postHeroLocation(position.coords.latitude, position.coords.longitude, token);

  watchId = Geolocation.watchPosition(
    (position) => {
      void postHeroLocation(position.coords.latitude, position.coords.longitude, token);
    },
    (error) => {
      console.error("Location watch failed", error);
    },
    {
      enableHighAccuracy: false,
      distanceFilter: 50,
      interval: 30000,
      fastestInterval: 15000,
    },
  );

  return watchId;
}

export async function stopLocationTracking() {
  if (watchId !== null) {
    Geolocation.clearWatch(watchId);
    watchId = null;
  }
}
