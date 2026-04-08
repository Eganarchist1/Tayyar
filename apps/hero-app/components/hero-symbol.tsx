import React from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { tayyarColors } from "@/lib/design";

type HeroSymbolName =
  | "brand"
  | "home"
  | "missions"
  | "wallet"
  | "profile"
  | "logout"
  | "send"
  | "route"
  | "package"
  | "document"
  | "calendar"
  | "cash-in"
  | "cash-out"
  | "power"
  | "pause";

export function HeroSymbol({
  name,
  size = 20,
  color = tayyarColors.textPrimary,
  style,
}: {
  name: HeroSymbolName;
  size?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
}) {
  if (name === "brand") {
    return (
      <View style={[iconFrame(size), style]}>
        <View style={[styles.brandWing, { borderLeftColor: color, borderTopColor: color, width: size * 0.62, height: size * 0.38 }]} />
        <View style={[styles.brandTail, { backgroundColor: color, width: size * 0.28, height: size * 0.1, borderRadius: size * 0.05 }]} />
        <View style={[styles.brandSpark, { backgroundColor: tayyarColors.gold, width: size * 0.16, height: size * 0.16, borderRadius: size * 0.08 }]} />
      </View>
    );
  }

  if (name === "home") {
    return (
      <View style={[iconFrame(size), style]}>
        <View style={[styles.homeRoof, { borderLeftColor: color, borderTopColor: color, width: size * 0.56, height: size * 0.56 }]} />
        <View style={[styles.homeBody, { borderColor: color, width: size * 0.5, height: size * 0.32, borderRadius: size * 0.12 }]} />
      </View>
    );
  }

  if (name === "missions") {
    return (
      <View style={[iconFrame(size), style]}>
        <View style={[styles.mapPin, { borderColor: color, width: size * 0.42, height: size * 0.58, borderRadius: size * 0.26 }]} />
        <View style={[styles.mapPinDot, { backgroundColor: color, width: size * 0.12, height: size * 0.12, borderRadius: size * 0.06 }]} />
        <View style={[styles.mapPinTail, { backgroundColor: color, width: size * 0.08, height: size * 0.16, borderRadius: size * 0.04 }]} />
      </View>
    );
  }

  if (name === "wallet") {
    return (
      <View style={[iconFrame(size), style]}>
        <View style={[styles.walletBody, { borderColor: color, width: size * 0.6, height: size * 0.42, borderRadius: size * 0.14 }]} />
        <View style={[styles.walletFlap, { borderColor: color, width: size * 0.28, height: size * 0.18, borderRadius: size * 0.08 }]} />
        <View style={[styles.walletDot, { backgroundColor: color, width: size * 0.08, height: size * 0.08, borderRadius: size * 0.04 }]} />
      </View>
    );
  }

  if (name === "profile") {
    return (
      <View style={[iconFrame(size), style]}>
        <View style={[styles.profileHead, { borderColor: color, width: size * 0.28, height: size * 0.28, borderRadius: size * 0.14 }]} />
        <View style={[styles.profileBody, { borderColor: color, width: size * 0.56, height: size * 0.26, borderRadius: size * 0.16 }]} />
      </View>
    );
  }

  if (name === "logout") {
    return (
      <View style={[iconFrame(size), style]}>
        <View style={[styles.logoutDoor, { borderColor: color, width: size * 0.34, height: size * 0.44, borderRadius: size * 0.08 }]} />
        <View style={[styles.logoutLine, { backgroundColor: color, width: size * 0.28, height: size * 0.08, borderRadius: size * 0.04 }]} />
        <View style={[styles.logoutArrow, { borderRightColor: color, borderTopColor: color, width: size * 0.2, height: size * 0.2 }]} />
      </View>
    );
  }

  if (name === "send") {
    return (
      <View style={[iconFrame(size), style]}>
        <View style={[styles.sendWing, { borderLeftColor: color, borderTopColor: color, width: size * 0.62, height: size * 0.38 }]} />
        <View style={[styles.sendTrail, { backgroundColor: color, width: size * 0.24, height: size * 0.08, borderRadius: size * 0.04 }]} />
      </View>
    );
  }

  if (name === "route") {
    return (
      <View style={[iconFrame(size), style]}>
        <View style={[styles.routeLine, { borderColor: color, width: size * 0.48, height: size * 0.48, borderRadius: size * 0.22 }]} />
        <View style={[styles.routeStart, { backgroundColor: color, width: size * 0.1, height: size * 0.1, borderRadius: size * 0.05 }]} />
        <View style={[styles.routeEnd, { backgroundColor: tayyarColors.gold, width: size * 0.14, height: size * 0.14, borderRadius: size * 0.07 }]} />
      </View>
    );
  }

  if (name === "package") {
    return (
      <View style={[iconFrame(size), style]}>
        <View style={[styles.packageBox, { borderColor: color, width: size * 0.52, height: size * 0.46, borderRadius: size * 0.1 }]} />
        <View style={[styles.packageLine, { backgroundColor: color, width: size * 0.42, height: size * 0.06, borderRadius: size * 0.03 }]} />
      </View>
    );
  }

  if (name === "document") {
    return (
      <View style={[iconFrame(size), style]}>
        <View style={[styles.docPage, { borderColor: color, width: size * 0.48, height: size * 0.58, borderRadius: size * 0.1 }]} />
        <View style={[styles.docFold, { borderLeftColor: color, borderTopColor: color, width: size * 0.16, height: size * 0.16 }]} />
        <View style={[styles.docLine, { backgroundColor: color, width: size * 0.28, height: size * 0.05, borderRadius: size * 0.025 }]} />
      </View>
    );
  }

  if (name === "calendar") {
    return (
      <View style={[iconFrame(size), style]}>
        <View style={[styles.calendarFrame, { borderColor: color, width: size * 0.56, height: size * 0.5, borderRadius: size * 0.12 }]} />
        <View style={[styles.calendarBar, { backgroundColor: color, width: size * 0.56, height: size * 0.08, borderRadius: size * 0.04 }]} />
        <View style={[styles.calendarDot, { backgroundColor: tayyarColors.gold, width: size * 0.1, height: size * 0.1, borderRadius: size * 0.05 }]} />
      </View>
    );
  }

  if (name === "cash-in" || name === "cash-out") {
    const positive = name === "cash-in";
    return (
      <View style={[iconFrame(size), style]}>
        <View style={[styles.cashLine, { backgroundColor: color, width: size * 0.5, height: size * 0.08, borderRadius: size * 0.04 }]} />
        <View
          style={[
            styles.cashArrow,
            positive ? styles.cashArrowIn : styles.cashArrowOut,
            {
              borderRightColor: color,
              borderTopColor: color,
              width: size * 0.2,
              height: size * 0.2,
            },
          ]}
        />
      </View>
    );
  }

  if (name === "pause") {
    return (
      <View style={[iconFrame(size), style]}>
        <View style={[styles.pauseBar, { backgroundColor: color, width: size * 0.1, height: size * 0.48, borderRadius: size * 0.05, left: size * 0.28 }]} />
        <View style={[styles.pauseBar, { backgroundColor: color, width: size * 0.1, height: size * 0.48, borderRadius: size * 0.05, right: size * 0.28 }]} />
      </View>
    );
  }

  if (name === "power") {
    return (
      <View style={[iconFrame(size), style]}>
        <View style={[styles.powerRing, { borderColor: color, width: size * 0.56, height: size * 0.56, borderRadius: size * 0.28 }]} />
        <View style={[styles.powerStem, { backgroundColor: color, width: size * 0.11, height: size * 0.34, borderRadius: size * 0.055 }]} />
      </View>
    );
  }

  return (
    <View style={[iconFrame(size), style]}>
      <Text style={{ color, fontSize: size * 0.72, lineHeight: size }}>{name === "power" ? "•" : "?"}</Text>
    </View>
  );
}

