# Orion Works setup guide (A to Z, phone only, all free)

Do the parts in order. Every command is on its own line: type or paste one line, press Enter, wait, then the next.

## What you are setting up

1. **Website.** The screen you tap. It goes on **Vercel**.
2. **Firebase.** Login, database and notifications. Google runs it for you.
3. **Worker.** The AI's computer, which writes code and runs commands. It cannot run on Vercel. It runs in a free **GitHub Codespace**.
4. **Android app.** The same website packed as an APK. GitHub builds it for you.

Tip: on your phone browser turn on **Desktop site** for GitHub and Codespaces. It is much easier.

## Part 0: Free accounts

- GitHub: github.com
- Firebase: console.firebase.google.com (a Google account)
- AI key: OpenRouter (openrouter.ai) and/or Groq (console.groq.com). You need at least one.
- Vercel: vercel.com (choose "Continue with GitHub")

## Part 1: Put the code on GitHub

1. GitHub: **+** > **New repository**. Name `orion-works`, **Public**, License **MIT**. Create it.
2. In the repo tap **Code** > **Codespaces** > **Create codespace on main**. Wait for the editor and terminal.
3. In the file list (left bar, two pages icon) long-press empty space > **Upload...** > choose `orion-works.zip`.
4. In the terminal, go into your repo folder. See its name first:

```
ls
```

You will see your repo folder and the zip. Go into the folder (replace `YOUR-FOLDER` with the folder name you saw, for example `Elioo`):

```
mv orion-works.zip YOUR-FOLDER/
cd YOUR-FOLDER
```

5. Unpack and save:

```
unzip -o orion-works.zip
rm orion-works.zip
git add -A
git commit -m "Add Orion"
git push
```

If `unzip` says "command not found", use `python3 -m zipfile -e orion-works.zip .` instead.

## Part 2: Firebase

1. Firebase Console > **Create a project** (name `elio`, analytics off). Do not add billing.
2. **Build** > **Authentication** > **Get started** > **Email/Password** > turn on > Save.
3. **Build** > **Firestore Database** > **Create database** > **Production mode** > pick a location > Enable.
4. Firestore > **Rules** tab. Delete everything, paste this, tap **Publish**:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
    match /system/{document=**} {
      allow read: if request.auth != null;
      allow write: if false;
    }
  }
}
```

5. Gear icon > **Project settings** > **Your apps** > web icon `</>` > nickname `elio-web` > Register. Copy the `firebaseConfig` block. You can copy the whole snippet.

## Part 3: Put the website online (Vercel)

1. vercel.com > **Add New...** > **Project** > **Import** your `elio` repo > leave the defaults > **Deploy**.
2. You get a link like `elio-abc123.vercel.app`. Copy it without `https://`.
3. Firebase > **Authentication** > **Settings** > **Authorized domains** > **Add domain** > paste it. (Skip this and login shows "unauthorized domain".)
4. Open your link. The **Set up your Orion** wizard has 3 steps:
   - Firebase: paste the config.
   - AI: choose OpenRouter or Groq and paste a key (free keys: openrouter.ai/keys, console.groq.com/keys).
   - Voice: leave **Phone** for now.
5. Tap **Create account**. You are in.

Your keys stay only in this browser or phone.

## Part 4: Start the worker

1. Firebase > gear > **Project settings** > **Service accounts** > **Generate new private key**. A JSON file downloads. It is a password: never put it in the repo.
2. GitHub > your repo > **Settings** > **Secrets and variables** > **Codespaces** > **New repository secret**:
   - `FIREBASE_SERVICE_ACCOUNT`: paste the whole JSON file.
   - `OPENROUTER_API_KEY` and/or `GROQ_API_KEY`: your key(s).
3. Delete your old codespace (Code > Codespaces > three dots > Delete) and create a **new** one so the secrets load.
4. In its terminal:

```
cd worker
npm install
npm run setup-browser
npm start
```

5. You should see `Orion worker is running`. In the app the sidebar shows **Worker online**. Leave the tab open. If the Codespace sleeps, open it again and run `cd worker`, then `npm start`.

## Part 5: First task

1. Open your Vercel link. Tap **New task**: `Make a one-page website for a bakery with a hero, menu and contact section.`
2. Orion replies with a plan. Tap **Start building**.
3. Watch the **Activity** tab. If Orion asks to approve a command, tap **Approve** or **Deny**.
4. Open **Files** to preview the site or download a zip. Orion also calls you when it finishes.

## Part 6: Choose your AI and voice (Settings)

- **AI:** OpenRouter or Groq. The worker follows your choice if it has that key.
- **Voice engine:**
  - **Phone:** free and built in. Works everywhere.
  - **Groq:** natural voice and fast speech recognition on Groq's free tier. First time: console.groq.com > Playground > choose model `canopylabs/orpheus-v1-english` > accept the terms. Groq voices speak English.
  - **OpenRouter:** uses your OpenRouter credits.
- Tap **Test voice** to hear it and check the microphone. If a cloud voice fails during a call, Orion switches to the phone voice and keeps going.

## Part 7: Android app

Follow **ANDROID.md**. Short version: add an Android app in Firebase (package `app.elio.agent`), save `google-services.json` as a GitHub Actions secret named `GOOGLE_SERVICES_JSON`, run the **Build Android APK** workflow, download the APK, install it, and tap **Enable call alerts** in Settings.

## Part 7b: Connect Claude (optional)

Let Claude do the work in your own Claude account while Orion Works shows progress and calls you. Follow **CONNECTOR.md**. In short: make a secret token, add three variables in Vercel (`FIREBASE_SERVICE_ACCOUNT`, `ORION_MCP_TOKEN`, `ORION_OWNER_EMAIL`), redeploy, then add `https://YOUR-SITE.vercel.app/mcp?key=YOUR_TOKEN` as a custom connector in Claude.

## Part 8: Updating later

When you get a new version zip, repeat Part 1 steps 3 to 5 with the new zip (upload, unpack, push). Vercel redeploys on its own. Then:

- If the rules changed, republish them (Part 2 step 4).
- Rebuild the APK (Part 7), because the app contains its own copy of the website.
- Restart the worker.

## Already running an older version? Update in 5 steps

1. Codespace > upload `orion-works.zip` > in the terminal `cd` into your repo folder.
2. `unzip -o orion-works.zip`
3. `rm orion-works.zip`
4. `git add -A`, then `git commit -m "Orion Works update"`, then `git push`
5. Vercel redeploys by itself. Your saved settings move over automatically. Rebuild the APK for the phone app (Part 7).

## Fixing common problems

| You see | What to do |
|---|---|
| "unauthorized domain" | Add your Vercel address in Firebase > Authentication > Settings > Authorized domains. |
| "Missing or insufficient permissions" | Publish the rules from Part 2 step 4. |
| Worker shows offline | Open the Codespace, run `cd worker` then `npm start`. If it says missing secrets, create a new Codespace after adding the secrets. |
| "key was rejected" | Re-copy the key in Settings > AI. |
| Rate limit message | Wait a minute and retry, or switch AI provider in Settings. |
| Groq voice error about terms | Accept the Orpheus terms in the Groq Playground (Part 6). |
| Phone does not ring when closed | Settings > Calls > Enable call alerts, allow full-screen calls, and set battery to Unrestricted. |
| Vercel build fails | Open the failed build, copy the red error, and report it on GitHub. |

## Part 9: Share it as open source

1. Make sure the repo has no secrets (`google-services.json` and service-account files are already ignored).
2. Repo > Settings: keep it **Public**. Add a description and topics.
3. Anyone can now copy it and run their own Orion with their own free accounts.
