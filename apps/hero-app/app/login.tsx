import React from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import {
  Banner,
  FormField,
  GlassPanel,
  HeroLoadingShell,
  LocaleTogglePill,
  OtpCodeInput,
  TayyarButton,
  TayyarScreen,
} from "@/components/tayyar-ui";
import { heroAppCopy } from "@/lib/copy";
import { heroFetch, isInvalidOtpError, isMissingHeroAccountError, isRetryableHeroError } from "@/lib/api";
import { heroBuildConfig } from "@/lib/build-config";
import { getFontFamily, tayyarColors, tayyarRadii, typeRamp } from "@/lib/design";
import { useHeroLocale } from "@/lib/locale";
import { useAuthStore } from "@/store/authStore";

type OtpRequestResponse = {
  sent: boolean;
  devCode?: string;
  expiresInSeconds?: number;
};

type OtpVerifyResponse = {
  accessToken: string;
  refreshToken: string;
  user: { name: string; email: string; role: string; phone?: string | null };
};

export default function LoginScreen() {
  const { token, setAuth, hasHydrated } = useAuthStore();
  const { locale, direction, t } = useHeroLocale();
  const [phase, setPhase] = React.useState<"phone" | "otp">("phone");
  const [phone, setPhone] = React.useState(heroBuildConfig.qaHeroPhone.replace(/^\+20/, ""));
  const [otp, setOtp] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [banner, setBanner] = React.useState<{ tone: "accent" | "warning" | "success"; title: string; body: string } | null>(null);

  if (!hasHydrated) {
    return <HeroLoadingShell message={t(heroAppCopy.common.restoringSession)} />;
  }

  if (token) {
    return <HeroLoadingShell message={t(heroAppCopy.common.loading)} />;
  }

  const phoneDigits = phone.replace(/\D/g, "");
  const canContinue = phase === "phone" ? phoneDigits.length >= 10 : otp.length === 4;
  const align = direction === "rtl" ? "right" : "left";
  const rowDirection = direction === "rtl" ? "row-reverse" : "row";

  async function requestCode() {
    setLoading(true);
    setBanner(null);
    try {
      const payload = await heroFetch<OtpRequestResponse>("/v1/auth/otp/request", {
        method: "POST",
        body: JSON.stringify({ phone: `+20${phoneDigits}` }),
      });

      setPhase("otp");
      if (payload.devCode) {
        setOtp(payload.devCode);
      }
      setBanner({
        tone: "success",
        title: t(heroAppCopy.auth.codeSent),
        body:
          payload.devCode
            ? `${t(heroAppCopy.auth.qaCodeHint)}: ${payload.devCode}`
            : heroBuildConfig.buildFlavor === "qa"
              ? t(heroAppCopy.auth.qaCodeHint)
              : t(heroAppCopy.auth.trustedDevice),
      });
    } catch (error) {
      if (isMissingHeroAccountError(error)) {
        setBanner({
          tone: "warning",
          title: t(heroAppCopy.auth.accountMissing),
          body: heroBuildConfig.buildFlavor === "qa" ? t(heroAppCopy.auth.qaHint) : t(heroAppCopy.common.unexpectedError),
        });
        return;
      }

      setBanner({
        tone: "warning",
        title: isRetryableHeroError(error) ? t(heroAppCopy.common.offline) : t(heroAppCopy.common.retry),
        body: error instanceof Error ? error.message : t(heroAppCopy.common.unexpectedError),
      });
    } finally {
      setLoading(false);
    }
  }

  async function verifyCode() {
    setLoading(true);
    setBanner(null);
    try {
      const payload = await heroFetch<OtpVerifyResponse>("/v1/auth/otp/verify", {
        method: "POST",
        body: JSON.stringify({ phone: `+20${phoneDigits}`, code: otp }),
      });
      setAuth(payload.accessToken, payload.refreshToken, payload.user);
    } catch (error) {
      setBanner({
        tone: "warning",
        title: isInvalidOtpError(error) ? t(heroAppCopy.auth.wrongCode) : t(heroAppCopy.common.retry),
        body: error instanceof Error ? error.message : t(heroAppCopy.common.unexpectedError),
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <TayyarScreen scroll={false} contentContainerStyle={styles.screen}>
      <View style={styles.header}>
        <LocaleTogglePill />
        <View style={styles.logoWrap}>
          <View style={styles.logoBadge}>
            <Ionicons name="paper-plane" size={34} color="#071019" />
          </View>
          <Text style={[styles.brand, { fontFamily: getFontFamily(locale, "display") }]}>
            {t(heroAppCopy.common.heroBrand)}
          </Text>
        </View>
        <Text style={[styles.title, { fontFamily: getFontFamily(locale, "heading"), textAlign: "center" }]}>
          {t(heroAppCopy.auth.title)}
        </Text>
        <Text style={[styles.subtitle, { fontFamily: getFontFamily(locale, "body"), textAlign: "center" }]}>
          {t(heroAppCopy.auth.subtitle)}
        </Text>
      </View>

      <GlassPanel style={styles.panel} tone="accent">
        <Text style={[styles.panelTitle, { fontFamily: getFontFamily(locale, "heading"), textAlign: align }]}>
          {phase === "phone" ? t(heroAppCopy.auth.phoneTitle) : t(heroAppCopy.auth.otpTitle)}
        </Text>
        <Text style={[styles.panelBody, { fontFamily: getFontFamily(locale, "body"), textAlign: align }]}>
          {phase === "phone" ? t(heroAppCopy.auth.phoneBody) : t(heroAppCopy.auth.otpBody)}
        </Text>

        {banner ? <Banner title={banner.title} body={banner.body} tone={banner.tone} /> : null}

        {phase === "phone" ? (
          <FormField label={t(heroAppCopy.auth.phoneLabel)} hint={heroBuildConfig.buildFlavor === "qa" ? t(heroAppCopy.auth.qaHint) : undefined}>
            <View style={[styles.phoneInputShell, { flexDirection: rowDirection }]}>
              <Text style={styles.countryCode}>+20</Text>
              <TextInput
                value={phone}
                onChangeText={(value) => setPhone(value.replace(/[^\d]/g, "").slice(0, 11))}
                keyboardType="phone-pad"
                placeholder="10XXXXXXXX"
                placeholderTextColor={tayyarColors.textTertiary}
                style={[
                  styles.phoneInput,
                  {
                    textAlign: direction === "rtl" ? "right" : "left",
                    fontFamily: getFontFamily("en", "mono"),
                  },
                ]}
              />
            </View>
          </FormField>
        ) : (
          <View style={styles.formStack}>
            <FormField
              label={t(heroAppCopy.auth.otpLabel)}
              hint={heroBuildConfig.buildFlavor === "qa" ? t(heroAppCopy.auth.qaCodeHint) : t(heroAppCopy.auth.trustedDevice)}
            >
              <OtpCodeInput value={otp} onChangeText={setOtp} />
              <TextInput
                value={otp}
                onChangeText={(value) => setOtp(value.replace(/[^\d]/g, "").slice(0, 4))}
                keyboardType="number-pad"
                maxLength={4}
                autoFocus
                placeholder="1234"
                placeholderTextColor={tayyarColors.textTertiary}
                style={[
                  styles.otpInput,
                  {
                    textAlign: "center",
                    fontFamily: getFontFamily("en", "mono"),
                  },
                ]}
              />
            </FormField>

            <TayyarButton
              label={t(heroAppCopy.auth.editPhone)}
              variant="ghost"
              onPress={() => {
                setPhase("phone");
                setOtp("");
                setBanner(null);
              }}
            />
          </View>
        )}

        <TayyarButton
          label={
            loading
              ? phase === "phone"
                ? t(heroAppCopy.auth.sendingCode)
                : t(heroAppCopy.auth.verifyingCode)
              : phase === "phone"
                ? t(heroAppCopy.auth.sendCode)
                : t(heroAppCopy.auth.verifyCode)
          }
          loading={loading}
          disabled={!canContinue}
          onPress={phase === "phone" ? requestCode : verifyCode}
          icon={<Ionicons name={phase === "phone" ? "chatbubble-ellipses-outline" : "shield-checkmark-outline"} size={18} color="#071019" />}
        />

        {phase === "otp" ? (
          <TayyarButton
            label={t(heroAppCopy.auth.resendCode)}
            variant="outline"
            onPress={requestCode}
            disabled={loading}
          />
        ) : null}
      </GlassPanel>
    </TayyarScreen>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    justifyContent: "center",
    gap: 24,
  },
  header: {
    alignItems: "center",
    gap: 10,
    marginBottom: 4,
  },
  logoWrap: {
    alignItems: "center",
    gap: 10,
  },
  logoBadge: {
    width: 84,
    height: 84,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tayyarColors.gold,
    borderWidth: 1,
    borderColor: "rgba(246,183,60,0.42)",
  },
  brand: {
    fontSize: 34,
    color: tayyarColors.textPrimary,
  },
  title: {
    ...typeRamp.heading,
    fontSize: 28,
  },
  subtitle: {
    ...typeRamp.body,
    maxWidth: 320,
  },
  panel: {
    gap: 18,
  },
  panelTitle: {
    ...typeRamp.heading,
  },
  panelBody: {
    ...typeRamp.body,
  },
  formStack: {
    gap: 14,
  },
  phoneInputShell: {
    minHeight: 64,
    borderRadius: tayyarRadii.lg,
    borderWidth: 1,
    borderColor: tayyarColors.border,
    backgroundColor: "rgba(255,255,255,0.04)",
    alignItems: "center",
    paddingHorizontal: 18,
    gap: 14,
  },
  countryCode: {
    fontFamily: "monospace",
    fontSize: 16,
    color: tayyarColors.goldLight,
  },
  phoneInput: {
    flex: 1,
    fontSize: 18,
    color: tayyarColors.textPrimary,
  },
  otpInput: {
    minHeight: 58,
    borderRadius: tayyarRadii.lg,
    borderWidth: 1,
    borderColor: tayyarColors.border,
    backgroundColor: "rgba(255,255,255,0.04)",
    color: tayyarColors.textPrimary,
    fontSize: 24,
    letterSpacing: 8,
  },
});
