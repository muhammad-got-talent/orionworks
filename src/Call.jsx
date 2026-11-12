import { useEffect, useRef, useState } from "react";
import { addDoc, collection, doc, getDoc, getDocs, limit, orderBy, query, serverTimestamp, updateDoc } from "firebase/firestore";
import Logo from "./Logo.jsx";
import { Icon, mmss } from "./ui.jsx";
import { askElio } from "./llm.js";
import { loadConfig } from "./firebase.js";
import { speak, listen, stopVoice, startRing, stopRing, prepareMic, setAudioGate, engineLabel } from "./voice.js";
import { isNative, enableCallAlerts, openFullScreenSettings, simulateCall, endCallNative } from "./native.js";

const callDoc = (fire, user, id) => doc(fire.db, "users", user.uid, "calls", id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const BYE = /\b(bye|goodbye|that'?s all|hang up|talk later)\b/i;
const LABELS = { update: "Task update", question: "Needs your input", done: "Task finished", error: "Needs attention", test: "Test call" };

export function IncomingCall({ fire, user, call, onAnswer, onClose }) {
  useEffect(() => {
    startRing();
    const t = setTimeout(onClose, 45000);
    return () => { stopRing(); clearTimeout(t); };
  }, []);
  async function decline() {
    stopRing();
    if (!call.local) await updateDoc(callDoc(fire, user, call.id), { status: "declined" }).catch(() => {});
    onClose();
  }
  return (
    <main className="call ringing" aria-label="Incoming call">
      <p className="call-brand">Orion Works</p>
      <div className="call-top">
        <div className="ripple" aria-hidden="true"><span /><span /><span /><div className="avatar-xl"><Logo size={84} /></div></div>
        <h1>Orion</h1>
        <p className="call-sub">Incoming call</p>
        <div className="reason-chip"><Icon name="bolt" size={14} />{LABELS[call.reason] || "Call"}{call.taskTitle ? " · " + call.taskTitle : ""}</div>
      </div>
      <div className="actions">
        <div className="ctl"><button className="round decline" aria-label="Decline" onClick={decline}><Icon name="phone" size={30} /></button><span>Decline</span></div>
        <div className="ctl"><button className="round accept" aria-label="Answer" onClick={() => { stopRing(); onAnswer(); }}><Icon name="phone" size={30} /></button><span>Answer</span></div>
      </div>
    </main>
  );
}

function callSystem(call, events) {
  const agent = call.source === "connector" ? (call.agent || "Claude") : null;
  return (
    "You are Orion, an AI employee on a live voice call with your user. Reply in one or two short spoken sentences. No markdown, no lists, no emojis. " +
    (agent
      ? "The work on this task is done by an AI assistant called " + agent + " in another app. If the user gives an instruction or asks for a change, confirm that you saved it for " + agent + " and that " + agent + " will see it the next time the user chats with it. "
      : "If the user gives an instruction or asks for a change, confirm it briefly and say you will get on it right after the call. ") +
    "If they say goodbye, say a short goodbye." +
    (call.taskTitle ? "\nTask: " + call.taskTitle : "") +
    (events ? "\nRecent progress:\n" + events : "")
  );
}

function Ctl({ icon, label, onClick, active, tone }) {
  return (
    <div className="ctl">
      <button className={"round " + (tone || "") + (active ? " active" : "")} aria-label={label} aria-pressed={active === undefined ? undefined : active} onClick={onClick}><Icon name={icon} size={26} /></button>
      <span>{label}</span>
    </div>
  );
}

export function CallScreen({ fire, user, call, onEnd }) {
  const [lines, setLines] = useState([]);
  const [phase, setPhaseState] = useState("connecting");
  const [note, setNote] = useState("");
  const [text, setText] = useState("");
  const [muted, setMuted] = useState(false);
  const [secs, setSecs] = useState(0);
  const [gateTap, setGateTap] = useState(null);
  const alive = useRef(true);
  const finished = useRef(false);
  const spoke = useRef(false);
  const forceDevice = useRef(false); // set when a cloud voice fails, so the call keeps going
  const mutedRef = useRef(false);
  const replayFlag = useRef(false);
  const lastOrion = useRef("");
  const phaseRef = useRef("connecting");
  const history = useRef([]);
  const queue = useRef([]);
  const system = useRef("");
  const inputRef = useRef(null);
  const endRef = useRef(null);
  const taskRef = call.taskId ? doc(fire.db, "users", user.uid, "tasks", call.taskId) : null;
  const configured = (loadConfig() || { voice: { engine: "device" } }).voice.engine;
  const engineOpt = () => (forceDevice.current ? { engine: "device" } : {});
  const setPhase = (p) => { phaseRef.current = p; setPhaseState(p); };

  const add = (who, t) => setLines((l) => [...l, { who, t }]);
  async function persist(role, t) {
    if (taskRef) await addDoc(collection(taskRef, "messages"), { role, text: t, via: "call", createdAt: serverTimestamp() }).catch(() => {});
  }
  function fallback(e) {
    if (configured !== "device" && !forceDevice.current) {
      forceDevice.current = true;
      setNote(e.message + " Switched to the phone voice for this call.");
      return true;
    }
    return false;
  }
  async function say(t) {
    add("orion", t);
    lastOrion.current = t;
    history.current.push({ role: "assistant", text: t });
    setPhase("speaking");
    try { await speak(t, engineOpt()); }
    catch (e) { if (fallback(e)) { try { await speak(t, { engine: "device" }); } catch { /* keep the call going */ } } }
  }
  async function handle(t) {
    add("you", t);
    history.current.push({ role: "user", text: t });
    await persist("user", t);
    if (BYE.test(t)) { await say("Okay, talk soon."); return true; }
    spoke.current = true;
    setPhase("thinking");
    try {
      const r = await askElio(history.current, system.current, { maxTokens: 160 });
      await persist("assistant", r.text);
      await say(r.text);
    } catch (e) {
      setNote(e.message);
      await say("Sorry, I lost my connection for a moment.");
    }
    return false;
  }
  async function finish() {
    if (finished.current) return;
    finished.current = true;
    await stopVoice();
    if (!call.local) await updateDoc(callDoc(fire, user, call.id), { status: "ended" }).catch(() => {});
    if (spoke.current && taskRef) {
      try {
        const s = await getDoc(taskRef);
        const d = s.data() || {};
        // Resume the worker with the new instructions. Tasks run by Claude read them with get_instructions instead.
        if (d.source !== "connector" && d.status !== "build" && d.status !== "working") await updateDoc(taskRef, { status: "build" });
      } catch { /* ignore */ }
    }
    await endCallNative();
    onEnd();
  }

  useEffect(() => {
    alive.current = true;
    const timer = setInterval(() => setSecs((s) => s + 1), 1000);
    setAudioGate(() => new Promise((resolve) => setGateTap(() => resolve)));
    (async () => {
      if (!call.local) await updateDoc(callDoc(fire, user, call.id), { status: "accepted" }).catch(() => {});
      let events = "";
      if (taskRef) {
        try {
          const m = await getDocs(query(collection(taskRef, "messages"), orderBy("createdAt", "desc"), limit(12)));
          history.current = m.docs.map((d) => ({ role: d.data().role, text: d.data().text })).reverse();
          const e = await getDocs(query(collection(taskRef, "events"), orderBy("createdAt", "desc"), limit(8)));
          events = e.docs.map((d) => d.data().type + ": " + d.data().text).reverse().join("\n");
        } catch { /* the call still works without context */ }
      }
      system.current = callSystem(call, events);
      await prepareMic().catch((e) => { if (!fallback(e)) setNote("Microphone blocked. You can type instead."); });
      await say(call.message);
      let silent = 0;
      while (alive.current) {
        if (replayFlag.current) {
          replayFlag.current = false;
          setPhase("speaking");
          try { await speak(lastOrion.current, engineOpt()); } catch { /* ignore */ }
          continue;
        }
        if (mutedRef.current && !queue.current.length) { setPhase("muted"); await sleep(300); continue; }
        setPhase("listening");
        let heard = queue.current.shift() || "";
        if (!heard) {
          try { heard = await listen(engineOpt()); }
          catch (e) {
            if (!fallback(e) && !queue.current.length) { setNote("I could not hear you. Type a message below."); await sleep(2500); }
          }
          if (!heard) heard = queue.current.shift() || "";
        }
        if (!alive.current) break;
        if (replayFlag.current || (mutedRef.current && !heard)) continue;
        if (!heard.trim()) {
          if (++silent >= 5) { await say("I can't hear you, so I'll let you go. Call me back anytime."); break; }
          continue;
        }
        silent = 0;
        if (await handle(heard.trim())) break;
      }
      await finish();
    })();
    return () => { alive.current = false; clearInterval(timer); setAudioGate(null); stopVoice(); };
  }, []);

  useEffect(() => { if (endRef.current) endRef.current.scrollIntoView({ block: "end" }); }, [lines.length]);

  function sendTyped() {
    const t = text.trim();
    if (!t) return;
    setText("");
    queue.current.push(t);
    stopVoice(); // interrupts listening so the typed message is used right away
  }
  function toggleMute() {
    const next = !mutedRef.current;
    mutedRef.current = next;
    setMuted(next);
    if (next && phaseRef.current === "listening") stopVoice(); // only stops the microphone, not Orion's speech
  }
  function replay() { replayFlag.current = true; stopVoice(); }
  function end() { alive.current = false; stopVoice(); }

  const status = { connecting: "Connecting...", speaking: "Orion is speaking", listening: "Listening", thinking: "Thinking", muted: "You are muted" }[phase];
  return (
    <main className="call" aria-label="Call with Orion">
      <div className="call-head">
        <div className={"avatar-lg " + phase}><Logo size={52} /></div>
        <div>
          <h1>Orion</h1>
          <p className="call-meta"><span className="live-dot" />{mmss(secs)} · {status}</p>
        </div>
        <span className="engine-chip">{engineLabel(forceDevice.current ? "device" : configured)} voice</span>
      </div>
      {gateTap && <button className="btn btn-primary" onClick={() => { gateTap(); setGateTap(null); }}><Icon name="volume" size={18} />Tap to enable sound</button>}
      <div className="transcript" aria-live="polite">
        {lines.slice(-8).map((l, i) => (<div key={i} className={"line " + l.who}><b>{l.who === "you" ? "You" : "Orion"}</b><p>{l.t}</p></div>))}
        <div ref={endRef} />
      </div>
      {note && <p className="error" role="alert">{note}</p>}
      <div className="typebar">
        <input ref={inputRef} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendTyped()} placeholder="Type instead of speaking..." aria-label="Type a message" />
        <button className="send" aria-label="Send" onClick={sendTyped} disabled={!text.trim()}><Icon name="send" size={18} /></button>
      </div>
      <div className="controls">
        <Ctl icon={muted ? "micoff" : "mic"} label={muted ? "Unmute" : "Mute"} active={muted} onClick={toggleMute} />
        <Ctl icon="replay" label="Replay" onClick={replay} />
        <Ctl icon="keyboard" label="Type" onClick={() => inputRef.current && inputRef.current.focus()} />
        <Ctl icon="phone" label="End" tone="end" onClick={end} />
      </div>
    </main>
  );
}

export function CallSetupCard({ fire, user }) {
  const [msg, setMsg] = useState("");
  const [full, setFull] = useState(null);
  async function enable() {
    try {
      const r = await enableCallAlerts(fire, user);
      if (!r.ok) setMsg(r.reason);
      else { setFull(r.fullScreen); setMsg("Call alerts are on for this phone."); }
    } catch (e) { setMsg(e.message); }
  }
  async function testInApp() {
    await addDoc(collection(fire.db, "users", user.uid, "calls"), {
      taskId: null, taskTitle: "", reason: "test", status: "ringing",
      message: "This is a test call from Orion. If you can hear me, calls work.",
      createdAt: serverTimestamp(),
    });
  }
  return (
    <div className="stack">
      <p className="hint">Orion rings you when a task finishes, gets stuck, or needs your decision. {isNative ? "Turn on alerts so it can ring even when the app is closed." : "On the website it rings while this page is open. Use the Android app for rings when it is closed."}</p>
      <div className="btn-row">
        {isNative && <button className="btn" onClick={enable}><Icon name="phone" size={18} />Enable call alerts</button>}
        {isNative && full === false && <button className="btn" onClick={openFullScreenSettings}>Allow full-screen calls</button>}
        {isNative && <button className="btn" onClick={() => { simulateCall(8000); setMsg("Lock your phone now. It will ring in 8 seconds."); }}>Test while locked</button>}
        <button className="btn" onClick={testInApp}>Test call in the app</button>
      </div>
      {msg && <p className="notice" role="status">{msg}</p>}
    </div>
  );
}
