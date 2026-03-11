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

  const handleLogin = async (e) => {
    e.preventDefault(); setError(""); setLoading(true);
    const res = await signIn("credentials", { email, password, redirect: false });
    setLoading(false);
    if (res?.error) setError("Invalid email or password.");
    else router.push("/dashboard");
  };

  const handleSignup = async (e) => {
    e.preventDefault(); setError(""); setLoading(true);
    try {
      const res = await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password, name, inviteCode }) });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Signup failed."); setLoading(false); return; }
      const loginRes = await signIn("credentials", { email, password, redirect: false });
      setLoading(false);
      if (loginRes?.error) { setError("Account created. Please sign in."); setTab("login"); }
      else router.push("/dashboard");
    } catch { setError("Something went wrong."); setLoading(false); }
  };

  const features = [
    { icon: "⚖️", title: "AI Ruling Predictions", desc: "Cross-reference claims against the WSIB Operational Policy Manual with the Five Point Check System" },
    { icon: "📋", title: "Compliance Monitoring", desc: "Verify filing deadlines, treatment durations, and policy requirements automatically" },
    { icon: "🔄", title: "Return-to-Work Tracking", desc: "Assess RTW plans against clinical guidelines and monitor recovery milestones" },
    { icon: "📄", title: "Document Analysis", desc: "Upload Form 6, Form 7, Form 8, medical reports, and get instant AI-powered insights" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#F5F5F7", fontFamily: "'Plus Jakarta Sans', -apple-system, sans-serif", display: "flex", flexDirection: "column" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap');
        @keyframes fadeIn { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        @keyframes fadeInSlow { from { opacity:0; } to { opacity:1; } }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        input, button { font-family: inherit; }
        ::placeholder { color: #AEAEB2; }
      `}</style>

      {/* ── Top bar ── */}
      <div style={{ padding: "16px 32px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "#1D1D1F", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#fff" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" /></svg>
          </div>
          <span style={{ fontSize: 17, fontWeight: 700, letterSpacing: -0.4, color: "#1D1D1F" }}>CaseAssist</span>
        </div>
        <div style={{ fontSize: 13, color: "#86868B" }}>Workers' Compensation Claims Intelligence</div>
      </div>

      {/* ── Main content ── */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px 24px 60px" }}>
        <div style={{ display: "flex", gap: 80, alignItems: "center", maxWidth: 1100, width: "100%", animation: "fadeIn 0.6s cubic-bezier(0.25,0.1,0.25,1) both" }}>

          {/* ── Left side — hero + features ── */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ fontSize: 52, fontWeight: 800, letterSpacing: -2.5, lineHeight: 1.02, color: "#1D1D1F", marginBottom: 16 }}>
              Smarter claims.<br />
              <span style={{ color: "#AEAEB2" }}>Faster rulings.</span>
            </h1>
            <p style={{ fontSize: 17, color: "#6E6E73", lineHeight: 1.6, maxWidth: 440, marginBottom: 36 }}>
              CaseAssist uses AI to analyze workers' compensation claims against the WSIB Operational Policy Manual — giving you ruling predictions, compliance checks, and return-to-work guidance in seconds.
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {features.map((f, i) => (
                <div key={i} style={{ padding: "16px 18px", background: "#fff", borderRadius: 14, border: "0.5px solid #E8E8ED", animation: `fadeIn 0.5s cubic-bezier(0.25,0.1,0.25,1) ${0.1 + i * 0.08}s both` }}>
                  <div style={{ fontSize: 22, marginBottom: 8 }}>{f.icon}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#1D1D1F", marginBottom: 3 }}>{f.title}</div>
                  <div style={{ fontSize: 12, color: "#86868B", lineHeight: 1.45 }}>{f.desc}</div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 28, display: "flex", gap: 20, alignItems: "center", animation: "fadeInSlow 1s ease 0.5s both" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#34C759" }} />
                <span style={{ fontSize: 12, color: "#6E6E73", fontWeight: 500 }}>WSIB OPM Connected</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#0071E3" }} />
                <span style={{ fontSize: 12, color: "#6E6E73", fontWeight: 500 }}>ICD-10 Medical Database</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#FF9500" }} />
                <span style={{ fontSize: 12, color: "#6E6E73", fontWeight: 500 }}>PIPEDA Compliant</span>
              </div>
            </div>
          </div>

          {/* ── Right side — login form ── */}
          <div style={{ width: 380, flexShrink: 0, animation: "fadeIn 0.6s cubic-bezier(0.25,0.1,0.25,1) 0.15s both" }}>
            {/* Tab switcher */}
            <div style={{ display: "flex", gap: 2, padding: 3, background: "#E8E8ED", borderRadius: 12, marginBottom: 20 }}>
              {["login", "signup"].map(t => (
                <button key={t} onClick={() => { setTab(t); setError(""); }}
                  style={{
                    flex: 1, padding: "9px 0", borderRadius: 10, border: "none", fontSize: 13, fontWeight: 600,
                    cursor: "pointer", transition: "all 0.2s",
                    background: tab === t ? "#fff" : "transparent",
                    color: tab === t ? "#1D1D1F" : "#86868B",
                    boxShadow: tab === t ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                  }}>
                  {t === "login" ? "Sign In" : "Create Account"}
                </button>
              ))}
            </div>

            {/* Form */}
            <div style={{ background: "#fff", borderRadius: 18, padding: 28, border: "0.5px solid #E8E8ED", boxShadow: "0 2px 20px rgba(0,0,0,0.04)" }}>
              <form onSubmit={tab === "login" ? handleLogin : handleSignup}>
                {tab === "signup" && (
                  <>
                    <label style={lbl}>Access Code</label>
                    <input style={inp} type="text" value={inviteCode} onChange={e => setInviteCode(e.target.value)} placeholder="Enter your access code" required />
                    <label style={lbl}>Full Name</label>
                    <input style={inp} type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Jane Smith" />
                  </>
                )}
                <label style={lbl}>Email</label>
                <input style={inp} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required />
                <label style={lbl}>Password</label>
                <input style={inp} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required minLength={8} />

                {error && (
                  <div style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(255,59,48,0.06)", border: "0.5px solid rgba(255,59,48,0.12)", color: "#CC2D26", fontSize: 13, fontWeight: 500, marginTop: 14 }}>
                    {error}
                  </div>
                )}

                <button type="submit" disabled={loading}
                  style={{
                    width: "100%", marginTop: 18, padding: "13px", borderRadius: 12, border: "none",
                    background: loading ? "#D2D2D7" : "#0071E3", color: "#fff",
                    fontSize: 15, fontWeight: 600, cursor: loading ? "wait" : "pointer",
                    transition: "all 0.2s",
                  }}>
                  {loading ? "Please wait…" : tab === "login" ? "Sign In" : "Create Account"}
                </button>
              </form>

              {tab === "signup" && (
                <p style={{ textAlign: "center", marginTop: 14, fontSize: 12, color: "#AEAEB2", lineHeight: 1.5 }}>
                  Need an access code? Contact your firm administrator.
                </p>
              )}
            </div>

            <p style={{ textAlign: "center", marginTop: 16, fontSize: 11, color: "#AEAEB2", lineHeight: 1.5 }}>
              Advisory tool only. Final decisions by authorized WSIB adjudicators.<br />
              All data protected under PIPEDA / HIPAA.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

const lbl = { display: "block", fontSize: 12, fontWeight: 600, color: "#86868B", marginBottom: 5, marginTop: 16 };
const inp = { width: "100%", padding: "11px 14px", borderRadius: 10, border: "0.5px solid #E8E8ED", fontSize: 14, outline: "none", background: "#FAFAFA", fontFamily: "inherit", transition: "border-color 0.2s" };
