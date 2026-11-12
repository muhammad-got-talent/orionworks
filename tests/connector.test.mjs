// Run with: npm test
// Tests the connector with a small in-memory fake of Firestore, so no Firebase is needed.
import { createHandler } from "../api/_server.js";

let clock = 0;
const ts = () => Date.now() + ++clock;

class FakeDB {
  constructor() { this.data = new Map(); this.n = 0; }
  collection(p) { return new Col(this, p); }
  doc(p) { return new Doc(this, p); }
}
class Doc {
  constructor(db, path) { this.db = db; this.path = path; this.id = path.split("/").pop(); }
  collection(n) { return new Col(this.db, this.path + "/" + n); }
  async get() { const d = this.db.data.get(this.path); return { id: this.id, exists: d !== undefined, data: () => (d ? { ...d } : undefined), ref: this }; }
  async set(v) { this.db.data.set(this.path, { ...v }); }
  async update(p) { const d = this.db.data.get(this.path); if (!d) throw new Error("no such doc"); this.db.data.set(this.path, { ...d, ...p }); }
}
class Col {
  constructor(db, path) { this.db = db; this.path = path; }
  doc(id) { return new Doc(this.db, this.path + "/" + (id || "auto" + ++this.db.n + "x" + Math.floor(Math.random() * 1e6))); }
  async add(v) { const r = this.doc(); await r.set(v); return r; }
  orderBy(f, dir = "asc") { return new Query(this, f, dir); }
  async get() { return new Query(this).get(); }
}
class Query {
  constructor(col, f, dir = "asc", n) { this.col = col; this.f = f; this.dir = dir; this.n = n; }
  limit(n) { this.n = n; return this; }
  async get() {
    const prefix = this.col.path + "/";
    let docs = [...this.col.db.data.entries()]
      .filter(([p]) => p.startsWith(prefix) && !p.slice(prefix.length).includes("/"))
      .map(([p, d]) => ({ id: p.slice(prefix.length), data: () => ({ ...d }), ref: this.col.db.doc(p), exists: true, _d: d }));
    if (this.f) docs.sort((a, b) => ((a._d[this.f] || 0) - (b._d[this.f] || 0)) * (this.dir === "desc" ? -1 : 1));
    if (this.n) docs = docs.slice(0, this.n);
    return { docs, empty: !docs.length };
  }
}

const db = new FakeDB();
const sent = [];
const deps = { db, uid: "u1", ts, messaging: { sendEachForMulticast: async (m) => { sent.push(m); return { successCount: m.tokens.length }; } } };
const env = { ORION_MCP_TOKEN: "secret-token-123", FIREBASE_SERVICE_ACCOUNT: "{}", ORION_OWNER_EMAIL: "a@b.c" };
const handler = createHandler({ getDeps: async () => deps, env });

let failed = 0;
const check = (name, cond) => { if (!cond) failed++; console.log((cond ? "PASS " : "FAIL ") + name); };

async function call(body, { method = "POST", headers = {}, query = {}, url = "/mcp" } = {}) {
  const res = { code: 200, body: undefined, headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; }, end() { return this; } };
  await handler({ method, headers, query, url, body }, res);
  return res;
}
const auth = { authorization: "Bearer secret-token-123" };
let id = 0;
const rpc = (method, params) => call({ jsonrpc: "2.0", id: ++id, method, params }, { headers: auth });
const tool = async (name, args) => { const r = await rpc("tools/call", { name, arguments: args }); const t = r.body.result.content[0].text; let v; try { v = JSON.parse(t); } catch { v = t; } return { err: !!r.body.result.isError, v }; };

// --- protocol and auth ---
let r = await rpc("initialize", { protocolVersion: "2025-03-26" });
check("initialize echoes protocol and names server", r.body.result.protocolVersion === "2025-03-26" && r.body.result.serverInfo.name === "orion-works" && !!r.body.result.instructions);
r = await rpc("tools/list");
check("tools/list returns 7 tools", r.body.result.tools.length === 7 && r.body.result.tools.every((t) => t.inputSchema.type === "object"));
r = await call({ jsonrpc: "2.0", id: 9, method: "ping" });
check("no token is rejected with 401", r.code === 401);
r = await call({ jsonrpc: "2.0", id: 9, method: "ping" }, { headers: { authorization: "Bearer nope" } });
check("wrong token is rejected", r.code === 401);
r = await call({ jsonrpc: "2.0", id: 9, method: "ping" }, { query: { key: "secret-token-123" } });
check("token in ?key= works", r.code === 200 && r.body.result);
r = await call({ jsonrpc: "2.0", id: 9, method: "ping" }, { url: "/mcp?key=secret-token-123" });
check("token read from the URL when query is missing", r.code === 200);
r = await call({ jsonrpc: "2.0", method: "notifications/initialized" }, { headers: auth });
check("notification gets 202 and no body", r.code === 202 && r.body === undefined);
r = await rpc("nothing/here");
check("unknown method gives -32601", r.body.error && r.body.error.code === -32601);
r = await call(undefined, { method: "GET" });
check("GET shows a status page", r.code === 200 && r.body.status === "online" && r.body.configured === true && !JSON.stringify(r.body).includes("secret-token"));
r = await call(undefined, { method: "GET", headers: { accept: "text/event-stream" } });
check("GET for event stream is 405", r.code === 405);
const noEnv = createHandler({ getDeps: async () => deps, env: {} });
const res0 = { code: 0, setHeader() {}, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; }, end() {} };
await noEnv({ method: "POST", headers: auth, body: { jsonrpc: "2.0", id: 1, method: "ping" } }, res0);
check("missing ORION_MCP_TOKEN gives a clear 500", res0.code === 500 && /ORION_MCP_TOKEN/.test(res0.body.error.message));
r = await call([{ jsonrpc: "2.0", id: 1, method: "ping" }, { jsonrpc: "2.0", id: 2, method: "tools/list" }], { headers: auth });
check("batch requests work", Array.isArray(r.body) && r.body.length === 2);

