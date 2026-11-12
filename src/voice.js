import { Capacitor } from "@capacitor/core";
import { loadConfig } from "./firebase.js";

// Voice for calls and dictation. Three engines you can switch in Settings:
//   device      the phone or browser's built-in speech (free, no keys)
//   groq        Groq Whisper (speech to text) + Orpheus (text to speech)
//   openrouter  OpenRouter audio models (uses your OpenRouter credits)
const native = Capacitor.isNativePlatform();
const GROQ = "https://api.groq.com/openai/v1";
const OPENROUTER = "https://openrouter.ai/api/v1";
const GROQ_STT = "whisper-large-v3-turbo";
const GROQ_TTS = "canopylabs/orpheus-v1-english";

export const ENGINES = [
  { id: "device", label: "Phone", note: "Free. Uses the built-in speech of your phone or browser." },
  { id: "groq", label: "Groq", note: "Free tier. Fast and natural. Needs a Groq key." },
  { id: "openrouter", label: "OpenRouter", note: "Uses your OpenRouter credits. Needs an OpenRouter key." },
];
export const GROQ_VOICES = ["autumn", "diana", "hannah", "austin", "daniel", "troy"];
export const LANGUAGES = [
  { id: "en", label: "English", bcp: "en-US" },
  { id: "ur", label: "Urdu", bcp: "ur-PK" },
  { id: "hi", label: "Hindi", bcp: "hi-IN" },
  { id: "ar", label: "Arabic", bcp: "ar-SA" },
  { id: "auto", label: "Auto-detect (cloud engines)", bcp: "en-US" },
];
const bcp = (id) => (LANGUAGES.find((l) => l.id === id) || LANGUAGES[0]).bcp;

let current = null; // the audio that is playing right now
let stopRecording = null;
let webRecognition = null;
let gate = null; // asks the user to tap when the browser blocks autoplay
export function setAudioGate(fn) { gate = fn; }

function voiceConfig() {
  const c = loadConfig();
  return { voice: c ? c.voice : { engine: "device", language: "en", groqVoice: "autumn", orVoice: "alloy" }, keys: c ? c.keys : {} };
}
export function engineLabel(id) { return (ENGINES.find((e) => e.id === id) || ENGINES[0]).label; }

async function failText(res, label) {
  let body = "";
  try { body = await res.text(); } catch { /* ignore */ }
  if (res.status === 401 || res.status === 403) return "Your " + label + " key was rejected.";
  if (res.status === 429) return label + " voice limit reached. Try again in a minute.";
  if (/terms/i.test(body)) return "Groq needs you to accept the Orpheus voice terms once: open console.groq.com, go to Playground, choose the canopylabs/orpheus-v1-english model and accept.";
  return label + " voice error " + res.status + ": " + body.slice(0, 160);
}

// ---------- microphone ----------
export async function prepareMic(engine) {
  const e = engine || voiceConfig().voice.engine;
  if (e === "device") {
    if (!native) return;
    const { SpeechRecognition } = await import("@capacitor-community/speech-recognition");
    const p = await SpeechRecognition.requestPermissions();
    if (p.speechRecognition !== "granted") throw new Error("Microphone permission denied");
    return;
  }
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  stream.getTracks().forEach((t) => t.stop());
}

