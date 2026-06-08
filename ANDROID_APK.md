# Build TRUST MOMOS as an Android APK

The app is packaged with **Capacitor** so you can install it on Android as a real APK.
It also installs a service worker so the UI works **offline** after the first load.

> **Note:** Live data (orders, menu changes) still needs internet, because the database lives in the cloud. Only the UI shell and previously-loaded data work offline.

## One-time setup on your computer

1. Install [Android Studio](https://developer.android.com/studio) (includes JDK + Android SDK).
2. Clone or download this project to your computer.
3. Open a terminal in the project folder and run:
   ```bash
   bun install
   ```

## Build the APK

Run this from the project folder:

```bash
bun run cap:build
```

This does three things:
1. `bun run build` — builds the web app into `dist/`
2. `node scripts/build-capacitor-index.mjs` — writes a static `index.html` Capacitor can load
3. `npx cap sync android` — copies the web assets into the Android project

Then open the Android project in Android Studio:

```bash
bun run cap:open
```

In Android Studio:
- Wait for Gradle sync to finish.
- Menu: **Build → Build App Bundle(s) / APK(s) → Build APK(s)**.
- When done, click **locate** in the notification — the file is
  `android/app/build/outputs/apk/debug/app-debug.apk`.
- Copy that file to your Android phone and tap it to install
  (you'll need to allow "Install from unknown sources").

## Re-build after code changes

Every time you change the web code, re-run:

```bash
bun run cap:build
```

then rebuild the APK in Android Studio.

## App identity

- App ID: `com.trustmomos.pos`
- App name: `TRUST MOMOS`

Change these in `capacitor.config.ts`, then delete the `android/` folder and run
`npx cap add android` again.

## For Play Store release

The `app-debug.apk` is signed with a debug key and is only for direct install.
For Play Store you need a release-signed AAB — see Android Studio's
**Build → Generate Signed Bundle / APK** flow.