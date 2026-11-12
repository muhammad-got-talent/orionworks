// The tools Claude (or any MCP client) can use on your Orion Works dashboard.
// Pure logic with injected dependencies, so it can be tested without Firebase.

const TEXT_EXT = new Set([".html", ".css", ".js", ".mjs", ".json", ".md", ".txt", ".svg", ".xml", ".ts", ".tsx", ".jsx", ".py", ".yml", ".yaml", ".csv"]);
const IMAGE_EXT = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp" };
const STATUSES = ["working", "done", "failed"];
const REASONS = ["update", "question", "done", "error"];
const ID = /^[A-Za-z0-9_-]{6,40}$/;

export const TOOLS = [
  {
    name: "create_task",
    description: "Create a task on the user's Orion Works dashboard. Call this first when you start a piece of work the user may want to follow. Returns task_id, which the other tools need.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Short title of the work, for example: Landing page for a bakery." },
        details: { type: "string", description: "Optional longer description of what the user asked for." },
        agent: { type: "string", description: "Who is doing the work, for example Claude or ChatGPT. Default: Claude." },
      },
      required: ["title"],
    },
  },
  {
    name: "post_update",
    description: "Post progress to a task on the dashboard. Use status 'done' (with a short summary) when you finish, or 'failed' if you are blocked. Progress notes appear in the Activity tab; reports and final summaries also appear in the chat.",
    inputSchema: {
      type: "object",
      properties: {
        task_id: { type: "string" },
        message: { type: "string", description: "What happened or what you did." },
        status: { type: "string", enum: STATUSES, description: "Optional. working, done or failed." },
        kind: { type: "string", enum: ["progress", "report"], description: "progress (default) shows in Activity only. report also shows in the chat." },
      },
      required: ["task_id", "message"],
    },
  },
  {
    name: "save_files",
    description: "Attach files you created to a task, so the user can preview them and download a zip from the dashboard. Text files up to 400 KB each. Small images can be sent as base64.",
    inputSchema: {
      type: "object",
      properties: {
        task_id: { type: "string" },
        files: {
          type: "array",
          description: "Up to 40 files per call.",
          items: {
            type: "object",
            properties: {
              path: { type: "string", description: "Relative path such as index.html or css/style.css." },
              content: { type: "string" },
              encoding: { type: "string", enum: ["utf8", "base64"], description: "Use base64 only for png, jpg, gif or webp images." },
            },
            required: ["path", "content"],
          },
        },
      },
      required: ["task_id", "files"],
    },
  },
  {
    name: "call_me",
    description: "Ring the user's phone with an incoming call from Orion. Use it when the work is finished, when you are blocked, or when you need a decision. Do not use it for small progress. Limited to 5 calls per 10 minutes.",
    inputSchema: {
      type: "object",
      properties: {
        message: { type: "string", description: "What Orion says first when the user answers. One or two short sentences." },
        reason: { type: "string", enum: REASONS },
        task_id: { type: "string", description: "Optional. Links the call to a task." },
      },
      required: ["message"],
    },
  },
  {
    name: "get_instructions",
    description: "Read new instructions the user left on the dashboard or said on a phone call. Check this at the start of every conversation and whenever the user mentions a call or a note. Returns only messages you have not read yet.",
    inputSchema: {
      type: "object",
      properties: {
        task_id: { type: "string", description: "Optional. Omit to check all your tasks." },
        mark_read: { type: "boolean", description: "Default true." },
      },
    },
  },
  {
    name: "get_task",
    description: "Get a task's title, status and the latest messages.",
    inputSchema: { type: "object", properties: { task_id: { type: "string" } }, required: ["task_id"] },
  },
  {
    name: "list_tasks",
    description: "List the user's 20 most recent tasks with their ids and statuses.",
    inputSchema: { type: "object", properties: {} },
  },
];

