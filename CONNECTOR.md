# Connect Claude (or ChatGPT) to Orion Works

This is optional. It lets **Claude do the work in your own Claude account** while **Orion Works is the dashboard and the phone**:

- Claude creates a task on your dashboard and posts progress you can watch live.
- Claude attaches the files it wrote, so you can preview them and download a zip.
- When the work is done, **Orion calls your phone**. You talk to Orion on the call and what you say is saved.
- Claude reads your notes and call instructions the next time you chat with it.

You do not need the worker or any OpenRouter or Groq key for this. Your normal Claude plan does the thinking.

## What it cannot do

Claude only works while you are chatting with it. A phone call cannot wake Claude up. So the loop is: you ask Claude, Claude works and calls you, you talk on the call, and next time you open Claude it reads what you said (it checks automatically, or just say "check Orion").

## Part 1: Make a secret token

This is a long random password that protects your connector. In your Codespace terminal run:

```
node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
```

Copy the 48 characters it prints. This is your `ORION_MCP_TOKEN`. Keep it private.

## Part 2: Add three variables in Vercel

1. Vercel > your project > **Settings** > **Environment Variables**.
2. Add these three (apply to Production):

| Name | Value |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | the whole service-account JSON file (the same one the worker uses) |
| `ORION_MCP_TOKEN` | the token from Part 1 |
| `ORION_OWNER_EMAIL` | the email you sign in to Orion Works with |

3. Vercel > **Deployments** > the three dots on the latest one > **Redeploy**.

## Part 3: Check that it is online

Open this address in your browser (use your own Vercel address):

```
https://YOUR-SITE.vercel.app/mcp
```

You should see a small page with `"status": "online"` and `"configured": true`. If `configured` is false, one of the three variables is missing. You can also open Orion Works > Settings > **Connectors** > **Check connector**.

## Part 4: Add it to Claude

1. In Claude (website, or the app), open **Settings** > **Connectors** > **Add custom connector**. Menu names change over time, so look for custom connectors.
2. Name: `Orion Works`.
3. Address (paste yours, with your token at the end):

```
https://YOUR-SITE.vercel.app/mcp?key=YOUR_TOKEN
```

4. Tap **Add**. Open a new chat and turn the connector on from the tools or connectors menu.

As far as I know, custom connectors are available on Free (one connector), Pro, Max and team plans, and appear in the mobile app after you add them. Plans and menus change, so check Claude's help page for custom connectors if you cannot find it.

## Part 5: Try it

Say this to Claude:

> Use Orion Works. Create a task called "Bakery landing page", build a simple one-page website, post progress as you go, save the files with save_files, and call me when it is finished.

Open Orion Works. The task appears with a "via Claude" tag. Watch the Activity tab, open Files to preview and download the site, and answer the call when it rings.

## What the connector can do

| Tool | What it does |
|---|---|
| `create_task` | Makes a task on your dashboard |
| `post_update` | Posts progress, a report or a final summary, and sets the status |
| `save_files` | Attaches files so you can preview and download them (text up to 400 KB each, small images as base64) |
| `call_me` | Rings your phone (max 5 calls per 10 minutes) |
| `get_instructions` | Reads new notes you left in the app or said on a call |
| `get_task`, `list_tasks` | Looks at tasks and recent messages |

Phone calls need the Android app set up as described in [ANDROID.md](ANDROID.md). Without it, calls ring on the website while the page is open.

## ChatGPT

The address is the same. ChatGPT supports MCP connectors in "developer mode" on some plans, mostly on the website, and the rules change often. Check OpenAI's current help page before relying on it.

## Security

- The address contains your secret token. Anyone who has it can create tasks, read your task titles and notes, and ring your phone (limited to 5 calls per 10 minutes). They cannot read the rest of your Firebase data.
- Do not share screenshots of the address. Claude's servers also see what the connector returns, such as task titles and your notes, because it becomes part of your chat.
- To rotate the token: change `ORION_MCP_TOKEN` in Vercel, redeploy, and update the address in Claude.
- This connector is built for **one person** (you). A multi-user version would need proper sign-in (OAuth), which is not included.

## Troubleshooting

| You see | What to do |
|---|---|
| Page shows `"configured": false` | Add the three Vercel variables and redeploy. |
| Claude says unauthorized | The token in the address does not match `ORION_MCP_TOKEN`. |
| "No Orion Works account found" | Fix `ORION_OWNER_EMAIL`. It must be the email you sign in with. |
| "FIREBASE_SERVICE_ACCOUNT ... not valid JSON" | Paste the whole JSON file again, braces included. |
| 404 at /mcp | The `api` folder and `vercel.json` are not on GitHub yet. Push them and let Vercel redeploy. |
| Task never appears | Open Orion Works with the same email as `ORION_OWNER_EMAIL`. |
| Call does not ring | Check the Calls section in Settings (ANDROID.md). Calls ring for about 45 seconds. |

## For contributors

The code is in `api/`: `mcp.js` (Vercel entry), `_server.js` (the MCP protocol and token check), `_tools.js` (the tools). Run `npm test` to test everything with a fake database. Tasks made by the connector have `source: "connector"`, and the worker ignores them.
