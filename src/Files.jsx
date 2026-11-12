import { useEffect, useState } from "react";
import { collection, onSnapshot, query, updateDoc, where, doc } from "firebase/firestore";
import { Icon } from "./ui.jsx";
import { isNative } from "./native.js";

export function ApprovalCard({ fire, user, task }) {
  const [items, setItems] = useState([]);
  useEffect(() => {
    const q = query(collection(fire.db, "users", user.uid, "tasks", task.id, "approvals"), where("status", "==", "pending"));
    return onSnapshot(q, (s) => setItems(s.docs.map((d) => ({ id: d.id, ...d.data() }))), () => {});
  }, [task.id]);
  const answer = (id, status) => updateDoc(doc(fire.db, "users", user.uid, "tasks", task.id, "approvals", id), { status });
  if (!items.length) return null;
  return (
    <section className="approval" aria-live="assertive">
      {items.map((a) => (
        <div key={a.id}>
          <div className="approval-head"><span className="sect-ic warn"><Icon name="alert" /></span><div><strong>Orion needs your approval</strong><p className="hint">This command is risky ({a.reason}). Allow it?</p></div></div>
          <pre className="term"><span>$</span> {a.command}</pre>
          <div className="row-actions">
            <button className="btn" onClick={() => answer(a.id, "denied")}>Deny</button>
            <button className="btn btn-primary" onClick={() => answer(a.id, "approved")}>Approve</button>
          </div>
        </div>
      ))}
    </section>
  );
}

function buildPreview(files) {
  const by = Object.fromEntries(files.map((f) => [f.path, f]));
  const clean = (p) => p.replace(/^\.\//, "");
  let html = (by["index.html"] && by["index.html"].content) || "";
  html = html.replace(/<link[^>]+href=["']([^"']+\.css)["'][^>]*>/gi, (m, href) => (by[clean(href)] ? "<style>" + by[clean(href)].content + "</style>" : m));
  html = html.replace(/<script([^>]*?)\ssrc=["']([^"']+\.js)["']([^>]*)><\/script>/gi, (m, a, src, b) => (by[clean(src)] ? "<script" + a + b + ">" + by[clean(src)].content + "<\/script>" : m));
  html = html.replace(/(src|href)=["']([^"':#]+\.(?:png|jpe?g|gif|webp|svg))["']/gi, (m, attr, p) => {
    const f = by[clean(p)];
    if (!f) return m;
    const url = f.binary ? f.dataUrl : "data:image/svg+xml;utf8," + encodeURIComponent(f.content);
    return attr + '="' + url + '"';
  });
  return html;
}

export function FilesPanel({ files }) {
  const hasIndex = files.some((f) => f.path === "index.html");
  const [mode, setMode] = useState(hasIndex ? "preview" : "code");
  const [device, setDevice] = useState("mobile");
  const [open, setOpen] = useState(null);
  const [msg, setMsg] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open && files.length) setOpen((files.find((f) => f.path === "index.html") || files[0]).path);
    if (hasIndex && mode === "code" && !open) setMode("preview");
  }, [files.length]);

  async function download() {
    setMsg("");
    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      for (const f of files) {
        if (f.binary) zip.file(f.path, f.dataUrl.split(",")[1], { base64: true });
        else zip.file(f.path, f.content);
      }
      const name = "orion-project.zip";
      if (isNative) {
        const b64 = await zip.generateAsync({ type: "base64" });
        const { Filesystem, Directory } = await import("@capacitor/filesystem");
        const { Share } = await import("@capacitor/share");
        await Filesystem.writeFile({ path: name, data: b64, directory: Directory.Cache });
        const { uri } = await Filesystem.getUri({ path: name, directory: Directory.Cache });
        await Share.share({ title: "Orion project", url: uri });
      } else {
        const blob = await zip.generateAsync({ type: "blob" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = name;
        a.click();
        URL.revokeObjectURL(a.href);
      }
    } catch (e) { setMsg("Download failed: " + e.message); }
  }
  async function copy(text) {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }
    catch { setMsg("Could not copy. Select the text and copy it by hand."); }
  }

  if (!files.length) {
    return <div className="empty small"><span className="sect-ic"><Icon name="folder" /></span><p>No files yet. Files Orion writes show up here, ready to preview and download.</p></div>;
  }
  const current = files.find((f) => f.path === open) || files[0];
  const titleMatch = hasIndex && /<title>([^<]*)<\/title>/i.exec(files.find((f) => f.path === "index.html").content || "");
  const pageTitle = (titleMatch && titleMatch[1]) || "index.html";
  return (
    <div className="stack">
      <div className="fbar">
        <div className="seg compact" role="tablist" aria-label="View">
          <button role="tab" aria-selected={mode === "preview"} className={mode === "preview" ? "on" : ""} disabled={!hasIndex} onClick={() => setMode("preview")}><Icon name="eye" size={16} />Preview</button>
          <button role="tab" aria-selected={mode === "code"} className={mode === "code" ? "on" : ""} onClick={() => setMode("code")}><Icon name="code" size={16} />Code</button>
        </div>
        {mode === "preview" && (
          <div className="seg compact" role="group" aria-label="Device">
            <button aria-label="Phone size" aria-pressed={device === "mobile"} className={device === "mobile" ? "on" : ""} onClick={() => setDevice("mobile")}><Icon name="smartphone" size={16} /></button>
            <button aria-label="Desktop size" aria-pressed={device === "desktop"} className={device === "desktop" ? "on" : ""} onClick={() => setDevice("desktop")}><Icon name="monitor" size={16} /></button>
          </div>
        )}
        <span className="grow" />
        <button className="btn sm" onClick={download}><Icon name="download" size={16} />Download</button>
      </div>
      {msg && <p className="error" role="alert">{msg}</p>}

      {mode === "preview" && hasIndex && (
        <div className={"frame " + device}>
          <div className="frame-bar"><i /><i /><i /><span>{pageTitle}</span></div>
          <iframe className="preview" title="Website preview" sandbox="allow-scripts" srcDoc={buildPreview(files)} />
        </div>
      )}

      {mode === "code" && (
        <div className="codeview">
          <div className="filetabs" role="tablist" aria-label="Files">
            {files.map((f) => (
              <button key={f.id} role="tab" aria-selected={current.path === f.path} className={"filetab" + (current.path === f.path ? " on" : "")} onClick={() => setOpen(f.path)}><Icon name="file" size={14} />{f.path}</button>
            ))}
          </div>
          <div className="codehead">
            <span>{current.path}</span>
            {!current.binary && <button className="btn sm" onClick={() => copy(current.content)}><Icon name={copied ? "check" : "copy"} size={14} />{copied ? "Copied" : "Copy"}</button>}
          </div>
          {current.binary ? <img className="shot" alt={current.path} src={current.dataUrl} /> : <pre className="code tall flat">{current.content}</pre>}
        </div>
      )}
    </div>
  );
}
