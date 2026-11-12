import crypto from "node:crypto";
import { TOOLS, runTool } from "./_tools.js";

const VERSION = "1.2.0";
const INSTRUCTIONS =
  "Orion Works is the user's personal dashboard and phone. When you start real work, call create_task. Use post_update for progress, " +
  "save_files to attach finished files, and call_me only when you are finished or blocked. " +
  "Call get_instructions at the start of a conversation and whenever the user mentions a call or a note they left.";

const ok = (id, result) => ({ jsonrpc: "2.0", id, result });
const fail = (id, code, message) => ({ jsonrpc: "2.0", id, error: { code, message } });

function safeEqual(a, b) {
  const x = crypto.createHash("sha256").update(String(a)).digest();
  const y = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(x, y);
}

function tokenFrom(req) {
  const h = (req.headers && (req.headers.authorization || req.headers.Authorization)) || "";
  const m = /^Bearer\s+(.+)$/i.exec(h);
  if (m) return m[1].trim();
  if (req.query && typeof req.query.key === "string") return req.query.key;
  try { return new URL(req.url, "http://x").searchParams.get("key") || ""; } catch { return ""; }
}

async function handleMessage(msg, getDeps) {
  if (!msg || typeof msg !== "object" || typeof msg.method !== "string") return fail(msg && msg.id !== undefined ? msg.id : null, -32600, "Invalid request");
  const { id, method, params } = msg;
  if (id === undefined) return null; // notifications get no reply
  switch (method) {
    case "initialize":
      return ok(id, {
        protocolVersion: (params && params.protocolVersion) || "2025-06-18",
        capabilities: { tools: {} },
        serverInfo: { name: "orion-works", version: VERSION },
        instructions: INSTRUCTIONS,
      });
    case "ping":
      return ok(id, {});
    case "tools/list":
      return ok(id, { tools: TOOLS });
    case "tools/call": {
      const name = params && params.name;
      if (!TOOLS.some((t) => t.name === name)) return fail(id, -32602, "Unknown tool: " + name);
      try {
        const deps = await getDeps();
        const result = await runTool(deps, name, (params && params.arguments) || {});
        return ok(id, { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] });
      } catch (e) {
        return ok(id, { isError: true, content: [{ type: "text", text: String(e && e.message ? e.message : e) }] });
      }
    }
    default:
      return fail(id, -32601, "Method not found: " + method);
  }
}

export function createHandler({ getDeps, env = process.env }) {
  return async function handler(req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "authorization, content-type, mcp-protocol-version, mcp-session-id");
    res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
    if (req.method === "OPTIONS") return res.status(204).end();

    if (req.method === "GET") {
      if (String((req.headers && req.headers.accept) || "").includes("text/event-stream")) {
        res.setHeader("Allow", "POST");
        return res.status(405).json({ error: "This server answers POST requests only." });
      }
      return res.status(200).json({
        name: "orion-works",
        version: VERSION,
        status: "online",
        configured: Boolean(env.ORION_MCP_TOKEN && env.FIREBASE_SERVICE_ACCOUNT && (env.ORION_OWNER_EMAIL || env.ORION_OWNER_UID)),
        hint: "Add this address as a custom connector in Claude, with ?key=YOUR_TOKEN at the end.",
      });
    }
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST, GET, OPTIONS");
      return res.status(405).json({ error: "Method not allowed" });
    }

    const expected = env.ORION_MCP_TOKEN;
    if (!expected) return res.status(500).json(fail(null, -32000, "Server is not configured: add ORION_MCP_TOKEN in your Vercel environment variables, then redeploy."));
    if (!safeEqual(tokenFrom(req), expected)) return res.status(401).json(fail(null, -32001, "Unauthorized: the token is missing or wrong."));

    let body = req.body;
    if (typeof body === "string") { try { body = JSON.parse(body); } catch { return res.status(400).json(fail(null, -32700, "Parse error")); } }
    if (body === undefined || body === null) return res.status(400).json(fail(null, -32700, "Empty request"));

    const batch = Array.isArray(body);
    const replies = (await Promise.all((batch ? body : [body]).map((m) => handleMessage(m, getDeps)))).filter(Boolean);
    if (!replies.length) return res.status(202).end();
    return res.status(200).json(batch ? replies : replies[0]);
  };
}
