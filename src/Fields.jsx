import { useState } from "react";
import { ChoiceCards, Icon } from "./ui.jsx";
import { PROVIDERS } from "./llm.js";
import { GROQ_VOICES, LANGUAGES } from "./voice.js";

function KeyInput({ id, value, onChange, placeholder }) {
  const [show, setShow] = useState(false);
  return (
    <div className="keyrow">
      <input id={id} type={show ? "text" : "password"} autoComplete="off" autoCapitalize="off" spellCheck="false" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      <button type="button" className="icon-btn" aria-label={show ? "Hide key" : "Show key"} onClick={() => setShow(!show)}><Icon name="eye" /></button>
    </div>
  );
}

// value = full config; onChange(patch) merges into it.
export function AiFields({ value, onChange }) {
  const provider = value.ai.provider;
  const p = PROVIDERS[provider];
  const otherId = provider === "groq" ? "openrouter" : "groq";
  const o = PROVIDERS[otherId];
  return (
    <div className="stack">
      <ChoiceCards
        label="AI provider" value={provider} onChange={(id) => onChange({ ai: { provider: id } })}
        options={[
          { id: "openrouter", title: "OpenRouter", tag: "Free models", desc: "One key, many models. Free models cost nothing but can be slower." },
          { id: "groq", title: "Groq", tag: "Very fast", desc: "Fast open models with a generous free tier." },
        ]}
      />
      <div>
        <label htmlFor="key-main">{p.label} key</label>
        <KeyInput id="key-main" value={value.keys[provider]} onChange={(v) => onChange({ keys: { [provider]: v.trim() } })} placeholder={p.keyHint} />
        <p className="hint">Get a free key at <a href={p.keyUrl} target="_blank" rel="noreferrer">{p.keyUrl.replace("https://", "")}</a></p>
      </div>
      <div>
        <label htmlFor="model">Model</label>
        <input id="model" value={value.ai.models[provider]} onChange={(e) => onChange({ ai: { models: { [provider]: e.target.value.trim() } } })} spellCheck="false" autoCapitalize="off" />
        <p className="hint">{p.modelHint}</p>
      </div>
      <details className="more">
        <summary>{o.label} key (optional, to switch later)</summary>
        <KeyInput id="key-other" value={value.keys[otherId]} onChange={(v) => onChange({ keys: { [otherId]: v.trim() } })} placeholder={o.keyHint} />
        <p className="hint">Get a free key at <a href={o.keyUrl} target="_blank" rel="noreferrer">{o.keyUrl.replace("https://", "")}</a></p>
      </details>
    </div>
  );
}

export function VoiceFields({ value, onChange }) {
  const v = value.voice;
  return (
    <div className="stack">
      <ChoiceCards
        label="Voice engine" value={v.engine} onChange={(id) => onChange({ voice: { engine: id } })}
        options={[
          { id: "device", title: "Phone voice", tag: "Free", desc: "Your phone's built-in speech. Works everywhere, no keys needed." },
          { id: "groq", title: "Groq voice", tag: "Free tier", desc: "Natural voices and very fast listening. Needs your Groq key." },
          { id: "openrouter", title: "OpenRouter voice", tag: "Uses credits", desc: "OpenAI-style voices through OpenRouter. Needs your OpenRouter key." },
        ]}
      />
      {v.engine === "groq" && (
        <div>
          <label>Voice</label>
          <div className="vchips" role="radiogroup" aria-label="Groq voice">
            {GROQ_VOICES.map((n) => (
              <button key={n} type="button" role="radio" aria-checked={v.groqVoice === n} className={"chip" + (v.groqVoice === n ? " on" : "")} onClick={() => onChange({ voice: { groqVoice: n } })}>{n[0].toUpperCase() + n.slice(1)}</button>
            ))}
          </div>
          <p className="hint">Groq voices speak English. The first time, accept the Orpheus voice terms in the Groq console (Playground).</p>
        </div>
      )}
      {v.engine === "openrouter" && (
        <div className="stack">
          <div>
            <label htmlFor="orvoice">Voice name</label>
            <input id="orvoice" value={v.orVoice} onChange={(e) => onChange({ voice: { orVoice: e.target.value.trim() } })} spellCheck="false" autoCapitalize="off" />
          </div>
          <div>
            <label htmlFor="ortts">Speech model</label>
            <input id="ortts" value={v.orTtsModel} onChange={(e) => onChange({ voice: { orTtsModel: e.target.value.trim() } })} spellCheck="false" autoCapitalize="off" />
          </div>
          <div>
            <label htmlFor="orstt">Transcription model</label>
            <input id="orstt" value={v.orSttModel} onChange={(e) => onChange({ voice: { orSttModel: e.target.value.trim() } })} spellCheck="false" autoCapitalize="off" />
            <p className="hint">Model names can change. If it stops working, check the speech models on openrouter.ai/models.</p>
          </div>
        </div>
      )}
      <div>
        <label htmlFor="lang">Spoken language</label>
        <select id="lang" value={v.language} onChange={(e) => onChange({ voice: { language: e.target.value } })}>
          {LANGUAGES.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
        </select>
      </div>
    </div>
  );
}
