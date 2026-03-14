"use client";
import { useState } from "react";
import { STAGES, stageOf, fmt, daysAgo } from "@/app/lib/constants";
import { getDeadlines, getRedFlags, getRTWProgress, getWorkflowStatus } from "@/app/lib/claim-engine";

/**
 * EmployerDashboard — Compliance + cost management view for HR/employers.
 *
 * Shows: compliance status across all claims, premium impact calculator,
 * modified duties tracker, and dispute preparation.
 *
 * Usage: <EmployerDashboard claims={claims} onOpenClaim={(c) => {}} onClose={() => {}} />
 */
export default function EmployerDashboard({ claims, onOpenClaim, onClose }) {
  const [tab, setTab] = useState("compliance"); // compliance | premium | duties | dispute
  const [premiumCalc, setPremiumCalc] = useState({ annualPremium: "", claimCost: "", rateGroup: "" });
  const [premiumResult, setPremiumResult] = useState(null);

  // Compliance metrics
  const allDeadlines = claims.flatMap((c) => getDeadlines(c).map((d) => ({ ...d, claimNumber: c.claimNumber, caseId: c.id })));
  const overdue = allDeadlines.filter((d) => d.status === "overdue");
  const upcoming = allDeadlines.filter((d) => d.status === "upcoming" && d.daysLeft <= 7);
  const allFlags = claims.flatMap((c) => getRedFlags(c).map((f) => ({ ...f, claimNumber: c.claimNumber, caseId: c.id })));
  const criticalFlags = allFlags.filter((f) => f.severity === "critical" || f.severity === "high");
  const missingForm7 = claims.filter((c) => c.stage !== "closed" && !c.documents?.some((d) => d.tag === "form7"));
  const activeClaims = claims.filter((c) => !["closed", "denied"].includes(c.stage));
  const complianceScore = claims.length > 0 ? Math.max(0, 100 - overdue.length * 15 - criticalFlags.length * 10 - missingForm7.length * 20) : 100;

  // Premium impact calculator (simplified NEER/MAP model)
  const calcPremium = () => {
    const annual = parseFloat(premiumCalc.annualPremium) || 0;
    const cost = parseFloat(premiumCalc.claimCost) || 0;
    if (!annual || !cost) return;
    // Simplified NEER: claim cost affects premium over 4 years at ~35% weight
    const neerImpact = cost * 0.35;
    const year1 = Math.round(neerImpact * 0.4);
    const year2 = Math.round(neerImpact * 0.3);
    const year3 = Math.round(neerImpact * 0.2);
    const year4 = Math.round(neerImpact * 0.1);
    const totalImpact = year1 + year2 + year3 + year4;
    const pctIncrease = Math.round((totalImpact / annual) * 100);
    setPremiumResult({ year1, year2, year3, year4, totalImpact, pctIncrease, basePremium: annual, claimCost: cost });
  };

  const tabStyle = (t) => ({
    flex: 1, padding: "10px 0", borderRadius: 10, border: "none", fontSize: 12, fontWeight: 600,
    cursor: "pointer", background: tab === t ? "#fff" : "transparent",
    color: tab === t ? "var(--g900)" : "var(--g500)",
    boxShadow: tab === t ? "0 1px 3px rgba(0,0,0,.06)" : "none",
  });

  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", backdropFilter: "blur(8px)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "#fff", borderRadius: 20, width: "100%", maxWidth: 720, boxShadow: "0 20px 60px rgba(0,0,0,.15)", maxHeight: "90vh", overflowY: "auto" }}>

        <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--g100)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: -0.5 }}>Employer dashboard</div>
            <div style={{ fontSize: 12, color: "var(--g500)" }}>{activeClaims.length} active claims across portfolio</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "var(--g400)" }}>×</button>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 2, padding: "12px 24px 0", background: "var(--g50)" }}>
          <div style={{ display: "flex", gap: 2, padding: 3, background: "var(--g100)", borderRadius: 12, flex: 1 }}>
            {[{ id: "compliance", label: "Compliance" }, { id: "premium", label: "Premium impact" }, { id: "duties", label: "Modified duties" }, { id: "dispute", label: "Disputes" }].map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)} style={tabStyle(t.id)}>{t.label}</button>
            ))}
          </div>
        </div>

        <div style={{ padding: "20px 24px" }}>

          {/* === COMPLIANCE TAB === */}
          {tab === "compliance" && (
            <>
              {/* Score card */}
              <div style={{ padding: "20px 24px", background: complianceScore >= 80 ? "rgba(40,167,69,.04)" : complianceScore >= 50 ? "rgba(255,149,0,.04)" : "rgba(229,57,53,.04)", border: `1.5px solid ${complianceScore >= 80 ? "rgba(40,167,69,.15)" : complianceScore >= 50 ? "rgba(255,149,0,.15)" : "rgba(229,57,53,.15)"}`, borderRadius: 16, marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--g500)", textTransform: "uppercase", letterSpacing: 1 }}>Compliance score</div>
                  <div style={{ fontSize: 13, color: "var(--g600)", marginTop: 4 }}>
                    {complianceScore >= 80 ? "All filings on track" : complianceScore >= 50 ? "Some items need attention" : "Critical compliance gaps"}
                  </div>
                </div>
                <div style={{ fontSize: 36, fontWeight: 800, color: complianceScore >= 80 ? "var(--green)" : complianceScore >= 50 ? "var(--orange)" : "var(--red)" }}>
                  {complianceScore}%
                </div>
              </div>

              {/* Quick stats */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 16 }}>
                {[
                  { label: "Overdue", value: overdue.length, color: overdue.length > 0 ? "var(--red)" : "var(--green)" },
                  { label: "Due 7 days", value: upcoming.length, color: upcoming.length > 0 ? "var(--orange)" : "var(--green)" },
                  { label: "Missing F7", value: missingForm7.length, color: missingForm7.length > 0 ? "var(--red)" : "var(--green)" },
                  { label: "Red flags", value: criticalFlags.length, color: criticalFlags.length > 0 ? "var(--red)" : "var(--green)" },
                ].map((s, i) => (
                  <div key={i} style={{ padding: 12, background: "var(--g50)", borderRadius: 12, textAlign: "center" }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
                    <div style={{ fontSize: 10, color: "var(--g500)" }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Overdue items */}
              {overdue.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--red)", textTransform: "uppercase", letterSpacing: .5, marginBottom: 8 }}>Overdue ({overdue.length})</div>
                  {overdue.map((d, i) => (
                    <div key={i} onClick={() => { const c = claims.find((x) => x.id === d.caseId); if (c) { onOpenClaim(c); onClose(); } }} style={{ padding: "10px 14px", background: "var(--red-light)", border: "1px solid var(--red-border)", borderRadius: 10, marginBottom: 4, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div><span style={{ fontSize: 13, fontWeight: 600, color: "var(--red)" }}>{d.claimNumber}</span> <span style={{ fontSize: 12, color: "var(--g600)" }}>{d.label}</span></div>
                      <span style={{ fontSize: 11, fontWeight: 600, color: "var(--red)" }}>{Math.abs(d.daysLeft)}d overdue</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Per-claim compliance status */}
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--g500)", textTransform: "uppercase", letterSpacing: .5, marginBottom: 8 }}>All claims</div>
              {activeClaims.map((c) => {
                const dl = getDeadlines(c);
                const hasOverdue = dl.some((d) => d.status === "overdue");
                const hasF7 = c.documents?.some((d) => d.tag === "form7");
                const flags = getRedFlags(c).filter((f) => f.severity === "high" || f.severity === "critical");
                return (
                  <div key={c.id} onClick={() => { onOpenClaim(c); onClose(); }} style={{ padding: "10px 14px", background: "#fff", borderRadius: 10, border: "1px solid var(--card-border)", marginBottom: 4, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <span style={{ fontSize: 13, fontWeight: 700 }}>{c.claimNumber}</span>
                      <span style={{ fontSize: 12, color: "var(--g500)", marginLeft: 8 }}>{c.worker}</span>
                    </div>
                    <div style={{ display: "flex", gap: 4 }}>
                      <span style={{ padding: "2px 8px", borderRadius: 100, fontSize: 10, fontWeight: 600, color: hasF7 ? "var(--green)" : "var(--red)", background: hasF7 ? "var(--green-light)" : "var(--red-light)" }}>{hasF7 ? "F7 filed" : "F7 missing"}</span>
                      {hasOverdue && <span style={{ padding: "2px 8px", borderRadius: 100, fontSize: 10, fontWeight: 600, color: "var(--red)", background: "var(--red-light)" }}>Overdue</span>}
                      {flags.length > 0 && <span style={{ padding: "2px 8px", borderRadius: 100, fontSize: 10, fontWeight: 600, color: "var(--orange)", background: "rgba(245,124,0,.06)" }}>{flags.length} flags</span>}
                    </div>
                  </div>
                );
              })}
            </>
          )}

          {/* === PREMIUM IMPACT TAB === */}
          {tab === "premium" && (
            <>
              <div style={{ padding: "16px 20px", background: "linear-gradient(135deg, #1A1040, #3B5EC0)", borderRadius: 14, color: "#fff", marginBottom: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>NEER/MAP premium impact calculator</div>
                <div style={{ fontSize: 12, opacity: .7 }}>Estimate how a claim affects your WSIB premiums over 4 years</div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--g500)", marginBottom: 4 }}>Annual WSIB premium ($)</label>
                  <input type="number" value={premiumCalc.annualPremium} onChange={(e) => setPremiumCalc((p) => ({ ...p, annualPremium: e.target.value }))} placeholder="e.g. 50000" style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid var(--card-border)", fontSize: 14, outline: "none" }} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--g500)", marginBottom: 4 }}>Estimated claim cost ($)</label>
                  <input type="number" value={premiumCalc.claimCost} onChange={(e) => setPremiumCalc((p) => ({ ...p, claimCost: e.target.value }))} placeholder="e.g. 25000" style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid var(--card-border)", fontSize: 14, outline: "none" }} />
                </div>
              </div>

              <button onClick={calcPremium} style={{ width: "100%", padding: 12, borderRadius: 12, border: "none", fontSize: 14, fontWeight: 600, background: "var(--blue)", color: "#fff", cursor: "pointer", marginBottom: 16 }}>
                Calculate premium impact
              </button>

              {premiumResult && (
                <>
                  <div style={{ padding: "16px 20px", background: "var(--red-light)", border: "1px solid var(--red-border)", borderRadius: 14, marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--g500)", textTransform: "uppercase" }}>4-year premium impact</div>
                      <div style={{ fontSize: 12, color: "var(--g600)", marginTop: 2 }}>+{premiumResult.pctIncrease}% over base premium</div>
                    </div>
                    <div style={{ fontSize: 28, fontWeight: 800, color: "var(--red)" }}>+${premiumResult.totalImpact.toLocaleString()}</div>
                  </div>

                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--g500)", textTransform: "uppercase", letterSpacing: .5, marginBottom: 8 }}>Year-by-year breakdown</div>
                  {[{ year: "Year 1", amount: premiumResult.year1, pct: 40 }, { year: "Year 2", amount: premiumResult.year2, pct: 30 }, { year: "Year 3", amount: premiumResult.year3, pct: 20 }, { year: "Year 4", amount: premiumResult.year4, pct: 10 }].map((y, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0", borderBottom: i < 3 ? "1px solid var(--g100)" : "none" }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--g700)", minWidth: 50 }}>{y.year}</span>
                      <div style={{ flex: 1, height: 8, background: "var(--g100)", borderRadius: 4, overflow: "hidden" }}>
                        <div style={{ width: `${y.pct}%`, height: "100%", background: "var(--red)", borderRadius: 4 }} />
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "var(--red)", minWidth: 80, textAlign: "right" }}>+${y.amount.toLocaleString()}</span>
                    </div>
                  ))}

                  <div style={{ padding: "12px 14px", background: "var(--g50)", borderRadius: 10, marginTop: 14, fontSize: 12, color: "var(--g600)", lineHeight: 1.6 }}>
                    <strong>Note:</strong> This is a simplified estimate based on the NEER cost allocation model. Actual premium impact depends on your rate group, experience rating window, and claim development. Consult your WSIB account manager for precise figures.
                  </div>
                </>
              )}
            </>
          )}

          {/* === MODIFIED DUTIES TAB === */}
          {tab === "duties" && (
            <>
              <div style={{ fontSize: 12, color: "var(--g500)", marginBottom: 16 }}>Track modified work arrangements across all active claims. OPM 19-02-01 requires modified duties to be productive, meaningful, and within documented restrictions.</div>
              {activeClaims.map((c) => {
                const rtw = getRTWProgress(c);
                const duties = c.modifiedDuties || [];
                return (
                  <div key={c.id} style={{ padding: "14px 16px", background: "#fff", borderRadius: 12, border: "1px solid var(--card-border)", marginBottom: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <div>
                        <span style={{ fontSize: 14, fontWeight: 700 }}>{c.claimNumber}</span>
                        <span style={{ fontSize: 12, color: "var(--g500)", marginLeft: 8 }}>{c.worker} — {c.injuryType}</span>
                      </div>
                      {rtw && (
                        <span style={{ fontSize: 11, fontWeight: 600, color: rtw.status === "delayed" ? "var(--red)" : rtw.status === "on-track" ? "var(--blue)" : "var(--green)", padding: "2px 8px", borderRadius: 100, background: rtw.status === "delayed" ? "var(--red-light)" : "var(--blue-light)" }}>
                          {rtw.label}
                        </span>
                      )}
                    </div>
                    {rtw && (
                      <div style={{ height: 4, background: "var(--g200)", borderRadius: 2, overflow: "hidden", marginBottom: 8 }}>
                        <div style={{ width: `${rtw.pct}%`, height: "100%", background: rtw.status === "delayed" ? "var(--red)" : "var(--blue)", borderRadius: 2 }} />
                      </div>
                    )}
                    {duties.length > 0 ? duties.map((d, i) => (
                      <div key={i} style={{ fontSize: 12, color: "var(--g600)", padding: "4px 0", display: "flex", justifyContent: "space-between" }}>
                        <span>{d.desc}</span>
                        <span style={{ fontSize: 10, fontWeight: 600, color: d.status === "accepted" ? "var(--green)" : d.status === "declined" ? "var(--red)" : "var(--orange)" }}>{d.status}</span>
                      </div>
                    )) : (
                      <div style={{ fontSize: 12, color: "var(--g400)", fontStyle: "italic" }}>No modified duties documented</div>
                    )}
                    <button onClick={() => { onOpenClaim(c); onClose(); }} style={{ marginTop: 8, padding: "6px 14px", borderRadius: 8, border: "1px solid var(--card-border)", background: "#fff", fontSize: 11, fontWeight: 600, color: "var(--blue)", cursor: "pointer" }}>
                      Manage duties
                    </button>
                  </div>
                );
              })}
              {activeClaims.length === 0 && <div style={{ padding: 24, textAlign: "center", color: "var(--g400)" }}>No active claims</div>}
            </>
          )}

          {/* === DISPUTE TAB === */}
          {tab === "dispute" && (
            <>
              <div style={{ fontSize: 12, color: "var(--g500)", marginBottom: 16 }}>Review claims where you may want to dispute or file an objection. CaseAssist helps identify weak points and build your employer response.</div>
              {claims.filter((c) => ["review", "investigating", "approved"].includes(c.stage)).map((c) => {
                const flags = getRedFlags(c);
                const disputableFlags = flags.filter((f) => ["Late reporting", "Missing Form 6", "Inconsistent rulings", "No medical evidence"].some((k) => f.label.includes(k.split(" ")[0])));
                return (
                  <div key={c.id} style={{ padding: "14px 16px", background: "#fff", borderRadius: 12, border: "1px solid var(--card-border)", marginBottom: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <div><span style={{ fontSize: 14, fontWeight: 700 }}>{c.claimNumber}</span> <span style={{ fontSize: 12, color: "var(--g500)" }}>{c.worker}</span></div>
                      <span style={{ padding: "2px 10px", borderRadius: 100, fontSize: 10, fontWeight: 600, color: stageOf(c.stage).color, background: stageOf(c.stage).color + "10" }}>{stageOf(c.stage).label}</span>
                    </div>
                    {disputableFlags.length > 0 ? (
                      <div style={{ marginBottom: 8 }}>
                        <div style={{ fontSize: 10, fontWeight: 600, color: "var(--orange)", marginBottom: 4 }}>Potential dispute grounds:</div>
                        {disputableFlags.map((f, i) => (
                          <div key={i} style={{ fontSize: 12, color: "var(--g600)", padding: "2px 0" }}>- {f.label}: {f.desc}</div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ fontSize: 12, color: "var(--g400)", marginBottom: 8 }}>No obvious dispute grounds identified</div>
                    )}
                    <button onClick={() => { onOpenClaim(c); onClose(); }} style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid var(--card-border)", background: "#fff", fontSize: 11, fontWeight: 600, color: "var(--blue)", cursor: "pointer" }}>
                      Review claim
                    </button>
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
