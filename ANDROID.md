# Android app

The Android app is the same Orion you see on the website, packed with Capacitor, plus native code for call notifications (Firebase Cloud Messaging) and a real incoming-call screen. You do not need a PC.

You need two things first:

- Your Firebase project (Setup Guide, Part 2).
- A free `google-services.json` for it (below). It is what lets calls reach a closed app. Each person uses their own.

## 1. Get google-services.json (2 minutes)

1. Firebase Console > your project > Project settings > General > **Add app** > Android.
2. Package name: `app.elio.agent` (exactly). Skip the remaining steps.
3. Download `google-services.json`.

No billing is needed. Cloud Messaging is free.

## 2. Build the APK with GitHub Actions (easiest, free, from your phone)

1. Open the `google-services.json` file in a text app and copy everything.
2. GitHub > your repo > **Settings** > **Secrets and variables** > **Actions** > **New repository secret**.
   Name: `GOOGLE_SERVICES_JSON`. Value: paste the whole file. Save.
3. Repo > **Actions** tab > **Build Android APK** > **Run workflow** > **Run workflow**.
4. Wait about 10 minutes. Open the finished run, scroll to **Artifacts**, tap `orion-apk`. It downloads a zip.
5. Extract the zip with your phone's Files app. Tap `app-debug.apk` and allow installing from this source.

Rebuild any time you update Orion, because the app contains its own copy of the website.

## 3. Or build it with Manus (or any cloud computer)

Give the agent your repo link and `google-services.json`, plus this prompt:

> Clone https://github.com/YOUR-NAME/YOUR-REPO. I am attaching `google-services.json`; place it in the repo root. Install Node.js 22, JDK 21 and the Android SDK (platform 35, build-tools 35). Run `npm install` then `npm run android:apk`. If a step fails, read the error, fix it and retry. Give me `android/app/build/outputs/apk/debug/app-debug.apk` as a download. Do not change app code unless a build error requires it, and tell me what you changed.

## 4. First run on the phone

1. Open Orion, finish setup, sign in.
2. Settings > Calls > **Enable call alerts** and allow notifications.
3. If it shows **Allow full-screen calls**, tap it and switch it on (Android 14+).
4. Tap **Test call in the app**, then **Test while locked** and lock the phone. It should ring with the call screen.

## How calling works

- The worker places a call: it writes a ringing call to Firestore and sends a high-priority push to your phone.
- App open: the call screen appears at once. App closed or phone locked: Android shows a full-screen ringing notification with Answer and Decline.
- Unanswered calls become "missed" after 45 seconds, and Orion leaves its message in the task.
- On the call, Orion speaks and listens with the voice engine you chose in Settings (Phone, Groq or OpenRouter). You can also type during a call.
- If you give instructions and hang up, the task goes back to "build" and the worker continues.

## Known limits

- Some phone brands (Xiaomi, Oppo, Huawei, Samsung) stop background apps. If calls do not ring while the app is closed, set Orion's battery usage to Unrestricted and allow auto-start.
- A debug APK is signed with a debug key. It is fine for you. Publishing on the Play Store needs your own release signing.
- The website rings only while the page is open (web push is not built yet).
