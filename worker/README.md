# Orion worker

The worker is Orion's computer. It watches Firestore for tasks marked "build", asks the AI what to do, and runs the AI's tools (files, commands, a headless browser) inside `worker/projects/<task>/`. Progress streams back to the app, and Orion calls you when it finishes.

It cannot run on Vercel (no terminal there). It runs in a free GitHub Codespace, or on any computer with Node.js 20+.

## Set it up (from a phone, free)

1. Firebase Console > Project settings > **Service accounts** > **Generate new private key**. A JSON file downloads. Treat it like a password and never commit it.
2. GitHub > your repo > **Settings** > **Secrets and variables** > **Codespaces** > **New repository secret**. Add:

| Secret | Value |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | the whole JSON file |
| `OPENROUTER_API_KEY` | your OpenRouter key (optional if you use Groq) |
| `GROQ_API_KEY` | your Groq key (optional if you use OpenRouter) |
| `ELIO_PROVIDER` | optional: `openrouter` or `groq` (default: whichever key exists) |
| `ELIO_MODEL` | optional: model for the default provider |

3. Open the repo in a **new** Codespace (Code > Codespaces > Create) so the secrets load.
4. Run:

```
cd worker
npm install
npm run setup-browser
npm start
```

`npm run setup-browser` downloads a headless Chrome once (a few minutes). It lets Orion test the pages it builds. Everything else works without it.

Keep the tab open. In the app you should see **Worker online**. Open a task and tap **Start building**.

## Switching AI

Pick OpenRouter or Groq in the app under Settings > AI. The worker reads your choice and model for each task, as long as it has that provider's key. If a key is missing it logs a message and uses the other provider.

Groq's free tier has tight per-minute limits. If a task stops with a rate-limit message, wait a minute and press Build again, or switch to a lighter model.

## What the AI can do

`list_files`, `read_file`, `write_file`, `run_command`, `test_page` (opens a page in a phone-size browser, reports errors and takes a screenshot), `call_user` (rings your phone), and `finish`.

## Approvals, preview and download

- Risky-but-useful commands (recursive delete, downloaded scripts, global installs, git clone, pip install) pause and show an Approve / Deny card in the app, and Orion calls you. No answer in 5 minutes counts as Deny.
- Files Orion writes appear in the app under **Files**: view them, **Preview** a simple website, or **Download zip**. Text files and small images up to 400 KB each are kept in your Firestore (free Spark plan, no Firebase Storage needed).

## Safety

- File tools cannot leave the project folder.
- Commands run with a stripped environment, so the AI cannot see your keys.
- Never allowed: sudo, absolute paths, leaving the project folder, reading secrets, ssh, git push.
- Commands stop after 90 seconds. Orion tests pages with its own browser tool instead of dev servers.

## Free-tier notes

Codespaces has a monthly free allowance and sleeps when idle. Reopen it and run `cd worker` then `npm start`. Free AI models can be slow or rate limited, and the worker retries a few times.
