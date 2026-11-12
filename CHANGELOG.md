# Changelog

## 1.2.0

- New: **Claude connector** (MCP server on Vercel). Claude can create tasks, post progress, attach files and ring your phone, while Orion Works is the dashboard. See CONNECTOR.md.
- Tasks run by Claude show a "via Claude" tag. Notes you leave there are read by Claude with `get_instructions`.
- Calls on connector tasks tell you the note was saved for Claude.
- Settings has a Connectors section with the address and a connector check.
- Added `npm test` (31 connector tests with a fake database), also run in CI.

## 1.1.0

- The app is now called **Orion Works**. The AI employee is called Orion. (Older settings move over automatically.)
- New premium interface on phone and desktop: task cards with filters and stats, a Claude-style chat, a live activity timeline with a terminal look, a files view with Preview and Code, phone and desktop preview frames, and one-tap copy.
- Calls: new incoming-call screen, a call timer, and a WhatsApp-style control bar with Mute, Replay, Type and End.
- Settings rebuilt with cards for AI, Voice, Calls and Account. Setup is now a guided wizard.
- New task page with ideas and voice dictation.

## 1.0.0

- New professional interface for phone and desktop: task list, chat, activity timeline, files, settings.
- Switch the AI between OpenRouter and Groq. The worker follows your choice.
- Switch voice between the phone, Groq (Whisper and Orpheus) and OpenRouter. Cloud voices fall back to the phone voice on errors.
- Voice dictation for tasks and messages.
- Worker status ("Worker online") with a heartbeat.
- 3-step setup wizard, friendlier errors, Firebase config paste that accepts the whole snippet.
- Android: build the APK from your phone with GitHub Actions.
- Fixed: install error from a wrong text-to-speech plugin version.
- Fixed: setup page failed when the pasted Firebase snippet had comments or an import line.
- Added CONTRIBUTING.md, SECURITY.md and a build check workflow.
