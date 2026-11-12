import { useEffect, useMemo, useRef, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import Logo from "./Logo.jsx";
import Setup from "./Setup.jsx";
import Login from "./Auth.jsx";
import Settings, { syncAiSettings } from "./Settings.jsx";
import { Sidebar, EmptyMain, NewTask, TaskView, useTasks, useWorker } from "./Tasks.jsx";
import { IncomingCall, CallScreen } from "./Call.jsx";
import { getFirebase, loadConfig, clearConfig } from "./firebase.js";
import { isNative, refreshToken, onCallEvent } from "./native.js";

const isConfigured = () => { const c = loadConfig(); return !!(c && c.firebase); };

// Watches for calls from Orion (works on the website and in the Android app).
function useCalls(fire, user) {
  const [call, setCall] = useState(null);
  const wantAccept = useRef(null);
  const uid = user ? user.uid : null;
  useEffect(() => {
    if (!fire || !uid) return;
    const q = query(collection(fire.db, "users", uid, "calls"), where("status", "==", "ringing"));
    return onSnapshot(q, (s) => {
      const fresh = s.docs.map((d) => ({ id: d.id, ...d.data() })).filter((c) => !c.createdAt || Date.now() - c.createdAt.toMillis() < 60000);
      setCall((cur) => {
        if (cur) return !cur.accepted && !cur.local && !fresh.some((c) => c.id === cur.id) ? null : cur;
        return fresh[0] ? { ...fresh[0], accepted: wantAccept.current === fresh[0].id } : null;
      });
    }, () => {});
  }, [uid, !!fire]);
  useEffect(() => {
    if (!isNative) return;
    let handle = null;
    onCallEvent((ev) => {
      if (ev.callId === "test") {
        setCall({ id: "test", local: true, reason: "test", taskId: null, message: "This is a test call. Calls from Orion will ring just like this.", accepted: ev.action === "accept" });
        return;
      }
      if (ev.action === "accept") {
        wantAccept.current = ev.callId;
        setCall((cur) => (cur && cur.id === ev.callId ? { ...cur, accepted: true } : cur));
      }
    }).then((h) => { handle = h; });
    return () => { if (handle) handle.remove(); };
  }, []);
  return [call, setCall];
}

function Splash() {
  return <main className="splash" aria-busy="true"><Logo size={64} /></main>;
}

export default function App() {
  const [configured, setConfigured] = useState(isConfigured());
  const [user, setUser] = useState(undefined);
  const [view, setView] = useState({ name: "home" });
  const fire = useMemo(() => (configured ? getFirebase() : null), [configured]);
  const [call, setCall] = useCalls(fire, user);
  const { tasks, loaded } = useTasks(fire, user);
  const worker = useWorker(fire, user);

  useEffect(() => {
    if (!fire) return;
    return onAuthStateChanged(fire.auth, (u) => setUser(u || null));
  }, [fire]);
  useEffect(() => {
    if (!fire || !user) return;
    syncAiSettings(fire, user);
    if (isNative) refreshToken(fire, user).catch(() => {});
  }, [user && user.uid]);

  const resetSetup = () => { clearConfig(); setUser(undefined); setView({ name: "home" }); setConfigured(false); };

  if (!fire) return <Setup onDone={() => setConfigured(true)} />;
  if (user === undefined) return <Splash />;
  if (!user) return <Login fire={fire} onReset={resetSetup} />;

  const selected = view.name === "task" ? tasks.find((t) => t.id === view.id) : null;
  const go = (v) => setView(v);
  return (
    <>
      <div className="app" data-view={view.name}>
        <Sidebar
          tasks={tasks} loaded={loaded} worker={worker} selectedId={view.name === "task" ? view.id : null}
          onSelect={(id) => go({ name: "task", id })} onNew={() => go({ name: "new" })} onSettings={() => go({ name: "settings" })}
        />
        <section className="main">
          {view.name === "home" && <EmptyMain onNew={() => go({ name: "new" })} />}
          {view.name === "new" && <NewTask fire={fire} user={user} onCreated={(id) => go({ name: "task", id })} onBack={() => go({ name: "home" })} />}
          {view.name === "task" && selected && <TaskView key={selected.id} fire={fire} user={user} task={selected} worker={worker} onBack={() => go({ name: "home" })} />}
          {view.name === "task" && !selected && <div className="empty"><p className="muted">{loaded ? "This task was not found." : "Loading..."}</p></div>}
          {view.name === "settings" && <Settings fire={fire} user={user} onBack={() => go({ name: "home" })} onReset={resetSetup} />}
        </section>
      </div>
      {call && (
        <div className="overlay">
          {call.accepted
            ? <CallScreen fire={fire} user={user} call={call} onEnd={() => setCall(null)} />
            : <IncomingCall fire={fire} user={user} call={call} onAnswer={() => setCall({ ...call, accepted: true })} onClose={() => setCall(null)} />}
        </div>
      )}
    </>
  );
}
