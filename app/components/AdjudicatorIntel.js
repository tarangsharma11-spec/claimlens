"use client";
import { useState, useMemo } from "react";
import { stageOf, fmt, daysAgo } from "@/app/lib/constants";
import { getRiskScore, getRedFlags, getClaimStrength } from "@/app/lib/claim-engine";

/**
 * AdjudicatorIntel — Three tools for claims processing efficiency:
 * 1. Complexity scoring — predict straightforward vs contested claims on intake
 * 2. Duplicate/related claim detection — same worker, body part, or employer
 * 3. Decision consistency checker — flag potential inconsistencies
 */
export default function AdjudicatorIntel({ claims, onOpenClaim, onClose }) {
  const [tab, setTab] = useState("complexity");

  // === COMPLEXITY SCORING ===
  const scoredClaims = useMemo(() => {
    return claims.filter((c) => c.stage !== "closed").map((c) => {
      let complexity = 0;
      const factors = [];

      // Injury type complexity
      const typeWeights = { "Acute Injury": 1, "Recurrence": 2, "Occupational Disease": 3, "Aggravation of Pre-existing": 3, "Traumatic Mental Stress": 4, "Chronic Mental Stress": 5, "PTSD (First Responder)": 3 };
      const tw = typeWeights[c.injuryType] || 2;
      complexity += tw * 10;
      if (tw >= 4) factors.push("High-complexity injury type");

      // Pre-existing conditions
      if (/pre-existing|aggravation|prior|previous/i.test(c.description || "")) {
        complexity += 20;
        factors.push("Pre-existing condition mentioned");
      }

      // Reporting delay
      if (c.injuryDate && c.injuryDate !== "—") {
        const reportDelay = Math.floor((new Date(c.createdAt) - new Date(c.injuryDate)) / 864e5);
        if (reportDelay > 14) { complexity += 15; factors.push("Late reporting (" + reportDelay + " days)"); }
        else if (reportDelay > 7) { complexity += 8; factors.push("Moderate reporting delay"); }
      }

      // Employer disputing
      if (/disput|contest|object|deny/i.test(c.description || "")) {
        complexity += 20;
        factors.push("Employer may be disputing");
      }

      // Multiple body parts / multiple diagnoses
      if (/and|multiple|bilateral|both/i.test(c.description || "")) {
        complexity += 10;
        factors.push("Multiple body parts/diagnoses");
      }

      // Mental health component
      if (/mental|stress|ptsd|anxiety|depression|psychological/i.test(c.description || "") || /Mental|PTSD/i.test(c.injuryType)) {
        complexity += 15;
        factors.push("Mental health component");
      }

      // Document completeness (fewer docs = more investigation needed)
      const docCount = c.documents?.length || 0;
      if (docCount === 0) { complexity += 10; factors.push("No documents on file"); }
      else if (docCount < 3) { complexity += 5; factors.push("Limited documentation"); }

      // Red flags
      const flags = getRedFlags(c);
      complexity += flags.length * 5;
      if (flags.length > 2) factors.push(flags.length + " red flags identified");

      const level = complexity >= 60 ? "Complex" : complexity >= 35 ? "Moderate" : "Straightforward";
      const color = complexity >= 60 ? "var(--red)" : complexity >= 35 ? "var(--orange)" : "var(--green)";
      const recommendation = complexity >= 60 ? "Assign to senior adjudicator. Expect investigation, possible IME." : complexity >= 35 ? "Standard processing. May need additional evidence." : "Fast-track eligible. Straightforward Five Point Check.";

      return { ...c, _complexity: complexity, _level: level, _color: color, _factors: factors, _recommendation: recommendation };
    }).sort((a, b) => b._complexity - a._complexity);
  }, [claims]);

  // === DUPLICATE DETECTION ===
  const duplicates = useMemo(() => {
    const groups = [];
    const seen = new Set();

    for (let i = 0; i < claims.length; i++) {
      if (seen.has(claims[i].id)) continue;
      const matches = [];

      for (let j = i + 1; j < claims.length; j++) {
        if (seen.has(claims[j].id)) continue;
        const reasons = [];

        // Same worker name
        if (claims[i].worker && claims[j].worker && claims[i].worker !== "—" && claims[j].worker !== "—") {
          const w1 = claims[i].worker.toLowerCase().trim();
          const w2 = claims[j].worker.toLowerCase().trim();
          if (w1 === w2) reasons.push("Same worker name");
          else if (w1.split(" ")[0] === w2.split(" ")[0] && w1.length > 2) reasons.push("Similar worker name");
        }

        // Same employer
        if (claims[i].employer && claims[j].employer && claims[i].employer !== "—" && claims[j].employer !== "—") {
          if (claims[i].employer.toLowerCase().trim() === claims[j].employer.toLowerCase().trim()) reasons.push("Same employer");
        }

        // Same injury type
        if (claims[i].injuryType === claims[j].injuryType) reasons.push("Same injury type");

        // Close injury dates
        if (claims[i].injuryDate && claims[j].injuryDate && claims[i].injuryDate !== "—" && claims[j].injuryDate !== "—") {
          const daysDiff = Math.abs(Math.floor((new Date(claims[i].injuryDate) - new Date(claims[j].injuryDate)) / 864e5));
          if (daysDiff < 30) reasons.push("Injury dates within " + daysDiff + " days");
          else if (daysDiff < 180) reasons.push("Injury dates within 6 months");
        }

        // Same body part keywords in description
        if (claims[i].description && claims[j].description) {
          const bodyParts = ["back", "shoulder", "knee", "wrist", "neck", "hip", "ankle", "elbow", "hand", "foot", "head", "spine", "lumbar"];
          const d1 = claims[i].description.toLowerCase();
          const d2 = claims[j].description.toLowerCase();
          const shared = bodyParts.filter((bp) => d1.includes(bp) && d2.includes(bp));
          if (shared.length > 0) reasons.push("Same body part: " + shared.join(", "));
        }

        // Need at least 2 matching factors to flag
        if (reasons.length >= 2) {
          matches.push({ claim: claims[j], reasons });
          seen.add(claims[j].id);
        }
      }

      if (matches.length > 0) {
        groups.push({ primary: claims[i], related: matches });
        seen.add(claims[i].id);
      }
    }
    return groups;
  }, [claims]);

  // === CONSISTENCY CHECKER ===
  const inconsistencies = useMemo(() => {
    const issues = [];

    // Check for similar claims with different rulings
    const analyzed = claims.filter((c) => c.analyses?.length > 0);
    for (let i = 0; i < analyzed.length; i++) {
      for (let j = i + 1; j < analyzed.length; j++) {
        const a = analyzed[i];
        const b = analyzed[j];
        const aRuling = a.analyses[a.analyses.length - 1]?.ruling;
        const bRuling = b.analyses[b.analyses.length - 1]?.ruling;

        if (aRuling && bRuling && aRuling !== bRuling && a.injuryType === b.injuryType) {
          // Same injury type but different rulings — worth flagging
          const aStrength = getClaimStrength(a);
          const bStrength = getClaimStrength(b);
          // Flag if the stronger claim got denied or weaker got approved
          if ((aRuling === "Deny" && (aStrength?.score || 0) > (bStrength?.score || 0) && bRuling === "Allow") ||
              (bRuling === "Deny" && (bStrength?.score || 0) > (aStrength?.score || 0) && aRuling === "Allow")) {
            issues.push({
              type: "ruling_reversal",
              label: "Stronger claim denied while weaker approved",
              claimA: a,
              claimB: b,
              detail: `${a.claimNumber} (${aRuling}, strength ${aStrength?.score || "?"}%) vs ${b.claimNumber} (${bRuling}, strength ${bStrength?.score || "?"}%). Both ${a.injuryType}. Review for consistency.`,
            });
          } else {
            issues.push({
              type: "different_ruling",
              label: "Different rulings for same injury type",
              claimA: a,
              claimB: b,
              detail: `${a.claimNumber} = ${aRuling}, ${b.claimNumber} = ${bRuling}. Both ${a.injuryType}. Verify the difference is justified by evidence.`,
            });
          }
        }
      }
    }

    // Check for claims with multiple analyses that changed ruling
    for (const c of claims) {
      if (c.analyses?.length > 1) {
        const rulings = c.analyses.map((a) => a.ruling);
        const unique = [...new Set(rulings)];
        if (unique.length > 1) {
          issues.push({
            type: "internal_flip",
            label: "Ruling changed within same claim",
            claimA: c,
            claimB: null,
            detail: `${c.claimNumber} has ${c.analyses.length} analyses with rulings: ${rulings.join(" → ")}. New evidence may justify the change — verify.`,
          });
        }
      }
    }

    return issues;
  }, [claims]);

  const tabStyle = (t) => ({ flex: 1, padding: "10px 0", borderRadius: 10, border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer", background: tab === t ? "#fff" : "transparent", color: tab === t ? "var(--g900)" : "var(--g500)", boxShadow: tab === t ? "0 1px 3px rgba(0,0,0,.06)" : "none" });

  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", backdropFilter: "blur(8px)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "#fff", borderRadius: 20, width: "100%", maxWidth: 740, boxShadow: "0 20px 60px rgba(0,0,0,.15)", maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--g100)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: -0.5 }}>Adjudicator intelligence</div>
            <div style={{ fontSize: 12, color: "var(--g500)" }}>Complexity scoring, duplicate detection, consistency checks</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "var(--g400)" }}>×</button>
        </div>

        <div style={{ display: "flex", gap: 2, padding: "12px 24px 0", background: "var(--g50)" }}>
          <div style={{ display: "flex", gap: 2, padding: 3, background: "var(--g100)", borderRadius: 12, flex: 1 }}>
            <button onClick={() => setTab("complexity")} style={tabStyle("complexity")}>Complexity ({scoredClaims.length})</button>
            <button onClick={() => setTab("duplicates")} style={tabStyle("duplicates")}>Duplicates ({duplicates.length})</button>
            <button onClick={() => setTab("consistency")} style={tabStyle("consistency")}>Consistency ({inconsistencies.length})</button>
          </div>
        </div>

        <div style={{ padding: "20px 24px" }}>

          {/* COMPLEXITY */}
          {tab === "complexity" && (<>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 14 }}>
              {[
                { label: "Straightforward", count: scoredClaims.filter((c) => c._level === "Straightforward").length, color: "var(--green)" },
                { label: "Moderate", count: scoredClaims.filter((c) => c._level === "Moderate").length, color: "var(--orange)" },
                { label: "Complex", count: scoredClaims.filter((c) => c._level === "Complex").length, color: "var(--red)" },
              ].map((s, i) => (
                <div key={i} style={{ padding: 12, background: "var(--g50)", borderRadius: 12, textAlign: "center" }}>
                  <div style={{ fontSize: 24, fontWeight: 800, color: s.color }}>{s.count}</div>
                  <div style={{ fontSize: 10, color: "var(--g500)" }}>{s.label}</div>
                </div>
              ))}
            </div>
            {scoredClaims.map((c) => (
              <div key={c.id} onClick={() => { onOpenClaim(c); onClose(); }} style={{ padding: "12px 14px", background: "#fff", borderRadius: 10, border: "1px solid var(--card-border)", marginBottom: 4, cursor: "pointer", display: "flex", gap: 12, alignItems: "flex-start" }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: c._color + "10", border: "1px solid " + c._color + "20", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800, color: c._color, flexShrink: 0 }}>{c._complexity}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 700 }}>{c.claimNumber}</span>
                      <span style={{ fontSize: 10, fontWeight: 600, color: c._color, padding: "1px 8px", borderRadius: 100, background: c._color + "10" }}>{c._level}</span>
                    </div>
                    <span style={{ fontSize: 11, color: "var(--g400)" }}>{c.injuryType}</span>
                  </div>
                  <div style={{ fontSize: 11, color: "var(--g500)", marginBottom: 2 }}>{c.worker} · {c.employer}</div>
                  {c._factors.length > 0 && (
                    <div style={{ fontSize: 11, color: "var(--g600)" }}>{c._factors.slice(0, 3).join(" · ")}</div>
                  )}
                  <div style={{ fontSize: 11, color: c._color, fontWeight: 500, marginTop: 2 }}>{c._recommendation}</div>
                </div>
              </div>
            ))}
            {scoredClaims.length === 0 && <div style={{ padding: 32, textAlign: "center", color: "var(--g400)" }}>No active claims to score</div>}
          </>)}

          {/* DUPLICATES */}
          {tab === "duplicates" && (<>
            {duplicates.length > 0 ? duplicates.map((group, gi) => (
              <div key={gi} style={{ padding: "14px 16px", background: "rgba(255,149,0,.03)", border: "1px solid rgba(255,149,0,.1)", borderRadius: 12, marginBottom: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--orange)", textTransform: "uppercase", letterSpacing: .5, marginBottom: 8 }}>Potential related claims</div>
                <div onClick={() => { onOpenClaim(group.primary); onClose(); }} style={{ padding: "8px 12px", background: "#fff", borderRadius: 8, border: "1px solid var(--card-border)", marginBottom: 6, cursor: "pointer" }}>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{group.primary.claimNumber}</span>
                  <span style={{ fontSize: 12, color: "var(--g500)", marginLeft: 8 }}>{group.primary.worker} — {group.primary.injuryType} — {fmt(group.primary.injuryDate)}</span>
                </div>
                {group.related.map((rel, ri) => (
                  <div key={ri}>
                    <div onClick={() => { onOpenClaim(rel.claim); onClose(); }} style={{ padding: "8px 12px", background: "#fff", borderRadius: 8, border: "1px solid var(--card-border)", marginBottom: 4, cursor: "pointer" }}>
                      <span style={{ fontSize: 13, fontWeight: 700 }}>{rel.claim.claimNumber}</span>
                      <span style={{ fontSize: 12, color: "var(--g500)", marginLeft: 8 }}>{rel.claim.worker} — {rel.claim.injuryType} — {fmt(rel.claim.injuryDate)}</span>
                    </div>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 4, paddingLeft: 12 }}>
                      {rel.reasons.map((r, ri2) => (
                        <span key={ri2} style={{ fontSize: 10, fontWeight: 500, color: "var(--orange)", padding: "2px 8px", borderRadius: 100, background: "rgba(255,149,0,.06)" }}>{r}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )) : (
              <div style={{ padding: 32, textAlign: "center", color: "var(--g400)", fontSize: 13 }}>No potential duplicates or related claims detected across your portfolio.</div>
            )}
          </>)}

          {/* CONSISTENCY */}
          {tab === "consistency" && (<>
            {inconsistencies.length > 0 ? inconsistencies.map((issue, i) => (
              <div key={i} style={{ padding: "14px 16px", background: issue.type === "ruling_reversal" ? "var(--red-light)" : "rgba(255,149,0,.03)", border: "1px solid " + (issue.type === "ruling_reversal" ? "var(--red-border)" : "rgba(255,149,0,.1)"), borderRadius: 12, marginBottom: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: issue.type === "ruling_reversal" ? "var(--red)" : "var(--orange)" }}>{issue.label}</span>
                  <span style={{ fontSize: 10, fontWeight: 600, color: "var(--g400)", padding: "2px 8px", borderRadius: 100, background: "var(--g50)" }}>{issue.type.replace("_", " ")}</span>
                </div>
                <div style={{ fontSize: 12, color: "var(--g600)", lineHeight: 1.6 }}>{issue.detail}</div>
                <div style={{ display: "flex", gap: 4, marginTop: 8 }}>
                  <button onClick={() => { onOpenClaim(issue.claimA); onClose(); }} style={{ padding: "4px 12px", borderRadius: 6, fontSize: 10, fontWeight: 600, border: "1px solid var(--card-border)", background: "#fff", color: "var(--blue)", cursor: "pointer" }}>Open {issue.claimA.claimNumber}</button>
                  {issue.claimB && <button onClick={() => { onOpenClaim(issue.claimB); onClose(); }} style={{ padding: "4px 12px", borderRadius: 6, fontSize: 10, fontWeight: 600, border: "1px solid var(--card-border)", background: "#fff", color: "var(--blue)", cursor: "pointer" }}>Open {issue.claimB.claimNumber}</button>}
                </div>
              </div>
            )) : (
              <div style={{ padding: 32, textAlign: "center", color: "var(--g400)", fontSize: 13 }}>No consistency issues detected. All analyzed claims have coherent rulings.</div>
            )}
          </>)}
        </div>
      </div>
    </div>
  );
}
