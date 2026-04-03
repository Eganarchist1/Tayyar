import { Platform, type TextStyle, type ViewStyle } from "react-native";
import { formatLocalizedCurrency, type AppLocale } from "@tayyar/utils";

export const midnightColors = {
  canvas: "#030509",
  base: "#070B14",
  surface: "#0E1420",
  surface2: "#141E2E",
  overlay: "#1A2438",
  elevated: "#213148",
  sky: "#0EA5E9",
  skyLight: "#38BDF8",
  gold: "#F59E0B",
  goldLight: "#FCD34D",
  success: "#10B981",
  warning: "#F97316",
  danger: "#EF4444",
  textPrimary: "#EEF4FF",
  textSecondary: "#8BACC8",
  textTertiary: "#5F7893",
  border: "rgba(56,189,248,0.10)",
  borderStrong: "rgba(56,189,248,0.22)",
  glass: "rgba(10,16,29,0.78)",
} as const;

export const fajrColors = {
  canvas: "#F4F7F6",
  base: "#FFFFFF",
  surface: "#FFFFFF",
  surface2: "#EEF8F6",
  overlay: "#E0F2EE",
  elevated: "#C5E8E2",
  sky: "#0D9488",
  skyLight: "#2A9689",
  gold: "#D4920A",
  goldLight: "#FAD86A",
  success: "#15803D",
  warning: "#C2410C",
  danger: "#B91C1C",
  textPrimary: "#042F2E",
  textSecondary: "#1E4D47",
  textTertiary: "#4A7A74",
  border: "rgba(13,148,136,0.25)",
  borderStrong: "rgba(13,148,136,0.45)",
  glass: "rgba(255,255,255,0.92)",
} as const;

export const tayyarColors = midnightColors;

export const tayyarFonts = {
  displayAr: "Cairo-900",
  headingAr: "Cairo-700",
  bodyAr: "IBMPlexSansArabic-400",
  bodyMediumAr: "IBMPlexSansArabic-500",
  bodySemiAr: "IBMPlexSansArabic-600",
  displayEn: "Syne-700",
  headingEn: "Syne-700",
  bodyEn: "DMSans-400",
  bodyMediumEn: "DMSans-500",
  bodySemiEn: "DMSans-700",
  mono: "DMMono-500",
} as const;

export const tayyarSpacing = {
  sm: 10,
  md: 16,
  lg: 20,
  xl: 28,
} as const;

export const tayyarRadii = {
  lg: 22,
  xl: 28,
  pill: 999,
} as const;

export const surfaceShadow: ViewStyle = {
  shadowColor: "#000000",
  shadowOpacity: 0.32,
  shadowRadius: 24,
  shadowOffset: { width: 0, height: 12 },
  elevation: 12,
};

export const typeRamp = {
  hero: {
    fontSize: 30,
    lineHeight: 36,
    color: tayyarColors.textPrimary,
  } satisfies TextStyle,
  heading: {
    fontSize: 22,
    lineHeight: 28,
    color: tayyarColors.textPrimary,
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
  } satisfies TextStyle,
  label: {
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: Platform.OS === "web" ? 0.4 : 0,
    color: tayyarColors.textTertiary,
  } satisfies TextStyle,
};

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

export function getHeroStatusMeta(
  status?: string | null,
  locale: AppLocale = "ar",
) {
  switch (status) {
    case "ONLINE":
      return {
        label: locale === "ar" ? "جاهز" : "Online",
        textColor: "#D1FAE5",
        bgColor: "rgba(16,185,129,0.12)",
        borderColor: "rgba(16,185,129,0.22)",
      };
    case "ON_DELIVERY":
      return {
        label: locale === "ar" ? "في مهمة" : "On mission",
        textColor: "#FDE68A",
        bgColor: "rgba(245,158,11,0.12)",
        borderColor: "rgba(245,158,11,0.22)",
      };
    case "ON_BREAK":
      return {
        label: locale === "ar" ? "استراحة" : "On break",
        textColor: "#FDBA74",
        bgColor: "rgba(249,115,22,0.12)",
        borderColor: "rgba(249,115,22,0.22)",
      };
    default:
      return {
        label: locale === "ar" ? "غير متصل" : "Offline",
        textColor: "#CBD5E1",
        bgColor: "rgba(148,163,184,0.10)",
        borderColor: "rgba(148,163,184,0.16)",
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
