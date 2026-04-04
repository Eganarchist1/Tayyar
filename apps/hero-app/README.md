# Tayyar Hero App

Native Android React Native app for Tayyar heroes.

## Current scope
- Arabic-first login
- readiness status
- active missions
- mission detail and delivery progression
- wallet / earnings summary
- vacation balance and request flow

## Commands
```bash
npm install
npm run android
npm run android:apk:release
```

## Build configuration
The APK build reads values from `lib/build-config.ts`. GitHub Actions overwrites that file during CI so the release APK points at the live API without relying on Expo or EAS.
