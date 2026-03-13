"use client";
import { useState, useRef } from "react";
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
  const authRef = useRef(null);

  const handleLogin = async (e) => { e.preventDefault(); setError(""); setLoading(true); const res = await signIn("credentials", { email, password, redirect: false }); setLoading(false); if (res?.error) setError("Invalid email or password."); else router.push("/dashboard"); };
  const handleSignup = async (e) => { e.preventDefault(); setError(""); setLoading(true); try { const res = await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password, name, inviteCode }) }); const data = await res.json(); if (!res.ok) { setError(data.error || "Signup failed."); setLoading(false); return; } const loginRes = await signIn("credentials", { email, password, redirect: false }); setLoading(false); if (loginRes?.error) { setError("Account created. Please sign in."); setTab("login"); } else router.push("/dashboard"); } catch { setError("Something went wrong."); setLoading(false); } };
  const scrollTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });

  return (
    <div style={{ minHeight: "100vh", background: "#FAFBFC", fontFamily: "'Plus Jakarta Sans', -apple-system, sans-serif", overflowX: "hidden" }}>
      <style>{`
        @keyframes fadeUp{from{opacity:0;transform:translateY(30px)}to{opacity:1;transform:translateY(0)}}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-12px)}}
        *{box-sizing:border-box;margin:0;padding:0}input,button{font-family:inherit}::placeholder{color:#AEAEB2}
        .sec{max-width:1120px;margin:0 auto;padding:0 28px}
        @media(max-width:900px){.hero-grid{flex-direction:column!important;text-align:center}.hero-grid>div:first-child{align-items:center!important}.feat-grid{grid-template-columns:1fr 1fr!important}.journey-grid{grid-template-columns:1fr!important;gap:24px!important}.journey-grid>div>div:first-child{display:none}.who-grid{grid-template-columns:1fr!important}.auth-split{flex-direction:column!important}.auth-left{display:none!important}}
        @media(max-width:600px){.feat-grid{grid-template-columns:1fr!important}.stats-grid{grid-template-columns:1fr 1fr!important}}
      `}</style>

      {/* NAV */}
      <nav style={{ position: "sticky", top: 0, zIndex: 100, background: "rgba(250,251,252,.85)", backdropFilter: "saturate(180%) blur(20px)", borderBottom: "1px solid rgba(0,0,0,.04)" }}>
        <div className="sec" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 60 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: "#1D1D1F", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="17" height="17" fill="none" viewBox="0 0 24 24" stroke="#fff" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" /></svg>
            </div>
            <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: -0.5, color: "#1D1D1F" }}>CaseAssist</span>
          </div>
          <div style={{ display: "flex", gap: 24, alignItems: "center" }}>
            <span onClick={() => scrollTo("features")} style={{ fontSize: 13, fontWeight: 500, color: "#6E6E73", cursor: "pointer" }}>Features</span>
            <span onClick={() => scrollTo("journey")} style={{ fontSize: 13, fontWeight: 500, color: "#6E6E73", cursor: "pointer" }}>How It Works</span>
            <span onClick={() => scrollTo("who")} style={{ fontSize: 13, fontWeight: 500, color: "#6E6E73", cursor: "pointer" }}>Who For</span>
            <button onClick={() => { setTab("login"); scrollTo("auth"); }} style={{ padding: "8px 18px", borderRadius: 980, fontSize: 13, fontWeight: 600, border: "none", background: "#0071E3", color: "#fff", cursor: "pointer" }}>Sign In</button>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section style={{ background: "linear-gradient(180deg, #FAFBFC 0%, #EEF1F6 100%)", padding: "80px 0 60px", overflow: "hidden" }}>
        <div className="sec">
          <div className="hero-grid" style={{ display: "flex", gap: 60, alignItems: "center" }}>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "flex-start", animation: "fadeUp .8s cubic-bezier(.25,.1,.25,1) both" }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "5px 16px 5px 6px", borderRadius: 980, background: "#fff", border: "1px solid #E8E8ED", marginBottom: 24, boxShadow: "0 1px 4px rgba(0,0,0,.04)" }}>
                <span style={{ width: 22, height: 22, borderRadius: "50%", background: "#34C759", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#fff" }}>{"\u2713"}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#6E6E73" }}>Powered by WSIB Operational Policy Manual</span>
              </div>
              <h1 style={{ fontSize: "clamp(36px, 5vw, 56px)", fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1.02, color: "#1D1D1F", marginBottom: 20 }}>
                Claims intelligence,<br /><span style={{ background: "linear-gradient(135deg, #0071E3, #34C759)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>made simple.</span>
              </h1>
              <p style={{ fontSize: 18, color: "#6E6E73", lineHeight: 1.65, maxWidth: 480, marginBottom: 32 }}>
                Analyze workers' compensation claims against the WSIB OPM. Get AI ruling predictions, automated compliance checks, and guided return-to-work tracking.
              </p>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <button onClick={() => scrollTo("auth")} style={{ padding: "14px 32px", borderRadius: 980, fontSize: 16, fontWeight: 700, border: "none", background: "#0071E3", color: "#fff", cursor: "pointer", boxShadow: "0 4px 16px rgba(0,113,227,.3)" }}>Start analyzing claims</button>
                <button onClick={() => scrollTo("features")} style={{ padding: "14px 32px", borderRadius: 980, fontSize: 16, fontWeight: 600, border: "1px solid #D2D2D7", background: "#fff", color: "#1D1D1F", cursor: "pointer" }}>See how it works</button>
              </div>
            </div>
            <div style={{ flex: 1, position: "relative", animation: "fadeUp .8s cubic-bezier(.25,.1,.25,1) .15s both" }}>
              <div style={{ background: "#fff", borderRadius: 20, padding: 24, boxShadow: "0 8px 40px rgba(0,0,0,.08)", border: "1px solid #E8E8ED" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}><span style={{ width: 10, height: 10, borderRadius: "50%", background: "#34C759" }} /><span style={{ fontSize: 13, fontWeight: 600 }}>CL-A7B2F1</span><span style={{ padding: "2px 10px", borderRadius: 980, fontSize: 11, fontWeight: 600, color: "#34C759", background: "rgba(52,199,89,.08)", border: "1px solid rgba(52,199,89,.15)" }}>Approved</span></div>
                <div style={{ padding: 14, background: "rgba(52,199,89,.04)", borderRadius: 12, border: "1px solid rgba(52,199,89,.1)", marginBottom: 12 }}><div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: "#34C759" }} /><span style={{ fontSize: 15, fontWeight: 700, color: "#1B7D36" }}>RULING PREDICTION: Allow</span></div></div>
                {["Active employer account", "Worker performing duties", "Injury by accident", "Arose from employment", "Resulting disability"].map((t, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 12px", background: "rgba(52,199,89,.04)", borderRadius: 8, border: "1px solid rgba(52,199,89,.08)", marginBottom: 4 }}>
                    <span style={{ width: 18, height: 18, borderRadius: "50%", background: "#34C759", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 800 }}>{"\u2713"}</span>
                    <span style={{ fontSize: 12, color: "#48484A" }}>{t}</span>
                  </div>
                ))}
                <div style={{ display: "flex", gap: 6, marginTop: 10 }}>{["OPM 15-02-02", "OPM 11-01-01", "M54.5"].map((t, i) => (<span key={i} style={{ padding: "3px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600, color: "#0071E3", background: "rgba(0,113,227,.06)", border: "1px solid rgba(0,113,227,.1)" }}>{t}</span>))}</div>
              </div>
              <div style={{ position: "absolute", bottom: -16, right: -16, background: "#fff", borderRadius: 14, padding: "12px 16px", boxShadow: "0 4px 20px rgba(0,0,0,.1)", border: "1px solid #E8E8ED", animation: "float 4s ease infinite", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 20 }}>{"\uD83D\uDCC8"}</span>
                <div><div style={{ fontSize: 18, fontWeight: 800 }}>78</div><div style={{ fontSize: 10, color: "#86868B" }}>Claim Strength</div></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* STATS */}
      <section style={{ padding: "40px 0", background: "#fff", borderBottom: "1px solid #E8E8ED" }}>
        <div className="sec"><div className="stats-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 24, textAlign: "center" }}>
          {[{ n: "Five Point", s: "Check System", d: "Full OPM adjudication" }, { n: "11", s: "Injury Types", d: "Including PTSD & mental stress" }, { n: "100%", s: "PIPEDA Compliant", d: "No PII in AI outputs" }, { n: "ICD-10", s: "Medical Database", d: "Diagnosis & recovery codes" }].map((x, i) => (
            <div key={i}><div style={{ fontSize: 28, fontWeight: 800, letterSpacing: -1, color: "#1D1D1F" }}>{x.n}</div><div style={{ fontSize: 13, fontWeight: 700, color: "#0071E3", marginBottom: 2 }}>{x.s}</div><div style={{ fontSize: 12, color: "#86868B" }}>{x.d}</div></div>
          ))}
        </div></div>
      </section>

      {/* FEATURES */}
      <section id="features" style={{ padding: "80px 0", background: "#FAFBFC" }}>
        <div className="sec">
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#0071E3", textTransform: "uppercase", letterSpacing: 2, marginBottom: 12 }}>Platform Features</div>
            <h2 style={{ fontSize: "clamp(28px, 4vw, 42px)", fontWeight: 800, letterSpacing: -1.5, color: "#1D1D1F", marginBottom: 14 }}>Everything you need to<br />adjudicate with confidence</h2>
            <p style={{ fontSize: 16, color: "#6E6E73", maxWidth: 520, margin: "0 auto" }}>From first report of injury to appeal hearing, CaseAssist guides every step.</p>
          </div>
          <div className="feat-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
            {[
              { icon: "\u2696\uFE0F", title: "AI Ruling Predictions", desc: "Five Point Check against the full OPM. Get Allow/Deny/Investigate with cited policy sections.", c: "#0071E3" },
              { icon: "\uD83D\uDCC4", title: "Document Intelligence", desc: "Upload forms and reports. Auto-tagged by type with entity extraction and Q&A.", c: "#34C759" },
              { icon: "\u23F0", title: "Deadline Engine", desc: "Auto-calculated filing deadlines, RTW milestones, appeal windows, and LOE reviews.", c: "#FF9500" },
              { icon: "\uD83D\uDEA9", title: "Red Flag Detection", desc: "Fraud indicators: late reporting, missing forms, inconsistent evidence, and more.", c: "#FF3B30" },
              { icon: "\uD83D\uDCCA", title: "Claim Strength Score", desc: "0-100 score based on evidence, compliance, medical consistency, and AI confidence.", c: "#AF52DE" },
              { icon: "\uD83D\uDCB0", title: "Benefit Calculator", desc: "LOE at 85% net earnings, NEL ranges, monthly projections, and review dates.", c: "#00C7BE" },
              { icon: "\uD83D\uDD04", title: "RTW Tracking", desc: "Visual timeline against clinical benchmarks per injury type with status indicators.", c: "#5856D6" },
              { icon: "\uD83D\uDCC8", title: "Analytics Dashboard", desc: "Approval rates, case distribution, ruling breakdown, and portfolio insights.", c: "#FF2D55" },
              { icon: "\uD83D\uDCDD", title: "Hearing Prep", desc: "One-click AI brief for WSIAT: chronology, OPM arguments, evidence, and rebuttals.", c: "#FF9500" },
            ].map((f, i) => (
              <div key={i} style={{ padding: 24, background: "#fff", borderRadius: 16, border: "1px solid #E8E8ED" }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: `${f.c}10`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, marginBottom: 14 }}>{f.icon}</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#1D1D1F", marginBottom: 6 }}>{f.title}</div>
                <div style={{ fontSize: 13, color: "#6E6E73", lineHeight: 1.55 }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* JOURNEY */}
      <section id="journey" style={{ padding: "80px 0", background: "#fff" }}>
        <div className="sec">
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#0071E3", textTransform: "uppercase", letterSpacing: 2, marginBottom: 12 }}>The Claims Journey</div>
            <h2 style={{ fontSize: "clamp(28px, 4vw, 42px)", fontWeight: 800, letterSpacing: -1.5, color: "#1D1D1F", marginBottom: 14 }}>Guided from intake to resolution</h2>
          </div>
          <div className="journey-grid" style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 0, position: "relative" }}>
            <div style={{ position: "absolute", top: 28, left: "10%", right: "10%", height: 3, background: "linear-gradient(90deg, #0071E3, #34C759)", borderRadius: 2, zIndex: 0 }} />
            {[{ n: "1", l: "New", d: "Upload docs, run first analysis", c: "#86868B" }, { n: "2", l: "Review", d: "Compliance checks, RTW assessment", c: "#0071E3" }, { n: "3", l: "Investigate", d: "Gather evidence, detect contradictions", c: "#FF9500" }, { n: "4", l: "Decision", d: "Approve, deny, or appeal", c: "#34C759" }, { n: "5", l: "Closed", d: "Archive with full audit trail", c: "#48484A" }].map((s, i) => (
              <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", position: "relative", zIndex: 1 }}>
                <div style={{ width: 56, height: 56, borderRadius: "50%", background: s.c, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 800, marginBottom: 12, boxShadow: `0 4px 16px ${s.c}40`, border: "4px solid #fff" }}>{s.n}</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#1D1D1F", marginBottom: 4 }}>{s.l}</div>
                <div style={{ fontSize: 12, color: "#86868B", textAlign: "center", lineHeight: 1.4, maxWidth: 140 }}>{s.d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* WHO */}
      <section id="who" style={{ padding: "80px 0", background: "#FAFBFC" }}>
        <div className="sec">
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#0071E3", textTransform: "uppercase", letterSpacing: 2, marginBottom: 12 }}>Who It's For</div>
            <h2 style={{ fontSize: "clamp(28px, 4vw, 42px)", fontWeight: 800, letterSpacing: -1.5, color: "#1D1D1F" }}>Built for the claims ecosystem</h2>
          </div>
          <div className="who-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
            {[
              { icon: "\u2696\uFE0F", title: "Injury Lawyers", desc: "Assess claim viability, build OPM-cited arguments, and generate hearing prep packages.", items: ["Claim strength scoring", "Appeal success prediction", "Case memo generation", "Hearing prep briefs"] },
              { icon: "\uD83C\uDFE2", title: "Employers & HR", desc: "Ensure Form 7 compliance, track RTW progress, and understand benefit obligations.", items: ["Filing deadline alerts", "RTW benchmarking", "Benefit calculator", "Compliance monitoring"] },
              { icon: "\uD83D\uDCCB", title: "Adjudicators & TPAs", desc: "Streamline caseloads with red flag detection, document classification, and evidence gap analysis.", items: ["Red flag detection", "Document auto-tagging", "What's missing checklist", "Portfolio analytics"] },
            ].map((w, i) => (
              <div key={i} style={{ padding: 28, background: "#fff", borderRadius: 16, border: "1px solid #E8E8ED" }}>
                <div style={{ fontSize: 32, marginBottom: 14 }}>{w.icon}</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: "#1D1D1F", marginBottom: 8, letterSpacing: -0.5 }}>{w.title}</div>
                <p style={{ fontSize: 13, color: "#6E6E73", lineHeight: 1.6, marginBottom: 16 }}>{w.desc}</p>
                {w.items.map((it, j) => (<div key={j} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#48484A", marginBottom: 6 }}><span style={{ width: 18, height: 18, borderRadius: "50%", background: "rgba(0,113,227,.06)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#0071E3", flexShrink: 0 }}>{"\u2713"}</span>{it}</div>))}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* DATA SOURCES */}
      <section style={{ padding: "60px 0", background: "#1D1D1F", color: "#fff" }}>
        <div className="sec" style={{ textAlign: "center" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#0071E3", textTransform: "uppercase", letterSpacing: 2, marginBottom: 12 }}>Knowledge Base</div>
          <h2 style={{ fontSize: "clamp(24px, 3.5vw, 36px)", fontWeight: 800, letterSpacing: -1.2, marginBottom: 36 }}>Cross-referencing authoritative sources</h2>
          <div style={{ display: "flex", justifyContent: "center", gap: 32, flexWrap: "wrap" }}>
            {[{ l: "WSIB OPM", s: "Operational Policy Manual", i: "\uD83D\uDCDA" }, { l: "ICD-10", s: "Medical Classification", i: "\uD83C\uDFE5" }, { l: "ODG", s: "Disability Guidelines", i: "\uD83D\uDCC4" }, { l: "PIPEDA", s: "Privacy Compliance", i: "\uD83D\uDD12" }, { l: "WSIA", s: "Ontario Legislation", i: "\u2696\uFE0F" }].map((x, i) => (
              <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                <div style={{ width: 56, height: 56, borderRadius: 14, background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>{x.i}</div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{x.l}</div>
                <div style={{ fontSize: 11, color: "#AEAEB2" }}>{x.s}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AUTH */}
      
<section style={{padding:"80px 24px",background:"#fff"}}>
<div style={{maxWidth:1000,margin:"0 auto",textAlign:"center"}}>
<div style={{fontSize:12,fontWeight:700,color:"#3B5EC0",textTransform:"uppercase",letterSpacing:2,marginBottom:12}}>Trusted By Professionals</div>
<h2 style={{fontSize:"clamp(28px, 4vw, 36px)",fontWeight:800,letterSpacing:-1,marginBottom:40}}>What our users are saying</h2>
<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(280px, 1fr))",gap:20}}>
{[{q:"CaseAssist cut our claim review time by over 60%. The Five Point Check analysis is incredibly thorough and cites the exact OPM policies.",n:"Sarah M.",r:"WC Paralegal",c:"Toronto Injury Law"},{q:"As an HR manager handling 50+ claims a year, the workflow tracking and deadline alerts have been a game changer. I never miss a filing deadline.",n:"David K.",r:"HR Director",c:"Ontario Manufacturing"},{q:"After my workplace injury, I was lost navigating WSIB. CaseAssist helped me understand exactly what was happening with my claim.",n:"Maria L.",r:"Injured Worker",c:"Mississauga, ON"}].map((t,i)=>(
<div key={i} style={{padding:"28px 24px",background:"var(--bg)",borderRadius:16,border:"1px solid var(--card-border)",textAlign:"left"}}>
<div style={{fontSize:14,color:"var(--g700)",lineHeight:1.7,marginBottom:16,fontStyle:"italic"}}>{'"'+t.q+'"'}</div>
<div style={{display:"flex",alignItems:"center",gap:10}}>
<div style={{width:36,height:36,borderRadius:"50%",background:"linear-gradient(135deg, #1A1040, #3B5EC0)",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:13,fontWeight:700}}>{t.n.charAt(0)}</div>
<div><div style={{fontSize:13,fontWeight:600,color:"var(--g800)"}}>{t.n}</div><div style={{fontSize:11,color:"var(--g500)"}}>{t.r}, {t.c}</div></div>
</div>
</div>))}
</div>
</div>
</section>
<section id="auth" ref={authRef} style={{ padding: "80px 0", background: "#FAFBFC" }}>
        <div className="sec">
          <div className="auth-split" style={{ display: "flex", gap: 60, alignItems: "center", maxWidth: 900, margin: "0 auto" }}>
            <div className="auth-left" style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#0071E3", textTransform: "uppercase", letterSpacing: 2, marginBottom: 12 }}>Get Started</div>
              <h2 style={{ fontSize: 36, fontWeight: 800, letterSpacing: -1.5, color: "#1D1D1F", marginBottom: 16 }}>Ready to analyze<br />your first claim?</h2>
              <p style={{ fontSize: 15, color: "#6E6E73", lineHeight: 1.65, marginBottom: 24 }}>Sign in or create an account. All you need is an access code from your administrator.</p>
              {["\u2713 AI-powered Five Point Check", "\u2713 Deadline tracking & notifications", "\u2713 Document intelligence & auto-tagging", "\u2713 Benefit calculator & cost forecasting", "\u2713 Export cases as JSON or CSV"].map((x, i) => (<div key={i} style={{ fontSize: 14, color: "#48484A", fontWeight: 500, marginBottom: 8 }}>{x}</div>))}
            </div>
            <div style={{ width: 400, flexShrink: 0 }}>
              <div style={{ display: "flex", gap: 2, padding: 3, background: "#E8E8ED", borderRadius: 12, marginBottom: 20 }}>
                {["login", "signup"].map(t => (<button key={t} onClick={() => { setTab(t); setError(""); }} style={{ flex: 1, padding: "9px 0", borderRadius: 10, border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer", background: tab === t ? "#fff" : "transparent", color: tab === t ? "#1D1D1F" : "#86868B", boxShadow: tab === t ? "0 1px 3px rgba(0,0,0,.06)" : "none" }}>{t === "login" ? "Sign In" : "Create Account"}</button>))}
              </div>
              <div style={{ background: "#fff", borderRadius: 18, padding: 26, border: "1px solid #E8E8ED", boxShadow: "0 2px 24px rgba(0,0,0,.04)" }}>
                <form onSubmit={tab === "login" ? handleLogin : handleSignup}>
                  {tab === "signup" && (<><label style={lbl}>Access Code</label><input style={inp} type="text" value={inviteCode} onChange={e => setInviteCode(e.target.value)} placeholder="Enter your access code" required /><label style={lbl}>Full Name</label><input style={inp} type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Jane Smith" /></>)}
                  <label style={lbl}>Email</label><input style={inp} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required />
                  <label style={lbl}>Password</label><input style={inp} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder={"\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"} required minLength={8} />
                  {error && <div style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(255,59,48,.05)", border: "1px solid rgba(255,59,48,.1)", color: "#CC2D26", fontSize: 13, fontWeight: 500, marginTop: 14 }}>{error}</div>}
                  <button type="submit" disabled={loading} style={{ width: "100%", marginTop: 18, padding: "13px", borderRadius: 12, border: "none", background: loading ? "#D2D2D7" : "#0071E3", color: "#fff", fontSize: 15, fontWeight: 600, cursor: loading ? "wait" : "pointer" }}>{loading ? "Please wait\u2026" : tab === "login" ? "Sign In" : "Create Account"}</button>
                </form>
                {tab === "signup" && <p style={{ textAlign: "center", marginTop: 14, fontSize: 12, color: "#AEAEB2" }}>Need an access code? Contact your firm administrator.</p>}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ padding: "32px 0", background: "#fff", borderTop: "1px solid #E8E8ED" }}>
        <div className="sec" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}><div style={{ width: 24, height: 24, borderRadius: 6, background: "#1D1D1F", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="#fff" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" /></svg></div><span style={{ fontSize: 14, fontWeight: 700 }}>CaseAssist</span></div>
          <p style={{ fontSize: 11, color: "#AEAEB2" }}>Advisory tool only. Final decisions by authorized WSIB adjudicators. {"\u00A9"} 2026</p>
        </div>
      </footer>
    </div>
  );
}

const lbl = { display: "block", fontSize: 12, fontWeight: 600, color: "#86868B", marginBottom: 5, marginTop: 16 };
const inp = { width: "100%", padding: "11px 14px", borderRadius: 10, border: "1px solid #E8E8ED", fontSize: 14, outline: "none", background: "#FAFAFA", fontFamily: "inherit" };
