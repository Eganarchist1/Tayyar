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
adb logcat -d > hero-logcat.txt

python - <<'PY'
from pathlib import Path

pid = Path("hero-pid.txt").read_text(encoding="utf-8", errors="ignore").strip()
if not pid:
    raise SystemExit("Hero app process is not running after launch.")

logcat = Path("hero-logcat.txt").read_text(encoding="utf-8", errors="ignore")
fatal_markers = [
    "FATAL EXCEPTION",
    "Process: com.tayyar.hero",
    "Force finishing activity com.tayyar.hero",
    "ANR in com.tayyar.hero",
    "Theme.AppCompat",
]

if any(marker in logcat for marker in fatal_markers):
    raise SystemExit("Hero app crash marker found in logcat.")

if "Displayed com.tayyar.hero/.MainActivity" not in logcat:
    raise SystemExit("Hero main activity was not displayed.")
PY
