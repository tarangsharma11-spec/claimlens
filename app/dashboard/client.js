"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { signOut } from "next-auth/react";

/*
  This is the full ClaimLens portal UI — identical to the artifact version
  but adapted for Next.js:
  - API calls go to /api/chat (server-side proxy) instead of direct Anthropic calls
  - Claims stored in localStorage for now (swap to DB API routes for production)
  - User session passed as prop from server component
*/

/* ═══ Markdown renderer ═══ */
const Msg = ({ text }) => {
  const lines = (text || "").split("\n");
  return (<div className="ai-text">{lines.map((raw, i) => {
    const t = raw.trim();
    if (!t) return <div key={i} style={{ height: 10 }} />;
    if (/^#{1,3}\s/.test(t)) { const l = t.match(/^(#+)/)[1].length; return <div key={i} className={`ai-h ai-h${l}`}>{t.replace(/^#+\s*/, "")}</div>; }
    if (/\*\*RULING PREDICTION/i.test(t) || /^RULING PREDICTION/i.test(t)) { const a = /allow/i.test(t), d = /deny/i.test(t); return <div key={i} className={`ai-ruling ${a ? "allow" : d ? "deny" : "inv"}`}><span className="ai-rdot" />{t.replace(/\*\*/g, "")}</div>; }
    if (/^⚠/.test(t)) return <div key={i} className="ai-flag">{t}</div>;
    if (/^(OPM\s+)?\d{2}-\d{2}-\d{2}/i.test(t)) return <div key={i} className="ai-opm">{t}</div>;
    if (/^[✓✔]\s/.test(t)) return <div key={i} className="ai-chk pass"><span className="ai-ci">✓</span><span>{t.replace(/^[✓✔]\s*/, "")}</span></div>;
    if (/^[✗✘]\s/.test(t)) return <div key={i} className="ai-chk fail"><span className="ai-ci">✗</span><span>{t.replace(/^[✗✘]\s*/, "")}</span></div>;
    if (/^[-•]\s/.test(t)) return <div key={i} className="ai-li">{t.replace(/^[-•]\s*/, "")}</div>;
    if (/^\d+[.)]\s/.test(t)) { const n = t.match(/^(\d+)/)[1]; return <div key={i} className="ai-ol"><span className="ai-oln">{n}</span>{t.replace(/^\d+[.)]\s*/, "")}</div>; }
    const p = t.split(/(\*\*[^*]+\*\*)/g);
    if (p.length > 1) return <div key={i} className="ai-p">{p.map((s, j) => /^\*\*/.test(s) ? <strong key={j}>{s.replace(/\*\*/g, "")}</strong> : <span key={j}>{s}</span>)}</div>;
    return <div key={i} className="ai-p">{t}</div>;
  })}</div>);
};

