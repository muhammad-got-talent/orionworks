import { loadConfig } from "./firebase.js";

// The chat brain. Works with OpenRouter or Groq (both speak the OpenAI chat format).
export const PROVIDERS = {
  openrouter: {
    label: "OpenRouter",
    url: "https://openrouter.ai/api/v1/chat/completions",
    keyUrl: "https://openrouter.ai/keys",
    keyHint: "sk-or-...",
    defaultModel: "openrouter/free",
    modelHint: "openrouter/free picks a free model for you. Any slug ending in :free also works.",
  },
  groq: {
    label: "Groq",
    url: "https://api.groq.com/openai/v1/chat/completions",
    keyUrl: "https://console.groq.com/keys",
    keyHint: "gsk_...",
    defaultModel: "llama-3.3-70b-versatile",
    modelHint: "llama-3.3-70b-versatile is reliable. openai/gpt-oss-120b is a stronger alternative.",
  },
};

export const SYSTEM =
  "You are Orion, an autonomous AI employee that builds websites and apps for the user. " +
  "Right now you can only plan and discuss; the user starts the real work with the Start building button. " +
  "When given a task, reply with a short step-by-step plan (at most 6 steps) and ask at most one clarifying question. Be concise.";

function friendly(label, status, body) {
  if (status === 401 || status === 403) return "Your " + label + " key was rejected. Check it in Settings.";
  if (status === 429) return label + " is busy or you hit the free limit. Wait a minute and try again.";
  if (status === 404) return label + " could not find that model. Check the model name in Settings.";
  return label + " error " + status + ": " + String(body).slice(0, 200);
}

export async function askElio(history, system = SYSTEM, opts = {}) {
  const config = loadConfig();
  if (!config) throw new Error("Finish setup first.");
  const provider = opts.provider || config.ai.provider;
  const p = PROVIDERS[provider];
  const key = config.keys[provider];
  if (!key) throw new Error("Add your " + p.label + " key in Settings.");
  const headers = { Authorization: "Bearer " + key, "Content-Type": "application/json" };
  if (provider === "openrouter") headers["X-Title"] = "Orion";
  const body = {
    model: opts.model || config.ai.models[provider] || p.defaultModel,
    messages: [{ role: "system", content: system }, ...history.map((m) => ({ role: m.role, content: m.text }))],
  };
  if (opts.maxTokens) body.max_tokens = opts.maxTokens;
  let res;
  try { res = await fetch(p.url, { method: "POST", headers, body: JSON.stringify(body) }); }
  catch { throw new Error("Could not reach " + p.label + ". Check your internet connection."); }
  if (!res.ok) throw new Error(friendly(p.label, res.status, await res.text()));
  const data = await res.json();
  const text = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
  return { text: text || "(empty reply)", model: data.model || body.model, provider };
}
