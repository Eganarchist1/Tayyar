import React from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
  type ScrollViewProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { getHeroStatusMeta, getFontFamily, surfaceShadow, tayyarColors, tayyarRadii, tayyarSpacing, typeRamp } from "@/lib/design";
import { heroAppCopy } from "@/lib/copy";
import { useHeroLocale } from "@/lib/locale";

function textAlign(direction: "rtl" | "ltr") {
  return direction === "rtl" ? "right" : "left";
}

function rowDirection(direction: "rtl" | "ltr") {
  return direction === "rtl" ? "row-reverse" : "row";
}

export function TayyarScreen({
  children,
  scroll = true,
  contentContainerStyle,
  refreshControl,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  contentContainerStyle?: ScrollViewProps["contentContainerStyle"];
  refreshControl?: ScrollViewProps["refreshControl"];
}) {
  const content = scroll ? (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[styles.screenContent, contentContainerStyle]}
      refreshControl={refreshControl}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.screenContent, contentContainerStyle as ViewStyle]}>{children}</View>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <View style={styles.canvasGlowTop} />
      <View style={styles.canvasGlowBottom} />
      {content}
    </SafeAreaView>
  );
}

export function GlassPanel({
  children,
  style,
  tone = "default",
}: {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  tone?: "default" | "gold" | "sky" | "success";
}) {
  const toneStyle =
    tone === "gold"
      ? styles.goldPanel
      : tone === "sky"
        ? styles.skyPanel
        : tone === "success"
          ? styles.successPanel
          : styles.defaultPanel;

  return (
    <LinearGradient
      colors={
        tone === "gold"
          ? ["rgba(245,158,11,0.16)", "rgba(7,11,20,0.92)"]
          : ["rgba(255,255,255,0.06)", "rgba(255,255,255,0.025)"]
      }
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.panel, toneStyle, style]}
    >
      {children}
    </LinearGradient>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
}) {
  const { locale, direction } = useHeroLocale();

  return (
    <View style={styles.sectionHeading}>
      {eyebrow ? <Text style={[styles.eyebrow, { fontFamily: getFontFamily(locale, "bodyMedium"), textAlign: textAlign(direction) }]}>{eyebrow}</Text> : null}
      <Text style={[styles.heading, { fontFamily: getFontFamily(locale, "heading"), textAlign: textAlign(direction) }]}>{title}</Text>
      {subtitle ? <Text style={[styles.subtitle, { fontFamily: getFontFamily(locale, "body"), textAlign: textAlign(direction) }]}>{subtitle}</Text> : null}
    </View>
  );
}

export function MetricTile({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string | number;
  tone?: "default" | "gold" | "success" | "sky";
}) {
  const { locale, direction } = useHeroLocale();

  return (
    <GlassPanel style={styles.metricTile} tone={tone === "sky" ? "sky" : tone}>
      <Text style={[styles.metricLabel, { fontFamily: getFontFamily(locale, "bodyMedium"), textAlign: textAlign(direction) }]}>{label}</Text>
      <Text style={[styles.metricValue, { textAlign: textAlign(direction) }]}>{value}</Text>
    </GlassPanel>
  );
}

export function StatusPill({
  label,
  tone,
}: {
  label?: string;
  tone?: string | null;
}) {
  const { locale, direction } = useHeroLocale();
  const meta = getHeroStatusMeta(tone || label, locale);

  return (
    <View
      style={[
        styles.statusPill,
        { backgroundColor: meta.bgColor, borderColor: meta.borderColor, flexDirection: rowDirection(direction) },
      ]}
    >
      <View style={[styles.statusDot, { backgroundColor: meta.textColor }]} />
      <Text style={[styles.statusPillText, { color: meta.textColor, fontFamily: getFontFamily(locale, "bodySemi") }]}>
        {label || meta.label}
      </Text>
    </View>
  );
}

