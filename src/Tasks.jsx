import { useEffect, useRef, useState } from "react";
import { addDoc, collection, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from "firebase/firestore";
import Logo from "./Logo.jsx";
import { BrandName } from "./Brand.jsx";
import { Icon, StatusPill, Markdown, ago, greeting, STATUS_ICON } from "./ui.jsx";
import { askElio } from "./llm.js";
import { listen, prepareMic } from "./voice.js";
import { ApprovalCard, FilesPanel } from "./Files.jsx";

export function useTasks(fire, user) {
  const [tasks, setTasks] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const uid = user ? user.uid : null;
  useEffect(() => {
    if (!fire || !uid) return;
    const q = query(collection(fire.db, "users", uid, "tasks"), orderBy("createdAt", "desc"));
    return onSnapshot(q, (s) => { setTasks(s.docs.map((d) => ({ id: d.id, ...d.data() }))); setLoaded(true); }, (e) => setError(e.message));
  }, [uid, !!fire]);
  return { tasks, loaded, error };
}

// online / offline / unknown, from the worker's heartbeat
export function useWorker(fire, user) {
  const [state, setState] = useState("unknown");
  const uid = user ? user.uid : null;
  useEffect(() => {
    if (!fire || !uid) return;
    let last = null;
    const tick = () => { if (last) setState(Date.now() - last < 90000 ? "online" : "offline"); };
    const unsub = onSnapshot(doc(fire.db, "system", "worker"), (s) => {
      if (!s.exists()) { setState("offline"); return; }
      const t = s.data().lastSeen;
      last = t && t.toMillis ? t.toMillis() : Date.now();
      tick();
    }, () => setState("unknown"));
    const iv = setInterval(tick, 15000);
    return () => { unsub(); clearInterval(iv); };
  }, [uid, !!fire]);
  return state;
}

const FILTERS = [{ id: "all", label: "All" }, { id: "active", label: "Active" }, { id: "done", label: "Done" }];
const ACTIVE = ["queued", "planned", "build", "working"];

export function Sidebar({ tasks, loaded, selectedId, worker, onSelect, onNew, onSettings }) {
  const [filter, setFilter] = useState("all");
  const running = tasks.filter((t) => t.status === "working" || t.status === "build").length;
  const done = tasks.filter((t) => t.status === "done").length;
  const shown = tasks.filter((t) => (filter === "all" ? true : filter === "active" ? ACTIVE.includes(t.status) : t.status === "done"));
  return (
    <aside className="sidebar">
      <header className="side-head">
        <BrandName size={30} />
        <button className="icon-btn" aria-label="Settings" onClick={onSettings}><Icon name="settings" /></button>
      </header>
      <div className="side-hello">
        <h2>{greeting()}</h2>
        <p>What should Orion build today?</p>
      </div>
      <button className="newcard" onClick={onNew}>
        <span className="newcard-ic"><Icon name="plus" size={22} /></span>
        <span className="newcard-text"><strong>New task</strong><small>Describe it. Orion does the rest.</small></span>
        <Icon name="back" size={18} />
      </button>
      <div className="stats" aria-label="Summary">
        <div><b>{running}</b><span>Running</span></div>
        <div><b>{done}</b><span>Done</span></div>
        <div><b>{tasks.length}</b><span>Total</span></div>
      </div>
      {worker !== "unknown" && (
        <div className={"worker " + worker} role="status"><i className="dot" />{worker === "online" ? "Worker online" : "Worker offline"}</div>
      )}
      <div className="filters" role="tablist" aria-label="Filter tasks">
        {FILTERS.map((f) => <button key={f.id} role="tab" aria-selected={filter === f.id} className={filter === f.id ? "on" : ""} onClick={() => setFilter(f.id)}>{f.label}</button>)}
      </div>
      <ul className="tasklist">
        {!loaded && <li className="muted pad">Loading...</li>}
        {loaded && !shown.length && <li className="emptylist"><Icon name="folder" size={22} /><span>{tasks.length ? "Nothing here with this filter." : "No tasks yet. Create your first one."}</span></li>}
        {shown.map((t) => (
          <li key={t.id}>
            <button className={"task-card" + (t.id === selectedId ? " on" : "")} onClick={() => onSelect(t.id)}>
              <span className={"sic " + t.status}><Icon name={STATUS_ICON[t.status] || "chat"} size={18} /></span>
              <span className="task-main">
                <span className="task-title">{t.text}</span>
                <span className="task-meta"><StatusPill status={t.status} />{t.source === "connector" && <span className="via-tag">via {t.agent || "Claude"}</span>}<span>{ago(t.createdAt)}</span></span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}

export function EmptyMain({ onNew }) {
  return (
    <div className="empty hero">
      <div className="orb"><Logo size={56} /></div>
      <h2>Give Orion a task</h2>
      <p>Describe what you need. Orion plans it, builds it, tests it, and calls you when it has news.</p>
      <button className="btn btn-primary" onClick={onNew}><Icon name="plus" size={18} />New task</button>
    </div>
  );
}

const IDEAS = [
  { icon: "file", title: "Landing page", sub: "For a business, with sections and a contact area", text: "Build a landing page for a small bakery with a hero, a menu and a contact section" },
  { icon: "check", title: "To-do app", sub: "Clean design that saves tasks on the device", text: "Build a to-do app with a clean design that saves tasks in the browser" },
  { icon: "user", title: "Portfolio site", sub: "Show your work with a gallery and about page", text: "Build a personal portfolio website for a photographer with a gallery and an about section" },
  { icon: "bolt", title: "Calculator", sub: "Simple and fast, made for phone screens", text: "Build a simple calculator that works well on phones" },
];

export function NewTask({ fire, user, onCreated, onBack }) {
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const box = useRef(null);

  async function create() {
    const t = text.trim();
    if (!t || busy) return;
    setBusy(true);
    setError("");
    try {
      const ref = await addDoc(collection(fire.db, "users", user.uid, "tasks"), { text: t, status: "queued", createdAt: serverTimestamp() });
      await addDoc(collection(fire.db, "users", user.uid, "tasks", ref.id, "messages"), { role: "user", text: t, createdAt: serverTimestamp() });
      onCreated(ref.id);
    } catch (e) { setError(e.message); setBusy(false); }
  }
  async function dictate() {
    setError("");
    setListening(true);
    try {
      await prepareMic();
      const heard = await listen();
      if (heard) setText((cur) => (cur ? cur + " " : "") + heard);
      else setError("I did not hear anything. Try again.");
    } catch (e) { setError(e.message); }
    setListening(false);
  }

  return (
    <div className="page">
      <header className="topbar">
        <button className="icon-btn only-mobile" aria-label="Back" onClick={onBack}><Icon name="back" /></button>
        <h1 className="topbar-title">New task</h1>
      </header>
      <div className="scroll">
        <div className="content narrow">
          <div className="nt-hero">
            <div className="orb sm"><Logo size={34} /></div>
            <h2>What should Orion build?</h2>
            <p className="muted">Describe it in your own words. You can refine it in the chat afterwards.</p>
          </div>
          <div className="composer-box big">
            <label htmlFor="task" className="sr">Task</label>
            <textarea ref={box} id="task" rows="5" value={text} onChange={(e) => setText(e.target.value)} placeholder="Build a landing page for my bakery with a menu and contact section..." />
            <div className="composer-bar">
              <button className="tool" onClick={dictate} disabled={listening}><Icon name="mic" size={18} />{listening ? "Listening..." : "Speak"}</button>
              <span className="grow" />
              <button className="btn btn-primary" onClick={create} disabled={!text.trim() || busy}>{busy ? "Creating..." : "Create task"}</button>
            </div>
          </div>
          {error && <p className="error" role="alert">{error}</p>}
          <h3 className="ideas-title">Or start from an idea</h3>
          <div className="ideas">
            {IDEAS.map((i) => (
              <button key={i.title} className="idea" onClick={() => { setText(i.text); if (box.current) box.current.focus(); }}>
                <span className="sect-ic"><Icon name={i.icon} size={18} /></span>
                <span><strong>{i.title}</strong><small>{i.sub}</small></span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const EV_ICON = { start: "bolt", thought: "sparkle", file: "file", command: "activity", output: "activity", list: "eye", read: "eye", test: "check", call: "phone", approval: "alert", blocked: "alert", done: "check", error: "alert" };
const EV_LABEL = { start: "Started", thought: "Thinking", file: "File", command: "Command", output: "Output", list: "Looked at files", read: "Read a file", test: "Browser test", call: "Called you", approval: "Needs approval", blocked: "Blocked", done: "Finished", error: "Error" };

function EventRow({ e }) {
  const [open, setOpen] = useState(false);
  const long = e.text.length > 180 || e.text.split("\n").length > 4;
  const mono = e.type === "output";
  return (
    <li className={"ev ev-" + e.type}>
      <span className="ev-ic"><Icon name={EV_ICON[e.type] || "activity"} size={16} /></span>
      <div className="ev-body">
        <div className="ev-head"><b>{EV_LABEL[e.type] || e.type}</b><time>{ago(e.createdAt)}</time></div>
        {e.type === "command"
          ? <pre className="term"><span>$</span> {e.text}</pre>
          : <p className={"ev-text" + (mono ? " mono" : "") + (long && !open ? " clamp" : "")}>{e.text}</p>}
        {long && e.type !== "command" && <button className="btn-link tiny" onClick={() => setOpen(!open)}>{open ? "Show less" : "Show more"}</button>}
      </div>
    </li>
  );
}

export function TaskView({ fire, user, task, worker, onBack }) {
  const taskRef = doc(fire.db, "users", user.uid, "tasks", task.id);
  const msgsCol = collection(fire.db, "users", user.uid, "tasks", task.id, "messages");
  const [tab, setTab] = useState("chat");
  const [msgs, setMsgs] = useState([]);
  const [events, setEvents] = useState([]);
  const [files, setFiles] = useState([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [tick, setTick] = useState(0);
  const [listening, setListening] = useState(false);
  const handled = useRef(null);
  const endRef = useRef(null);
  const status = task.status;
  const working = status === "build" || status === "working";
  const viaAgent = task.source === "connector" ? (task.agent || "Claude") : null; // run by Claude or another assistant

  useEffect(() => {
    const q = query(msgsCol, orderBy("createdAt", "asc"));
    return onSnapshot(q, (s) => setMsgs(s.docs.map((d) => ({ id: d.id, ...d.data() }))), (e) => setError(e.message));
  }, [task.id]);
  useEffect(() => {
    const q = query(collection(fire.db, "users", user.uid, "tasks", task.id, "events"), orderBy("createdAt", "asc"));
    return onSnapshot(q, (s) => setEvents(s.docs.map((d) => ({ id: d.id, ...d.data() }))), () => {});
  }, [task.id]);
  useEffect(() => {
    const q = query(collection(fire.db, "users", user.uid, "tasks", task.id, "files"), orderBy("path", "asc"));
    return onSnapshot(q, (s) => setFiles(s.docs.map((d) => ({ id: d.id, ...d.data() }))), () => {});
  }, [task.id]);

  // While the worker is not building, Orion answers in chat (plans and questions).
  useEffect(() => {
    const last = msgs[msgs.length - 1];
    if (viaAgent || working || !last || last.role !== "user" || handled.current === last.id) return;
    handled.current = last.id;
    (async () => {
      setBusy(true);
      setError("");
      try {
        const r = await askElio(msgs);
        await addDoc(msgsCol, { role: "assistant", text: r.text, model: r.model || "", createdAt: serverTimestamp() });
        await updateDoc(taskRef, { status: "planned" });
      } catch (e) { setError(e.message); }
      setBusy(false);
    })();
  }, [msgs, tick, working]);

  useEffect(() => { if (endRef.current && tab === "chat") endRef.current.scrollIntoView({ behavior: "smooth", block: "end" }); }, [msgs.length, busy, tab]);

  async function send() {
    const t = text.trim();
    if (!t) return;
    setText("");
    try {
      await addDoc(msgsCol, { role: "user", text: t, createdAt: serverTimestamp() });
      if (!working && !viaAgent) await updateDoc(taskRef, { status: "queued" });
    } catch (e) { setError(e.message); }
  }
  async function dictate() {
    setError("");
    setListening(true);
    try {
      await prepareMic();
      const heard = await listen();
      if (heard) setText((cur) => (cur ? cur + " " : "") + heard);
    } catch (e) { setError(e.message); }
    setListening(false);
  }
  const build = () => updateDoc(taskRef, { status: "build" }).catch((e) => setError(e.message));
  const retry = () => { handled.current = null; setError(""); setTick(tick + 1); };
  const onKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey && window.matchMedia("(min-width: 900px)").matches) { e.preventDefault(); send(); }
  };

  const hasReply = msgs.some((m) => m.role === "assistant");
  const steps = events.filter((e) => ["thought", "file", "command", "test", "list", "read", "call"].includes(e.type)).length;
  const fileCount = events.filter((e) => e.type === "file").length;
  const tests = events.filter((e) => e.type === "test" && /Page title|No errors|Problems|not installed|failed|not found/i.test(e.text)).length;
  const calls = events.filter((e) => e.type === "call").length;

  return (
    <div className="page">
      <header className="topbar">
        <button className="icon-btn only-mobile" aria-label="Back" onClick={onBack}><Icon name="back" /></button>
        <div className="topbar-text">
          <h1 className="topbar-title">{task.text}</h1>
          <span className="topbar-sub">Created {ago(task.createdAt) || "just now"}</span>
        </div>
        <StatusPill status={status} />
      </header>
      <ApprovalCard fire={fire} user={user} task={task} />
      <nav className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === "chat"} className={tab === "chat" ? "on" : ""} onClick={() => setTab("chat")}><Icon name="chat" size={16} />Chat</button>
        <button role="tab" aria-selected={tab === "activity"} className={tab === "activity" ? "on" : ""} onClick={() => setTab("activity")}><Icon name="activity" size={16} />Activity{working && <i className="dot live" />}</button>
        <button role="tab" aria-selected={tab === "files"} className={tab === "files" ? "on" : ""} onClick={() => setTab("files")}><Icon name="folder" size={16} />Files{files.length > 0 && <span className="count">{files.length}</span>}</button>
      </nav>

      {tab === "chat" && (
        <>
          <div className="scroll">
            <div className="content chat">
              {msgs.map((m) => (
                m.role === "assistant" ? (
                  <div key={m.id} className="msg assistant">
                    <span className="avatar"><Logo size={18} /></span>
                    <div className="msg-body"><div className="who">{m.via === "connector" ? (m.agent || viaAgent || "Claude") : "Orion"}{m.via === "call" && <span className="via"><Icon name="phone" size={11} />Call</span>}</div><Markdown text={m.text} /></div>
                  </div>
                ) : (
                  <div key={m.id} className="msg user">
                    <div className="user-bubble">{m.via === "call" && <span className="via"><Icon name="phone" size={11} />Call</span>}<p>{m.text}</p></div>
                  </div>
                )
              ))}
              {busy && <div className="msg assistant"><span className="avatar"><Logo size={18} /></span><div className="msg-body"><div className="typing" aria-label="Orion is thinking"><i /><i /><i /></div></div></div>}
              {error && <p className="error" role="alert">{error} <button className="btn-link" onClick={retry}>Retry</button></p>}

              {status === "build" && (
                <div className="banner"><span className="sect-ic"><Icon name="clock" /></span><div><strong>Waiting for the worker</strong><p>{worker === "offline" ? "The worker is offline. Open your Codespace and run npm start in the worker folder." : "The worker will start in a moment."}</p></div></div>
              )}
              {status === "working" && (
                <div className="banner live"><span className="sect-ic live"><Icon name="bolt" /></span><div><strong>{viaAgent || "Orion"} is working</strong><p>{viaAgent ? "Progress shows in the Activity tab. Notes you leave here are read by " + viaAgent + " the next time you chat with it." : "Watch the Activity tab. You can send new instructions any time."}</p></div><button className="btn sm" onClick={() => setTab("activity")}>Watch</button></div>
              )}
              {status === "done" && (
                <div className="banner ok"><span className="sect-ic ok"><Icon name="check" /></span><div><strong>Finished</strong><p>Preview or download the project in the Files tab.</p></div><button className="btn sm" onClick={() => setTab("files")}>View files</button></div>
              )}
              {status === "failed" && (
                <div className="banner bad"><span className="sect-ic warn"><Icon name="alert" /></span><div><strong>{viaAgent || "Orion"} stopped before finishing</strong><p>{viaAgent ? "Leave a note here, then ask " + viaAgent + " to continue." : "Send a message with more detail, then press Try again."}</p></div></div>
              )}
              {!working && !viaAgent && hasReply && !busy && (
                <div className="cta">
                  <button className="btn btn-primary" onClick={build}><Icon name="bolt" size={18} />{status === "done" ? "Build again" : status === "failed" ? "Try again" : "Start building"}</button>
                  {worker === "offline" && <p className="hint">The worker is offline, so building will wait until you start it.</p>}
                </div>
              )}
              {viaAgent && <p className="hint center">This task is run by {viaAgent}. Orion shows the progress, saves the files and calls you.</p>}
              <div ref={endRef} />
            </div>
          </div>
          <div className="composer">
            <div className="composer-box">
              <textarea rows={Math.min(5, Math.max(1, text.split("\n").length))} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={onKey} placeholder={viaAgent ? "Leave a note for " + viaAgent + "..." : "Message Orion..."} aria-label="Message" />
              <div className="composer-bar">
                <button className="tool icon" aria-label="Dictate" onClick={dictate} disabled={listening}><Icon name="mic" size={18} /></button>
                <span className="grow" />
                <button className="send" aria-label="Send" onClick={send} disabled={!text.trim()}><Icon name="send" size={18} /></button>
              </div>
            </div>
          </div>
        </>
      )}

      {tab === "activity" && (
        <div className="scroll">
          <div className="content">
            {!events.length ? (
              <div className="empty small"><span className="sect-ic"><Icon name="activity" /></span><p>Nothing yet. Press Start building and every step shows up here live.</p></div>
            ) : (
              <>
                <div className="sumchips" aria-label="Summary">
                  <span><b>{steps}</b> {steps === 1 ? "step" : "steps"}</span><span><b>{fileCount}</b> {fileCount === 1 ? "file" : "files"}</span><span><b>{tests}</b> {tests === 1 ? "test" : "tests"}</span><span><b>{calls}</b> {calls === 1 ? "call" : "calls"}</span>
                </div>
                <ul className="timeline" aria-label="Progress">{events.map((e) => <EventRow key={e.id} e={e} />)}</ul>
              </>
            )}
          </div>
        </div>
      )}

      {tab === "files" && (
        <div className="scroll"><div className="content"><FilesPanel files={files} /></div></div>
      )}
    </div>
  );
}