const STAGES = [
  { id: "new", label: "New", color: "#86868B" },
  { id: "review", label: "Under Review", color: "#0071E3" },
  { id: "approved", label: "Approved", color: "#34C759" },
  { id: "denied", label: "Denied", color: "#FF3B30" },
  { id: "investigating", label: "Investigating", color: "#FF9500" },
  { id: "appeal", label: "Appeal", color: "#AF52DE" },
  { id: "closed", label: "Closed", color: "#48484A" },
];
const stageOf = id => STAGES.find(s => s.id === id) || STAGES[0];
const fmt = iso => { if (!iso || iso === "—") return "—"; try { return new Date(iso).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" }); } catch { return iso; } };
const fmtTime = iso => { try { return new Date(iso).toLocaleString("en-CA", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }); } catch { return ""; } };

// ── Local storage for claims (swap to API calls for production DB) ──
function loadClaims() {
  try { return JSON.parse(window.localStorage.getItem("claimlens_claims") || "[]"); } catch { return []; }
}
function persistClaims(claims) {
  try { window.localStorage.setItem("claimlens_claims", JSON.stringify(claims)); } catch {}
}

export default function DashboardClient({ user }) {
  const [view, setView] = useState("home");
  const [claims, setClaims] = useState([]);
  const [active, setActive] = useState(null);
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState([]);
  const [fc, setFc] = useState({});
  const [modal, setModal] = useState(null);
  const [nf, setNf] = useState({ claimNumber: "", worker: "", employer: "", injuryDate: "", injuryType: "Acute Injury", description: "" });
  const [noteIn, setNoteIn] = useState("");
  const [filter, setFilter] = useState("all");
  const fRef = useRef(null);
  const endRef = useRef(null);
  const taRef = useRef(null);

  useEffect(() => { setClaims(loadClaims()); }, []);
  useEffect(() => { if (claims.length > 0) persistClaims(claims); }, [claims]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, loading]);

  const saveClaim = (c) => {
    c.updatedAt = new Date().toISOString();
    setClaims(p => { const idx = p.findIndex(x => x.id === c.id); const n = [...p]; if (idx >= 0) n[idx] = c; else n.unshift(c); return n; });
    setActive(c);
  };

  const createClaim = () => {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const c = { id, claimNumber: nf.claimNumber || `CL-${id.slice(0, 6).toUpperCase()}`, worker: nf.worker || "—", employer: nf.employer || "—", injuryDate: nf.injuryDate || "—", injuryType: nf.injuryType, description: nf.description || "", stage: "new", timeline: [{ date: new Date().toISOString(), type: "created", note: "Claim record created" }], documents: [], analyses: [], messages: [], notes: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    saveClaim(c);
    setNf({ claimNumber: "", worker: "", employer: "", injuryDate: "", injuryType: "Acute Injury", description: "" });
    setModal(null);
    openClaim(c);
  };

  const openClaim = c => { setActive(c); setMsgs(c.messages || []); setView("detail"); };
  const openChat = c => { if (c) { setActive(c); setMsgs(c.messages || []); } setView("chat"); };
  const changeStage = sid => { const c = { ...active, stage: sid, timeline: [...(active.timeline || []), { date: new Date().toISOString(), type: "stage", note: `Status → ${stageOf(sid).label}` }] }; saveClaim(c); setModal(null); };
  const addNote = () => { if (!noteIn.trim()) return; const c = { ...active, notes: [...(active.notes || []), { date: new Date().toISOString(), text: noteIn.trim() }], timeline: [...(active.timeline || []), { date: new Date().toISOString(), type: "note", note: noteIn.trim() }] }; saveClaim(c); setNoteIn(""); };
  const delClaim = id => { setClaims(p => p.filter(c => c.id !== id)); persistClaims(claims.filter(c => c.id !== id)); if (active?.id === id) { setActive(null); setView("claims"); } };

  const addFiles = useCallback(e => { const n = Array.from(e.target.files); setFiles(p => [...p, ...n]); n.forEach(f => { const r = new FileReader(); r.onload = ev => setFc(p => ({ ...p, [f.name]: ev.target.result })); r.readAsText(f); }); e.target.value = ""; }, []);
  const rmFile = n => { setFiles(p => p.filter(f => f.name !== n)); setFc(p => { const x = { ...p }; delete x[n]; return x; }); };

  const send = async (override) => {
    const text = override || input.trim();
    if (!text && files.length === 0) return;
    setInput(""); if (taRef.current) taRef.current.style.height = "auto";
    let content = text;
    const af = [...files];
    if (af.length > 0 && Object.keys(fc).length > 0) content = `${text || "Please analyze these claim documents."}\n\n[UPLOADED DOCUMENTS]\n${Object.entries(fc).map(([n, c]) => `── ${n} ──\n${c}`).join("\n\n────\n\n")}`;
    if (active) content = `[CLAIM CONTEXT]\nClaim #: ${active.claimNumber}\nWorker: ${active.worker}\nEmployer: ${active.employer}\nInjury Date: ${active.injuryDate}\nType: ${active.injuryType}\nStatus: ${stageOf(active.stage).label}\nDescription: ${active.description || "N/A"}\n\n${content}`;
    const um = { role: "user", display: text || `Uploaded ${af.length} document${af.length > 1 ? "s" : ""}`, content, files: af.map(f => f.name), ts: new Date().toISOString() };
    const newMsgs = [...msgs, um]; setMsgs(newMsgs); setFiles([]); setFc({}); setLoading(true);

    try {
      // ── Call server-side API route (not Anthropic directly) ──
      const hist = newMsgs.slice(-20).map(m => ({ role: m.role === "user" ? "user" : "assistant", content: m.content }));
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: hist }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed");
      const reply = data.reply;
      const am = { role: "assistant", content: reply, ts: new Date().toISOString() };
      const final = [...newMsgs, am]; setMsgs(final);

      if (active) {
        const c = { ...active, messages: final };
        if (/RULING PREDICTION|Five Point Check/i.test(reply)) {
          const ruling = /Allow/i.test(reply) && !/Deny/i.test(reply.split("RULING")[1] || "") ? "Allow" : /Deny/i.test(reply) ? "Deny" : "Further Investigation";
          c.analyses = [...(c.analyses || []), { date: new Date().toISOString(), ruling, snippet: reply.slice(0, 200) }];
          c.timeline = [...(c.timeline || []), { date: new Date().toISOString(), type: "analysis", note: `AI analysis — Ruling: ${ruling}` }];
          if (c.stage === "new") { c.stage = "review"; c.timeline.push({ date: new Date().toISOString(), type: "stage", note: "Status → Under Review" }); }
        }
        saveClaim(c);
      }
    } catch (err) { setMsgs(p => [...p, { role: "assistant", content: `**Error:** ${err.message}`, ts: new Date().toISOString() }]); }
    finally { setLoading(false); }
  };

  const scenarios = [
    { l: "Back injury claim", t: "A warehouse worker injured their lower back lifting a 50lb box on March 3, 2026. Reported same day, Form 7 filed March 5. Doctor diagnosed lumbar strain (M54.5), recommended 4 weeks off. No pre-existing conditions. What would WSIB rule?" },
    { l: "Disputed late reporting", t: "A construction worker reports a shoulder injury 3 weeks after the alleged incident. No witnesses. Employer is disputing. How would WSIB approach this?" },
    { l: "Pre-existing aggravation", t: "Worker has documented degenerative disc disease at L4-L5. Claims a workplace slip aggravated this, now needs surgery. How does the thin skull principle apply?" },
    { l: "First responder PTSD", t: "A paramedic with 12 years of service is filing a PTSD claim after a fatal MVA involving children. What does OPM 15-03-13 say about presumptive coverage?" },
  ];
  const quickPrompts = ["Run a full adjudication analysis", "Check reporting compliance", "Assess the RTW plan", "What benefits apply?", "Any red flags?"];
  const filtered = filter === "all" ? claims : claims.filter(c => c.stage === filter);
  const recentClaims = claims.slice(0, 5);
  const stageCounts = STAGES.map(s => ({ ...s, count: claims.filter(c => c.stage === s.id).length })).filter(s => s.count > 0);

  // ── Inline styles (same Apple system as artifact) ──
  // Using inline styles here because this is a single-file client component.
  // In production, move these to CSS modules or Tailwind.

  return (
    <>
      <style jsx global>{`
        .ai-text{font-size:15px;line-height:1.7;color:var(--g700)}.ai-text strong{font-weight:600;color:var(--g900)}
        .ai-h{font-weight:700;color:var(--g900);letter-spacing:-.5px}.ai-h1{font-size:22px;margin:28px 0 10px}.ai-h2{font-size:17px;margin:24px 0 6px}.ai-h3{font-size:15px;margin:18px 0 4px}.ai-p{margin-top:4px}
        .ai-ruling{padding:16px 20px;border-radius:12px;margin:18px 0 10px;font-size:16px;font-weight:700;letter-spacing:-.3px;display:flex;align-items:center;gap:10px}
        .ai-rdot{width:10px;height:10px;border-radius:50%;flex-shrink:0}
        .ai-ruling.allow{background:var(--green-light);color:#1B7D36;border:.5px solid rgba(52,199,89,.15)}.ai-ruling.allow .ai-rdot{background:var(--green)}
        .ai-ruling.deny{background:var(--red-light);color:#CC2D26;border:.5px solid var(--red-border)}.ai-ruling.deny .ai-rdot{background:var(--red)}
        .ai-ruling.inv{background:rgba(255,149,0,.06);color:#A66A00;border:.5px solid rgba(255,149,0,.12)}.ai-ruling.inv .ai-rdot{background:#FF9500}
        .ai-flag{padding:12px 16px;border-radius:8px;margin:8px 0 4px;font-size:13px;font-weight:500;color:#CC2D26;background:var(--red-light);border:.5px solid var(--red-border)}
        .ai-opm{display:inline-block;padding:3px 10px;border-radius:6px;margin:4px 0;font-family:'DM Mono',monospace;font-size:12px;font-weight:500;color:var(--blue);background:var(--blue-light);border:.5px solid var(--blue-border)}
        .ai-chk{display:flex;align-items:flex-start;gap:10px;padding:12px 16px;border-radius:8px;margin:6px 0;font-size:14px}
        .ai-ci{width:22px;height:22px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800}
        .ai-chk.pass{background:var(--green-light);border:.5px solid rgba(52,199,89,.15)}.ai-chk.pass .ai-ci{background:var(--green);color:white}
        .ai-chk.fail{background:var(--red-light);border:.5px solid var(--red-border)}.ai-chk.fail .ai-ci{background:var(--red);color:white}
        .ai-li{padding-left:18px;position:relative;margin-top:4px;font-size:14px}.ai-li::before{content:'';position:absolute;left:4px;top:10px;width:5px;height:5px;border-radius:50%;background:var(--g300)}
        .ai-ol{display:flex;gap:10px;margin-top:5px;font-size:14px}.ai-oln{font-weight:700;color:var(--blue);font-size:12px;font-family:'DM Mono',monospace;min-width:18px;text-align:right;margin-top:3px}
      `}</style>

      <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
        {/* NAV */}
        <nav style={{ height: 52, padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(255,255,255,.72)", backdropFilter: "saturate(180%) blur(20px)", borderBottom: ".5px solid rgba(0,0,0,.08)", flexShrink: 0, zIndex: 100 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }} onClick={() => setView("home")}>
            <div style={{ width: 28, height: 28, borderRadius: 7, background: "var(--g900)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#fff" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"/></svg>
            </div>
            <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: -0.3 }}>ClaimLens</span>
          </div>
          <div style={{ display: "flex", gap: 2 }}>
            {[{ id: "home", label: "Home" }, { id: "claims", label: "Claims" }, { id: "advisor", label: "Advisor" }].map(t => (
              <button key={t.id} onClick={() => { if (t.id === "advisor") { setActive(null); setMsgs([]); setView("chat"); } else setView(t.id); }}
                style={{ padding: "6px 16px", borderRadius: 980, fontSize: 13, fontWeight: 500, color: (view === t.id || (t.id === "advisor" && view === "chat" && !active)) ? "#fff" : "var(--g600)", background: (view === t.id || (t.id === "advisor" && view === "chat" && !active)) ? "var(--g900)" : "transparent", border: "none", cursor: "pointer", transition: "all .25s" }}>
                {t.label}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "var(--g500)" }}>{user.name || user.email}</span>
            <button onClick={() => setModal("new")} style={{ padding: "7px 18px", borderRadius: 980, fontSize: 13, fontWeight: 600, border: "none", background: "var(--blue)", color: "#fff", cursor: "pointer" }}>+ New Claim</button>
            <button onClick={() => signOut({ callbackUrl: "/login" })} style={{ padding: "7px 14px", borderRadius: 980, fontSize: 12, fontWeight: 500, border: ".5px solid var(--g300)", background: "transparent", color: "var(--g600)", cursor: "pointer" }}>Sign Out</button>
          </div>
        </nav>

        {/* ══ HOME ══ */}
        {view === "home" && (
          <div style={{ flex: 1, overflowY: "auto" }}>
            <div className="fade-in" style={{ maxWidth: 840, margin: "0 auto", padding: "40px 24px 100px" }}>
              <div style={{ textAlign: "center", marginBottom: 48 }}>
                <h1 style={{ fontSize: 52, fontWeight: 800, letterSpacing: -2.5, lineHeight: 1.02, marginBottom: 14 }}>Analyze claims.<br /><span style={{ color: "var(--g400)" }}>Predict rulings.</span></h1>
                <p style={{ fontSize: 17, color: "var(--g500)", maxWidth: 460, margin: "0 auto", lineHeight: 1.55 }}>Upload documents, describe a scenario, or track a claim through adjudication — all cross-referenced against the WSIB Operational Policy Manual.</p>
                <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 24 }}>
                  <button onClick={() => { setActive(null); setMsgs([]); setView("chat"); }} style={{ padding: "12px 28px", borderRadius: 980, fontSize: 15, fontWeight: 600, border: "none", background: "var(--blue)", color: "#fff", cursor: "pointer", boxShadow: "0 2px 12px rgba(0,113,227,.25)" }}>Start a conversation</button>
                  <button onClick={() => setModal("new")} style={{ padding: "12px 28px", borderRadius: 980, fontSize: 15, fontWeight: 600, border: ".5px solid var(--g300)", background: "#fff", color: "var(--g900)", cursor: "pointer" }}>Create a claim</button>
                </div>
              </div>
              {claims.length > 0 && <div style={{ display: "flex", gap: 10, marginBottom: 28, flexWrap: "wrap" }}><div style={{ padding: "14px 20px", background: "#fff", borderRadius: 14, border: ".5px solid var(--g200)", minWidth: 110, textAlign: "center" }}><div style={{ fontSize: 28, fontWeight: 800, letterSpacing: -1 }}>{claims.length}</div><div style={{ fontSize: 11, color: "var(--g500)" }}>Total</div></div>{stageCounts.map(s => <div key={s.id} style={{ padding: "14px 20px", background: "#fff", borderRadius: 14, border: ".5px solid var(--g200)", minWidth: 110, textAlign: "center" }}><div style={{ fontSize: 28, fontWeight: 800, letterSpacing: -1, color: s.color }}>{s.count}</div><div style={{ fontSize: 11, color: "var(--g500)" }}>{s.label}</div></div>)}</div>}
              {recentClaims.length > 0 && <><div style={{ fontSize: 13, fontWeight: 700, color: "var(--g400)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 14 }}>Recent Claims</div>{recentClaims.map(c => { const s = stageOf(c.stage); return <div key={c.id} onClick={() => openClaim(c)} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 18px", background: "#fff", borderRadius: 14, border: ".5px solid var(--g200)", cursor: "pointer", marginBottom: 6, transition: "all .25s" }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: s.color }} /><div style={{ flex: 1 }}><span style={{ fontSize: 14, fontWeight: 700 }}>{c.claimNumber}</span><span style={{ fontSize: 12, color: "var(--g500)", marginLeft: 10 }}>{c.worker} · {c.employer}</span></div><span style={{ padding: "2px 10px", borderRadius: 980, fontSize: 11, fontWeight: 600, color: s.color, background: `${s.color}10`, border: `.5px solid ${s.color}30` }}>{s.label}</span><span style={{ fontSize: 11, color: "var(--g400)" }}>{fmt(c.injuryDate)}</span></div>; })}<div style={{ height: 24 }} /></>}
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--g400)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 14 }}>Quick Scenarios</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>{scenarios.map((s, i) => <button key={i} onClick={() => { setActive(null); setMsgs([]); setView("chat"); setTimeout(() => send(s.t), 100); }} style={{ padding: "18px 20px", borderRadius: 16, background: "#fff", border: ".5px solid var(--g200)", cursor: "pointer", textAlign: "left" }}><div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{s.l}</div><div style={{ fontSize: 12, color: "var(--g500)", lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{s.t}</div></button>)}</div>
            </div>
          </div>
        )}

        {/* ══ CLAIMS ══ */}
        {view === "claims" && (
          <div style={{ flex: 1, overflowY: "auto", padding: 24 }}><div className="fade-in" style={{ maxWidth: 900, margin: "0 auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}><div style={{ fontSize: 28, fontWeight: 800, letterSpacing: -1 }}>Claims</div></div>
            <div style={{ display: "flex", gap: 4, marginBottom: 14, flexWrap: "wrap" }}><button onClick={() => setFilter("all")} style={{ padding: "5px 14px", borderRadius: 980, fontSize: 12, fontWeight: 500, border: ".5px solid var(--g200)", cursor: "pointer", background: filter === "all" ? "var(--g900)" : "#fff", color: filter === "all" ? "#fff" : "var(--g500)" }}>All ({claims.length})</button>{STAGES.map(s => { const n = claims.filter(c => c.stage === s.id).length; return n > 0 ? <button key={s.id} onClick={() => setFilter(s.id)} style={{ padding: "5px 14px", borderRadius: 980, fontSize: 12, fontWeight: 500, border: ".5px solid var(--g200)", cursor: "pointer", background: filter === s.id ? "var(--g900)" : "#fff", color: filter === s.id ? "#fff" : "var(--g500)" }}>{s.label} ({n})</button> : null; })}</div>
            {filtered.length === 0 ? <div style={{ textAlign: "center", padding: "60px 20px" }}><div style={{ fontSize: 18, fontWeight: 700, color: "var(--g700)", marginBottom: 6 }}>{claims.length === 0 ? "No claims yet" : "No matches"}</div><p style={{ fontSize: 14, color: "var(--g500)", marginBottom: 16 }}>{claims.length === 0 ? "Create your first claim." : "Try another filter."}</p></div> : filtered.map(c => { const s = stageOf(c.stage); return <div key={c.id} onClick={() => openClaim(c)} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 18px", background: "#fff", borderRadius: 14, border: ".5px solid var(--g200)", marginBottom: 6, cursor: "pointer", transition: "all .25s" }}><span style={{ width: 10, height: 10, borderRadius: "50%", background: s.color }} /><div style={{ flex: 1 }}><div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}><span style={{ fontSize: 15, fontWeight: 700 }}>{c.claimNumber}</span><span style={{ padding: "2px 10px", borderRadius: 980, fontSize: 11, fontWeight: 600, color: s.color, background: `${s.color}10`, border: `.5px solid ${s.color}30` }}>{s.label}</span></div><div style={{ fontSize: 13, color: "var(--g500)" }}>{c.worker} · {c.employer}</div></div><div style={{ textAlign: "right" }}><div style={{ fontSize: 12, color: "var(--g400)" }}>{fmt(c.injuryDate)}</div><div style={{ fontSize: 11, color: "var(--g500)" }}>{c.injuryType}</div></div><span style={{ color: "var(--g300)", fontSize: 18 }}>›</span></div>; })}
          </div></div>
        )}

        {/* ══ DETAIL ══ */}
        {view === "detail" && active && (
          <div style={{ flex: 1, overflowY: "auto", padding: 24 }}><div className="fade-in" style={{ maxWidth: 900, margin: "0 auto" }}>
            <button onClick={() => setView("claims")} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13, fontWeight: 500, color: "var(--blue)", background: "none", border: "none", cursor: "pointer", marginBottom: 14 }}>← All Claims</button>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 22, gap: 16, flexWrap: "wrap" }}>
              <div><div style={{ fontSize: 26, fontWeight: 800, letterSpacing: -.8, marginBottom: 4 }}>{active.claimNumber}</div><div style={{ fontSize: 13, color: "var(--g500)", display: "flex", gap: 14, flexWrap: "wrap" }}><span>👤 {active.worker}</span><span>🏢 {active.employer}</span><span>📅 {fmt(active.injuryDate)}</span><span>📋 {active.injuryType}</span></div></div>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => openChat(active)} style={{ padding: "7px 18px", borderRadius: 980, fontSize: 13, fontWeight: 600, border: "none", background: "var(--blue)", color: "#fff", cursor: "pointer" }}>Open Advisor</button>
                <button onClick={() => setModal("stage")} style={{ padding: "7px 14px", borderRadius: 980, fontSize: 13, fontWeight: 600, border: ".5px solid var(--g300)", background: "transparent", color: "var(--g600)", cursor: "pointer" }}>Change Status</button>
                <button onClick={() => { if (confirm("Delete?")) delClaim(active.id); }} style={{ padding: "7px 14px", borderRadius: 980, fontSize: 13, fontWeight: 600, border: ".5px solid var(--red-border)", background: "transparent", color: "var(--red)", cursor: "pointer" }}>Delete</button>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10, marginBottom: 22 }}>
              {[{ l: "Status", v: <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: stageOf(active.stage).color }} />{stageOf(active.stage).label}</span> }, { l: "Analyses", v: active.analyses?.length || 0 }, { l: "Documents", v: active.documents?.length || 0 }, { l: "Updated", v: <span style={{ fontSize: 13 }}>{fmtTime(active.updatedAt)}</span> }].map((d, i) => <div key={i} style={{ padding: 16, background: "#fff", borderRadius: 14, border: ".5px solid var(--g200)" }}><div style={{ fontSize: 10, fontWeight: 600, color: "var(--g400)", textTransform: "uppercase", letterSpacing: .8, marginBottom: 6 }}>{d.l}</div><div style={{ fontSize: 15, fontWeight: 600 }}>{d.v}</div></div>)}
            </div>
            {/* Timeline */}
            <div style={{ marginBottom: 22 }}><div style={{ fontSize: 12, fontWeight: 700, color: "var(--g500)", textTransform: "uppercase", letterSpacing: .5, marginBottom: 10 }}>Timeline</div>
              {(active.timeline || []).slice().reverse().map((ev, i, arr) => <div key={i} style={{ display: "flex", gap: 12, position: "relative" }}>{i < arr.length - 1 && <div style={{ position: "absolute", left: 10, top: 22, bottom: 0, width: 1, background: "var(--g200)" }} />}<div style={{ width: 22, height: 22, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, zIndex: 1, background: ev.type === "stage" ? "var(--blue-light)" : ev.type === "document" ? "var(--green-light)" : ev.type === "analysis" ? "rgba(255,149,0,.06)" : ev.type === "note" ? "rgba(175,82,222,.06)" : "var(--g200)", color: ev.type === "stage" ? "var(--blue)" : ev.type === "document" ? "var(--green)" : ev.type === "analysis" ? "#FF9500" : ev.type === "note" ? "#AF52DE" : "var(--g600)" }}>{ev.type === "created" ? "●" : ev.type === "stage" ? "→" : ev.type === "document" ? "📄" : ev.type === "analysis" ? "⚡" : "✎"}</div><div style={{ flex: 1, paddingBottom: 14 }}><div style={{ fontSize: 13, color: "var(--g700)", lineHeight: 1.4 }}>{ev.note}</div><div style={{ fontSize: 11, color: "var(--g400)", marginTop: 2 }}>{fmtTime(ev.date)}</div></div></div>)}
              <div style={{ display: "flex", gap: 6, marginTop: 8 }}><input value={noteIn} onChange={e => setNoteIn(e.target.value)} onKeyDown={e => { if (e.key === "Enter") addNote(); }} placeholder="Add a note…" style={{ flex: 1, padding: "8px 14px", borderRadius: 10, border: ".5px solid var(--g200)", fontSize: 13, outline: "none", background: "#fff" }} /><button onClick={addNote} disabled={!noteIn.trim()} style={{ padding: "7px 14px", borderRadius: 980, fontSize: 13, fontWeight: 600, border: ".5px solid var(--g300)", background: "transparent", color: "var(--g600)", cursor: "pointer" }}>Add</button></div>
            </div>
          </div></div>
        )}

        {/* ══ CHAT ══ */}
        {view === "chat" && (<>
          <div style={{ flex: 1, overflowY: "auto", padding: "24px 24px 130px" }}><div style={{ maxWidth: 720, margin: "0 auto" }}>
            {active && <div className="fade-in" style={{ padding: "12px 16px", background: "#fff", borderRadius: 12, border: ".5px solid var(--g200)", marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}><div><span style={{ fontSize: 14, fontWeight: 700 }}>{active.claimNumber}</span><span style={{ fontSize: 13, color: "var(--g500)", marginLeft: 12 }}>{active.worker} · {active.injuryType}</span></div><span style={{ padding: "2px 10px", borderRadius: 980, fontSize: 11, fontWeight: 600, color: stageOf(active.stage).color, background: `${stageOf(active.stage).color}10`, border: `.5px solid ${stageOf(active.stage).color}30` }}>{stageOf(active.stage).label}</span></div>}
            {msgs.length === 0 && <div className="fade-in" style={{ padding: "32px 0" }}><div style={{ fontSize: 32, fontWeight: 800, letterSpacing: -1.2, marginBottom: 8 }}>{active ? `Analyze ${active.claimNumber}` : "Ask anything."}</div><div style={{ fontSize: 15, color: "var(--g500)", marginBottom: 20, maxWidth: 460, lineHeight: 1.55 }}>{active ? "Upload documents or ask questions. Analysis is saved to this claim." : "Describe a scenario, upload documents, or ask a policy question."}</div>{active && <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>{quickPrompts.map((q, i) => <button key={i} onClick={() => send(q)} style={{ padding: "7px 16px", borderRadius: 980, fontSize: 12, fontWeight: 500, color: "var(--g600)", background: "#fff", border: ".5px solid var(--g200)", cursor: "pointer" }}>{q}</button>)}</div>}{!active && <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, maxWidth: 560 }}>{scenarios.map((s, i) => <button key={i} onClick={() => send(s.t)} style={{ padding: "18px 20px", borderRadius: 16, background: "#fff", border: ".5px solid var(--g200)", cursor: "pointer", textAlign: "left" }}><div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{s.l}</div><div style={{ fontSize: 12, color: "var(--g500)", lineHeight: 1.4 }}>{s.t.slice(0, 90)}…</div></button>)}</div>}</div>}
            {msgs.map((m, i) => <div key={i} style={{ marginBottom: 28, display: "flex", flexDirection: "column", alignItems: m.role === "user" ? "flex-end" : "flex-start", animation: "fadeIn .35s cubic-bezier(.25,.1,.25,1) both" }}><div style={{ fontSize: 11, fontWeight: 600, color: "var(--g400)", letterSpacing: .5, textTransform: "uppercase", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: m.role === "user" ? "var(--g900)" : "var(--blue)" }} />{m.role === "user" ? "You" : "ClaimLens"}</div>{m.files?.length > 0 && <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8, justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>{m.files.map((f, j) => <span key={j} style={{ padding: "5px 12px", borderRadius: 980, fontSize: 12, fontWeight: 500, color: "var(--blue)", background: "var(--blue-light)", border: ".5px solid var(--blue-border)" }}>{f}</span>)}</div>}{m.role === "user" ? <div style={{ maxWidth: "70%", padding: "14px 20px", borderRadius: "20px 20px 6px 20px", background: "var(--g900)", color: "#fff", fontSize: 15, lineHeight: 1.55 }}>{m.display || m.content}</div> : <div style={{ width: "100%" }}><Msg text={m.content} /></div>}</div>)}
            {loading && <div style={{ marginBottom: 28 }}><div style={{ fontSize: 11, fontWeight: 600, color: "var(--g400)", letterSpacing: .5, textTransform: "uppercase", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--blue)" }} />ClaimLens</div><div style={{ display: "flex", gap: 6, alignItems: "center" }}>{[0, 1, 2].map(d => <div key={d} style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--blue)", animation: `pulse 1.5s ease infinite ${d * .2}s` }} />)}<span style={{ marginLeft: 8, fontSize: 13, color: "var(--g400)" }}>Reviewing…</span></div></div>}
            <div ref={endRef} />
          </div></div>
          <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, padding: "0 24px 20px", background: "linear-gradient(to top, var(--bg) 60%, transparent)", pointerEvents: "none", zIndex: 50 }}><div style={{ maxWidth: 720, margin: "0 auto", pointerEvents: "auto" }}>
            {files.length > 0 && <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>{files.map((f, i) => <div key={i} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 8px 5px 12px", borderRadius: 980, fontSize: 12, fontWeight: 500, color: "var(--blue)", background: "#fff", border: ".5px solid var(--blue-border)", boxShadow: "0 1px 4px rgba(0,0,0,.06)" }}>{f.name}<button onClick={() => rmFile(f.name)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--g400)", fontSize: 14, padding: "0 2px" }}>×</button></div>)}</div>}
            <div style={{ display: "flex", alignItems: "flex-end", gap: 4, background: "#fff", border: ".5px solid var(--g200)", borderRadius: 22, padding: "6px 6px 6px 8px", boxShadow: "0 2px 20px rgba(0,0,0,.08)" }}>
              <button onClick={() => fRef.current?.click()} style={{ width: 36, height: 36, borderRadius: "50%", border: "none", background: "transparent", cursor: "pointer", color: "var(--g400)", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg></button>
              <input ref={fRef} type="file" multiple onChange={addFiles} style={{ display: "none" }} accept=".txt,.pdf,.doc,.docx,.html,.md,.rtf" />
              <textarea ref={taRef} value={input} onChange={e => { setInput(e.target.value); e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 140) + "px"; }} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} placeholder={active ? `Ask about ${active.claimNumber}…` : "Describe a claim or ask a policy question…"} style={{ flex: 1, border: "none", background: "transparent", resize: "none", outline: "none", fontSize: 15, color: "var(--g900)", padding: "8px 4px", lineHeight: 1.45, minHeight: 36, maxHeight: 140, fontFamily: "'Plus Jakarta Sans', sans-serif" }} rows={1} />
              <button onClick={() => send()} disabled={loading || (!input.trim() && files.length === 0)} style={{ width: 36, height: 36, borderRadius: "50%", border: "none", flexShrink: 0, cursor: (input.trim() || files.length > 0) && !loading ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", background: (input.trim() || files.length > 0) && !loading ? "var(--blue)" : "var(--g200)", color: "#fff", transition: "all .25s" }}><svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18"/></svg></button>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8, padding: "0 12px" }}><span style={{ fontSize: 11, color: "var(--g400)" }}>Advisory only. Final decisions by authorized WSIB adjudicators.</span>{msgs.length > 0 && <button onClick={() => { setMsgs([]); }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "var(--g400)", fontWeight: 500 }}>Clear chat</button>}</div>
          </div></div>
        </>)}

        {/* ══ MODALS ══ */}
        {modal === "new" && <div onClick={e => { if (e.target === e.currentTarget) setModal(null); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.25)", backdropFilter: "blur(10px)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}><div style={{ background: "#fff", borderRadius: 20, padding: 28, width: "100%", maxWidth: 480, boxShadow: "0 20px 60px rgba(0,0,0,.15)", animation: "scaleIn .3s cubic-bezier(.25,.1,.25,1)" }}>
          <h3 style={{ fontSize: 20, fontWeight: 700, letterSpacing: -.5, marginBottom: 16 }}>New Claim</h3>
          {[{ k: "claimNumber", l: "Claim Number", p: "Auto-generated if blank" }, { k: "worker", l: "Worker Name / Initials", p: "e.g. J. Smith" }, { k: "employer", l: "Employer", p: "e.g. Acme Construction" }].map(f => <div key={f.k}><label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--g500)", marginBottom: 4, marginTop: 12 }}>{f.l}</label><input value={nf[f.k]} onChange={e => setNf(p => ({ ...p, [f.k]: e.target.value }))} placeholder={f.p} style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: ".5px solid var(--g200)", fontSize: 14, outline: "none", background: "var(--g50)", fontFamily: "inherit" }} /></div>)}
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--g500)", marginBottom: 4, marginTop: 12 }}>Date of Injury</label><input type="date" value={nf.injuryDate} onChange={e => setNf(p => ({ ...p, injuryDate: e.target.value }))} style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: ".5px solid var(--g200)", fontSize: 14, outline: "none", background: "var(--g50)", fontFamily: "inherit" }} />
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--g500)", marginBottom: 4, marginTop: 12 }}>Injury Type</label><select value={nf.injuryType} onChange={e => setNf(p => ({ ...p, injuryType: e.target.value }))} style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: ".5px solid var(--g200)", fontSize: 14, outline: "none", background: "var(--g50)", fontFamily: "inherit" }}><option>Acute Injury</option><option>Occupational Disease</option><option>Traumatic Mental Stress</option><option>Chronic Mental Stress</option><option>PTSD (First Responder)</option><option>Recurrence</option><option>Aggravation of Pre-existing</option></select>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--g500)", marginBottom: 4, marginTop: 12 }}>Description</label><textarea value={nf.description} onChange={e => setNf(p => ({ ...p, description: e.target.value }))} placeholder="Brief injury description…" rows={3} style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: ".5px solid var(--g200)", fontSize: 14, outline: "none", background: "var(--g50)", fontFamily: "inherit", resize: "none" }} />
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 20 }}><button onClick={() => setModal(null)} style={{ padding: "7px 18px", borderRadius: 980, fontSize: 13, fontWeight: 600, border: ".5px solid var(--g300)", background: "transparent", color: "var(--g600)", cursor: "pointer" }}>Cancel</button><button onClick={createClaim} style={{ padding: "7px 18px", borderRadius: 980, fontSize: 13, fontWeight: 600, border: "none", background: "var(--blue)", color: "#fff", cursor: "pointer" }}>Create</button></div>
        </div></div>}

        {modal === "stage" && active && <div onClick={e => { if (e.target === e.currentTarget) setModal(null); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.25)", backdropFilter: "blur(10px)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}><div style={{ background: "#fff", borderRadius: 20, padding: 28, width: "100%", maxWidth: 400, boxShadow: "0 20px 60px rgba(0,0,0,.15)" }}>
          <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>Change Status</h3>
          {STAGES.map(s => <button key={s.id} onClick={() => changeStage(s.id)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 10, border: "none", background: active.stage === s.id ? "var(--blue-light)" : "transparent", cursor: "pointer", fontSize: 14, fontWeight: active.stage === s.id ? 600 : 500, color: active.stage === s.id ? "var(--blue)" : "var(--g700)", width: "100%", textAlign: "left", marginBottom: 2 }}><span style={{ width: 10, height: 10, borderRadius: "50%", background: s.color }} />{s.label}{active.stage === s.id && <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--g400)" }}>Current</span>}</button>)}
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}><button onClick={() => setModal(null)} style={{ padding: "7px 18px", borderRadius: 980, fontSize: 13, fontWeight: 600, border: ".5px solid var(--g300)", background: "transparent", color: "var(--g600)", cursor: "pointer" }}>Close</button></div>
        </div></div>}
      </div>
    </>
  );
}
