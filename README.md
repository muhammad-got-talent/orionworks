<h1 align="center">Orion Works</h1>
<p align="center"><strong>An open-source AI employee.</strong><br>Give it a task. It plans, builds, tests, and calls you when it has news.</p>

Orion Works runs entirely on your own free accounts. Your AI employee is called Orion. There is no hosted service: you bring your own Firebase project and AI key, and nothing private lives in this repo.

## What it does

- **Builds real projects.** Orion writes files, runs commands, opens a headless browser to test the page, finds bugs and fixes them.
- **Calls you.** When a task finishes, gets stuck, or needs your decision, Orion rings your phone like a real incoming call, even when the app is closed. Answer, talk, give new instructions. Orion keeps working.
- **Your choice of AI and voice.** Switch between OpenRouter and Groq for thinking. Switch between the phone's built-in voice, Groq, or OpenRouter for speaking and listening.
- **Works with Claude.** Optional connector: Claude does the work in your own Claude account while Orion Works shows progress, saves the files and calls your phone. See [CONNECTOR.md](CONNECTOR.md).
- **Safe by design.** Orion works only inside its project folder, cannot see your keys, and asks your approval for risky commands.
- **Mobile first.** The website and the Android app are the same app. You can run the whole thing from a phone.

## How it fits together

```
 Phone / Website  <----->  Firebase (login, database, push)  <----->  Worker (Codespace)
   (Vercel + APK)               Google runs it for free                 the AI's computer
        |                                                                     |
        +---------------------- your OpenRouter / Groq key -------------------+
```

| Piece | What it is | Where it runs |
|---|---|---|
| Website | React app (Vite) | Vercel, free |
| Android app | Same app via Capacitor + native call code | GitHub Actions builds the APK, free |
| Backend | Firebase Auth + Firestore + Cloud Messaging | Google, free Spark plan |
| Worker | Node.js program with files, terminal and browser tools | GitHub Codespaces, free hours |
| AI | OpenRouter or Groq | their free tiers |

## Get started

New here? Follow **[SETUP_GUIDE.md](SETUP_GUIDE.md)**. It walks through everything, A to Z, with every command, and works from a phone.

In short: make a Firebase project, deploy this repo on Vercel, start the worker in a Codespace, then build the Android app. About 30 minutes.

More docs: [CONNECTOR.md](CONNECTOR.md) (use Claude as the brain), [ANDROID.md](ANDROID.md) (app and calls), [worker/README.md](worker/README.md) (the AI's computer), [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md).

## Free tier limits (they can change)

- Firebase Spark plan has daily read/write limits, fine for personal use. No billing is needed.
- OpenRouter free models and Groq's free tier have request limits. Free models can be weaker at long coding tasks, so some tasks need a retry.
- Groq voice needs you to accept the Orpheus voice terms once. OpenRouter voice models are paid per use.
- Codespaces gives a monthly free allowance and sleeps when idle.

## Project layout

```
src/            the app (React): setup, tasks, chat, calls, settings
api/            the Claude connector (MCP server on Vercel)
worker/         the AI's computer (Node.js)
android-overlay native Android code for call notifications
scripts/        one-command Android build helper
.github/        build checks and the APK workflow
firestore.rules database security rules (publish these)
```

## Contributing

Pull requests are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) first.

## License

MIT. See [LICENSE](LICENSE). Use it, change it, and share your version under the same terms.
