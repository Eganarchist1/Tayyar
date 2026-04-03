# Hero App EAS Build

The hero app is prepared for Expo EAS cloud Android builds.

## Current build target

- App name: `Tayyar Hero`
- Expo slug: `tayyar-hero`
- Android package: `com.tayyar.hero`
- Preview build output: `APK`
- API target for testing: `http://84.8.249.193:3001`

## One-time steps

1. Create or sign in to a free Expo account.
2. In `E:\Anti Gravity\Tayyar\apps\hero-app`, run:

```bash
npx eas-cli login
```

3. Still in `E:\Anti Gravity\Tayyar\apps\hero-app`, connect the app to EAS:

```bash
npx eas-cli init
```

When Expo asks, keep the existing slug and create the project.

## Build the APK

Run:

```bash
npm run eas:build:android:preview
```

That creates an installable Android APK in EAS cloud.

## Notes

- The current preview build allows cleartext HTTP because the testing API is still on a raw server IP.
- Once the API moves behind HTTPS and a real domain, switch `EXPO_PUBLIC_API_URL` in `E:\Anti Gravity\Tayyar\apps\hero-app\eas.json` to the public HTTPS API URL.
- For public store release later, use the production profile instead of preview.
