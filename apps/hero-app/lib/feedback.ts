import ReactNativeHapticFeedback from "react-native-haptic-feedback";

const options = {
  enableVibrateFallback: true,
  ignoreAndroidSystemSettings: false,
} as const;

function trigger(type: Parameters<typeof ReactNativeHapticFeedback.trigger>[0]) {
  try {
    ReactNativeHapticFeedback.trigger(type, options);
  } catch {
    // Haptics are optional in the first stable release.
  }
}

export const heroFeedback = {
  success() {
    trigger("notificationSuccess");
  },
  warning() {
    trigger("notificationWarning");
  },
  error() {
    trigger("notificationError");
  },
  selection() {
    trigger("effectTick");
  },
  impact() {
    trigger("impactMedium");
  },
};