function iconFrame(size: number): ViewStyle {
  return {
    width: size,
    height: size,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  };
}

const styles = StyleSheet.create({
  brandWing: {
    position: "absolute",
    borderLeftWidth: 3,
    borderTopWidth: 3,
    transform: [{ rotate: "45deg" }],
    borderTopLeftRadius: 4,
  },
  brandTail: {
    position: "absolute",
    bottom: "24%",
    left: "22%",
    transform: [{ rotate: "-35deg" }],
  },
  brandSpark: {
    position: "absolute",
    right: "8%",
    top: "18%",
  },
  homeRoof: {
    position: "absolute",
    top: "18%",
    borderLeftWidth: 3,
    borderTopWidth: 3,
    transform: [{ rotate: "45deg" }],
  },
  homeBody: {
    position: "absolute",
    bottom: "15%",
    borderWidth: 2.4,
  },
  mapPin: {
    position: "absolute",
    top: "10%",
    borderWidth: 2.4,
  },
  mapPinDot: {
    position: "absolute",
    top: "32%",
  },
  mapPinTail: {
    position: "absolute",
    bottom: "8%",
  },
  walletBody: {
    position: "absolute",
    bottom: "18%",
    borderWidth: 2.4,
  },
  walletFlap: {
    position: "absolute",
    right: "10%",
    top: "32%",
    borderWidth: 2.4,
  },
  walletDot: {
    position: "absolute",
    right: "21%",
    top: "44%",
  },
  profileHead: {
    position: "absolute",
    top: "10%",
    borderWidth: 2.4,
  },
  profileBody: {
    position: "absolute",
    bottom: "12%",
    borderWidth: 2.4,
  },
  logoutDoor: {
    position: "absolute",
    left: "10%",
    borderWidth: 2.4,
  },
  logoutLine: {
    position: "absolute",
    right: "18%",
  },
  logoutArrow: {
    position: "absolute",
    right: "12%",
    borderRightWidth: 3,
    borderTopWidth: 3,
    transform: [{ rotate: "45deg" }],
  },
  sendWing: {
    position: "absolute",
    borderLeftWidth: 3,
    borderTopWidth: 3,
    transform: [{ rotate: "45deg" }],
    borderTopLeftRadius: 4,
  },
  sendTrail: {
    position: "absolute",
    bottom: "26%",
    left: "24%",
    transform: [{ rotate: "-35deg" }],
  },
  routeLine: {
    position: "absolute",
    borderWidth: 2.2,
    borderStyle: "dashed",
  },
  routeStart: {
    position: "absolute",
    left: "18%",
    bottom: "22%",
  },
  routeEnd: {
    position: "absolute",
    right: "16%",
    top: "18%",
  },
  packageBox: {
    position: "absolute",
    borderWidth: 2.2,
  },
  packageLine: {
    position: "absolute",
  },
  docPage: {
    position: "absolute",
    borderWidth: 2.2,
  },
  docFold: {
    position: "absolute",
    top: "12%",
    right: "18%",
    borderLeftWidth: 2.4,
    borderTopWidth: 2.4,
    transform: [{ rotate: "45deg" }],
  },
  docLine: {
    position: "absolute",
    bottom: "26%",
  },
  calendarFrame: {
    position: "absolute",
    borderWidth: 2.2,
  },
  calendarBar: {
    position: "absolute",
    top: "24%",
  },
  calendarDot: {
    position: "absolute",
    bottom: "22%",
  },
  cashLine: {
    position: "absolute",
  },
  cashArrow: {
    position: "absolute",
    borderRightWidth: 3,
    borderTopWidth: 3,
  },
  cashArrowIn: {
    top: "22%",
    transform: [{ rotate: "-45deg" }],
  },
  cashArrowOut: {
    bottom: "22%",
    transform: [{ rotate: "135deg" }],
  },
  pauseBar: {
    position: "absolute",
  },
  powerRing: {
    position: "absolute",
    borderWidth: 2.6,
  },
  powerStem: {
    position: "absolute",
    top: "8%",
  },
});
