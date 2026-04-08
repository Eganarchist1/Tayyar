import Geolocation from "@react-native-community/geolocation";
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
  const granted = await ensureLocationPermission();
  if (!granted) {
    throw new Error("Location permission not granted.");
  }

  if (watchId !== null) {
    return watchId;
  }

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
