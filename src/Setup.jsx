import { useState } from "react";
import { Icon } from "./ui.jsx";
import { AuthShell } from "./Brand.jsx";
import { AiFields, VoiceFields } from "./Fields.jsx";
import { defaultConfig, parseFirebaseConfig, saveConfig } from "./firebase.js";

const STEPS = ["Firebase", "AI", "Voice"];

export default function Setup({ onDone }) {
  const [step, setStep] = useState(0);
  const [fb, setFb] = useState("");
  const [cfg, setCfg] = useState(defaultConfig());
  const [error, setError] = useState("");

  function patch(p) {
    setCfg((c) => ({
      ...c,
      keys: { ...c.keys, ...(p.keys || {}) },
      ai: { ...c.ai, ...(p.ai || {}), models: { ...c.ai.models, ...((p.ai && p.ai.models) || {}) } },
      voice: { ...c.voice, ...(p.voice || {}) },
    }));
  }
  function next() {
    setError("");
    try {
      if (step === 0) parseFirebaseConfig(fb);
      if (step === 1 && !cfg.keys[cfg.ai.provider]) throw new Error("Paste your " + (cfg.ai.provider === "groq" ? "Groq" : "OpenRouter") + " key to continue.");
      if (step === 2) {
        saveConfig({ ...cfg, firebase: parseFirebaseConfig(fb) });
        onDone();
        return;
      }
      setStep(step + 1);
    } catch (e) { setError(e.message); }
  }

  return (
    <AuthShell>
      <div className="auth-card">
        <div className="progress" role="progressbar" aria-valuemin="1" aria-valuemax="3" aria-valuenow={step + 1} aria-label={"Step " + (step + 1) + " of 3"}>
          {STEPS.map((s, i) => <span key={s} className={i <= step ? "on" : ""} />)}
        </div>
        <p className="step-label">Step {step + 1} of 3 · {STEPS[step]}</p>

        {step === 0 && (
          <div className="stack">
            <div>
              <h1>Connect Firebase</h1>
              <p className="muted">Firebase stores your tasks and handles sign-in. It is free and it is yours.</p>
            </div>
            <div>
              <label htmlFor="fb">Firebase web config</label>
              <textarea id="fb" rows="7" value={fb} onChange={(e) => setFb(e.target.value)} spellCheck="false" autoCapitalize="off" placeholder={'const firebaseConfig = {\n  apiKey: "...",\n  authDomain: "...",\n  projectId: "...",\n  appId: "..."\n};'} />
              <p className="hint">You can paste the whole snippet Firebase gives you.</p>
            </div>
            <details className="more">
              <summary>Where do I find this?</summary>
              <ol className="howto">
                <li>Open console.firebase.google.com and your project.</li>
                <li>Tap the gear icon, then <strong>Project settings</strong>.</li>
                <li>Under <strong>Your apps</strong> add a Web app (the {"</>"} icon).</li>
                <li>Copy the <code>firebaseConfig</code> block and paste it here.</li>
              </ol>
            </details>
          </div>
        )}
        {step === 1 && (
          <div className="stack">
            <div>
              <h1>Choose your AI</h1>
              <p className="muted">Pick OpenRouter or Groq. You can add both and switch any time in Settings.</p>
            </div>
            <AiFields value={cfg} onChange={patch} />
          </div>
        )}
        {step === 2 && (
          <div className="stack">
            <div>
              <h1>Pick a voice for calls</h1>
              <p className="muted">Phone voice is free and needs nothing. You can change it later.</p>
            </div>
            <VoiceFields value={cfg} onChange={patch} />
          </div>
        )}

        {error && <p className="error" role="alert">{error}</p>}
        <div className="row-actions">
          {step > 0 ? <button className="btn" onClick={() => { setError(""); setStep(step - 1); }}>Back</button> : <span />}
          <button className="btn btn-primary" onClick={next}>{step === 2 ? "Finish setup" : "Continue"}{step < 2 && <Icon name="back" size={16} />}</button>
        </div>
      </div>
    </AuthShell>
  );
}
