#!/usr/bin/env bash
set -euo pipefail

export LC_ALL=C.UTF-8

capture_artifacts() {
  adb logcat -d > hero-logcat.txt || true
  adb shell uiautomator dump /sdcard/hero-ui.xml >/dev/null || true
  adb pull /sdcard/hero-ui.xml hero-ui.xml >/dev/null 2>&1 || true
  adb exec-out screencap -p > hero-launch.png || true
}

trap capture_artifacts EXIT

adb logcat -c
adb install -r apps/hero-app/android/app/build/outputs/apk/release/app-release.apk
adb shell am start -W -n com.tayyar.hero/.MainActivity
sleep 25
adb shell pidof com.tayyar.hero > hero-pid.txt
adb shell uiautomator dump /sdcard/hero-ui.xml >/dev/null
adb pull /sdcard/hero-ui.xml hero-ui.xml

python - <<'PY'
from pathlib import Path

text = Path("hero-ui.xml").read_text(encoding="utf-8", errors="ignore")
terms = [
    "طيار هيرو",
    "رقم الهاتف",
    "رمز الدخول",
    "لوحة العمل",
    "المهام",
    "المحفظة",
    "Phone number",
    "Dashboard",
]

if not any(term in text for term in terms):
    raise SystemExit(1)
PY
