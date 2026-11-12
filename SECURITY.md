# Security

## Reporting a problem

Please do not open a public issue for a security problem. Use GitHub's "Report a vulnerability" button on the Security tab of this repo, or contact the maintainer privately.

## How Orion protects you

- **Bring your own keys.** No keys are in this repo. Your OpenRouter or Groq key lives only in your browser or phone, and in your own Codespaces secrets for the worker.
- **Firestore rules.** Each signed-in user can only read and write their own data (`firestore.rules`). Publish them before real use.
- **Worker sandbox.** The AI works inside `worker/projects/<task>/`. File paths cannot leave that folder. Commands run with a stripped environment, so the AI cannot read your keys. Dangerous commands are blocked, and risky ones need your approval in the app.

## The Claude connector

The optional connector (`api/mcp.js`) is protected by a secret token (`ORION_MCP_TOKEN`) that you set in Vercel. It is built for one person. Anyone with the connector address can create tasks, read task titles and notes, and ring your phone (max 5 calls per 10 minutes). Keep the address private and rotate the token if it leaks. See CONNECTOR.md.

## Things to know

- Your AI keys are stored in the browser's local storage on your device. Anyone with access to your unlocked device can read them. Use a screen lock, and revoke keys you no longer use.
- The Firebase service-account file gives full access to your project. Keep it only in the Codespaces secret. Never commit it.
- The `google-services.json` file and the Firebase web config are not secrets by themselves. Your security comes from the Firestore rules and sign-in.
- A debug APK is for your own use. Do not publish it.
