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

  const features = [
    { icon: "⚖️", title: "AI Ruling Predictions", desc: "Five Point Check against the WSIB Operational Policy Manual" },
    { icon: "📋", title: "Compliance Monitoring", desc: "Filing deadlines, treatment durations, and policy checks" },
    { icon: "🔄", title: "Return-to-Work Tracking", desc: "RTW plans assessed against clinical guidelines" },
    { icon: "📄", title: "Document Analysis", desc: "Upload Form 6, 7, 8 and get instant AI insights" },
  ];

  return (
    <div className="login-root">
      <style>{`
        @keyframes fadeIn{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
        @keyframes fadeInSlow{from{opacity:0}to{opacity:1}}
        .login-root{min-height:100vh;background:#F5F5F7;font-family:"Plus Jakarta Sans",-apple-system,sans-serif;display:flex;flex-direction:column}
        .login-top{padding:16px 24px;display:flex;align-items:center;justify-content:space-between}
        .login-main{flex:1;display:flex;align-items:center;justify-content:center;padding:20px 24px 60px}
        .login-split{display:flex;gap:60px;align-items:center;max-width:1100px;width:100%;animation:fadeIn .6s cubic-bezier(.25,.1,.25,1) both}
        .login-hero{flex:1;min-width:0}
        .login-hero h1{font-size:48px;font-weight:800;letter-spacing:-2.5px;line-height:1.02;color:#1D1D1F;margin-bottom:16px}
        .login-hero h1 span{color:#AEAEB2}
        .login-hero p{font-size:16px;color:#6E6E73;line-height:1.6;max-width:440px;margin-bottom:32px}
        .login-features{display:grid;grid-template-columns:1fr 1fr;gap:10px}
        .login-feat{padding:16px;background:#fff;border-radius:14px;border:.5px solid #E8E8ED}
        .login-feat-ico{font-size:20px;margin-bottom:6px}
        .login-feat-t{font-size:13px;font-weight:700;color:#1D1D1F;margin-bottom:2px}
        .login-feat-d{font-size:11.5px;color:#86868B;line-height:1.45}
        .login-indicators{margin-top:24px;display:flex;gap:16px;align-items:center;flex-wrap:wrap}
        .login-ind{display:flex;align-items:center;gap:6px;font-size:12px;color:#6E6E73;font-weight:500}
        .login-ind-dot{width:8px;height:8px;border-radius:50%}
        .login-form-wrap{width:380px;flex-shrink:0;animation:fadeIn .6s cubic-bezier(.25,.1,.25,1) .15s both}
        .login-tabs{display:flex;gap:2px;padding:3px;background:#E8E8ED;border-radius:12px;margin-bottom:20px}
        .login-tab{flex:1;padding:9px 0;border-radius:10px;border:none;font-size:13px;font-weight:600;cursor:pointer;transition:all .2s}
        .login-tab.on{background:#fff;color:#1D1D1F;box-shadow:0 1px 3px rgba(0,0,0,.08)}
        .login-tab.off{background:transparent;color:#86868B}
        .login-card{background:#fff;border-radius:18px;padding:24px;border:.5px solid #E8E8ED;box-shadow:0 2px 20px rgba(0,0,0,.04)}
        .login-lbl{display:block;font-size:12px;font-weight:600;color:#86868B;margin-bottom:5px;margin-top:16px}
        .login-inp{width:100%;padding:11px 14px;border-radius:10px;border:.5px solid #E8E8ED;font-size:14px;outline:none;background:#FAFAFA;font-family:inherit}
        .login-inp:focus{border-color:#0071E3}
        .login-err{padding:10px 14px;border-radius:10px;background:rgba(255,59,48,.06);border:.5px solid rgba(255,59,48,.12);color:#CC2D26;font-size:13px;font-weight:500;margin-top:14px}
        .login-btn{width:100%;margin-top:18px;padding:13px;border-radius:12px;border:none;background:#0071E3;color:#fff;font-size:15px;font-weight:600;cursor:pointer;transition:all .2s}
        .login-btn:hover{background:#0077ED}
        .login-btn:disabled{background:#D2D2D7;cursor:wait}
        .login-footer{text-align:center;margin-top:16px;font-size:11px;color:#AEAEB2;line-height:1.5}
        @media(max-width:900px){.login-split{flex-direction:column;gap:32px}.login-hero{text-align:center}.login-hero h1{font-size:34px;letter-spacing:-1.5px}.login-hero p{font-size:15px;margin:0 auto 24px;max-width:100%}.login-features{gap:8px}.login-feat{padding:12px}.login-indicators{justify-content:center}.login-form-wrap{width:100%;max-width:420px}.login-main{padding:20px 16px 40px}}
        @media(max-width:480px){.login-hero h1{font-size:28px;letter-spacing:-1px}.login-hero p{font-size:14px}.login-features{grid-template-columns:1fr}.login-indicators{flex-direction:column;gap:8px}.login-top{padding:12px 16px}.login-card{padding:20px}}
      `}</style>
      <div className="login-top">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "#1D1D1F", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#fff" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" /></svg>
          </div>
          <span style={{ fontSize: 17, fontWeight: 700, letterSpacing: -0.4, color: "#1D1D1F" }}>CaseAssist</span>
        </div>
      </div>
      <div className="login-main"><div className="login-split">
        <div className="login-hero">
          <h1>Smarter claims.<br /><span>Faster rulings.</span></h1>
          <p>CaseAssist uses AI to analyze workers' compensation claims against the WSIB Operational Policy Manual — giving you ruling predictions, compliance checks, and return-to-work guidance in seconds.</p>
          <div className="login-features">{features.map((f, i) => (<div key={i} className="login-feat" style={{ animation: `fadeIn .5s cubic-bezier(.25,.1,.25,1) ${0.1 + i * 0.08}s both` }}><div className="login-feat-ico">{f.icon}</div><div className="login-feat-t">{f.title}</div><div className="login-feat-d">{f.desc}</div></div>))}</div>
          <div className="login-indicators" style={{ animation: "fadeInSlow 1s ease 0.5s both" }}>{[{ color: "#34C759", label: "WSIB OPM Connected" }, { color: "#0071E3", label: "ICD-10 Medical DB" }, { color: "#FF9500", label: "PIPEDA Compliant" }].map((ind, i) => (<div key={i} className="login-ind"><span className="login-ind-dot" style={{ background: ind.color }} />{ind.label}</div>))}</div>
        </div>
        <div className="login-form-wrap">
          <div className="login-tabs">{["login", "signup"].map(t => (<button key={t} className={`login-tab ${tab === t ? "on" : "off"}`} onClick={() => { setTab(t); setError(""); }}>{t === "login" ? "Sign In" : "Create Account"}</button>))}</div>
          <div className="login-card">
            <form onSubmit={tab === "login" ? handleLogin : handleSignup}>
              {tab === "signup" && (<><label className="login-lbl">Access Code</label><input className="login-inp" type="text" value={inviteCode} onChange={e => setInviteCode(e.target.value)} placeholder="Enter your access code" required /><label className="login-lbl">Full Name</label><input className="login-inp" type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Jane Smith" /></>)}
              <label className="login-lbl">Email</label><input className="login-inp" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required />
              <label className="login-lbl">Password</label><input className="login-inp" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required minLength={8} />
              {error && <div className="login-err">{error}</div>}
              <button type="submit" disabled={loading} className="login-btn">{loading ? "Please wait…" : tab === "login" ? "Sign In" : "Create Account"}</button>
            </form>
            {tab === "signup" && <p style={{ textAlign: "center", marginTop: 14, fontSize: 12, color: "#AEAEB2" }}>Need an access code? Contact your firm administrator.</p>}
          </div>
          <p className="login-footer">Advisory tool only. Final decisions by authorized WSIB adjudicators. Data protected under PIPEDA / HIPAA.</p>
        </div>
      </div></div>
    </div>
  );
}
