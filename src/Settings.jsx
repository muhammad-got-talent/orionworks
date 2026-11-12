import { useRef, useState } from "react";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { signOut } from "firebase/auth";
import { Icon } from "./ui.jsx";
import { AiFields, VoiceFields } from "./Fields.jsx";
import { CallSetupCard } from "./Call.jsx";
import ConnectorCard from "./Connector.jsx";
import { askElio } from "./llm.js";
import { speak, listen, prepareMic } from "./voice.js";
import { clearConfig, defaultConfig, loadConfig, updateConfig } from "./firebase.js";
import pkg from "../package.json";

// The worker reads these so it uses the same provider and model you picked here.
export async function syncAiSettings(fire, user) {
  const c = loadConfig();
  if (!c) return;
  try {
    await setDoc(doc(fire.db, "users", user.uid, "settings", "ai"), { provider: c.ai.provider, model: c.ai.models[c.ai.provider], updatedAt: serverTimestamp() });
  } catch { /* offline or rules not updated yet */ }
}

function Section({ icon, title, desc, innerRef, children }) {
  return (
    <section className="card sect" ref={innerRef}>
      <header className="sect-head">
        <span className="sect-ic"><Icon name={icon} /></span>
        <div><h3>{title}</h3><p className="hint">{desc}</p></div>
      </header>
      {children}
    </section>
  );
}

export default function Settings({ fire, user, onBack, onReset }) {
  const [cfg, setCfg] = useState(() => loadConfig() || defaultConfig());
  const [aiMsg, setAiMsg] = useState(null);
  const [voiceMsg, setVoiceMsg] = useState(null);
  const timer = useRef(null);
  const refs = { ai: useRef(null), voice: useRef(null), calls: useRef(null), connect: useRef(null), account: useRef(null) };
  const jump = (k) => refs[k].current && refs[k].current.scrollIntoView({ behavior: "smooth", block: "start" });

  function patch(p) {
    setCfg(updateConfig(p));
    if (p.ai) { clearTimeout(timer.current); timer.current = setTimeout(() => syncAiSettings(fire, user), 700); }
  }
  async function testAi() {
    setAiMsg({ tone: "", text: "Testing..." });
    try {
      const r = await askElio([{ role: "user", text: "Reply with the single word: ready" }], "You are a connection test. Reply with one word.", { maxTokens: 20 });
      setAiMsg({ tone: "ok", text: "Connected to " + r.provider + ". Reply: " + r.text.slice(0, 40) });
    } catch (e) { setAiMsg({ tone: "err", text: e.message }); }
  }
  async function testVoice() {
    setVoiceMsg({ tone: "", text: "Speaking..." });
    try {
      await prepareMic();
      await speak("Hi, this is Orion. Say something after I finish.");
      setVoiceMsg({ tone: "", text: "Listening... say a few words." });
      const heard = await listen();
      setVoiceMsg(heard ? { tone: "ok", text: "I heard: " + heard } : { tone: "err", text: "I did not hear anything. Check your microphone permission." });
    } catch (e) { setVoiceMsg({ tone: "err", text: e.message }); }
  }
  function reset() {
    if (window.confirm("Remove your Firebase config, keys and voice settings from this device? Your tasks stay in your Firebase project.")) {
      clearConfig();
      onReset();
    }
  }
  const initial = ((user.email || "?")[0] || "?").toUpperCase();

  return (
    <div className="page">
      <header className="topbar">
        <button className="icon-btn only-mobile" aria-label="Back" onClick={onBack}><Icon name="back" /></button>
        <h1 className="topbar-title">Settings</h1>
      </header>
      <div className="scroll">
        <div className="content narrow stack-lg">
          <nav className="sectnav" aria-label="Jump to section">
            <button onClick={() => jump("ai")}><Icon name="sparkle" size={16} />AI</button>
            <button onClick={() => jump("voice")}><Icon name="volume" size={16} />Voice</button>
            <button onClick={() => jump("calls")}><Icon name="phone" size={16} />Calls</button>
            <button onClick={() => jump("connect")}><Icon name="bolt" size={16} />Connect</button>
            <button onClick={() => jump("account")}><Icon name="user" size={16} />Account</button>
          </nav>

          <Section innerRef={refs.ai} icon="sparkle" title="AI" desc="Choose what Orion thinks with. The worker follows your choice too.">
            <AiFields value={cfg} onChange={patch} />
            <div className="btn-row"><button className="btn" onClick={testAi}><Icon name="check" size={18} />Test connection</button></div>
            {aiMsg && <p className={"notice " + aiMsg.tone} role="status">{aiMsg.text}</p>}
            <p className="hint">The worker has its own keys. Add <code>OPENROUTER_API_KEY</code> and/or <code>GROQ_API_KEY</code> to your Codespaces secrets for the providers you want.</p>
          </Section>

          <Section innerRef={refs.voice} icon="volume" title="Voice" desc="How Orion speaks and listens on calls and when you dictate.">
            <VoiceFields value={cfg} onChange={patch} />
            <div className="btn-row"><button className="btn" onClick={testVoice}><Icon name="mic" size={18} />Test voice</button></div>
            {voiceMsg && <p className={"notice " + voiceMsg.tone} role="status">{voiceMsg.text}</p>}
          </Section>

          <Section innerRef={refs.calls} icon="phone" title="Calls" desc="Let Orion ring you, even when the app is closed.">
            <CallSetupCard fire={fire} user={user} />
          </Section>

          <Section innerRef={refs.connect} icon="bolt" title="Connectors" desc="Let Claude or ChatGPT use Orion as their dashboard and phone.">
            <ConnectorCard />
          </Section>

          <Section innerRef={refs.account} icon="user" title="Account" desc="Your sign-in and this device.">
            <div className="account">
              <span className="avatar-sm">{initial}</span>
              <div><strong>{user.email}</strong><p className="hint">Signed in to your own Firebase project</p></div>
            </div>
            <div className="btn-row">
              <button className="btn" onClick={() => signOut(fire.auth)}><Icon name="logout" size={18} />Sign out</button>
              <button className="btn danger" onClick={reset}>Reset setup on this device</button>
            </div>
          </Section>

          <p className="hint center">Orion Works {pkg.version} · MIT licensed · open source</p>
        </div>
      </div>
    </div>
  );
}
