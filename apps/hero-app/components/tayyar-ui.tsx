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
import Ionicons from "react-native-vector-icons/Ionicons";
import {
  getFontFamily,
  getHeroStatusMeta,
  heroTokens,
  surfaceShadow,
  tayyarColors,
  tayyarRadii,
  tayyarSpacing,
  typeRamp,
} from "@/lib/design";
import { heroAppCopy } from "@/lib/copy";
import { useHeroLocale } from "@/lib/locale";

function textAlign(direction: "rtl" | "ltr") {
  return direction === "rtl" ? "right" : "left";
}

function rowDirection(direction: "rtl" | "ltr") {
  return direction === "rtl" ? "row-reverse" : "row";
}

const midnightInk = "#071019";

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
      <View style={styles.glowSky} />
      <View style={styles.glowGold} />
      {content}
    </SafeAreaView>
  );
}

export function HeroLoadingShell({ message }: { message?: string }) {
  const { locale, t } = useHeroLocale();
  return (
    <TayyarScreen scroll={false} contentContainerStyle={styles.loadingWrap}>
      <View style={styles.loadingMark}>
        <Ionicons name="paper-plane" size={28} color={midnightInk} />
      </View>
      <ActivityIndicator color={tayyarColors.skyLight} />
      <Text style={[styles.loadingText, { fontFamily: getFontFamily(locale, "bodyMedium") }]}>
        {message || t(heroAppCopy.common.restoringSession)}
      </Text>
    </TayyarScreen>
  );
}

export function GlassPanel({
  children,
  style,
  tone = "default",
}: {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  tone?: "default" | "accent" | "success" | "warning";
}) {
  const toneStyle =
    tone === "accent"
      ? styles.panelAccent
      : tone === "success"
        ? styles.panelSuccess
        : tone === "warning"
          ? styles.panelWarning
          : styles.panelDefault;

  return <View style={[styles.panel, toneStyle, style]}>{children}</View>;
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
      {eyebrow ? (
        <Text style={[styles.eyebrow, { fontFamily: getFontFamily(locale, "bodyMedium"), textAlign: textAlign(direction) }]}>
          {eyebrow}
        </Text>
      ) : null}
      <Text style={[styles.heading, { fontFamily: getFontFamily(locale, "heading"), textAlign: textAlign(direction) }]}>
        {title}
      </Text>
      {subtitle ? (
        <Text style={[styles.subtitle, { fontFamily: getFontFamily(locale, "body"), textAlign: textAlign(direction) }]}>
          {subtitle}
        </Text>
      ) : null}
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
        <Text style={[styles.brandMark, { fontFamily: getFontFamily(locale, "bodyMedium"), textAlign: textAlign(direction) }]}>
          {t(heroAppCopy.common.heroBrand)}
        </Text>
        <Text style={[styles.topBarTitle, { fontFamily: getFontFamily(locale, "display"), textAlign: textAlign(direction) }]}>
          {title}
        </Text>
        <Text style={[styles.topBarSubtitle, { fontFamily: getFontFamily(locale, "body"), textAlign: textAlign(direction) }]}>
          {subtitle}
        </Text>
      </View>
      {rightSlot}
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
  tone?: "default" | "accent" | "success" | "warning";
}) {
  const { locale, direction } = useHeroLocale();
  return (
    <GlassPanel style={styles.metricTile} tone={tone}>
      <Text style={[styles.metricLabel, { fontFamily: getFontFamily(locale, "bodyMedium"), textAlign: textAlign(direction) }]}>
        {label}
      </Text>
      <Text style={[styles.metricValue, { textAlign: textAlign(direction) }]}>{value}</Text>
    </GlassPanel>
  );
}

export function StatusPill({ label, tone }: { label?: string; tone?: string | null }) {
  const { locale, direction } = useHeroLocale();
  const meta = getHeroStatusMeta(tone || label, locale);
  return (
    <View
      style={[
        styles.statusPill,
        {
          backgroundColor: meta.bg,
          borderColor: meta.border,
          flexDirection: rowDirection(direction),
        },
      ]}
    >
      <View style={[styles.statusDot, { backgroundColor: meta.text }]} />
      <Text style={[styles.statusPillText, { color: meta.text, fontFamily: getFontFamily(locale, "bodySemi") }]}>
        {label || meta.label}
      </Text>
    </View>
  );
}