// Records one phrase. Stops by itself after a pause in speech.
async function record() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
  const AC = window.AudioContext || window.webkitAudioContext;
  const ac = new AC();
  await ac.resume().catch(() => {});
  const vad = ac.state === "running"; // without a user tap some browsers keep audio analysis paused
  const analyser = ac.createAnalyser();
  analyser.fftSize = 1024;
  ac.createMediaStreamSource(stream).connect(analyser);
  const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((t) => window.MediaRecorder && MediaRecorder.isTypeSupported(t)) || "";
  const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
  const chunks = [];
  rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
  const buf = new Uint8Array(analyser.fftSize);
  return new Promise((resolve) => {
    const t0 = Date.now();
    let heard = !vad; // no analysis available: just record for a fixed time
    let lastLoud = Date.now();
    let noise = 0;
    const cleanup = () => { clearInterval(timer); stream.getTracks().forEach((t) => t.stop()); ac.close().catch(() => {}); stopRecording = null; };
    const stop = () => { if (rec.state !== "inactive") rec.stop(); };
    rec.onstop = () => { cleanup(); resolve(heard ? new Blob(chunks, { type: rec.mimeType || "audio/webm" }) : null); };
    stopRecording = () => { heard = false; stop(); };
    rec.start(250);
    const timer = setInterval(() => {
      const now = Date.now();
      if (vad) {
        analyser.getByteTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) { const d = (buf[i] - 128) / 128; sum += d * d; }
        const rms = Math.sqrt(sum / buf.length);
        if (now - t0 < 400) noise = Math.max(noise, rms); // measure the room first
        else if (rms > Math.max(0.02, noise * 2.5)) { heard = true; lastLoud = now; }
        if (heard && now - lastLoud > 1300) stop();
        if (!heard && now - t0 > 9000) stop();
      } else if (now - t0 > 6000) stop();
      if (now - t0 > 20000) stop();
    }, 100);
  });
}

// ---------- cloud speech to text ----------
async function transcribe(engine, blob, c) {
  const form = new FormData();
  form.append("file", blob, "speech.webm");
  const lang = c.voice.language;
  if (lang && lang !== "auto") form.append("language", lang);
  let url, key, label;
  if (engine === "groq") {
    url = GROQ + "/audio/transcriptions"; key = c.keys.groq; label = "Groq";
    form.append("model", GROQ_STT); form.append("response_format", "json"); form.append("temperature", "0");
  } else {
    url = OPENROUTER + "/audio/transcriptions"; key = c.keys.openrouter; label = "OpenRouter";
    form.append("model", c.voice.orSttModel || "openai/whisper-large-v3");
  }
  if (!key) throw new Error("Add your " + label + " key in Settings to use this voice.");
  let res;
  try { res = await fetch(url, { method: "POST", headers: { Authorization: "Bearer " + key }, body: form }); }
  catch { throw new Error("Could not reach " + label + " for speech recognition."); }
  if (!res.ok) throw new Error(await failText(res, label));
  const data = await res.json();
  return String(data.text || "").trim();
}

function cleanTranscript(t) {
  const s = t.trim();
  if (s.length < 2) return "";
  if (/^(thank you\.?|thanks for watching\.?|you\.?|bye\.?)$/i.test(s)) return ""; // Whisper often invents these on silence
  return s;
}

function listenDevice(lang) {
  return (async () => {
    if (native) {
      const { SpeechRecognition } = await import("@capacitor-community/speech-recognition");
      const r = await SpeechRecognition.start({ language: bcp(lang), maxResults: 1, partialResults: false, popup: false });
      return (r.matches && r.matches[0]) || "";
    }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) throw new Error("This browser has no speech recognition. Type your message instead.");
    return new Promise((resolve, reject) => {
      const rec = new SR();
      webRecognition = rec;
      rec.lang = bcp(lang);
      rec.onresult = (e) => resolve(e.results[0][0].transcript);
      rec.onerror = (e) => (e.error === "no-speech" || e.error === "aborted" ? resolve("") : reject(new Error(e.error)));
      rec.onend = () => resolve("");
      rec.start();
    });
  })();
}

// Listens for one phrase and returns it as text.
export async function listen(opts = {}) {
  const c = loadConfig() || { voice: voiceConfig().voice, keys: {} };
  const engine = opts.engine || c.voice.engine;
  if (engine === "device") return listenDevice(c.voice.language);
  const blob = await record();
  if (!blob || blob.size < 3000) return "";
  return cleanTranscript(await transcribe(engine, blob, c));
}