// --- tools ---
let t = await tool("create_task", { title: "Bakery site", details: "Warm colors", agent: "Claude" });
const taskId = t.v.task_id;
const taskDoc = db.data.get("users/u1/tasks/" + taskId);
check("create_task makes a connector task", !t.err && taskDoc.source === "connector" && taskDoc.status === "working" && taskDoc.agent === "Claude");
check("create_task stores the request as a read message", [...db.data.entries()].some(([p, d]) => p.includes(taskId + "/messages/") && d.readByAgent === true && d.text.includes("Warm colors")));

t = await tool("create_task", {});
check("create_task needs a title", t.err && /title/.test(t.v));

t = await tool("post_update", { task_id: taskId, message: "Wrote the header" });
const evCount = () => [...db.data.keys()].filter((p) => p.includes(taskId + "/events/")).length;
const msgCount = () => [...db.data.keys()].filter((p) => p.includes(taskId + "/messages/")).length;
check("progress update adds an event but no chat message", !t.err && evCount() === 2 && msgCount() === 1);
t = await tool("post_update", { task_id: taskId, message: "All done. The page is ready.", status: "done" });
check("done update adds a chat message and sets status", !t.err && msgCount() === 2 && db.data.get("users/u1/tasks/" + taskId).status === "done");
t = await tool("post_update", { task_id: taskId, message: "x", status: "weird" });
check("bad status is rejected", t.err);
t = await tool("post_update", { task_id: "not valid!", message: "x" });
check("bad task id is rejected", t.err);

// a worker-run task must be protected
db.data.set("users/u1/tasks/workertask1", { text: "Worker job", status: "working", createdAt: ts() });
t = await tool("post_update", { task_id: "workertask1", message: "hijack" });
check("cannot change a worker-run task", t.err && /worker/.test(t.v));

t = await tool("save_files", { task_id: taskId, files: [
  { path: "index.html", content: "<h1>Hi</h1>" },
  { path: "css/style.css", content: "body{}" },
  { path: "../evil.js", content: "x" },
  { path: "/abs.html", content: "x" },
  { path: "run.exe", content: "x" },
  { path: "logo.png", content: "iVBORw0KGgo=", encoding: "base64" },
  { path: "note.txt", content: "x".repeat(400001) },
] });
check("save_files saves good files and skips bad ones", t.v.saved.join() === "index.html,css/style.css,logo.png" && t.v.skipped.length === 4);
const f1 = db.data.get("users/u1/tasks/" + taskId + "/files/" + encodeURIComponent("css/style.css"));
const f2 = db.data.get("users/u1/tasks/" + taskId + "/files/logo.png");
check("files use the app's document format", f1.path === "css/style.css" && f1.binary === false && f2.binary === true && f2.dataUrl.startsWith("data:image/png;base64,"));
t = await tool("save_files", { task_id: taskId, files: Array.from({ length: 41 }, (_, i) => ({ path: "f" + i + ".txt", content: "x" })) });
check("more than 40 files is rejected", t.err);

t = await tool("call_me", { message: "I finished the bakery site. Want changes?", reason: "done", task_id: taskId });
db.data.set("users/u1/devices/tok123", { platform: "android" });
const calls = [...db.data.entries()].filter(([p]) => p.startsWith("users/u1/calls/"));
check("call_me creates a ringing call linked to the task", !t.err && calls.length === 1 && calls[0][1].status === "ringing" && calls[0][1].taskId === taskId && calls[0][1].source === "connector");
t = await tool("call_me", { message: "second call" });
check("call_me sends a push to registered phones", sent.length === 1 && sent[0].tokens[0] === "tok123" && sent[0].data.type === "call" && sent[0].android.priority === "high");
for (let i = 0; i < 3; i++) await tool("call_me", { message: "again " + i });
t = await tool("call_me", { message: "one too many" });
check("call_me is limited to 5 calls per 10 minutes", t.err && /Too many calls/.test(t.v));

// instructions the user left
const m = db.collection("users").doc("u1").collection("tasks").doc(taskId).collection("messages");
await m.add({ role: "user", text: "Make the button bigger", via: "call", createdAt: ts() });
await m.add({ role: "user", text: "Also add opening hours", createdAt: ts() });
t = await tool("get_instructions", {});
check("get_instructions returns new messages with their source", t.v.length === 2 && t.v.some((x) => x.from === "phone call" && /bigger/.test(x.text)) && t.v.some((x) => x.from === "dashboard chat"));
t = await tool("get_instructions", {});
check("messages are marked read after delivery", t.v.note === "No new instructions.");
t = await tool("get_task", { task_id: taskId });
check("get_task returns status and recent messages", t.v.status === "done" && t.v.recent_messages.length >= 3);
t = await tool("list_tasks", {});
check("list_tasks shows both tasks", Array.isArray(t.v) && t.v.length === 2 && t.v.some((x) => x.run_by === "Claude") && t.v.some((x) => x.run_by === "orion worker"));
r = await rpc("tools/call", { name: "nope", arguments: {} });
check("unknown tool gives an error", !!r.body.error);

console.log(failed ? "\n" + failed + " FAILED" : "\nAll connector tests passed.");
process.exit(failed ? 1 : 0);