export function Banner({
  title,
  body,
  tone = "accent",
}: {
  title: string;
  body: string;
  tone?: "accent" | "success" | "warning";
}) {
  const { locale, direction } = useHeroLocale();
  return (
    <GlassPanel tone={tone} style={styles.banner}>
      <Text style={[styles.bannerTitle, { fontFamily: getFontFamily(locale, "bodySemi"), textAlign: textAlign(direction) }]}>
        {title}
      </Text>
      <Text style={[styles.bannerBody, { fontFamily: getFontFamily(locale, "body"), textAlign: textAlign(direction) }]}>
        {body}
      </Text>
    </GlassPanel>
  );
}

export function EmptyState({
  icon,
  title,
  body,
}: {
  icon: string;
  title: string;
  body: string;
}) {
  const { locale } = useHeroLocale();
  return (
    <GlassPanel style={styles.emptyState}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={24} color={tayyarColors.goldLight} />
      </View>
      <Text style={[styles.emptyTitle, { fontFamily: getFontFamily(locale, "heading") }]}>{title}</Text>
      <Text style={[styles.emptyBody, { fontFamily: getFontFamily(locale, "body") }]}>{body}</Text>
    </GlassPanel>
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
          style={[styles.localeButton, locale === option && styles.localeButtonActive]}
        >
          <Text
            style={[
              styles.localeText,
              { fontFamily: getFontFamily(option, "bodySemi") },
              locale === option && styles.localeTextActive,
            ]}
          >
            {option === "ar" ? "العربية" : "English"}
          </Text>
        </Pressable>
      ))}
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
  variant?: "primary" | "secondary" | "outline" | "ghost";
  style?: ViewStyle | ViewStyle[];
  textStyle?: TextStyle;
  disabled?: boolean;
}) {
  const { locale, direction } = useHeroLocale();
  const palette =
    variant === "primary"
      ? styles.primaryButton
      : variant === "outline"
        ? styles.outlineButton
        : variant === "ghost"
          ? styles.ghostButton
          : styles.secondaryButton;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        { flexDirection: rowDirection(direction) },
        palette,
        disabled && styles.disabledButton,
        pressed && !disabled && styles.buttonPressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === "primary" ? midnightInk : tayyarColors.textPrimary} />
      ) : (
        icon
      )}
      <Text
        style={[
          styles.buttonText,
          { fontFamily: getFontFamily(locale, "bodySemi") },
          variant === "primary" ? styles.primaryButtonText : styles.secondaryButtonText,
          variant === "ghost" && styles.ghostButtonText,
          textStyle,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function BottomActionDock({
  primary,
  secondary,
}: {
  primary: React.ReactNode;
  secondary?: React.ReactNode;
}) {
  return (
    <View style={styles.bottomDock}>
      {secondary ? <View style={styles.bottomDockSecondary}>{secondary}</View> : null}
      <View style={styles.bottomDockPrimary}>{primary}</View>
    </View>
  );
}

export function OtpCodeInput({
  value,
}: {
  value: string;
  onChangeText: (value: string) => void;
}) {
  const { direction } = useHeroLocale();
  return (
    <View style={[styles.otpRow, { flexDirection: rowDirection(direction) }]}>
      {[0, 1, 2, 3].map((index) => (
        <View key={index} style={[styles.otpBox, value[index] ? styles.otpBoxFilled : null]}>
          <Text style={[styles.otpDigit, { fontFamily: getFontFamily("en", "mono") }]}>{value[index] || ""}</Text>
        </View>
      ))}
    </View>
  );
}

export function FormField({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  const { locale, direction } = useHeroLocale();
  return (
    <View style={styles.formField}>
      <Text style={[styles.fieldLabel, { fontFamily: getFontFamily(locale, "bodyMedium"), textAlign: textAlign(direction) }]}>
        {label}
      </Text>
      {children}
      {hint ? (
        <Text style={[styles.fieldHint, { fontFamily: getFontFamily(locale, "body"), textAlign: textAlign(direction) }]}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: tayyarColors.canvas,
  },
  screenContent: {
    gap: tayyarSpacing.lg,
    paddingTop: tayyarSpacing.sm,
    paddingHorizontal: tayyarSpacing.lg,
    paddingBottom: 120,
  },
  glowSky: {
    position: "absolute",
    top: -90,
    left: -40,
    width: 240,
    height: 240,
    borderRadius: 240,
    backgroundColor: "rgba(31,182,255,0.12)",
  },
  glowGold: {
    position: "absolute",
    bottom: -130,
    right: -60,
    width: 240,
    height: 240,
    borderRadius: 240,
    backgroundColor: "rgba(246,183,60,0.08)",
  },
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: tayyarSpacing.md,
  },
  loadingMark: {
    width: 68,
    height: 68,
    borderRadius: 22,
    backgroundColor: tayyarColors.gold,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    ...typeRamp.body,
  },
  topBar: {
    alignItems: "center",
    justifyContent: "space-between",
    gap: tayyarSpacing.md,
  },
  topBarCopy: {
    flex: 1,
    gap: 4,
  },
  brandMark: {
    ...typeRamp.label,
    color: heroTokens.text.accent,
  },
  topBarTitle: {
    ...typeRamp.hero,
  },
  topBarSubtitle: {
    ...typeRamp.body,
  },
  panel: {
    borderRadius: tayyarRadii.lg,
    borderWidth: 1,
    borderColor: tayyarColors.border,
    padding: tayyarSpacing.lg,
    gap: tayyarSpacing.md,
    ...surfaceShadow,
  },
  panelDefault: {
    backgroundColor: tayyarColors.glass,
  },
  panelAccent: {
    backgroundColor: heroTokens.surface.accent,
  },
  panelSuccess: {
    backgroundColor: heroTokens.surface.success,
  },
  panelWarning: {
    backgroundColor: heroTokens.surface.warning,
  },
  sectionHeading: {
    gap: 6,
  },
  eyebrow: {
    ...typeRamp.label,
    color: heroTokens.text.accent,
  },
  heading: {
    ...typeRamp.heading,
  },
  subtitle: {
    ...typeRamp.body,
  },
  metricTile: {
    flex: 1,
    minHeight: 108,
    justifyContent: "space-between",
  },
  metricLabel: {
    ...typeRamp.label,
  },
  metricValue: {
    fontSize: 24,
    color: tayyarColors.textPrimary,
    fontFamily: "monospace",
  },
  statusPill: {
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: tayyarRadii.pill,
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
  banner: {
    gap: 6,
  },
  bannerTitle: {
    ...typeRamp.bodyStrong,
  },
  bannerBody: {
    ...typeRamp.body,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: tayyarSpacing.xl,
  },
  emptyIcon: {
    width: 54,
    height: 54,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  emptyTitle: {
    ...typeRamp.heading,
    textAlign: "center",
  },
  emptyBody: {
    ...typeRamp.body,
    textAlign: "center",
  },
  localeToggle: {
    flexDirection: "row",
    padding: 4,
    borderRadius: tayyarRadii.pill,
    borderWidth: 1,
    borderColor: tayyarColors.border,
    backgroundColor: "rgba(255,255,255,0.04)",
    gap: 4,
  },
  localeButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: tayyarRadii.pill,
  },
  localeButtonActive: {
    backgroundColor: "rgba(31,182,255,0.18)",
  },
  localeText: {
    fontSize: 12,
    color: tayyarColors.textSecondary,
  },
  localeTextActive: {
    color: tayyarColors.textPrimary,
  },
  button: {
    minHeight: 56,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: tayyarRadii.md,
    paddingHorizontal: tayyarSpacing.lg,
    gap: 10,
  },
  primaryButton: {
    backgroundColor: heroTokens.action.primaryBackground,
  },
  secondaryButton: {
    backgroundColor: heroTokens.action.secondaryBackground,
    borderWidth: 1,
    borderColor: tayyarColors.border,
  },
  outlineButton: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: tayyarColors.borderStrong,
  },
  ghostButton: {
    backgroundColor: "transparent",
  },
  buttonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.995 }],
  },
  disabledButton: {
    opacity: 0.55,
  },
  buttonText: {
    fontSize: 16,
  },
  primaryButtonText: {
    color: heroTokens.action.primaryText,
  },
  secondaryButtonText: {
    color: heroTokens.action.secondaryText,
  },
  ghostButtonText: {
    color: tayyarColors.skyLight,
  },
  bottomDock: {
    gap: tayyarSpacing.sm,
  },
  bottomDockSecondary: {
    gap: tayyarSpacing.sm,
  },
  bottomDockPrimary: {
    gap: tayyarSpacing.sm,
  },
  otpRow: {
    gap: tayyarSpacing.sm,
    justifyContent: "space-between",
  },
  otpBox: {
    flex: 1,
    minHeight: 68,
    borderRadius: tayyarRadii.md,
    borderWidth: 1,
    borderColor: tayyarColors.border,
    backgroundColor: "rgba(255,255,255,0.04)",
    alignItems: "center",
    justifyContent: "center",
  },
  otpBoxFilled: {
    borderColor: tayyarColors.sky,
    backgroundColor: "rgba(31,182,255,0.12)",
  },
  otpDigit: {
    fontSize: 28,
    color: tayyarColors.textPrimary,
  },
  formField: {
    gap: 8,
  },
  fieldLabel: {
    ...typeRamp.label,
    color: tayyarColors.textSecondary,
  },
  fieldHint: {
    ...typeRamp.body,
    color: tayyarColors.textTertiary,
  },
});