const str = (v, max, name) => {
  if (typeof v !== "string" || !v.trim()) throw new Error(name + " is required.");
  return v.trim().slice(0, max);
};
const ms = (v) => (v && typeof v.toMillis === "function" ? v.toMillis() : typeof v === "number" ? v : 0);
const ext = (p) => { const i = p.lastIndexOf("."); return i < 0 ? "" : p.slice(i).toLowerCase(); };
const fileId = (p) => encodeURIComponent(p);

function cleanPath(p) {
  if (typeof p !== "string") throw new Error("a file path is missing");
  const s = p.trim().replace(/^\.\//, "");
  if (!s || s.length > 200 || s.startsWith("/") || s.split("/").some((x) => x === ".." || x === "") || !/^[A-Za-z0-9._\-\/ ]+$/.test(s)) {
    throw new Error("bad file path: " + p);
  }
  return s;
}

export async function runTool(deps, name, a = {}) {
  const { db, uid, ts } = deps;
  const user = () => db.collection("users").doc(uid);
  const tasks = () => user().collection("tasks");

  async function taskRef(id, { connectorOnly } = {}) {
    if (typeof id !== "string" || !ID.test(id)) throw new Error("task_id is missing or not valid. Call create_task first.");
    const ref = tasks().doc(id);
    const snap = await ref.get();
    if (!snap.exists) throw new Error("Task not found.");
    const t = snap.data();
    if (connectorOnly && t.source !== "connector") throw new Error("This task is run by the Orion worker, so it cannot be changed from here.");
    return { ref, t };
  }

  switch (name) {
    case "list_tasks": {
      const snap = await tasks().orderBy("createdAt", "desc").limit(20).get();
      return snap.docs.map((d) => { const t = d.data(); return { task_id: d.id, title: t.text, status: t.status, run_by: t.source === "connector" ? t.agent || "connector" : "orion worker" }; });
    }

    case "create_task": {
      const title = str(a.title, 200, "title");
      const details = typeof a.details === "string" ? a.details.trim().slice(0, 4000) : "";
      const agent = typeof a.agent === "string" && a.agent.trim() ? a.agent.trim().slice(0, 30) : "Claude";
      const ref = await tasks().add({ text: title, status: "working", source: "connector", agent, createdAt: ts(), updatedAt: ts() });
      await ref.collection("messages").add({ role: "user", text: details ? title + "\n\n" + details : title, via: "connector", agent, readByAgent: true, createdAt: ts() });
      await ref.collection("events").add({ type: "start", text: agent + " started this task.", createdAt: ts() });
      return { task_id: ref.id, note: "Task created. Use this task_id with post_update, save_files and call_me." };
    }

    case "post_update": {
      const { ref, t } = await taskRef(a.task_id, { connectorOnly: true });
      const message = str(a.message, 4000, "message");
      if (a.status !== undefined && !STATUSES.includes(a.status)) throw new Error("status must be working, done or failed.");
      const report = a.kind === "report" || a.status === "done" || a.status === "failed";
      const type = a.status === "done" ? "done" : a.status === "failed" ? "error" : "thought";
      await ref.collection("events").add({ type, text: message.slice(0, 2000), createdAt: ts() });
      if (report) await ref.collection("messages").add({ role: "assistant", text: message, via: "connector", agent: t.agent || "Claude", createdAt: ts() });
      const patch = { updatedAt: ts() };
      if (a.status) patch.status = a.status;
      await ref.update(patch);
      return { ok: true, status: a.status || t.status };
    }

    case "save_files": {
      const { ref } = await taskRef(a.task_id, { connectorOnly: true });
      if (!Array.isArray(a.files) || !a.files.length) throw new Error("files must be a list with at least one file.");
      if (a.files.length > 40) throw new Error("At most 40 files per call.");
      const saved = [];
      const skipped = [];
      for (const f of a.files) {
        let path;
        try { path = cleanPath(f && f.path); } catch (e) { skipped.push(e.message); continue; }
        const e = ext(path);
        const content = f && typeof f.content === "string" ? f.content : null;
        if (content === null) { skipped.push(path + ": content must be text"); continue; }
        if (content.length > 400000) { skipped.push(path + ": larger than 400 KB"); continue; }
        if (f.encoding === "base64") {
          if (!IMAGE_EXT[e]) { skipped.push(path + ": base64 is only for png, jpg, gif and webp"); continue; }
          await ref.collection("files").doc(fileId(path)).set({ path, dataUrl: "data:" + IMAGE_EXT[e] + ";base64," + content, binary: true, updatedAt: ts() });
        } else {
          if (!TEXT_EXT.has(e)) { skipped.push(path + ": file type not supported"); continue; }
          await ref.collection("files").doc(fileId(path)).set({ path, content, binary: false, updatedAt: ts() });
        }
        saved.push(path);
      }
      if (saved.length) {
        await ref.collection("events").add({ type: "file", text: "Saved " + saved.length + " file" + (saved.length === 1 ? "" : "s") + ": " + saved.slice(0, 8).join(", "), createdAt: ts() });
        await ref.update({ updatedAt: ts() });
      }
      return { saved, skipped };
    }

    case "call_me": {
      const message = str(a.message, 300, "message");
      const reason = REASONS.includes(a.reason) ? a.reason : "update";
      let taskId = null;
      let title = "";
      let agent = "Claude";
      let ref = null;
      if (a.task_id) {
        const r = await taskRef(a.task_id);
        ref = r.ref; taskId = ref.id; title = r.t.text || ""; agent = r.t.agent || agent;
      }
      // Safety: stop runaway loops from ringing the phone again and again.
      const recent = await user().collection("calls").orderBy("createdAt", "desc").limit(5).get();
      const times = recent.docs.map((d) => ms(d.data().createdAt));
      if (times.length >= 5 && Date.now() - times[4] < 10 * 60 * 1000) throw new Error("Too many calls in the last 10 minutes. Wait a while before calling again.");
      const call = await user().collection("calls").add({ taskId, taskTitle: title, reason, message, agent, source: "connector", status: "ringing", createdAt: ts() });
      let pushed = 0;
      try {
        const devices = await user().collection("devices").get();
        const tokens = devices.docs.map((d) => d.id);
        if (tokens.length && deps.messaging) {
          const res = await deps.messaging.sendEachForMulticast({
            tokens,
            data: { type: "call", callId: call.id, taskId: taskId || "", title: "Orion is calling", body: message.slice(0, 120) },
            android: { priority: "high", ttl: 45000 },
          });
          pushed = res.successCount !== undefined ? res.successCount : tokens.length;
        }
      } catch { /* the in-app call still rings when the app is open */ }
      if (ref) await ref.collection("events").add({ type: "call", text: "Calling you: " + message, createdAt: ts() });
      return { call_id: call.id, phones_notified: pushed, note: "The call rings in the Orion Works app for about 45 seconds." };
    }

    case "get_instructions": {
      let list;
      if (a.task_id) {
        const { ref } = await taskRef(a.task_id);
        list = [await ref.get()];
      } else {
        const snap = await tasks().orderBy("createdAt", "desc").limit(20).get();
        list = snap.docs.filter((d) => d.data().source === "connector");
      }
      const out = [];
      for (const task of list) {
        const msgs = await task.ref.collection("messages").orderBy("createdAt", "asc").get();
        for (const m of msgs.docs) {
          const d = m.data();
          if (d.role !== "user" || d.readByAgent) continue;
          out.push({ task_id: task.id, title: task.data().text, from: d.via === "call" ? "phone call" : "dashboard chat", text: d.text });
          if (a.mark_read !== false) await m.ref.update({ readByAgent: true });
        }
        if (out.length >= 30) break;
      }
      return out.length ? out : { note: "No new instructions." };
    }

    case "get_task": {
      const { ref, t } = await taskRef(a.task_id);
      const msgs = await ref.collection("messages").orderBy("createdAt", "desc").limit(10).get();
      return { task_id: ref.id, title: t.text, status: t.status, run_by: t.source === "connector" ? t.agent || "connector" : "orion worker", recent_messages: msgs.docs.map((d) => ({ role: d.data().role, text: d.data().text })).reverse() };
    }

    default:
      throw new Error("Unknown tool: " + name);
  }
}
