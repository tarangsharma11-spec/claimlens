"use client";
import { useState } from "react";

/**
 * EmployerTools — Three employer-specific tools in tabbed modal:
 * 1. Rate Framework calculator (Risk Band model, post-2020)
 * 2. SIEF eligibility checker
 * 3. Early intervention playbook (first 72 hours)
 */
export default function EmployerTools({ claim, claims, onClose }) {
  const [tab, setTab] = useState("rate"); // rate | sief | playbook
  const [rateForm, setRateForm] = useState({ payroll: "", currentBand: "60", claimsCount: "", claimsCost: "", predictability: "50" });
  const [rateResult, setRateResult] = useState(null);
  const [siefForm, setSiefForm] = useState({ preExisting: false, preExistingDesc: "", aggravation: false, prolongedRecovery: false, ageOver55: false });
  const [siefResult, setSiefResult] = useState(null);

  // === RATE FRAMEWORK CALCULATOR ===
  const calcRate = () => {
    const payroll = parseFloat(rateForm.payroll) || 0;
    const currentBand = parseInt(rateForm.currentBand) || 60;
    const claimsCount = parseInt(rateForm.claimsCount) || 0;
    const claimsCost = parseFloat(rateForm.claimsCost) || 0;
    const predictability = parseFloat(rateForm.predictability) || 50;

    // Each risk band ≈ 5% premium change. Max move: 3 bands/year up, 3 down.
    // Industry average is band 60. Below 60 = better than average.
    // Predictability (2.5%-100%) determines how much your own experience matters.
    const costPerHundred = payroll > 0 ? (claimsCost / (payroll / 100)) : 0;
    const claimRate = payroll > 0 ? (claimsCount / (payroll / 100000)) : 0;

    // Simplified projection: each significant claim moves ~1-2 bands
    const projectedBandMove = Math.min(3, Math.ceil(claimsCount * (predictability / 100) * 0.8));
    const newBand = Math.min(currentBand + projectedBandMove, currentBand + 3);
    const premiumChangePct = (newBand - currentBand) * 5;

    // Estimate base premium rate from band (approximate: band 60 ≈ class rate)
    const basePremiumRate = 1.5 + (currentBand - 30) * 0.05; // rough $/100 payroll
    const currentAnnualPremium = payroll / 100 * basePremiumRate;
    const newAnnualPremium = currentAnnualPremium * (1 + premiumChangePct / 100);
    const dollarImpact = newAnnualPremium - currentAnnualPremium;

    // Per-claim limit (roughly proportional to payroll)
    const perClaimLimit = Math.round(payroll * 0.015);

    setRateResult({
      currentBand, newBand, projectedBandMove, premiumChangePct,
      currentAnnualPremium: Math.round(currentAnnualPremium),
      newAnnualPremium: Math.round(newAnnualPremium),
      dollarImpact: Math.round(dollarImpact),
      costPerHundred: costPerHundred.toFixed(2),
      perClaimLimit,
      isAboveAvg: newBand > 60,
    });
  };

  // === SIEF CHECKER ===
  const checkSief = () => {
    const factors = [];
    let eligible = false;
    let pctRelief = 0;

    if (siefForm.preExisting) {
      factors.push({ label: "Pre-existing condition documented", impact: "high", detail: "SIEF applies when a pre-existing condition significantly contributes to the severity or duration of the disability. The employer's claim costs can be reduced." });
      eligible = true;
      pctRelief += 50;
    }
    if (siefForm.aggravation) {
      factors.push({ label: "Work aggravated a pre-existing condition", impact: "high", detail: "Under the thin skull principle (OPM 15-04-01), the claim is allowed, but SIEF recognizes the employer shouldn't bear the full cost when pre-existing conditions contribute." });
      if (eligible) pctRelief += 25;
      else { eligible = true; pctRelief += 75; }
    }
    if (siefForm.prolongedRecovery) {
      factors.push({ label: "Recovery is prolonged beyond expectations", impact: "medium", detail: "If recovery takes significantly longer than expected for the injury type and the pre-existing condition is a factor, SIEF cost relief may apply to the extended period." });
      if (eligible) pctRelief += 10;
    }
    if (siefForm.ageOver55) {
      factors.push({ label: "Worker is over 55", impact: "low", detail: "Age alone doesn't qualify for SIEF, but age-related degeneration combined with a workplace injury strengthens the SIEF application." });
      if (!eligible) factors.push({ label: "Age alone is insufficient", impact: "info", detail: "SIEF requires a documented pre-existing condition. Age-related wear is common but must be medically documented." });
    }
    if (!siefForm.preExisting && !siefForm.aggravation) {
      factors.push({ label: "No pre-existing condition identified", impact: "blocker", detail: "SIEF requires evidence that a pre-existing condition contributed to the disability. Without this, the application will be denied." });
    }

    pctRelief = Math.min(pctRelief, 100);
    setSiefResult({ eligible, pctRelief, factors });
  };

  // === PLAYBOOK DATA ===
  const playbookSteps = [
    { time: "0-4 hours", title: "Immediate response", items: [
      { action: "Ensure worker receives medical attention", critical: true },
      { action: "Secure the scene and document conditions", critical: true },
      { action: "Collect witness names and statements", critical: false },
      { action: "Notify supervisor and HR department", critical: true },
      { action: "Take photos/video of the incident scene", critical: false },
    ]},
    { time: "4-24 hours", title: "Documentation and reporting", items: [
      { action: "Complete Form 7 (Employer Report) — due within 3 business days", critical: true },
      { action: "Contact the injured worker to check on their condition", critical: true },
      { action: "Contact the treating physician to discuss modified duties", critical: false },
      { action: "Document the worker's regular job duties and physical demands", critical: false },
      { action: "Begin preparing modified work options", critical: false },
    ]},
    { time: "24-48 hours", title: "Three-point contact", items: [
      { action: "Follow up with injured worker — explain the process and their rights", critical: true },
      { action: "Confirm Form 8 has been submitted by the health professional", critical: true },
      { action: "Offer modified duties in writing, consistent with medical restrictions", critical: true },
      { action: "Notify WSIB if the claim involves lost time beyond the day of injury", critical: false },
      { action: "Begin tracking all costs associated with the claim", critical: false },
    ]},
    { time: "48-72 hours", title: "Claims management setup", items: [
      { action: "Verify Form 7 was filed and WSIB received it", critical: true },
      { action: "Set up a claim file with all documents organized", critical: false },
      { action: "Assess SIEF eligibility if pre-existing conditions are known", critical: false },
      { action: "Schedule a return-to-work planning meeting with the worker", critical: false },
      { action: "Review the incident for prevention — update safety protocols if needed", critical: false },
      { action: "Consider whether the claim should be disputed (review evidence carefully)", critical: false },
    ]},
  ];

  const tabStyle = (t) => ({ flex: 1, padding: "10px 0", borderRadius: 10, border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer", background: tab === t ? "#fff" : "transparent", color: tab === t ? "var(--g900)" : "var(--g500)", boxShadow: tab === t ? "0 1px 3px rgba(0,0,0,.06)" : "none" });

  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", backdropFilter: "blur(8px)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "#fff", borderRadius: 20, width: "100%", maxWidth: 660, boxShadow: "0 20px 60px rgba(0,0,0,.15)", maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--g100)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: -0.5 }}>Employer tools</div>
            <div style={{ fontSize: 12, color: "var(--g500)" }}>Rate framework, SIEF, and early intervention</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "var(--g400)" }}>×</button>
        </div>

        <div style={{ display: "flex", gap: 2, padding: "12px 24px 0", background: "var(--g50)" }}>
          <div style={{ display: "flex", gap: 2, padding: 3, background: "var(--g100)", borderRadius: 12, flex: 1 }}>
            <button onClick={() => setTab("rate")} style={tabStyle("rate")}>Rate framework</button>
            <button onClick={() => setTab("sief")} style={tabStyle("sief")}>SIEF checker</button>
            <button onClick={() => setTab("playbook")} style={tabStyle("playbook")}>First 72 hours</button>
          </div>
        </div>

        <div style={{ padding: "20px 24px" }}>

          {/* RATE FRAMEWORK */}
          {tab === "rate" && (<>
            <div style={{ padding: "12px 16px", background: "linear-gradient(135deg, #1A1040, #3B5EC0)", borderRadius: 12, color: "#fff", marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>WSIB Rate Framework (2020+)</div>
              <div style={{ fontSize: 11, opacity: .7 }}>Replaced NEER/MAP. Each Risk Band = ~5% premium. Max 3 bands/year movement.</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
              {[
                { key: "payroll", label: "Annual insurable earnings ($)", ph: "2000000" },
                { key: "currentBand", label: "Current risk band (1-120)", ph: "60" },
                { key: "claimsCount", label: "Allowed claims this year", ph: "3" },
                { key: "claimsCost", label: "Total claims cost ($)", ph: "45000" },
                { key: "predictability", label: "Actuarial predictability (%)", ph: "50" },
              ].map((f) => (
                <div key={f.key}>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--g500)", marginBottom: 4 }}>{f.label}</label>
                  <input type="number" value={rateForm[f.key]} onChange={(e) => setRateForm((p) => ({ ...p, [f.key]: e.target.value }))} placeholder={f.ph} style={{ width: "100%", padding: "9px 12px", borderRadius: 10, border: "1px solid var(--card-border)", fontSize: 13, outline: "none" }} />
                </div>
              ))}
            </div>
            <button onClick={calcRate} style={{ width: "100%", padding: 12, borderRadius: 12, border: "none", fontSize: 14, fontWeight: 600, background: "var(--blue)", color: "#fff", cursor: "pointer", marginBottom: 14 }}>Calculate premium impact</button>

            {rateResult && (<>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
                <div style={{ padding: 12, background: "var(--g50)", borderRadius: 12, textAlign: "center" }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: "var(--g500)", textTransform: "uppercase" }}>Current band</div>
                  <div style={{ fontSize: 22, fontWeight: 800 }}>{rateResult.currentBand}</div>
                  <div style={{ fontSize: 10, color: "var(--g400)" }}>{rateResult.currentBand <= 60 ? "At or below avg" : "Above average"}</div>
                </div>
                <div style={{ padding: 12, background: rateResult.projectedBandMove > 0 ? "var(--red-light)" : "var(--green-light)", borderRadius: 12, textAlign: "center" }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: "var(--g500)", textTransform: "uppercase" }}>Projected band</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: rateResult.projectedBandMove > 0 ? "var(--red)" : "var(--green)" }}>{rateResult.newBand}</div>
                  <div style={{ fontSize: 10, color: "var(--g400)" }}>+{rateResult.projectedBandMove} bands</div>
                </div>
                <div style={{ padding: 12, background: "var(--red-light)", borderRadius: 12, textAlign: "center" }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: "var(--g500)", textTransform: "uppercase" }}>Premium impact</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: "var(--red)" }}>+{rateResult.premiumChangePct}%</div>
                  <div style={{ fontSize: 10, color: "var(--g400)" }}>+${rateResult.dollarImpact.toLocaleString()}/yr</div>
                </div>
              </div>
              <div style={{ padding: "10px 14px", background: "var(--g50)", borderRadius: 10, fontSize: 11, color: "var(--g500)", lineHeight: 1.6 }}>
                Per-claim cost limit: <strong style={{ color: "var(--g700)" }}>${rateResult.perClaimLimit.toLocaleString()}</strong> — claims exceeding this are capped. Predictability at {rateForm.predictability}% means your own experience drives {rateForm.predictability}% of your rate, class average drives the rest.
              </div>
            </>)}
          </>)}

          {/* SIEF CHECKER */}
          {tab === "sief" && (<>
            <div style={{ padding: "12px 16px", background: "rgba(40,167,69,.04)", border: "1px solid rgba(40,167,69,.1)", borderRadius: 12, marginBottom: 14, fontSize: 12, color: "var(--g600)", lineHeight: 1.6 }}>
              The <strong>Second Injury and Enhancement Fund (SIEF)</strong> provides cost relief to employers when a worker's pre-existing condition contributes to the severity or duration of a workplace injury. This reduces the claim's impact on your premiums.
            </div>
            <div style={{ marginBottom: 14 }}>
              {[
                { key: "preExisting", label: "Worker has a documented pre-existing condition" },
                { key: "aggravation", label: "Workplace injury aggravated the pre-existing condition" },
                { key: "prolongedRecovery", label: "Recovery is taking longer than expected for the injury type" },
                { key: "ageOver55", label: "Worker is over 55 years old" },
              ].map((f) => (
                <label key={f.key} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: siefForm[f.key] ? "rgba(40,167,69,.03)" : "#fff", border: "1px solid " + (siefForm[f.key] ? "rgba(40,167,69,.1)" : "var(--card-border)"), borderRadius: 10, marginBottom: 4, cursor: "pointer" }}>
                  <input type="checkbox" checked={siefForm[f.key]} onChange={(e) => setSiefForm((p) => ({ ...p, [f.key]: e.target.checked }))} style={{ width: 18, height: 18, accentColor: "var(--green)" }} />
                  <span style={{ fontSize: 13, color: "var(--g700)" }}>{f.label}</span>
                </label>
              ))}
            </div>
            {siefForm.preExisting && (
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--g500)", marginBottom: 4 }}>Describe the pre-existing condition</label>
                <input value={siefForm.preExistingDesc} onChange={(e) => setSiefForm((p) => ({ ...p, preExistingDesc: e.target.value }))} placeholder="e.g. Degenerative disc disease at L4-L5" style={{ width: "100%", padding: "9px 12px", borderRadius: 10, border: "1px solid var(--card-border)", fontSize: 13, outline: "none" }} />
              </div>
            )}
            <button onClick={checkSief} style={{ width: "100%", padding: 12, borderRadius: 12, border: "none", fontSize: 14, fontWeight: 600, background: "var(--green)", color: "#fff", cursor: "pointer", marginBottom: 14 }}>Check SIEF eligibility</button>

            {siefResult && (
              <div style={{ padding: "16px", background: siefResult.eligible ? "rgba(40,167,69,.04)" : "var(--red-light)", border: "1px solid " + (siefResult.eligible ? "rgba(40,167,69,.12)" : "var(--red-border)"), borderRadius: 14 }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: siefResult.eligible ? "var(--green)" : "var(--red)", marginBottom: 8 }}>
                  {siefResult.eligible ? `Likely eligible — up to ${siefResult.pctRelief}% cost relief` : "Not eligible with current factors"}
                </div>
                {siefResult.factors.map((f, i) => (
                  <div key={i} style={{ padding: "8px 0", borderBottom: i < siefResult.factors.length - 1 ? "1px solid var(--g100)" : "none" }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: f.impact === "blocker" ? "var(--red)" : f.impact === "high" ? "var(--green)" : "var(--g700)" }}>{f.label}</div>
                    <div style={{ fontSize: 12, color: "var(--g500)", lineHeight: 1.5, marginTop: 2 }}>{f.detail}</div>
                  </div>
                ))}
              </div>
            )}
          </>)}

          {/* EARLY INTERVENTION PLAYBOOK */}
          {tab === "playbook" && (<>
            <div style={{ padding: "12px 16px", background: "linear-gradient(135deg, #1A1040, #3B5EC0)", borderRadius: 12, color: "#fff", marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>Early intervention playbook</div>
              <div style={{ fontSize: 11, opacity: .7 }}>What employers must do in the first 72 hours after a workplace injury. Timely action reduces claim costs and improves outcomes.</div>
            </div>
            {playbookSteps.map((step, si) => (
              <div key={si} style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--blue)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{si + 1}</div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "var(--g900)" }}>{step.title}</div>
                    <div style={{ fontSize: 11, color: "var(--blue)", fontWeight: 600 }}>{step.time}</div>
                  </div>
                </div>
                {step.items.map((item, ii) => (
                  <div key={ii} style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "6px 0 6px 36px" }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: item.critical ? "var(--red)" : "var(--g300)", marginTop: 5, flexShrink: 0 }} />
                    <span style={{ fontSize: 13, color: "var(--g700)", lineHeight: 1.5 }}>
                      {item.action}
                      {item.critical && <span style={{ fontSize: 10, fontWeight: 600, color: "var(--red)", marginLeft: 6 }}>CRITICAL</span>}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </>)}
        </div>
      </div>
    </div>
  );
}
