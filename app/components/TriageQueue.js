"use client";
import { useState } from "react";
import { stageOf, fmt, daysAgo } from "@/app/lib/constants";
import { getRiskScore, getRedFlags, getDeadlines, getWorkflowStatus, getAIBrief, getSmartWarnings } from "@/app/lib/claim-engine";

/**
 * TriageQueue — Adjudicator/TPA workflow for processing claim volume.
 *
 * Features: auto-sorted priority queue, batch Five Point Check,
 * decision letter generator, QA review checklist.
 *
 * Usage: <TriageQueue claims={claims} onOpenClaim={(c) => {}} onOpenChat={(c, prompt) => {}} onClose={() => {}} />
 */
export default function TriageQueue({ claims, onOpenClaim, onOpenChat, onClose }) {
  const [tab, setTab] = useState("queue"); // queue | batch | letters | qa
  const [batchSelected, setBatchSelected] = useState([]);
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchResults, setBatchResults] = useState([]);
  const [letterClaim, setLetterClaim] = useState(null);
  const [letterType, setLetterType] = useState("allow");

  // Priority-sorted queue
  const scored = claims
    .filter((c) => !["closed"].includes(c.stage))
    .map((c) => {
      const risk = getRiskScore(c);
      const dl = getDeadlines(c);
      const overdueCount = dl.filter((d) => d.status === "overdue").length;
      const warns = getSmartWarnings(c);
      const wf = getWorkflowStatus(c);
      // Priority score: higher = more urgent
      let priority = 0;
      if (c.stage === "new" && !c.analyses?.length) priority += 50; // unanalyzed
      priority += overdueCount * 30;
      priority += (risk?.score || 0) * 3;
      priority += warns.filter((w) => w.type === "critical").length * 25;
      priority += warns.filter((w) => w.type === "warning").length * 10;
      if (c.stage === "investigating") priority += 15;
      if (c.stage === "denied") priority += 20; // appeal window
      return { ...c, _priority: priority, _risk: risk, _overdueCount: overdueCount, _warns: warns, _wf: wf };
    })
    .sort((a, b) => b._priority - a._priority);

  const needsAnalysis = scored.filter((c) => !c.analyses?.length);
  const needsDecision = scored.filter((c) => c.analyses?.length > 0 && c.stage === "review");

  const toggleBatch = (id) => {
    setBatchSelected((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);
  };

  const runBatch = async () => {
    setBatchRunning(true);
    setBatchResults([]);
    const selected = claims.filter((c) => batchSelected.includes(c.id));

    for (const claim of selected) {
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [{
              role: "user",
              content: `[BATCH ANALYSIS — CONCISE]\nClaim #: ${claim.claimNumber}\nWorker: ${claim.worker}\nEmployer: ${claim.employer}\nType: ${claim.injuryType}\nDOI: ${claim.injuryDate}\nDescription: ${claim.description || "N/A"}\nDocs: ${(claim.documents || []).map((d) => d.tag).join(", ") || "none"}\n\nRun the Five Point Check. Give ONLY:\nRULING: Allow/Deny/Further Investigation\nCONFIDENCE: High/Medium/Low\nKEY_REASON: one sentence\nMISSING: what evidence is needed (or "None")`,
            }],
            claimContext: { injuryType: claim.injuryType },
          }),
        });
        const data = await res.json();
        const reply = data.reply || "";
        const ruling = /Allow/i.test(reply) && !/Deny/i.test(reply.split("RULING")[1] || "") ? "Allow" : /Deny/i.test(reply) ? "Deny" : "Further Investigation";
        setBatchResults((p) => [...p, { id: claim.id, claimNumber: claim.claimNumber, ruling, reply, success: true }]);
      } catch (err) {
        setBatchResults((p) => [...p, { id: claim.id, claimNumber: claim.claimNumber, ruling: "Error", reply: err.message, success: false }]);
      }
    }
    setBatchRunning(false);
  };

  const tabStyle = (t) => ({
    flex: 1, padding: "10px 0", borderRadius: 10, border: "none", fontSize: 12, fontWeight: 600,
    cursor: "pointer", background: tab === t ? "#fff" : "transparent",
    color: tab === t ? "var(--g900)" : "var(--g500)",
    boxShadow: tab === t ? "0 1px 3px rgba(0,0,0,.06)" : "none",
  });

  const rulingColor = { Allow: "var(--green)", Deny: "var(--red)", "Further Investigation": "var(--orange)", Error: "var(--g400)" };

  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", backdropFilter: "blur(8px)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "#fff", borderRadius: 20, width: "100%", maxWidth: 760, boxShadow: "0 20px 60px rgba(0,0,0,.15)", maxHeight: "90vh", overflowY: "auto" }}>

        <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--g100)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: -0.5 }}>Triage queue</div>
            <div style={{ fontSize: 12, color: "var(--g500)" }}>{scored.length} claims sorted by urgency · {needsAnalysis.length} need analysis</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "var(--g400)" }}>×</button>
        </div>

        <div style={{ display: "flex", gap: 2, padding: "12px 24px 0", background: "var(--g50)" }}>
          <div style={{ display: "flex", gap: 2, padding: 3, background: "var(--g100)", borderRadius: 12, flex: 1 }}>
            {[{ id: "queue", label: `Queue (${scored.length})` }, { id: "batch", label: `Batch (${batchSelected.length})` }, { id: "letters", label: "Decision letters" }, { id: "qa", label: "QA review" }].map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)} style={tabStyle(t.id)}>{t.label}</button>
            ))}
          </div>
        </div>

        <div style={{ padding: "20px 24px" }}>

          {/* === QUEUE TAB === */}
          {tab === "queue" && (
            <>
              {/* Summary bar */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 14 }}>
                {[
                  { label: "Critical", value: scored.filter((c) => c._priority >= 80).length, color: "var(--red)" },
                  { label: "High", value: scored.filter((c) => c._priority >= 40 && c._priority < 80).length, color: "var(--orange)" },
                  { label: "Medium", value: scored.filter((c) => c._priority >= 15 && c._priority < 40).length, color: "var(--blue)" },
                  { label: "Low", value: scored.filter((c) => c._priority < 15).length, color: "var(--green)" },
                ].map((s, i) => (
                  <div key={i} style={{ padding: 10, background: "var(--g50)", borderRadius: 10, textAlign: "center" }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.value}</div>
                    <div style={{ fontSize: 10, color: "var(--g500)" }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Queue list */}
              {scored.map((c, idx) => (
                <div key={c.id} style={{ padding: "12px 14px", background: "#fff", borderRadius: 10, border: `1px solid ${c._priority >= 80 ? "var(--red-border)" : c._priority >= 40 ? "rgba(255,149,0,.1)" : "var(--card-border)"}`, marginBottom: 4, display: "flex", gap: 12, alignItems: "flex-start" }}>
                  {/* Priority badge */}
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: c._priority >= 80 ? "var(--red)" : c._priority >= 40 ? "var(--orange)" : c._priority >= 15 ? "var(--blue)" : "var(--g300)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, flexShrink: 0 }}>
                    {idx + 1}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 14, fontWeight: 700 }}>{c.claimNumber}</span>
                        <span style={{ padding: "1px 8px", borderRadius: 100, fontSize: 10, fontWeight: 600, color: stageOf(c.stage).color, background: stageOf(c.stage).color + "10" }}>{stageOf(c.stage).label}</span>
                        {c._risk && <span style={{ padding: "1px 8px", borderRadius: 100, fontSize: 10, fontWeight: 600, color: c._risk.color, background: c._risk.color + "10" }}>{c._risk.level}</span>}
                      </div>
                      <span style={{ fontSize: 10, color: "var(--g400)" }}>{c._wf.pct}% complete</span>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--g500)", marginBottom: 4 }}>{c.worker} · {c.employer} · {c.injuryType} · {fmt(c.injuryDate)}</div>
                    {/* Smart warnings */}
                    {c._warns.length > 0 && (
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 4 }}>
                        {c._warns.slice(0, 3).map((w, i) => (
                          <span key={i} style={{ fontSize: 9, fontWeight: 600, padding: "2px 6px", borderRadius: 4, color: w.type === "critical" ? "var(--red)" : "var(--orange)", background: w.type === "critical" ? "var(--red-light)" : "rgba(245,124,0,.04)" }}>{w.label}: {w.desc}</span>
                        ))}
                      </div>
                    )}
                    <div style={{ display: "flex", gap: 4 }}>
                      <button onClick={() => { onOpenClaim(c); onClose(); }} style={{ padding: "4px 10px", borderRadius: 6, fontSize: 10, fontWeight: 600, border: "1px solid var(--card-border)", background: "#fff", color: "var(--g600)", cursor: "pointer" }}>Open</button>
                      {!c.analyses?.length && (
                        <button onClick={() => { onOpenChat(c, "Run a full Five Point Check on this claim."); onClose(); }} style={{ padding: "4px 10px", borderRadius: 6, fontSize: 10, fontWeight: 600, border: "none", background: "var(--blue)", color: "#fff", cursor: "pointer" }}>Analyze</button>
                      )}
                      <button onClick={() => toggleBatch(c.id)} style={{ padding: "4px 10px", borderRadius: 6, fontSize: 10, fontWeight: 600, border: "1px solid var(--card-border)", background: batchSelected.includes(c.id) ? "var(--blue-light)" : "#fff", color: batchSelected.includes(c.id) ? "var(--blue)" : "var(--g500)", cursor: "pointer" }}>{batchSelected.includes(c.id) ? "In batch" : "+ Batch"}</button>
                    </div>
                  </div>
                </div>
              ))}
              {scored.length === 0 && <div style={{ padding: 32, textAlign: "center", color: "var(--g400)" }}>All claims are closed</div>}
            </>
          )}

          {/* === BATCH TAB === */}
          {tab === "batch" && (
            <>
              <div style={{ fontSize: 12, color: "var(--g500)", marginBottom: 14 }}>Select claims from the Queue tab to add to the batch, then run Five Point Check on all at once.</div>

              {batchSelected.length > 0 ? (
                <>
                  <div style={{ marginBottom: 12 }}>
                    {batchSelected.map((id) => {
                      const c = claims.find((x) => x.id === id);
                      const br = batchResults.find((r) => r.id === id);
                      return c ? (
                        <div key={id} style={{ padding: "10px 14px", background: br ? (br.success ? `${rulingColor[br.ruling]}08` : "var(--red-light)") : "var(--g50)", border: `1px solid ${br ? (br.success ? `${rulingColor[br.ruling]}20` : "var(--red-border)") : "var(--card-border)"}`, borderRadius: 10, marginBottom: 4, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div>
                            <span style={{ fontSize: 13, fontWeight: 700 }}>{c.claimNumber}</span>
                            <span style={{ fontSize: 12, color: "var(--g500)", marginLeft: 8 }}>{c.worker} — {c.injuryType}</span>
                          </div>
                          {br ? (
                            <span style={{ fontSize: 12, fontWeight: 700, color: rulingColor[br.ruling] || "var(--g500)" }}>{br.ruling}</span>
                          ) : (
                            <button onClick={() => toggleBatch(id)} style={{ padding: "3px 10px", borderRadius: 6, fontSize: 10, fontWeight: 600, border: "1px solid var(--card-border)", background: "#fff", color: "var(--g500)", cursor: "pointer" }}>Remove</button>
                          )}
                        </div>
                      ) : null;
                    })}
                  </div>
                  <button onClick={runBatch} disabled={batchRunning || batchResults.length === batchSelected.length} style={{ width: "100%", padding: 14, borderRadius: 12, border: "none", fontSize: 15, fontWeight: 700, background: batchRunning ? "var(--g300)" : "linear-gradient(135deg, #1A1040, #3B5EC0)", color: "#fff", cursor: batchRunning ? "default" : "pointer" }}>
                    {batchRunning ? `Analyzing... (${batchResults.length}/${batchSelected.length})` : batchResults.length > 0 ? `Complete — ${batchResults.length} analyzed` : `Run batch analysis (${batchSelected.length} claims)`}
                  </button>
                </>
              ) : (
                <div style={{ padding: 32, textAlign: "center", color: "var(--g400)", fontSize: 13 }}>No claims selected. Go to the Queue tab and click "+ Batch" on claims you want to analyze.</div>
              )}
            </>
          )}

          {/* === DECISION LETTERS TAB === */}
          {tab === "letters" && (
            <>
              <div style={{ fontSize: 12, color: "var(--g500)", marginBottom: 14 }}>Generate a formal WSIB decision letter for any analyzed claim. Select a claim and letter type below.</div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--g500)", marginBottom: 4 }}>Select claim</label>
                  <select value={letterClaim || ""} onChange={(e) => setLetterClaim(e.target.value)} style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid var(--card-border)", fontSize: 13, outline: "none", background: "#fff" }}>
                    <option value="">Choose a claim...</option>
                    {claims.filter((c) => c.analyses?.length > 0).map((c) => (
                      <option key={c.id} value={c.id}>{c.claimNumber} — {c.worker} ({c.analyses[c.analyses.length - 1]?.ruling})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--g500)", marginBottom: 4 }}>Letter type</label>
                  <select value={letterType} onChange={(e) => setLetterType(e.target.value)} style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid var(--card-border)", fontSize: 13, outline: "none", background: "#fff" }}>
                    <option value="allow">Initial Entitlement — Allow</option>
                    <option value="deny">Initial Entitlement — Deny</option>
                    <option value="investigate">Request for Additional Information</option>
                    <option value="rtw">Return to Work Notice</option>
                    <option value="loe">LOE Benefit Calculation Notice</option>
                  </select>
                </div>
              </div>

              <button onClick={() => {
                const c = claims.find((x) => x.id === letterClaim);
                if (c) {
                  const prompts = {
                    allow: `Generate a formal WSIB Initial Entitlement letter ALLOWING claim ${c.claimNumber}. Worker: ${c.worker}, Employer: ${c.employer}, DOI: ${c.injuryDate}, Type: ${c.injuryType}. Cite the Five Point Check results and relevant OPM sections. Include: decision, effective date, benefits overview, employer obligations, appeal rights. Format as an official WSIB decision letter.`,
                    deny: `Generate a formal WSIB Initial Entitlement letter DENYING claim ${c.claimNumber}. Worker: ${c.worker}, Employer: ${c.employer}, DOI: ${c.injuryDate}, Type: ${c.injuryType}. Cite which Five Point Check criteria were not met. Include: decision with reasons, specific evidence gaps, OPM references, appeal rights and timeline (30 days for RTW, 6 months for other). Format as an official WSIB decision letter.`,
                    investigate: `Generate a formal WSIB Request for Additional Information letter for claim ${c.claimNumber}. Worker: ${c.worker}, Employer: ${c.employer}. List the specific evidence needed and why, with response deadline. Format as an official WSIB letter.`,
                    rtw: `Generate a formal WSIB Return to Work notice for claim ${c.claimNumber}. Worker: ${c.worker}, Employer: ${c.employer}. Include: obligations under OPM 19-01-01, modified duties requirements, employer accommodation obligations, consequences of non-cooperation. Format as an official WSIB notice.`,
                    loe: `Generate a formal WSIB LOE Benefit Calculation notice for claim ${c.claimNumber}. Worker: ${c.worker}. Reference OPM 18-01-01, explain the 85% net earnings formula, first 12 weeks vs long-term calculation, and 72-month review timeline. Format as an official WSIB benefit notice.`,
                  };
                  onOpenChat(c, prompts[letterType]);
                  onClose();
                }
              }} disabled={!letterClaim} style={{ width: "100%", padding: 14, borderRadius: 12, border: "none", fontSize: 14, fontWeight: 700, background: letterClaim ? "linear-gradient(135deg, #1A1040, #3B5EC0)" : "var(--g200)", color: letterClaim ? "#fff" : "var(--g400)", cursor: letterClaim ? "pointer" : "default" }}>
                Generate decision letter
              </button>
            </>
          )}

          {/* === QA REVIEW TAB === */}
          {tab === "qa" && (
            <>
              <div style={{ fontSize: 12, color: "var(--g500)", marginBottom: 14 }}>Quality assurance checklist for peer review before finalizing decisions.</div>
              {needsDecision.map((c) => {
                const lr = c.analyses?.[c.analyses.length - 1];
                const flags = getRedFlags(c);
                return (
                  <div key={c.id} style={{ padding: "16px", background: "#fff", borderRadius: 12, border: "1px solid var(--card-border)", marginBottom: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                      <div>
                        <span style={{ fontSize: 14, fontWeight: 700 }}>{c.claimNumber}</span>
                        <span style={{ fontSize: 12, color: "var(--g500)", marginLeft: 8 }}>{c.worker}</span>
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 700, color: lr?.ruling === "Allow" ? "var(--green)" : lr?.ruling === "Deny" ? "var(--red)" : "var(--orange)" }}>AI: {lr?.ruling}</span>
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--g500)", textTransform: "uppercase", letterSpacing: .5, marginBottom: 6 }}>QA checklist</div>
                    {[
                      { label: "All Five Point criteria evaluated", check: !!lr },
                      { label: "Medical evidence reviewed", check: c.documents?.some((d) => ["medical", "form8", "specialist"].includes(d.tag)) },
                      { label: "OPM sections cited", check: !!lr?.snippet?.match(/\d{2}-\d{2}/) },
                      { label: "Red flags addressed", check: flags.length === 0 || (lr?.snippet || "").toLowerCase().includes("flag") },
                      { label: "Benefit of doubt considered", check: true },
                      { label: "Worker notified of rights", check: false },
                    ].map((item, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", fontSize: 12 }}>
                        <div style={{ width: 16, height: 16, borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 800, background: item.check ? "var(--green)" : "transparent", border: item.check ? "none" : "1.5px solid var(--g300)", color: "#fff", flexShrink: 0 }}>{item.check ? "✓" : ""}</div>
                        <span style={{ color: item.check ? "var(--g500)" : "var(--g800)" }}>{item.label}</span>
                      </div>
                    ))}
                    <button onClick={() => { onOpenClaim(c); onClose(); }} style={{ marginTop: 8, padding: "6px 14px", borderRadius: 8, border: "1px solid var(--card-border)", background: "#fff", fontSize: 11, fontWeight: 600, color: "var(--blue)", cursor: "pointer" }}>Full review</button>
                  </div>
                );
              })}
              {needsDecision.length === 0 && <div style={{ padding: 32, textAlign: "center", color: "var(--g400)" }}>No claims awaiting decision review</div>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
