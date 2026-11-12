import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// BYOK: every installation uses its own keys. They are stored only in this browser (or this phone).
const KEY = "orion.config";
const OLD_KEY = "elio.config"; // older installs: settings are moved over automatically

export function defaultConfig() {
  return {
    firebase: null,
    keys: { openrouter: "", groq: "" },
    ai: { provider: "openrouter", models: { openrouter: "openrouter/free", groq: "llama-3.3-70b-versatile" } },
    voice: {
      engine: "device", // device | groq | openrouter
      language: "en",
      groqVoice: "autumn",
      orVoice: "alloy",
      orTtsModel: "openai/gpt-4o-mini-tts-2025-12-15",
      orSttModel: "openai/whisper-large-v3",
    },
  };
}

function merge(base, raw) {
  const r = raw || {};
  return {
    firebase: r.firebase || null,
    keys: { ...base.keys, ...(r.keys || {}), openrouter: (r.keys && r.keys.openrouter) || r.openrouterKey || "" },
    ai: {
      provider: (r.ai && r.ai.provider) || "openrouter",
      models: { ...base.ai.models, ...((r.ai && r.ai.models) || {}), ...(!r.ai && r.model ? { openrouter: r.model } : {}) },
    },
    voice: { ...base.voice, ...(r.voice || {}) },
  };
}

export function loadConfig() {
  let raw = null;
  try { raw = JSON.parse(localStorage.getItem(KEY) || localStorage.getItem(OLD_KEY)); } catch { raw = null; }
  return raw ? merge(defaultConfig(), raw) : null;
}
export function saveConfig(config) { localStorage.setItem(KEY, JSON.stringify(config)); }
export function clearConfig() { localStorage.removeItem(KEY); localStorage.removeItem(OLD_KEY); }

// Change part of the saved settings and return the new full config.
export function updateConfig(patch) {
  const cur = loadConfig() || defaultConfig();
  const next = {
    ...cur,
    ...patch,
    keys: { ...cur.keys, ...(patch.keys || {}) },
    ai: { ...cur.ai, ...(patch.ai || {}), models: { ...cur.ai.models, ...((patch.ai && patch.ai.models) || {}) } },
    voice: { ...cur.voice, ...(patch.voice || {}) },
  };
  saveConfig(next);
  return next;
}

export function parseFirebaseConfig(text) {
  // Accepts the whole snippet Firebase shows (comments, import lines and all), or just the { ... } part.
  const clean = text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const at = clean.indexOf("apiKey");
  const open = at < 0 ? -1 : clean.lastIndexOf("{", at);
  const close = at < 0 ? -1 : clean.indexOf("}", at);
  if (open < 0 || close < 0) throw new Error("Could not find the Firebase config. Paste the block that contains apiKey.");
  const json = clean
    .slice(open, close + 1)
    .replace(/([{,]\s*)([A-Za-z_]\w*)\s*:/g, '$1"$2":')
    .replace(/'/g, '"')
    .replace(/,\s*}/g, "}");
  let config;
  try { config = JSON.parse(json); } catch { throw new Error("The config looks broken. Copy it again from Firebase."); }
  for (const k of ["apiKey", "authDomain", "projectId", "appId"]) {
    if (!config[k]) throw new Error("Missing field: " + k);
  }
  return config;
}

export function getFirebase() {
  const config = loadConfig();
  if (!config || !config.firebase) return null;
  const app = getApps()[0] || initializeApp(config.firebase);
  return { app, auth: getAuth(app), db: getFirestore(app) };
}