export function TayyarButton({
  label,
  onPress,
  icon,
  loading,
  variant = "primary",
  style,
  textStyle,
  disabled,
}: {
  label: string;
  onPress?: (event: GestureResponderEvent) => void;
  icon?: React.ReactNode;
  loading?: boolean;
  variant?: "primary" | "secondary" | "outline";
  style?: ViewStyle | ViewStyle[];
  textStyle?: TextStyle;
  disabled?: boolean;
}) {
  const { locale, direction } = useHeroLocale();
  const content = (
    <>
      {loading ? (
        <ActivityIndicator color={variant === "primary" ? "#071019" : tayyarColors.textPrimary} />
      ) : (
        icon
      )}
      <Text
        style={[
          styles.buttonText,
          { fontFamily: getFontFamily(locale, "heading") },
          variant === "primary" ? styles.primaryButtonText : styles.secondaryButtonText,
          textStyle,
        ]}
      >
        {label}
      </Text>
    </>
  );

  const contentStyle = [
    styles.button,
    { flexDirection: rowDirection(direction) },
    variant === "primary" ? styles.primaryButton : variant === "outline" ? styles.outlineButton : styles.secondaryButton,
    disabled && styles.disabledButton,
  ];

  if (variant === "primary") {
    return (
      <Pressable onPress={onPress} disabled={disabled || loading} style={style}>
        <LinearGradient colors={["#FCD34D", tayyarColors.gold]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={contentStyle}>
          {content}
        </LinearGradient>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={[contentStyle, style]}
    >
      {content}
    </Pressable>
  );
}

export function LocaleTogglePill() {
  const { locale, setLocale } = useHeroLocale();

  return (
    <View style={styles.localeToggle}>
      {(["ar", "en"] as const).map((option) => (
        <Pressable
          key={option}
          onPress={() => setLocale(option)}
          style={[styles.localeToggleButton, locale === option && styles.localeToggleButtonActive]}
        >
          <Text
            style={[
              styles.localeToggleText,
              { fontFamily: getFontFamily(option, "bodySemi") },
              locale === option && styles.localeToggleTextActive,
            ]}
          >
            {option === "ar" ? "العربية" : "English"}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

export function TopBrandBar({
  title,
  subtitle,
  rightSlot,
}: {
  title: string;
  subtitle: string;
  rightSlot?: React.ReactNode;
}) {
  const { locale, direction, t } = useHeroLocale();

  return (
    <View style={[styles.topBar, { flexDirection: rowDirection(direction) }]}>
      <View style={styles.topBarCopy}>
        <Text style={[styles.brandMark, { fontFamily: getFontFamily(locale, "bodyMedium"), textAlign: textAlign(direction) }]}>{t(heroAppCopy.common.heroBrand)}</Text>
        <Text style={[styles.topBarTitle, { fontFamily: getFontFamily(locale, "display"), textAlign: textAlign(direction) }]}>{title}</Text>
        <Text style={[styles.topBarSubtitle, { fontFamily: getFontFamily(locale, "body"), textAlign: textAlign(direction) }]}>{subtitle}</Text>
      </View>
      {rightSlot}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: tayyarColors.canvas,
  },
  screenContent: {
    paddingHorizontal: tayyarSpacing.lg,
    paddingBottom: 120,
    paddingTop: 12,
    gap: tayyarSpacing.lg,
  },
  canvasGlowTop: {
    position: "absolute",
    top: -80,
    left: 0,
    right: 0,
    height: 240,
    backgroundColor: "rgba(14,165,233,0.12)",
    borderRadius: 240,
    transform: [{ scaleX: 1.25 }],
  },
  canvasGlowBottom: {
    position: "absolute",
    bottom: -140,
    right: -30,
    width: 240,
    height: 240,
    backgroundColor: "rgba(245,158,11,0.08)",
    borderRadius: 240,
  },
  topBar: {
    justifyContent: "space-between",
    alignItems: "center",
    gap: tayyarSpacing.md,
  },
  topBarCopy: {
    flex: 1,
    gap: 2,
  },
  brandMark: {
    ...typeRamp.label,
    color: tayyarColors.goldLight,
    letterSpacing: 1.1,
  },
  topBarTitle: {
    ...typeRamp.hero,
    marginTop: 4,
  },
  topBarSubtitle: {
    ...typeRamp.body,
    marginTop: 4,
  },
  panel: {
    borderRadius: tayyarRadii.xl,
    borderWidth: 1,
    borderColor: tayyarColors.border,
    padding: tayyarSpacing.lg,
    overflow: "hidden",
    ...surfaceShadow,
  },
  defaultPanel: {
    backgroundColor: tayyarColors.glass,
  },
  goldPanel: {
    backgroundColor: "rgba(15, 12, 4, 0.88)",
  },
  skyPanel: {
    backgroundColor: "rgba(4, 13, 24, 0.88)",
  },
  successPanel: {
    backgroundColor: "rgba(3, 16, 12, 0.9)",
  },
  sectionHeading: {
    gap: 6,
  },
  eyebrow: {
    ...typeRamp.label,
    letterSpacing: 1,
  },
  heading: {
    ...typeRamp.heading,
  },
  subtitle: {
    ...typeRamp.body,
  },
  metricTile: {
    flex: 1,
    minHeight: 116,
    justifyContent: "space-between",
  },
  metricLabel: {
    ...typeRamp.label,
    color: tayyarColors.textSecondary,
  },
  metricValue: {
    fontFamily: getFontFamily("en", "mono"),
    fontSize: 24,
    color: tayyarColors.textPrimary,
  },
  statusPill: {
    alignItems: "center",
    gap: 8,
    borderRadius: tayyarRadii.pill,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 8,
  },
  statusPillText: {
    fontSize: 12,
  },
  button: {
    minHeight: 58,
    borderRadius: tayyarRadii.lg,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: tayyarSpacing.lg,
  },
  primaryButton: {},
  secondaryButton: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: tayyarColors.border,
  },
  outlineButton: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: tayyarColors.borderStrong,
  },
  disabledButton: {
    opacity: 0.55,
  },
  buttonText: {
    fontSize: 16,
  },
  primaryButtonText: {
    color: "#071019",
  },
  secondaryButtonText: {
    color: tayyarColors.textPrimary,
  },
  localeToggle: {
    flexDirection: "row",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: tayyarColors.border,
    backgroundColor: "rgba(255,255,255,0.04)",
    padding: 4,
    gap: 4,
  },
  localeToggleButton: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  localeToggleButtonActive: {
    backgroundColor: "rgba(14,165,233,0.22)",
  },
  localeToggleText: {
    fontSize: 12,
    color: tayyarColors.textSecondary,
  },
  localeToggleTextActive: {
    color: tayyarColors.textPrimary,
  },
});
