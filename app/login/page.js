"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [tab, setTab] = useState("login"); // "login" | "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(""); setLoading(true);
    const res = await signIn("credentials", { email, password, redirect: false });
    setLoading(false);
    if (res?.error) {
      setError("Invalid email or password.");
    } else {
      router.push("/dashboard");
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name, inviteCode }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Signup failed."); setLoading(false); return; }
      // Auto-login after signup
      const loginRes = await signIn("credentials", { email, password, redirect: false });
      setLoading(false);
      if (loginRes?.error) { setError("Account created. Please log in."); setTab("login"); }
      else { router.push("/dashboard"); }
    } catch {
      setError("Something went wrong."); setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 400, animation: "fadeIn 0.5s cubic-bezier(0.25,0.1,0.25,1) both" }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: "var(--g900)", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
            <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="#fff" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: -1, marginBottom: 4 }}>ClaimLens</h1>
          <p style={{ fontSize: 14, color: "var(--g500)" }}>Workers' Compensation Claims Intelligence</p>
        </div>

        {/* Tab switcher */}
        <div style={{ display: "flex", gap: 2, padding: 3, background: "var(--g200)", borderRadius: 12, marginBottom: 24 }}>
          {["login", "signup"].map(t => (
            <button key={t} onClick={() => { setTab(t); setError(""); }}
              style={{
                flex: 1, padding: "8px 0", borderRadius: 10, border: "none", fontSize: 13, fontWeight: 600,
                cursor: "pointer", transition: "all 0.2s",
                background: tab === t ? "var(--white)" : "transparent",
                color: tab === t ? "var(--g900)" : "var(--g500)",
                boxShadow: tab === t ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
              }}>
              {t === "login" ? "Sign In" : "Create Account"}
            </button>
          ))}
        </div>

        {/* Form card */}
        <div style={{ background: "var(--white)", borderRadius: 16, padding: 24, border: "0.5px solid var(--g200)" }}>
          <form onSubmit={tab === "login" ? handleLogin : handleSignup}>
            {tab === "signup" && (
              <>
                <label style={labelStyle}>Invite Code</label>
                <input style={inputStyle} type="text" value={inviteCode} onChange={e => setInviteCode(e.target.value)} placeholder="Paste your invite code" required />
                <label style={labelStyle}>Full Name</label>
                <input style={inputStyle} type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Jane Smith" />
              </>
            )}
            <label style={labelStyle}>Email</label>
            <input style={inputStyle} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required />
            <label style={labelStyle}>Password</label>
            <input style={inputStyle} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required minLength={8} />

            {error && (
              <div style={{ padding: "10px 14px", borderRadius: 10, background: "var(--red-light)", border: "0.5px solid var(--red-border)", color: "#CC2D26", fontSize: 13, fontWeight: 500, marginTop: 12 }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading}
              style={{
                width: "100%", marginTop: 16, padding: "12px", borderRadius: 12, border: "none",
                background: loading ? "var(--g300)" : "var(--blue)", color: "var(--white)",
                fontSize: 15, fontWeight: 600, cursor: loading ? "wait" : "pointer",
                transition: "all 0.2s",
              }}>
              {loading ? "Please wait…" : tab === "login" ? "Sign In" : "Create Account"}
            </button>
          </form>
        </div>

        {tab === "signup" && (
          <p style={{ textAlign: "center", marginTop: 16, fontSize: 12, color: "var(--g500)", lineHeight: 1.5 }}>
            ClaimLens is invite-only. Contact your administrator for an invite code.
          </p>
        )}
      </div>
    </div>
  );
}

const labelStyle = { display: "block", fontSize: 12, fontWeight: 600, color: "var(--g500)", marginBottom: 4, marginTop: 14 };
const inputStyle = { width: "100%", padding: "10px 14px", borderRadius: 10, border: "0.5px solid var(--g200)", fontSize: 14, outline: "none", background: "var(--g50)", fontFamily: "inherit" };
