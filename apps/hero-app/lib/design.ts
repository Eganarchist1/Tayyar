import { Platform, type TextStyle, type ViewStyle } from "react-native";
import { formatLocalizedCurrency, type AppLocale } from "@tayyar/utils";

export const midnightColors = {
  canvas: "#05070D",
  base: "#0A0F18",
  surface: "#111827",
  surface2: "#162032",
  overlay: "#1C2A42",
  elevated: "#22314D",
  sky: "#29B6F6",
  skyLight: "#7DD3FC",
  gold: "#F5B640",
  goldLight: "#F9D87A",
  success: "#22C55E",
  warning: "#F97316",
  danger: "#F43F5E",
  textPrimary: "#F5F7FB",
  textSecondary: "#B7C4D8",
  textTertiary: "#7F92AC",
  border: "rgba(125, 211, 252, 0.12)",
  borderStrong: "rgba(125, 211, 252, 0.24)",
  glass: "rgba(15, 23, 42, 0.92)",
} as const;

export const tayyarColors = midnightColors;

export const tayyarFonts = {
  displayAr: Platform.select({ android: "sans-serif-medium", default: "System" }) || "System",
  headingAr: Platform.select({ android: "sans-serif-medium", default: "System" }) || "System",
  bodyAr: Platform.select({ android: "sans-serif", default: "System" }) || "System",
  bodyMediumAr: Platform.select({ android: "sans-serif-medium", default: "System" }) || "System",
  bodySemiAr: Platform.select({ android: "sans-serif-medium", default: "System" }) || "System",
  displayEn: Platform.select({ android: "sans-serif-medium", default: "System" }) || "System",
  headingEn: Platform.select({ android: "sans-serif-medium", default: "System" }) || "System",
  bodyEn: Platform.select({ android: "sans-serif", default: "System" }) || "System",
  bodyMediumEn: Platform.select({ android: "sans-serif-medium", default: "System" }) || "System",
  bodySemiEn: Platform.select({ android: "sans-serif-medium", default: "System" }) || "System",
  mono: Platform.select({ android: "monospace", default: "Menlo" }) || "monospace",
} as const;

export const tayyarSpacing = {
  sm: 10,
  md: 16,
  lg: 20,
  xl: 28,
} as const;

export const tayyarRadii = {
  lg: 20,
  xl: 28,
  pill: 999,
} as const;

export const surfaceShadow: ViewStyle = {
  shadowColor: "#000000",
  shadowOpacity: 0.28,
  shadowRadius: 18,
  shadowOffset: { width: 0, height: 10 },
  elevation: 10,
};

export const typeRamp = {
  hero: {
    fontSize: 30,
    lineHeight: 36,
    color: tayyarColors.textPrimary,
    fontWeight: "700",
  } satisfies TextStyle,
  heading: {
    fontSize: 22,
    lineHeight: 29,
    color: tayyarColors.textPrimary,
    fontWeight: "700",
  } satisfies TextStyle,
  body: {
    fontSize: 14,
    lineHeight: 22,
    color: tayyarColors.textSecondary,
  } satisfies TextStyle,
  bodyStrong: {
    fontSize: 14,
    lineHeight: 22,
    color: tayyarColors.textPrimary,
    fontWeight: "600",
  } satisfies TextStyle,
  label: {
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: Platform.OS === "web" ? 0.4 : 0.2,
    color: tayyarColors.textTertiary,
    fontWeight: "600",
  } satisfies TextStyle,
} as const;

export function getFontFamily(
  locale: AppLocale,
  role: "display" | "heading" | "body" | "bodyMedium" | "bodySemi" | "mono",
) {
  if (role === "mono") {
    return tayyarFonts.mono;
  }

  if (locale === "ar") {
    if (role === "display") return tayyarFonts.displayAr;
    if (role === "heading") return tayyarFonts.headingAr;
    if (role === "body") return tayyarFonts.bodyAr;
    if (role === "bodyMedium") return tayyarFonts.bodyMediumAr;
    return tayyarFonts.bodySemiAr;
  }

  if (role === "display") return tayyarFonts.displayEn;
  if (role === "heading") return tayyarFonts.headingEn;
  if (role === "body") return tayyarFonts.bodyEn;
  if (role === "bodyMedium") return tayyarFonts.bodyMediumEn;
  return tayyarFonts.bodySemiEn;
}

export function formatCurrency(amount: number, locale: AppLocale = "ar") {
  return formatLocalizedCurrency(amount, locale);
}

export function getHeroStatusMeta(status?: string | null, locale: AppLocale = "ar") {
  switch (status) {
    case "ONLINE":
      return {
        label: locale === "ar" ? "جاهز" : "Online",
        textColor: "#DCFCE7",
        bgColor: "rgba(34,197,94,0.14)",
        borderColor: "rgba(34,197,94,0.25)",
      };
    case "ON_DELIVERY":
      return {
        label: locale === "ar" ? "في مهمة" : "On mission",
        textColor: "#FEF3C7",
        bgColor: "rgba(245,182,64,0.14)",
        borderColor: "rgba(245,182,64,0.25)",
      };
    case "ON_BREAK":
      return {
        label: locale === "ar" ? "استراحة" : "On break",
        textColor: "#FED7AA",
        bgColor: "rgba(249,115,22,0.14)",
        borderColor: "rgba(249,115,22,0.25)",
      };
    default:
      return {
        label: locale === "ar" ? "غير متصل" : "Offline",
        textColor: "#E2E8F0",
        bgColor: "rgba(148,163,184,0.12)",
        borderColor: "rgba(148,163,184,0.18)",
      };
  }
}

export function getOrderStage(status?: string | null) {
  if (!status || status === "REQUESTED" || status === "ASSIGNED" || status === "HERO_ACCEPTED") {
    return "pickup";
  }
  if (status === "PICKED_UP" || status === "ON_WAY" || status === "IN_TRANSIT") {
    return "enroute";
  }
  if (status === "ARRIVED") {
    return "handoff";
  }
  if (status === "DELIVERED") {
    return "done";
  }
  return "issue";
}
