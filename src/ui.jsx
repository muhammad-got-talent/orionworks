import { useEffect, useState } from "react";

const ICONS = {
  plus: "M12 5v14M5 12h14",
  back: "M15 18l-6-6 6-6",
  settings: "M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6",
  send: "M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z",
  mic: "M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3zM19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8",
  phone: "M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z",
  file: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6",
  check: "M20 6L9 17l-5-5",
  x: "M18 6L6 18M6 6l12 12",
  play: "M5 3l14 9-14 9V3z",
  download: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3",
  chat: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z",
  activity: "M22 12h-4l-3 9L9 3l-3 9H2",
  folder: "M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z",
  eye: "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  alert: "M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z",
  logout: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9",
  bolt: "M13 2L3 14h9l-1 8 10-12h-9l1-8z",
  key: "M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4",
  volume: "M11 5L6 9H2v6h4l5 4V5zM19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07",
  micoff: "M1 1l22 22M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6M17 16.95A7 7 0 0 1 5 12v-2M19 10v2a7 7 0 0 1-.11 1.23M12 19v4M8 23h8",
  replay: "M1 4v6h6M3.51 15a9 9 0 1 0 2.13-9.36L1 10",
  keyboard: "M2 5h20v14H2zM6 9h.01M10 9h.01M14 9h.01M18 9h.01M7 15h10",
  clock: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2",
  code: "M16 18l6-6-6-6M8 6l-6 6 6 6",
  smartphone: "M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zM12 18h.01",
  monitor: "M2 3h20v14H2zM8 21h8M12 17v4",
  copy: "M9 9h11v11H9zM5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1",
  user: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  sparkle: "M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3zM19 17l.9 2.1L22 20l-2.1.9L19 23l-.9-2.1L16 20l2.1-.9L19 17z",
};

export function Icon({ name, size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[name] || ""} />
    </svg>
  );
}

const STATUS = {
  queued: ["Draft", "gray"],
  planned: ["Planned", "teal"],
  build: ["Waiting for worker", "amber"],
  working: ["Working", "live"],
  done: ["Done", "green"],
  failed: ["Failed", "red"],
};
export function StatusPill({ status }) {
  const [label, tone] = STATUS[status] || ["New", "gray"];
  return <span className={"pill " + tone}>{tone === "live" && <i className="dot" />}{label}</span>;
}

export function ago(ts) {
  if (!ts || !ts.toMillis) return "";
  const s = Math.max(0, (Date.now() - ts.toMillis()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return Math.floor(s / 60) + " min ago";
  if (s < 86400) return Math.floor(s / 3600) + " h ago";
  return Math.floor(s / 86400) + " d ago";
}

export function useMedia(query) {
  const [match, setMatch] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setMatch(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [query]);
  return match;
}

// A small, safe markdown renderer (no raw HTML is ever inserted).
function inline(text) {
  return String(text).split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) return <code key={i}>{part.slice(1, -1)}</code>;
    return part;
  });
}
const UL = /^\s*[-*]\s+/;
const OL = /^\s*\d+[.)]\s+/;
export function Markdown({ text }) {
  const lines = String(text || "").split("\n");
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (l.startsWith("```")) {
      const buf = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) { buf.push(lines[i]); i++; }
      i++;
      out.push(<pre className="code" key={out.length}>{buf.join("\n")}</pre>);
    } else if (UL.test(l)) {
      const items = [];
      while (i < lines.length && UL.test(lines[i])) { items.push(lines[i].replace(UL, "")); i++; }
      out.push(<ul key={out.length}>{items.map((t, k) => <li key={k}>{inline(t)}</li>)}</ul>);
    } else if (OL.test(l)) {
      const items = [];
      while (i < lines.length && OL.test(lines[i])) { items.push(lines[i].replace(OL, "")); i++; }
      out.push(<ol key={out.length}>{items.map((t, k) => <li key={k}>{inline(t)}</li>)}</ol>);
    } else if (/^#{1,4}\s+/.test(l)) {
      out.push(<p className="md-h" key={out.length}>{inline(l.replace(/^#{1,4}\s+/, ""))}</p>);
      i++;
    } else if (!l.trim()) {
      i++;
    } else {
      const buf = [l];
      i++;
      while (i < lines.length && lines[i].trim() && !UL.test(lines[i]) && !OL.test(lines[i]) && !/^(#{1,4}\s|```)/.test(lines[i])) { buf.push(lines[i]); i++; }
      out.push(<p key={out.length}>{inline(buf.join(" "))}</p>);
    }
  }
  return <div className="md">{out}</div>;
}

export function Segmented({ label, options, value, onChange }) {
  return (
    <div className="seg" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.id} type="button" role="radio" aria-checked={value === o.id} className={value === o.id ? "on" : ""} onClick={() => onChange(o.id)}>{o.label}</button>
      ))}
    </div>
  );
}

export function friendlyAuthError(e) {
  const code = (e && e.code) || "";
  if (code.includes("invalid-credential") || code.includes("wrong-password") || code.includes("user-not-found")) return "Wrong email or password.";
  if (code.includes("email-already-in-use")) return "This email already has an account. Try Sign in.";
  if (code.includes("weak-password")) return "Use a password with at least 6 characters.";
  if (code.includes("invalid-email")) return "That email address does not look right.";
  if (code.includes("unauthorized-domain")) return "This website address is not allowed yet. In Firebase, open Authentication, Settings, Authorized domains and add this site's address.";
  if (code.includes("operation-not-allowed")) return "Email sign-in is off. In Firebase, open Authentication, Sign-in method and turn on Email/Password.";
  if (code.includes("network-request-failed")) return "No internet connection.";
  return (e && e.message) || "Something went wrong.";
}

export const STATUS_ICON = { done: "check", failed: "alert", working: "bolt", build: "clock", planned: "chat", queued: "chat" };

export function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}
export function mmss(s) {
  return String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");
}

// Big selectable cards (used for the AI provider and the voice engine).
export function ChoiceCards({ label, value, options, onChange }) {
  return (
    <div className="choices" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.id} type="button" role="radio" aria-checked={value === o.id} className={"choice" + (value === o.id ? " on" : "")} onClick={() => onChange(o.id)}>
          <span className="radio" aria-hidden="true" />
          <span className="choice-body">
            <span className="choice-title">{o.title}{o.tag && <span className="tag">{o.tag}</span>}</span>
            <span className="choice-desc">{o.desc}</span>
          </span>
        </button>
      ))}
    </div>
  );
}
