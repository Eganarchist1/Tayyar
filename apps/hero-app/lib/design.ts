import { Platform, type TextStyle, type ViewStyle } from "react-native";
import { formatLocalizedCurrency, type AppLocale } from "@tayyar/utils";

export const heroPrimitives = {
  color: {
    midnight950: "#04070D",
    midnight900: "#08101A",
    midnight850: "#0D1622",
    midnight800: "#111C2A",
    midnight700: "#162638",
    sky500: "#1FB6FF",
    sky400: "#51C7FF",
    sky300: "#8EDCFF",
    gold500: "#F6B73C",
    gold300: "#F9D577",
    success500: "#2CCB72",
    warning500: "#FF8A3D",
    danger500: "#F05A7E",
    white: "#F7FAFF",
    slate200: "#C5D1E0",
    slate300: "#9EB0C7",
    slate400: "#7E8FA5",
    slate500: "#627286",
    black: "#000000",
  },
  spacing: {
    2: 8,
    3: 12,
    4: 16,
    5: 20,
    6: 24,
    7: 28,
    8: 32,
  },
  radius: {
    sm: 14,
    md: 18,
    lg: 24,
    xl: 30,
    full: 999,
  },
  icon: {
    sm: 16,
    md: 20,
    lg: 24,
    xl: 30,
  },
  motion: {
    fast: 140,
    normal: 220,
    slow: 320,
  },
} as const;

export const heroTokens = {
  surface: {
    canvas: heroPrimitives.color.midnight950,
    primary: heroPrimitives.color.midnight900,
    secondary: heroPrimitives.color.midnight850,
    elevated: heroPrimitives.color.midnight800,
    accent: "#0F2233",
    success: "#0B2419",
    warning: "#2B190E",
  },
  text: {
    primary: heroPrimitives.color.white,
    secondary: heroPrimitives.color.slate200,
    muted: heroPrimitives.color.slate400,
    accent: heroPrimitives.color.sky300,
    critical: "#FFC2D1",
  },
  border: {
    subtle: "rgba(142,220,255,0.10)",
    default: "rgba(142,220,255,0.16)",
    strong: "rgba(142,220,255,0.28)",
  },
  action: {
    primaryBackground: heroPrimitives.color.gold500,
    primaryText: "#071019",
    secondaryBackground: "rgba(255,255,255,0.04)",
    secondaryText: heroPrimitives.color.white,
  },
  state: {
    offline: {
      bg: "rgba(126,143,165,0.12)",
      border: "rgba(126,143,165,0.22)",
      text: "#E2E8F0",
    },
    online: {
      bg: "rgba(44,203,114,0.14)",
      border: "rgba(44,203,114,0.24)",
      text: "#D4FBE6",
    },
    mission: {
      bg: "rgba(246,183,60,0.14)",
      border: "rgba(246,183,60,0.24)",
      text: "#FDE9B2",
    },
    break: {
      bg: "rgba(255,138,61,0.16)",
      border: "rgba(255,138,61,0.24)",
      text: "#FFD4BD",
    },
    warning: {
      bg: "rgba(240,90,126,0.14)",
      border: "rgba(240,90,126,0.24)",
      text: "#FFD0DD",
    },
  },
  mission: {
    accept: {
      background: heroPrimitives.color.gold500,
      text: "#071019",
    },
    navigate: {
      background: heroPrimitives.color.sky500,
      text: "#071019",
    },
  },
} as const;

export const tayyarColors = {
  canvas: heroTokens.surface.canvas,
  base: heroTokens.surface.primary,
  surface: heroTokens.surface.secondary,
  surface2: heroTokens.surface.elevated,
  overlay: heroTokens.surface.accent,
  elevated: "#1B2C42",
  sky: heroPrimitives.color.sky500,
  skyLight: heroPrimitives.color.sky300,
  gold: heroPrimitives.color.gold500,
  goldLight: heroPrimitives.color.gold300,
  success: heroPrimitives.color.success500,
  warning: heroPrimitives.color.warning500,
  danger: heroPrimitives.color.danger500,
  textPrimary: heroTokens.text.primary,
  textSecondary: heroTokens.text.secondary,
  textTertiary: heroTokens.text.muted,
  border: heroTokens.border.default,
  borderStrong: heroTokens.border.strong,
  glass: "rgba(12, 21, 33, 0.94)",
} as const;

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
  xs: heroPrimitives.spacing[2],
  sm: heroPrimitives.spacing[3],
  md: heroPrimitives.spacing[4],
  lg: heroPrimitives.spacing[5],
  xl: heroPrimitives.spacing[6],
  xxl: heroPrimitives.spacing[7],
} as const;

export const tayyarRadii = {
  sm: heroPrimitives.radius.sm,
  md: heroPrimitives.radius.md,
  lg: heroPrimitives.radius.lg,
  xl: heroPrimitives.radius.xl,
  pill: heroPrimitives.radius.full,
} as const;

export const surfaceShadow: ViewStyle = {
  shadowColor: "#000000",
  shadowOpacity: 0.28,
  shadowRadius: 24,
  shadowOffset: { width: 0, height: 12 },
  elevation: 12,
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
  if (role === "mono") return tayyarFonts.mono;

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
      return { label: locale === "ar" ? "جاهز" : "Online", ...heroTokens.state.online };
    case "ON_DELIVERY":
      return { label: locale === "ar" ? "في مهمة" : "On mission", ...heroTokens.state.mission };
    case "ON_BREAK":
      return { label: locale === "ar" ? "استراحة" : "On break", ...heroTokens.state.break };
    default:
      return { label: locale === "ar" ? "غير متصل" : "Offline", ...heroTokens.state.offline };
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

export function formatAppTime(date: Date, locale: AppLocale) {
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-EG-u-nu-latn" : "en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
