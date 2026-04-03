# Hero app Android build on GitHub Actions

This workflow builds a debug APK for the hero app without Expo cloud services.

## Workflow file

`/.github/workflows/hero-android-apk.yml`

## What it does

- checks out the repository
- installs Node, Java, and Android SDK pieces
- installs repo dependencies with `npm ci`
- writes `apps/hero-app/.env.production`
- builds `app-debug.apk` from `apps/hero-app/android`
- uploads the APK as a GitHub Actions artifact

## Required repository secret

Add this secret in GitHub repository settings:

- `HERO_APP_API_URL`

Example:

`http://84.8.249.193:3001`

If the secret is missing, the workflow falls back to the current public test API URL above.

## How to run it

1. Push the repository to GitHub.
2. Open the `Actions` tab.
3. Run `Hero Android APK`.
4. Download the `tayyar-hero-debug-apk` artifact when the workflow finishes.

## Notes

- The workflow currently builds a debug APK because that is the fastest tester path.
- When signing is ready, add a release build profile and keystore secrets.
- Merchant stays PWA-first; this workflow is only for the native hero app.
