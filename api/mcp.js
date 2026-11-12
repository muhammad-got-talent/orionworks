// Orion Works connector: a small MCP server that runs on Vercel.
// Claude (or ChatGPT) calls it to create tasks, post progress, attach files and ring your phone.
// Setup: see CONNECTOR.md. It needs three Vercel environment variables:
//   FIREBASE_SERVICE_ACCOUNT, ORION_MCP_TOKEN, ORION_OWNER_EMAIL
import { createHandler } from "./_server.js";

let cached = null;

async function getDeps() {
  if (cached) return cached;
  const admin = (await import("firebase-admin")).default;
  if (!admin.apps.length) {
    let account;
    try { account = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT); }
    catch { throw new Error("FIREBASE_SERVICE_ACCOUNT in Vercel is missing or is not valid JSON. Paste the whole service-account file."); }
    admin.initializeApp({ credential: admin.credential.cert(account) });
  }
  let uid = process.env.ORION_OWNER_UID;
  if (!uid) {
    const email = process.env.ORION_OWNER_EMAIL;
    if (!email) throw new Error("Add ORION_OWNER_EMAIL in Vercel: the email you sign in to Orion Works with.");
    try { uid = (await admin.auth().getUserByEmail(email)).uid; }
    catch { throw new Error("No Orion Works account found for " + email + ". Check ORION_OWNER_EMAIL."); }
  }
  cached = { db: admin.firestore(), uid, ts: () => admin.firestore.FieldValue.serverTimestamp(), messaging: admin.messaging() };
  return cached;
}

export default createHandler({ getDeps });
