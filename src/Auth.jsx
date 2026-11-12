import { useState } from "react";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { friendlyAuthError } from "./ui.jsx";
import { AuthShell } from "./Brand.jsx";

export default function Login({ fire, onReset }) {
  const [mode, setMode] = useState("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const fn = mode === "up" ? createUserWithEmailAndPassword : signInWithEmailAndPassword;
      await fn(fire.auth, email.trim(), password);
    } catch (err) { setError(friendlyAuthError(err)); }
    setBusy(false);
  }

  return (
    <AuthShell>
      <div className="auth-card">
        <div>
          <h1>{mode === "in" ? "Welcome back" : "Create your account"}</h1>
          <p className="muted">{mode === "in" ? "Sign in to your Orion Works workspace." : "Your account lives in your own Firebase project."}</p>
        </div>
        <form className="stack" onSubmit={submit}>
          <div>
            <label htmlFor="em">Email</label>
            <input id="em" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <label htmlFor="pw">Password</label>
            <input id="pw" type="password" autoComplete={mode === "in" ? "current-password" : "new-password"} value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          {error && <p className="error" role="alert">{error}</p>}
          <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? "Please wait..." : mode === "in" ? "Sign in" : "Create account"}</button>
        </form>
        <div className="auth-links">
          <button className="btn-link" onClick={() => { setError(""); setMode(mode === "in" ? "up" : "in"); }}>
            {mode === "in" ? "New here? Create an account" : "Already have an account? Sign in"}
          </button>
          <button className="btn-link subtle" onClick={onReset}>Change setup</button>
        </div>
      </div>
    </AuthShell>
  );
}
