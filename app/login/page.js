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
  const [mobileNav, setMobileNav] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const router = useRouter();
  const authRef = useRef(null);

  const handleLogin = async (e) => { e.preventDefault(); setError(""); setLoading(true); const res = await signIn("credentials", { email, password, redirect: false }); setLoading(false); if (res?.error) setError("Invalid email or password."); else router.push("/dashboard"); };
  const handleSignup = async (e) => { e.preventDefault(); setError(""); setLoading(true); try { const res = await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password, name, inviteCode }) }); const data = await res.json(); if (!res.ok) { setError(data.error || "Signup failed."); setLoading(false); return; } const loginRes = await signIn("credentials", { email, password, redirect: false }); setLoading(false); if (loginRes?.error) { setError("Account created. Please sign in."); setTab("login"); } else router.push("/dashboard"); } catch { setError("Something went wrong."); setLoading(false); } };
  const handleForgot = async (e) => { e.preventDefault(); setError(""); if (!email) { setError("Enter your email address above."); return; } setLoading(true); try { await fetch("/api/auth/forgot-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) }); setForgotSent(true); } catch { setError("Something went wrong."); } setLoading(false); };
  const scrollTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });

  return (
    <div style={{ minHeight: "100vh", background: "#FAFBFC", fontFamily: "'Plus Jakarta Sans', -apple-system, sans-serif", overflowX: "hidden" }}>
      <style>{`
        @keyframes fadeUp{from{opacity:0;transform:translateY(30px)}to{opacity:1;transform:translateY(0)}}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-12px)}}
        *{box-sizing:border-box;margin:0;padding:0}input,button{font-family:inherit}::placeholder{color:#AEAEB2}
        .sec{max-width:1120px;margin:0 auto;padding:0 28px}
        .nav-links{display:flex;gap:24px;align-items:center}
        .nav-toggle{display:none;background:none;border:none;cursor:pointer;padding:8px;color:#1D1D1F}
        .nav-mobile-menu{display:none}
        @media(max-width:900px){
          .hero-grid{flex-direction:column!important;text-align:center}
          .hero-grid>div:first-child{align-items:center!important}
          .hero-grid>div:last-child{width:100%!important;max-width:400px;margin:0 auto}
          .feat-grid{grid-template-columns:1fr 1fr!important}
          .journey-grid{grid-template-columns:repeat(4,1fr)!important;gap:8px!important}
          .journey-grid>div>div:first-child{display:none}
          .who-grid{grid-template-columns:1fr!important}
          .sec{padding-left:20px!important;padding-right:20px!important}
          .auth-split{flex-direction:column!important}
          .auth-left{display:none!important}
          .nav-links{display:none!important}
          .nav-toggle{display:flex!important}
          .nav-mobile-menu.open{display:flex!important;flex-direction:column;position:absolute;top:100%;left:0;right:0;background:rgba(250,251,252,.98);backdrop-filter:saturate(180%) blur(20px);border-bottom:1px solid rgba(0,0,0,.06);padding:12px 20px 20px;gap:4px;z-index:99}
          .nav-mobile-menu.open a,.nav-mobile-menu.open span,.nav-mobile-menu.open button{display:block;padding:12px 0;font-size:15px!important;text-align:left;width:100%}
        }
        @media(max-width:600px){
          .feat-grid{grid-template-columns:1fr!important;gap:10px!important}
          .who-grid{grid-template-columns:1fr!important}
          .hero-grid h1{font-size:28px!important}
          .stats-grid{grid-template-columns:1fr 1fr!important}
          .journey-grid{grid-template-columns:repeat(3,1fr)!important;gap:6px!important}
          .journey-grid>div:nth-child(n+5){display:none}
        }
        @media(max-width:480px){
          nav{padding:12px 16px!important}
          nav span{font-size:16px!important}
          .hero-grid h1{font-size:24px!important}
          .journey-grid{grid-template-columns:1fr 1fr!important}
          .auth-card-wrap{width:100%!important;min-width:0!important;flex-shrink:1!important}
        }
      `}</style>

      {/* NAV */}
      <nav style={{ position: "sticky", top: 0, zIndex: 100, background: "rgba(250,251,252,.85)", backdropFilter: "saturate(180%) blur(20px)", borderBottom: "1px solid rgba(0,0,0,.04)" }}>
        <div className="sec" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 60 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 34, height: 34 }}>
              <svg width="34" height="34" viewBox="0 0 80 90" fill="none">
                <defs><linearGradient id="navl" x1="0" y1="0" x2="0.5" y2="1"><stop offset="0%" stopColor="#1A1040"/><stop offset="100%" stopColor="#2E3580"/></linearGradient></defs>
                <rect x="16" y="16" width="54" height="64" rx="12" fill="#3B5EC0" opacity="0.5"/>
                <rect x="10" y="10" width="54" height="64" rx="12" fill="#2E3580" opacity="0.7"/>
                <rect x="4" y="4" width="54" height="64" rx="12" fill="url(#navl)"/>
                <line x1="16" y1="22" x2="44" y2="22" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" opacity="0.7"/>
                <line x1="16" y1="34" x2="38" y2="34" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" opacity="0.5"/>
                <line x1="16" y1="46" x2="32" y2="46" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" opacity="0.35"/>
                <path d="M42 19L45.5 22.5L52 15" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" opacity="0.9"/>
              </svg>
            </div>
            <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: -0.5, color: "#1D1D1F" }}>CaseAssist</span>
          </div>
          <div className="nav-links">
            <a href="/pricing" style={{ fontSize: 13, fontWeight: 500, color: "#6E6E73", textDecoration: "none" }}>Pricing</a>
            <a href="/blog" style={{ fontSize: 13, fontWeight: 500, color: "#6E6E73", textDecoration: "none" }}>Blog</a>
            <a href="/demo" style={{ fontSize: 13, fontWeight: 500, color: "#6E6E73", textDecoration: "none" }}>Request Demo</a>
            <span onClick={() => scrollTo("features")} style={{ fontSize: 13, fontWeight: 500, color: "#6E6E73", cursor: "pointer" }}>Features</span>
            <span onClick={() => scrollTo("journey")} style={{ fontSize: 13, fontWeight: 500, color: "#6E6E73", cursor: "pointer" }}>How It Works</span>
            <span onClick={() => scrollTo("who")} style={{ fontSize: 13, fontWeight: 500, color: "#6E6E73", cursor: "pointer" }}>Who For</span>
            <button onClick={() => { setTab("login"); scrollTo("auth"); }} style={{ padding: "8px 18px", borderRadius: 980, fontSize: 13, fontWeight: 600, border: "none", background: "#0071E3", color: "#fff", cursor: "pointer" }}>Sign In</button>
          </div>
          <button className="nav-toggle" onClick={() => setMobileNav(!mobileNav)} aria-label="Menu">
            <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              {mobileNav
                ? <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                : <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              }
            </svg>
          </button>
          <div className={`nav-mobile-menu ${mobileNav ? "open" : ""}`}>
            <a href="/pricing" onClick={() => setMobileNav(false)} style={{ fontSize: 14, fontWeight: 500, color: "#3E3F44", textDecoration: "none" }}>Pricing</a>
            <a href="/blog" onClick={() => setMobileNav(false)} style={{ fontSize: 14, fontWeight: 500, color: "#3E3F44", textDecoration: "none" }}>Blog</a>
            <a href="/demo" onClick={() => setMobileNav(false)} style={{ fontSize: 14, fontWeight: 500, color: "#3E3F44", textDecoration: "none" }}>Request Demo</a>
            <span onClick={() => { scrollTo("features"); setMobileNav(false); }} style={{ fontSize: 14, fontWeight: 500, color: "#3E3F44", cursor: "pointer" }}>Features</span>
            <span onClick={() => { scrollTo("journey"); setMobileNav(false); }} style={{ fontSize: 14, fontWeight: 500, color: "#3E3F44", cursor: "pointer" }}>How It Works</span>
            <button onClick={() => { setTab("login"); scrollTo("auth"); setMobileNav(false); }} style={{ padding: "12px 24px", borderRadius: 980, fontSize: 14, fontWeight: 600, border: "none", background: "#0071E3", color: "#fff", cursor: "pointer", marginTop: 8, width: "100%" }}>Sign In</button>
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
                Analyze workers' compensation claims against the WSIB OPM. Get AI ruling predictions, guided workflow tracking, email integration, and smart risk alerts.
              </p>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
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
            <div style={{ fontSize: 12, fontWeight: 700, color: "#3B5EC0", textTransform: "uppercase", letterSpacing: 2, marginBottom: 12 }}>Platform Features</div>
            <h2 style={{ fontSize: "clamp(28px, 4vw, 42px)", fontWeight: 800, letterSpacing: -1.5, color: "#1D1D1F", marginBottom: 14 }}>Everything you need to<br />adjudicate with confidence</h2>
            <p style={{ fontSize: 16, color: "#6E6E73", maxWidth: 520, margin: "0 auto" }}>AI-powered workflow, email integration, smart warnings, and full claim lifecycle management.</p>
          </div>
          <div className="feat-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
            {[
              { title: "AI Ruling Predictions", desc: "Five Point Check against the full OPM. Get Allow/Deny/Investigate with cited policy sections.", c: "#3B5EC0", icon: `<svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19 14.5M14.25 3.104c.251.023.501.05.75.082M19 14.5l-2.47 2.47m0 0a3.493 3.493 0 01-2.03.602c-.742 0-1.45-.238-2.03-.602m4.06 0L19 19m-7.53-2.03L9 19m0 0l-1.47-1.47M9 19v-3.5"/></svg>` },
              { title: "Document Intelligence", desc: "Dedicated upload buttons per form type. Auto-tagged with rename, download, and delete.", c: "#28A745", icon: `<svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m5.231 13.481L15 17.25m-4.5-15H5.625c-.621 0-1.125.504-1.125 1.125v16.5c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9zm3.75 11.625a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"/></svg>` },
              { title: "7-Step Workflow Engine", desc: "Guided case progression from intake to resolution with auto-completion tracking.", c: "#6C5CE7", icon: `<svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zm0 9.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zm0 9.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25a2.25 2.25 0 01-2.25-2.25v-2.25z"/></svg>` },
              { title: "Claim Board", desc: "Drag-and-drop Kanban pipeline with AI briefs, risk scores, and smart warnings.", c: "#251A5E", icon: `<svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 4.5v15m6-15v15m-10.875 0h15.75c.621 0 1.125-.504 1.125-1.125V5.625c0-.621-.504-1.125-1.125-1.125H4.125c-.621 0-1.125.504-1.125 1.125v12.75c0 .621.504 1.125 1.125 1.125z"/></svg>` },
              { title: "Red Flag Detection", desc: "Automated compliance alerts: late reporting, going dark, missing forms, evidence gaps.", c: "#E53935", icon: `<svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/></svg>` },
              { title: "Email Integration", desc: "Send emails directly from CaseAssist. Full thread logging with reply and forward.", c: "#0071E3", icon: `<svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"/></svg>` },
              { title: "Benefit Calculator", desc: "LOE at 85% net earnings, NEL estimates, AWW calculator, and full claim valuation.", c: "#00C7BE", icon: `<svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 15.75V18m-7.5-6.75h.008v.008H8.25v-.008zm0 2.25h.008v.008H8.25v-.008zm0 2.25h.008v.008H8.25v-.008zm0 2.25h.008v.008H8.25v-.008zm2.498-6.75h.007v.008h-.007v-.008zm0 2.25h.007v.008h-.007v-.008zm0 2.25h.007v.008h-.007v-.008zm0 2.25h.007v.008h-.007v-.008zm2.504-6.75h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008v-.008zm2.498-6.75h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008v-.008zM8.25 6h7.5v2.25h-7.5V6zM12 2.25c-1.892 0-3.758.11-5.593.322C5.307 2.7 4.5 3.65 4.5 4.757V19.5a2.25 2.25 0 002.25 2.25h10.5a2.25 2.25 0 002.25-2.25V4.757c0-1.108-.806-2.057-1.907-2.185A48.507 48.507 0 0012 2.25z"/></svg>` },
              { title: "Deadline Engine", desc: "Auto-calculated filing deadlines, diary follow-ups, and overdue alerts with reminders.", c: "#F57C00", icon: `<svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>` },
              { title: "OPM Policy Reference", desc: "289 WSIB policies embedded. Inline expandable reference with links to official sources.", c: "#5856D6", icon: `<svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"/></svg>` },
              { title: "PDF Export", desc: "One-click professional case reports with ruling history, valuation, documents, and timeline.", c: "#AF52DE", icon: `<svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"/></svg>` },
              { title: "Analytics Dashboard", desc: "Portfolio-wide insights: approval rates, case distribution, risk breakdown, and trends.", c: "#FF2D55", icon: `<svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"/></svg>` },
              { title: "PII Protection", desc: "Client-side PII redaction before AI processing. PIPEDA compliant with configurable levels.", c: "#1A1040", icon: `<svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"/></svg>` },
            ].map((f, i) => (
              <div key={i} style={{ padding: 24, background: "#fff", borderRadius: 16, border: "1px solid #E8E8ED" }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: `${f.c}08`, border: `1px solid ${f.c}15`, display: "flex", alignItems: "center", justifyContent: "center", color: f.c, marginBottom: 14 }} dangerouslySetInnerHTML={{ __html: f.icon }} />
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
            <div style={{ fontSize: 12, fontWeight: 700, color: "#3B5EC0", textTransform: "uppercase", letterSpacing: 2, marginBottom: 12 }}>The Claims Journey</div>
            <h2 style={{ fontSize: "clamp(28px, 4vw, 42px)", fontWeight: 800, letterSpacing: -1.5, color: "#1D1D1F", marginBottom: 14 }}>Guided through every step</h2>
          </div>
          <div className="journey-grid" style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 0, position: "relative" }}>
            <div style={{ position: "absolute", top: 28, left: "10%", right: "10%", height: 3, background: "linear-gradient(90deg, #0071E3, #34C759)", borderRadius: 2, zIndex: 0 }} />
            {[{ n: "1", l: "Report", d: "File Form 6 & 7, document injury", c: "#3B5EC0" }, { n: "2", l: "Contact", d: "Three-point: worker, employer, medical", c: "#6C5CE7" }, { n: "3", l: "Evidence", d: "Upload Form 8, medical records", c: "#0071E3" }, { n: "4", l: "Analyze", d: "Run AI Five Point Check", c: "#FF9500" }, { n: "5", l: "Decide", d: "Review ruling, calculate benefits", c: "#28A745" }, { n: "6", l: "RTW", d: "Modified duties, return to work", c: "#00C7BE" }, { n: "7", l: "Resolve", d: "Close claim or begin appeal", c: "#6E6E73" }].map((s, i) => (
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
            <div style={{ fontSize: 12, fontWeight: 700, color: "#3B5EC0", textTransform: "uppercase", letterSpacing: 2, marginBottom: 12 }}>Who It's For</div>
            <h2 style={{ fontSize: "clamp(28px, 4vw, 42px)", fontWeight: 800, letterSpacing: -1.5, color: "#1D1D1F" }}>Built for the claims ecosystem</h2>
          </div>
          <div className="who-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
            {[
              { icon: "\u2696\uFE0F", title: "Injury Lawyers", desc: "AI-powered ruling predictions, letter generation, demand packages, and claim valuation.", items: ["AI ruling predictions", "Demand package builder", "Letter generation", "Claim valuation calculator"] },
              { icon: "\uD83C\uDFE2", title: "Employers & HR", desc: "Filing compliance, modified duties tracking, benefit calculations, and direct email from the platform.", items: ["Filing deadline alerts", "Modified duties tracking", "Three-point contact tracker", "Email integration"] },
              { icon: "\uD83D\uDCCB", title: "Adjudicators & TPAs", desc: "Kanban claim board, AI briefs, risk scoring, smart warnings, and 7-step workflow tracking.", items: ["Claim board pipeline", "Risk assessment scoring", "What's missing checklist", "Workflow progress tracking"] },
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
          <div style={{ fontSize: 12, fontWeight: 700, color: "#3B5EC0", textTransform: "uppercase", letterSpacing: 2, marginBottom: 12 }}>Knowledge Base</div>
          <h2 style={{ fontSize: "clamp(24px, 3.5vw, 36px)", fontWeight: 800, letterSpacing: -1.2, marginBottom: 36 }}>Cross-referencing authoritative sources</h2>
          <div style={{ display: "flex", justifyContent: "center", gap: 32, flexWrap: "wrap" }}>
            {[{ l: "WSIB OPM", s: "Operational Policy Manual", i: "\uD83D\uDCDA" }, { l: "ICD-10", s: "Medical Classification", i: "\uD83C\uDFE5" }, { l: "ODG", s: "Disability Guidelines", i: "\uD83D\uDCC4" }, { l: "PIPEDA", s: "Privacy Compliance", i: "\uD83D\uDD12" }, { l: "WSIA", s: "Ontario Legislation", i: "\u2696\uFE0F" }].map((x, i) => (
              <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                <div style={{ width: 56, height: 56, borderRadius: 14, background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)", display: "flex", alignItems: "center", justifyContent: "center" }} dangerouslySetInnerHTML={{ __html: x.i }} />
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
              <div style={{ fontSize: 12, fontWeight: 700, color: "#3B5EC0", textTransform: "uppercase", letterSpacing: 2, marginBottom: 12 }}>Get Started</div>
              <h2 style={{ fontSize: 36, fontWeight: 800, letterSpacing: -1.5, color: "#1D1D1F", marginBottom: 16 }}>Ready to analyze<br />your first claim?</h2>
              <p style={{ fontSize: 15, color: "#6E6E73", lineHeight: 1.65, marginBottom: 24 }}>Sign in or create an account. All you need is an access code from your administrator.</p>
              {["\u2713 AI-powered Five Point Check", "\u2713 Deadline tracking & notifications", "\u2713 Document intelligence & auto-tagging", "\u2713 Three-point contact tracker & cost forecasting", "\u2713 Export cases as JSON or CSV"].map((x, i) => (<div key={i} style={{ fontSize: 14, color: "#48484A", fontWeight: 500, marginBottom: 8 }}>{x}</div>))}
            </div>
            <div className="auth-card-wrap" style={{ width: 400, maxWidth: "100%", flexShrink: 0 }}>
              <div style={{ display: "flex", gap: 2, padding: 3, background: "#E8E8ED", borderRadius: 12, marginBottom: 20 }}>
                {["login", "signup"].map(t => (<button key={t} onClick={() => { setTab(t); setError(""); }} style={{ flex: 1, padding: "9px 0", borderRadius: 10, border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer", background: tab === t ? "#fff" : "transparent", color: tab === t ? "#1D1D1F" : "#86868B", boxShadow: tab === t ? "0 1px 3px rgba(0,0,0,.06)" : "none" }}>{t === "login" ? "Sign In" : "Create Account"}</button>))}
              </div>
              <div style={{ background: "#fff", borderRadius: 18, padding: 26, border: "1px solid #E8E8ED", boxShadow: "0 2px 24px rgba(0,0,0,.04)" }}>
                <form onSubmit={forgotMode ? handleForgot : (tab === "login" ? handleLogin : handleSignup)}>
                  {forgotMode ? (<>
                    <label style={lbl}>Email</label><input style={inp} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required autoFocus />
                    {forgotSent ? (
                      <div style={{ padding: "16px", background: "rgba(40,167,69,.04)", border: "1px solid rgba(40,167,69,.12)", borderRadius: 12, textAlign: "center", marginTop: 10 }}>
                        <div style={{ fontSize: 15, fontWeight: 700, color: "#28A745", marginBottom: 4 }}>Check your inbox</div>
                        <div style={{ fontSize: 13, color: "#6E6F76", lineHeight: 1.5 }}>We sent a password reset link to <strong>{email}</strong>. It expires in 1 hour.</div>
                      </div>
                    ) : (<>
                      {error && <div style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(255,59,48,.05)", border: "1px solid rgba(255,59,48,.1)", color: "#CC2D26", fontSize: 13, fontWeight: 500, marginTop: 14 }}>{error}</div>}
                      <button type="submit" disabled={loading} style={{ width: "100%", marginTop: 18, padding: "13px", borderRadius: 12, border: "none", background: loading ? "#D2D2D7" : "#0071E3", color: "#fff", fontSize: 15, fontWeight: 600, cursor: loading ? "wait" : "pointer" }}>{loading ? "Sending..." : "Send reset link"}</button>
                    </>)}
                    <button type="button" onClick={() => { setForgotMode(false); setForgotSent(false); setError(""); }} style={{ width: "100%", marginTop: 10, padding: "10px", borderRadius: 10, border: "none", background: "transparent", color: "#0071E3", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Back to sign in</button>
                  </>) : (<>
                  {tab === "signup" && (<><label style={lbl}>Access Code</label><input style={inp} type="text" value={inviteCode} onChange={e => setInviteCode(e.target.value)} placeholder="Enter your access code" required /><label style={lbl}>Full Name</label><input style={inp} type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Jane Smith" /></>)}
                  <label style={lbl}>Email</label><input style={inp} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required />
                  <label style={lbl}>Password</label><input style={inp} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder={"\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"} required minLength={8} />
                  {tab === "login" && <div style={{ textAlign: "right", marginTop: 4 }}><button type="button" onClick={() => { setForgotMode(true); setError(""); }} style={{ background: "none", border: "none", color: "#0071E3", fontSize: 12, fontWeight: 600, cursor: "pointer", padding: 0 }}>Forgot password?</button></div>}
                  {error && <div style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(255,59,48,.05)", border: "1px solid rgba(255,59,48,.1)", color: "#CC2D26", fontSize: 13, fontWeight: 500, marginTop: 14 }}>{error}</div>}
                  <button type="submit" disabled={loading} style={{ width: "100%", marginTop: 18, padding: "13px", borderRadius: 12, border: "none", background: loading ? "#D2D2D7" : "#0071E3", color: "#fff", fontSize: 15, fontWeight: 600, cursor: loading ? "wait" : "pointer" }}>{loading ? "Please wait\u2026" : tab === "login" ? "Sign In" : "Create Account"}</button>
                  </>)}
                </form>
                {!forgotMode && (<>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "18px 0 14px" }}>
                    <div style={{ flex: 1, height: 1, background: "#E8E8ED" }} />
                    <span style={{ fontSize: 12, color: "#AEAEB2", fontWeight: 500 }}>or continue with</span>
                    <div style={{ flex: 1, height: 1, background: "#E8E8ED" }} />
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => signIn("google", { callbackUrl: "/dashboard" })} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "11px", borderRadius: 12, border: "1px solid #E0E1E6", background: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#3D3F47", fontFamily: "inherit" }}>
                      <svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                      Google
                    </button>
                    <button onClick={() => signIn("azure-ad", { callbackUrl: "/dashboard" })} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "11px", borderRadius: 12, border: "1px solid #E0E1E6", background: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#3D3F47", fontFamily: "inherit" }}>
                      <svg width="18" height="18" viewBox="0 0 23 23"><path fill="#f35325" d="M1 1h10v10H1z"/><path fill="#81bc06" d="M12 1h10v10H12z"/><path fill="#05a6f0" d="M1 12h10v10H1z"/><path fill="#ffba08" d="M12 12h10v10H12z"/></svg>
                      Microsoft
                    </button>
                  </div>
                </>)}
                {tab === "signup" && <p style={{ textAlign: "center", marginTop: 14, fontSize: 12, color: "#AEAEB2" }}>Need an access code? Contact your firm administrator.</p>}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ padding: "32px 0", background: "#fff", borderTop: "1px solid #E8E8ED" }}>
        <div className="sec" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}><div style={{ width: 24, height: 24 }}><svg width="24" height="24" viewBox="0 0 80 90" fill="none"><defs><linearGradient id="fl" x1="0" y1="0" x2="0.5" y2="1"><stop offset="0%" stopColor="#1A1040"/><stop offset="100%" stopColor="#2E3580"/></linearGradient></defs><rect x="16" y="16" width="54" height="64" rx="12" fill="#3B5EC0" opacity="0.5"/><rect x="10" y="10" width="54" height="64" rx="12" fill="#2E3580" opacity="0.7"/><rect x="4" y="4" width="54" height="64" rx="12" fill="url(#fl)"/><line x1="16" y1="22" x2="44" y2="22" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" opacity="0.7"/><line x1="16" y1="34" x2="38" y2="34" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" opacity="0.5"/><line x1="16" y1="46" x2="32" y2="46" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" opacity="0.35"/><path d="M42 19L45.5 22.5L52 15" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" opacity="0.9"/></svg></div><span style={{ fontSize: 14, fontWeight: 700 }}>CaseAssist</span></div>
          <p style={{ fontSize: 11, color: "#AEAEB2" }}>Advisory tool only. Final decisions by authorized WSIB adjudicators. {"\u00A9"} 2026</p>
        </div>
      </footer>
    </div>
  );
}

const lbl = { display: "block", fontSize: 12, fontWeight: 600, color: "#86868B", marginBottom: 5, marginTop: 16 };
const inp = { width: "100%", padding: "11px 14px", borderRadius: 10, border: "1px solid #E8E8ED", fontSize: 14, outline: "none", background: "#FAFAFA", fontFamily: "inherit" };
