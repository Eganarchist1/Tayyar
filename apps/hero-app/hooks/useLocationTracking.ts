import * as Location from "expo-location";
import { heroFetch } from "@/lib/api";

let locationSubscription: Location.LocationSubscription | null = null;

async function postHeroLocation(latitude: number, longitude: number) {
  try {
    await heroFetch("/v1/heroes/location", {
      method: "POST",
      body: JSON.stringify({
        lat: latitude,
        lng: longitude,
        reason: "MOVING_WITHOUT_ORDER",
      }),
    });
  } catch (error) {
    console.error("Failed to post hero location", error);
  }
}

export async function initBackgroundLocation() {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== "granted") {
    throw new Error("Location permission not granted.");
  }

  if (locationSubscription) {
    return locationSubscription;
  }

  locationSubscription = await Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: 30000,
      distanceInterval: 50,
    },
    async ({ coords }) => {
      await postHeroLocation(coords.latitude, coords.longitude);
    },
  );

  return locationSubscription;
}

export async function stopLocationTracking() {
  if (locationSubscription) {
    locationSubscription.remove();
    locationSubscription = null;
  }
}