// ---------- speaking ----------
function chunks(text) {
  const clean = text.replace(/\[[^\]]*\]/g, "").replace(/[*#`_>]/g, "").replace(/\s+/g, " ").trim();
  const parts = clean.match(/[^.!?]+[.!?]*\s*/g) || [clean];
  const out = [];
  let cur = "";
  for (let p of parts) {
    while (p.length > 180) { out.push((cur + p.slice(0, 180)).trim()); cur = ""; p = p.slice(180); }
    if ((cur + p).length > 180) { out.push(cur.trim()); cur = p; } else cur += p;
  }
  if (cur.trim()) out.push(cur.trim());
  return out.filter(Boolean);
}

async function synthesize(engine, text, c) {
  let url, key, label, body;
  if (engine === "groq") {
    url = GROQ + "/audio/speech"; key = c.keys.groq; label = "Groq";
    body = { model: GROQ_TTS, voice: c.voice.groqVoice || "autumn", input: text, response_format: "wav" };
  } else {
    url = OPENROUTER + "/audio/speech"; key = c.keys.openrouter; label = "OpenRouter";
    body = { model: c.voice.orTtsModel || "openai/gpt-4o-mini-tts-2025-12-15", voice: c.voice.orVoice || "alloy", input: text, response_format: "mp3" };
  }
  if (!key) throw new Error("Add your " + label + " key in Settings to use this voice.");
  let res;
  try { res = await fetch(url, { method: "POST", headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" }, body: JSON.stringify(body) }); }
  catch { throw new Error("Could not reach " + label + " for the voice."); }
  if (!res.ok) throw new Error(await failText(res, label));
  return res.blob();
}

async function playBlob(blob) {
  const url = URL.createObjectURL(blob);
  try {
    const audio = new Audio(url);
    await new Promise((resolve, reject) => {
      current = { audio, resolve };
      audio.onended = resolve;
      audio.onerror = () => reject(new Error("Could not play the audio."));
      audio.play().catch(async (e) => {
        if (e && e.name === "NotAllowedError" && gate) {
          try { await gate(); await audio.play(); } catch (e2) { reject(e2); }
        } else reject(e);
      });
    });
  } finally {
    URL.revokeObjectURL(url);
    current = null;
  }
}

async function speakDevice(text, lang) {
  if (native) {
    const { TextToSpeech } = await import("@capacitor-community/text-to-speech");
    await TextToSpeech.speak({ text, lang: bcp(lang), rate: 1.0, pitch: 1.0, volume: 1.0 });
    return;
  }
  if (!("speechSynthesis" in window)) return;
  await new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = bcp(lang);
    u.onend = resolve;
    u.onerror = resolve;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  });
}

export async function speak(text, opts = {}) {
  const c = loadConfig() || { voice: voiceConfig().voice, keys: {} };
  const engine = opts.engine || c.voice.engine;
  if (engine === "device") return speakDevice(text, c.voice.language);
  const parts = chunks(text);
  if (!parts.length) return;
  let next = synthesize(engine, parts[0], c);
  for (let i = 0; i < parts.length; i++) {
    const blob = await next;
    if (i + 1 < parts.length) next = synthesize(engine, parts[i + 1], c);
    next.catch(() => {}); // avoid unhandled rejection if we stop early
    await playBlob(blob);
  }
}

export async function stopVoice() {
  try {
    if (current) { current.audio.pause(); current.resolve(); }
    if (stopRecording) stopRecording();
    if (webRecognition) webRecognition.abort();
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    if (native) {
      const { SpeechRecognition } = await import("@capacitor-community/speech-recognition");
      const { TextToSpeech } = await import("@capacitor-community/text-to-speech");
      await SpeechRecognition.stop().catch(() => {});
      await TextToSpeech.stop().catch(() => {});
    }
  } catch { /* nothing to stop */ }
}

// ---------- ringing ----------
let ctx = null;
let timer = null;
export function startRing() {
  stopRing();
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    const beep = () => {
      [0, 0.45].forEach((t, i) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.frequency.value = i ? 520 : 440;
        g.gain.value = 0.12;
        o.connect(g);
        g.connect(ctx.destination);
        o.start(ctx.currentTime + t);
        o.stop(ctx.currentTime + t + 0.35);
      });
      if (navigator.vibrate) navigator.vibrate([400, 200, 400]);
    };
    beep();
    timer = setInterval(beep, 2500);
  } catch { /* audio not allowed yet */ }
}
export function stopRing() {
  if (timer) clearInterval(timer);
  timer = null;
  if (ctx) ctx.close().catch(() => {});
  ctx = null;
  if (navigator.vibrate) navigator.vibrate(0);
}
