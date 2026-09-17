"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function AuthPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  async function submit(event: React.FormEvent) {
    event.preventDefault(); const supabase = createClient();
    if (mode === "signup") { const { error } = await supabase.auth.signUp({ email, password, options: { data: { display_name: name.trim() }, emailRedirectTo: `${location.origin}/auth/callback` } }); setMessage(error ? error.message : "Check your inbox and confirm your email. Your XRPL Testnet wallet will be created after confirmation."); return; }
    const { error } = await supabase.auth.signInWithPassword({ email, password }); if (error) setMessage(error.message); else location.assign("/onboarding");
  }
  return <main className="shell"><nav className="nav"><a className="brand" href="/">proof<i>ly</i></a></nav><section className="details"><h1 style={{ fontSize: 48 }}>{mode === "signup" ? "Create a real Proofly account" : "Welcome back"}</h1><p className="lead">Every confirmed account receives a self-custody XRP Testnet wallet. Proofly never stores the wallet recovery seed.</p><form className="profile" onSubmit={submit}>{mode === "signup" && <label>Full name<br/><input required minLength={2} value={name} onChange={event => setName(event.target.value)} style={{ width: "100%", padding: 12, margin: "8px 0 16px" }} placeholder="Your real name"/></label>}<label>Email<br/><input required type="email" value={email} onChange={event => setEmail(event.target.value)} style={{ width: "100%", padding: 12, margin: "8px 0 16px" }} placeholder="you@example.com"/></label><label>Password<br/><input required minLength={10} type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} value={password} onChange={event => setPassword(event.target.value)} style={{ width: "100%", padding: 12, margin: "8px 0 16px" }}/></label><button className="button">{mode === "signup" ? "Create account" : "Sign in"}</button>{message && <p className="notice">{message}</p>}</form><button className="back" onClick={() => { setMode(mode === "signup" ? "signin" : "signup"); setMessage(""); }}>{mode === "signup" ? "Already have an account? Sign in" : "New to Proofly? Create an account"}</button></section></main>;
}
