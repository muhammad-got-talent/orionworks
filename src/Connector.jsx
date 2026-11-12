import { useState } from "react";
import { Icon } from "./ui.jsx";
import { isNative } from "./native.js";

// Shows how to connect Claude (or ChatGPT) to this Orion Works site, and checks that the connector is online.
export default function ConnectorCard() {
  const [status, setStatus] = useState(null);
  const [copied, setCopied] = useState(false);

  if (isNative) {
    return <p className="hint">Connectors are set up on the website. Open Orion Works in your browser, then go to Settings, Connectors.</p>;
  }
  const base = window.location.origin;
  const url = base + "/mcp?key=YOUR_TOKEN";

  async function check() {
    setStatus({ tone: "", text: "Checking..." });
    try {
      const r = await fetch(base + "/mcp", { headers: { Accept: "application/json" } });
      let j = null;
      try { j = await r.json(); } catch { /* not JSON */ }
      if (r.ok && j && j.name === "orion-works") {
        setStatus(j.configured
          ? { tone: "ok", text: "The connector is online and configured. Add the address above to Claude." }
          : { tone: "err", text: "The connector is online but not configured. Add FIREBASE_SERVICE_ACCOUNT, ORION_MCP_TOKEN and ORION_OWNER_EMAIL in Vercel, then redeploy." });
      } else {
        setStatus({ tone: "err", text: "No connector found at this address. Make sure the api folder is on GitHub and Vercel has redeployed. (This is normal when running locally.)" });
      }
    } catch { setStatus({ tone: "err", text: "Could not reach the connector." }); }
  }
  async function copy() {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ }
  }

  return (
    <div className="stack">
      <p className="hint">Claude does the work in your own Claude account. Orion shows the progress, saves the files, and rings your phone when it is done. Full steps are in CONNECTOR.md.</p>
      <div>
        <label>Connector address</label>
        <div className="urlbox"><code>{url}</code><button className="btn sm" onClick={copy}><Icon name={copied ? "check" : "copy"} size={14} />{copied ? "Copied" : "Copy"}</button></div>
        <p className="hint">Replace YOUR_TOKEN with the ORION_MCP_TOKEN you set in Vercel. Keep this address private.</p>
      </div>
      <div className="btn-row"><button className="btn" onClick={check}><Icon name="check" size={18} />Check connector</button></div>
      {status && <p className={"notice " + status.tone} role="status">{status.text}</p>}
    </div>
  );
}
