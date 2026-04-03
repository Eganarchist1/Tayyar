import React from "react";
import { useNavigation } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { GlassPanel, LocaleTogglePill, TayyarButton, TayyarScreen } from "@/components/tayyar-ui";
import { heroAppCopy } from "@/lib/copy";
import { heroFetch } from "@/lib/api";
import { useHeroLocale } from "@/lib/locale";
import { getFontFamily, tayyarColors, tayyarRadii, typeRamp } from "@/lib/design";
import { useAuthStore } from "@/store/authStore";

export default function LoginScreen() {
  const navigation = useNavigation<any>();
  const { token, setAuth, hasHydrated } = useAuthStore();
  const { locale, direction, t } = useHeroLocale();
  const [phone, setPhone] = React.useState("1000000004");
  const [otp, setOtp] = React.useState("");
  const [step, setStep] = React.useState<"phone" | "otp">("phone");
  const [loading, setLoading] = React.useState(false);
  const [message, setMessage] = React.useState("");

  if (!hasHydrated) {
    return (
      <TayyarScreen scroll={false} contentContainerStyle={styles.loadingScreen}>
        <Text style={[styles.loadingText, { fontFamily: getFontFamily(locale, "body") }]}>
          {t(heroAppCopy.common.restoringSession)}
        </Text>
      </TayyarScreen>
    );
  }

  React.useEffect(() => {
    if (token) {
      navigation.navigate("MainTabs");
    }
  }, [navigation, token]);

  if (token) {
    return null;
  }

  const canContinue = step === "phone" ? phone.replace(/\D/g, "").length >= 10 : otp.length === 4;
  const align = direction === "rtl" ? "right" : "left";
  const rowDirection = direction === "rtl" ? "row-reverse" : "row";

  async function handleContinue() {
    setLoading(true);
    setMessage("");
    try {
      if (step === "phone") {
        const payload = await heroFetch<{ sent: boolean; devCode?: string }>("/v1/auth/otp/request", {
          method: "POST",
          body: JSON.stringify({ phone: `+20${phone.replace(/\D/g, "")}` }),
        });
        if (payload.devCode) {
          setMessage(locale === "ar" ? `رمز الاختبار: ${payload.devCode}` : `Test code: ${payload.devCode}`);
        }
        setStep("otp");
        return;
      }

      const payload = await heroFetch<{
        accessToken: string;
        refreshToken: string;
        user: { name: string; email: string; role: string; phone?: string | null };
      }>("/v1/auth/otp/verify", {
        method: "POST",
        body: JSON.stringify({ phone: `+20${phone.replace(/\D/g, "")}`, code: otp }),
      });

      setAuth(payload.accessToken, payload.refreshToken, payload.user);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t(heroAppCopy.common.unexpectedError));
    } finally {
      setLoading(false);
    }
  }

  return (
    <TayyarScreen scroll={false} contentContainerStyle={styles.screen}>
      <View style={[styles.headerWrap, { alignItems: "center" }]}>
        <View style={styles.localeWrap}>
          <LocaleTogglePill />
        </View>
        <LinearGradient colors={["#38BDF8", "#0EA5E9", "#F59E0B"]} style={styles.logoOrb}>
          <Ionicons name="paper-plane" size={34} color="#071019" />
        </LinearGradient>
        <Text style={[styles.brand, { fontFamily: getFontFamily(locale, "display") }]}>{t(heroAppCopy.common.heroBrand)}</Text>
        <Text style={[styles.title, { fontFamily: getFontFamily(locale, "heading"), textAlign: "center" }]}>{t(heroAppCopy.login.title)}</Text>
        <Text style={[styles.subtitle, { fontFamily: getFontFamily(locale, "body"), textAlign: "center" }]}>{t(heroAppCopy.login.subtitle)}</Text>
      </View>

      <GlassPanel style={styles.panel}>
        <View style={styles.panelHeader}>
          <Text style={[styles.panelEyebrow, { fontFamily: getFontFamily(locale, "bodyMedium"), textAlign: align }]}>{t(heroAppCopy.login.gateway)}</Text>
          <Text style={[styles.panelTitle, { fontFamily: getFontFamily(locale, "heading"), textAlign: align }]}>
            {step === "phone" ? t(heroAppCopy.login.startWithPhone) : t(heroAppCopy.login.enterOtp)}
          </Text>
          <Text style={[styles.panelCopy, { fontFamily: getFontFamily(locale, "body"), textAlign: align }]}>
            {step === "phone" ? t(heroAppCopy.login.phoneBody) : t(heroAppCopy.login.otpBody)}
          </Text>
        </View>

        {step === "phone" ? (
          <View style={styles.formBlock}>
            <Text style={[styles.inputLabel, { fontFamily: getFontFamily(locale, "bodyMedium"), textAlign: align }]}>{t(heroAppCopy.login.phoneLabel)}</Text>
            <View style={[styles.inputShell, { flexDirection: rowDirection }]}>
              <Text style={styles.countryCode}>+20</Text>
              <TextInput
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                placeholder="10X XXXX XXX"
                placeholderTextColor={tayyarColors.textTertiary}
                style={[styles.input, { textAlign: direction === "rtl" ? "right" : "left", fontFamily: getFontFamily("en", "mono") }]}
              />
            </View>
          </View>
        ) : (
          <View style={styles.formBlock}>
            <Text style={[styles.inputLabel, { fontFamily: getFontFamily(locale, "bodyMedium"), textAlign: align }]}>{t(heroAppCopy.login.otpLabel)}</Text>
            <View style={[styles.otpRow, { flexDirection: rowDirection }]}>
              {[0, 1, 2, 3].map((index) => (
                <View key={index} style={[styles.otpBox, otp[index] ? styles.otpBoxFilled : null]}>
                  <Text style={styles.otpDigit}>{otp[index] || ""}</Text>
                </View>
              ))}
            </View>
            <TextInput
              value={otp}
              onChangeText={(value) => setOtp(value.replace(/\D/g, "").slice(0, 4))}
              keyboardType="number-pad"
              maxLength={4}
              style={styles.otpHiddenInput}
              autoFocus
            />
            <Pressable onPress={() => setStep("phone")}>
              <Text style={[styles.backLink, { fontFamily: getFontFamily(locale, "bodyMedium") }]}>{t(heroAppCopy.login.editPhone)}</Text>
            </Pressable>
          </View>
        )}

        {message ? <Text style={[styles.message, { fontFamily: getFontFamily(locale, "body"), textAlign: align }]}>{message}</Text> : null}

        <TayyarButton
          label={step === "phone" ? t(heroAppCopy.login.sendCode) : t(heroAppCopy.login.openBoard)}
          onPress={handleContinue}
          disabled={!canContinue}
          loading={loading}
          icon={<Ionicons name={direction === "rtl" ? "arrow-back" : "arrow-forward"} size={18} color="#071019" />}
        />
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
  headerWrap: {
    gap: 8,
    marginBottom: 6,
  },
  localeWrap: {
    marginBottom: 6,
  },
  logoOrb: {
    width: 86,
    height: 86,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  brand: {
    fontSize: 34,
    color: tayyarColors.textPrimary,
  },
  title: {
    ...typeRamp.heading,
    fontSize: 26,
  },
  subtitle: {
    ...typeRamp.body,
    maxWidth: 320,
  },
  panel: {
    gap: 22,
  },
  panelHeader: {
    gap: 6,
  },
  panelEyebrow: {
    ...typeRamp.label,
    color: tayyarColors.goldLight,
  },
  panelTitle: {
    ...typeRamp.heading,
  },
  panelCopy: {
    ...typeRamp.body,
  },
  formBlock: {
    gap: 14,
  },
  inputLabel: {
    ...typeRamp.label,
  },
  inputShell: {
    minHeight: 64,
    borderRadius: tayyarRadii.lg,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: tayyarColors.border,
    paddingHorizontal: 18,
    alignItems: "center",
    gap: 14,
  },
  countryCode: {
    fontFamily: getFontFamily("en", "mono"),
    fontSize: 16,
    color: tayyarColors.goldLight,
  },
  input: {
    flex: 1,
    fontSize: 18,
    color: tayyarColors.textPrimary,
  },
  otpRow: {
    gap: 12,
    justifyContent: "space-between",
  },
  otpBox: {
    flex: 1,
    minHeight: 72,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: tayyarColors.border,
    backgroundColor: "rgba(255,255,255,0.04)",
    alignItems: "center",
    justifyContent: "center",
  },
  otpBoxFilled: {
    borderColor: tayyarColors.sky,
    backgroundColor: "rgba(14,165,233,0.12)",
  },
  otpDigit: {
    fontFamily: getFontFamily("en", "mono"),
    fontSize: 28,
    color: tayyarColors.textPrimary,
  },
  otpHiddenInput: {
    position: "absolute",
    opacity: 0,
    pointerEvents: "none",
  },
  backLink: {
    ...typeRamp.label,
    color: tayyarColors.skyLight,
    textAlign: "center",
  },
  message: {
    ...typeRamp.body,
    color: tayyarColors.goldLight,
  },
  loadingScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    ...typeRamp.body,
  },
});
