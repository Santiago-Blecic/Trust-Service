"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function AuthPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  async function submit(event: React.FormEvent) {
    event.preventDefault(); const supabase = createClient();
    const handle = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    if (handle.length < 3 || handle.length > 40) return setMessage("Use a unique name with 3–40 letters or numbers.");
    const loginId = `${handle}@proofly.local`;
    if (mode === "signup") { const { data, error } = await supabase.auth.signUp({ email: loginId, password, options: { data: { display_name: name.trim(), handle } } }); if (error) return setMessage(error.message); if (data.session) location.assign("/onboarding"); else setMessage("Account created. Disable Confirm email in Supabase Authentication → Providers → Email, then create the account again."); return; }
    const { error } = await supabase.auth.signInWithPassword({ email: loginId, password }); if (error) setMessage("Name or password is incorrect."); else location.assign("/onboarding");
  }
  return <main className="shell"><nav className="nav"><a className="brand" href="/">proof<i>ly</i></a></nav><section className="details"><h1 style={{ fontSize: 48 }}>{mode === "signup" ? "Create your Proofly account" : "Welcome back"}</h1><p className="lead">Sign in with a unique name and password. Every account receives a self-custody XRP Testnet wallet; Proofly never stores its recovery seed.</p><form className="profile" onSubmit={submit}><label>{mode === "signup" ? "Your unique name" : "Name"}<br/><input required minLength={3} maxLength={40} value={name} onChange={event => setName(event.target.value)} style={{ width: "100%", padding: 12, margin: "8px 0 16px" }} placeholder="e.g. santi-blecic" autoCapitalize="none"/></label><label>Password<br/><input required minLength={10} type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} value={password} onChange={event => setPassword(event.target.value)} style={{ width: "100%", padding: 12, margin: "8px 0 16px" }}/></label><button className="button">{mode === "signup" ? "Create account" : "Sign in"}</button>{message && <p className="notice">{message}</p>}</form><p className="muted">Without an email address, a forgotten password cannot be recovered.</p><button className="back" onClick={() => { setMode(mode === "signup" ? "signin" : "signup"); setMessage(""); }}>{mode === "signup" ? "Already have an account? Sign in" : "New to Proofly? Create an account"}</button></section></main>;
}
