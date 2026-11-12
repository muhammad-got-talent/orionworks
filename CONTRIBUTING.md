# Contributing to Orion

Thanks for helping! Orion is MIT licensed and everyone is welcome.

## Ways to help

- Report bugs and rough edges (open an issue with the steps and what you saw).
- Improve the docs, especially the setup guide for beginners.
- Fix bugs or add features. For big changes, open an issue first so we can agree on the idea.

## Run it locally

```
npm install
npm run dev
```

Worker (needs the secrets in `worker/README.md`):

```
cd worker
npm install
npm start
```

## Pull requests

1. Fork the repo and make a branch.
2. Keep changes small and focused. Match the existing style.
3. Run `npm run build` and make sure it passes. The Build check runs it for you.
4. Describe what changed and how you tested it.

## Ground rules

- Never commit secrets: API keys, `google-services.json`, or Firebase service-account files.
- Keep Orion free to run. Do not add paid services as a requirement.
- The AI's commands must stay sandboxed to the project folder. Changes to `worker/index.js` safety checks need extra care and a clear explanation.
- Be kind. Assume good intent.

By contributing you agree your work is released under the MIT License.
