"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [tab, setTab] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e) => { e.preventDefault(); setError(""); setLoading(true); const res = await signIn("credentials", { email, password, redirect: false }); setLoading(false); if (res?.error) setError("Invalid email or password."); else router.push("/dashboard"); };
  const handleSignup = async (e) => { e.preventDefault(); setError(""); setLoading(true); try { const res = await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password, name, inviteCode }) }); const data = await res.json(); if (!res.ok) { setError(data.error || "Signup failed."); setLoading(false); return; } const loginRes = await signIn("credentials", { email, password, redirect: false }); setLoading(false); if (loginRes?.error) { setError("Account created. Please sign in."); setTab("login"); } else router.push("/dashboard"); } catch { setError("Something went wrong."); setLoading(false); } };

  return (
    <div style={{ minHeight: "100vh", background: "#F5F5F7", fontFamily: "'Plus Jakarta Sans', -apple-system, sans-serif", display: "flex", flexDirection: "column" }}>
      <style>{`
        @keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        @keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
        input,button,select{font-family:inherit}
        ::placeholder{color:#AEAEB2}
        .lp-split{display:flex;gap:64px;align-items:center;max-width:1100px;width:100%}
        .lp-hero{flex:1;min-width:0}
        .lp-form{width:400px;flex-shrink:0}
        @media(max-width:960px){.lp-split{flex-direction:column;gap:32px;text-align:center}.lp-hero{text-align:center}.lp-hero p{margin-left:auto;margin-right:auto}.lp-form{width:100%;max-width:440px}.lp-features{justify-content:center}.lp-badges{justify-content:center!important}}
        @media(max-width:480px){.lp-hero h1{font-size:32px!important}.lp-grid{grid-template-columns:1fr!important}}
      `}</style>

      {/* Top bar */}
      <div style={{ padding: "16px 28px", display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: "#1D1D1F", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#fff" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" /></svg>
        </div>
        <span style={{ fontSize: 17, fontWeight: 700, letterSpacing: -0.4, color: "#1D1D1F" }}>CaseAssist</span>
      </div>

      {/* Main */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 24px 60px" }}>
        <div className="lp-split" style={{ animation: "fadeUp .7s cubic-bezier(.25,.1,.25,1) both" }}>

          {/* Hero */}
          <div className="lp-hero">
            <div style={{ display: "inline-block", padding: "4px 14px", borderRadius: 980, background: "rgba(0,113,227,.06)", border: "1px solid rgba(0,113,227,.1)", fontSize: 12, fontWeight: 600, color: "#0071E3", marginBottom: 20, letterSpacing: 0.3 }}>AI-Powered Claims Intelligence</div>
            <h1 style={{ fontSize: 52, fontWeight: 800, letterSpacing: -2.8, lineHeight: 1, color: "#1D1D1F", marginBottom: 16 }}>
              Smarter claims.<br /><span style={{ color: "#AEAEB2" }}>Faster rulings.</span>
            </h1>
            <p style={{ fontSize: 17, color: "#6E6E73", lineHeight: 1.65, maxWidth: 460, marginBottom: 36 }}>
              Analyze workers' compensation claims against the WSIB Operational Policy Manual. Get ruling predictions, compliance checks, and return-to-work guidance in seconds.
            </p>

            <div className="lp-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 28 }}>
              {[
                { icon: "\u2696\uFE0F", title: "Ruling Predictions", desc: "Five Point Check against the OPM" },
                { icon: "\uD83D\uDCCB", title: "Compliance Checks", desc: "Filing deadlines and policy validation" },
                { icon: "\uD83D\uDD04", title: "RTW Tracking", desc: "Clinical benchmarks by injury type" },
                { icon: "\uD83D\uDCC4", title: "Document Analysis", desc: "Upload forms and get AI insights" },
              ].map((f, i) => (
                <div key={i} style={{ padding: "14px 16px", background: "#fff", borderRadius: 14, border: "0.5px solid #E8E8ED", animation: `fadeUp .5s cubic-bezier(.25,.1,.25,1) ${0.15 + i * 0.07}s both` }}>
                  <div style={{ fontSize: 20, marginBottom: 6 }}>{f.icon}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#1D1D1F", marginBottom: 2 }}>{f.title}</div>
                  <div style={{ fontSize: 11.5, color: "#86868B", lineHeight: 1.4 }}>{f.desc}</div>
                </div>
              ))}
            </div>

            <div className="lp-badges" style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap", animation: "fadeIn 1s ease .6s both" }}>
              {[{ c: "#34C759", t: "WSIB OPM" }, { c: "#0071E3", t: "ICD-10" }, { c: "#FF9500", t: "PIPEDA" }].map((b, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: b.c }} />
                  <span style={{ fontSize: 12, color: "#6E6E73", fontWeight: 500 }}>{b.t}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Form */}
          <div className="lp-form" style={{ animation: "fadeUp .7s cubic-bezier(.25,.1,.25,1) .12s both" }}>
            <div style={{ display: "flex", gap: 2, padding: 3, background: "#E8E8ED", borderRadius: 12, marginBottom: 20 }}>
              {["login", "signup"].map(t => (
                <button key={t} onClick={() => { setTab(t); setError(""); }}
                  style={{ flex: 1, padding: "9px 0", borderRadius: 10, border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer", transition: "all .2s", background: tab === t ? "#fff" : "transparent", color: tab === t ? "#1D1D1F" : "#86868B", boxShadow: tab === t ? "0 1px 3px rgba(0,0,0,.06)" : "none" }}>
                  {t === "login" ? "Sign In" : "Create Account"}
                </button>
              ))}
            </div>

            <div style={{ background: "#fff", borderRadius: 18, padding: 26, border: "0.5px solid #E8E8ED", boxShadow: "0 2px 24px rgba(0,0,0,.04)" }}>
              <form onSubmit={tab === "login" ? handleLogin : handleSignup}>
                {tab === "signup" && (<>
                  <label style={lbl}>Access Code</label>
                  <input style={inp} type="text" value={inviteCode} onChange={e => setInviteCode(e.target.value)} placeholder="Enter your access code" required />
                  <label style={lbl}>Full Name</label>
                  <input style={inp} type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Jane Smith" />
                </>)}
                <label style={lbl}>Email</label>
                <input style={inp} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required />
                <label style={lbl}>Password</label>
                <input style={inp} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder={"••••••••"} required minLength={8} />
                {error && <div style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(255,59,48,.05)", border: "0.5px solid rgba(255,59,48,.1)", color: "#CC2D26", fontSize: 13, fontWeight: 500, marginTop: 14 }}>{error}</div>}
                <button type="submit" disabled={loading} style={{ width: "100%", marginTop: 18, padding: "13px", borderRadius: 12, border: "none", background: loading ? "#D2D2D7" : "#0071E3", color: "#fff", fontSize: 15, fontWeight: 600, cursor: loading ? "wait" : "pointer", transition: "all .2s" }}>
                  {loading ? "Please wait\u2026" : tab === "login" ? "Sign In" : "Create Account"}
                </button>
              </form>
              {tab === "signup" && <p style={{ textAlign: "center", marginTop: 14, fontSize: 12, color: "#AEAEB2" }}>Need an access code? Contact your firm administrator.</p>}
            </div>
            <p style={{ textAlign: "center", marginTop: 16, fontSize: 11, color: "#AEAEB2", lineHeight: 1.5 }}>Advisory tool only. Final decisions by authorized WSIB adjudicators.<br />Data protected under PIPEDA / HIPAA.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

const lbl = { display: "block", fontSize: 12, fontWeight: 600, color: "#86868B", marginBottom: 5, marginTop: 16 };
const inp = { width: "100%", padding: "11px 14px", borderRadius: 10, border: "0.5px solid #E8E8ED", fontSize: 14, outline: "none", background: "#FAFAFA", fontFamily: "inherit" };
