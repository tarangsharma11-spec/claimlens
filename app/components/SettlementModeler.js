"use client";
import { useState } from "react";

/**
 * SettlementModeler — Multi-scenario claim valuation for injury lawyers.
 * Compare conservative/expected/aggressive valuations side by side.
 */
export default function SettlementModeler({ claim, onClose }) {
  const [scenarios, setScenarios] = useState([
    { label: "Conservative", grossWeekly: "", recoveryWeeks: "6", impairmentPct: "0", modifiedWeeks: "2", contingencyPct: "25", disbursements: "1500" },
    { label: "Expected", grossWeekly: "", recoveryWeeks: "12", impairmentPct: "5", modifiedWeeks: "4", contingencyPct: "30", disbursements: "2500" },
    { label: "Aggressive", grossWeekly: "", recoveryWeeks: "26", impairmentPct: "15", modifiedWeeks: "6", contingencyPct: "30", disbursements: "4000" },
  ]);
  const [results, setResults] = useState(null);

  const update = (idx, field, val) => setScenarios((p) => p.map((s, i) => i === idx ? { ...s, [field]: val } : s));

  const calculate = () => {
    const r = scenarios.map((s) => {
      const gross = parseFloat(s.grossWeekly) || 0;
      const net = gross * 0.72;
      const loeWeekly = net * 0.85;
      const recWks = parseFloat(s.recoveryWeeks) || 0;
      const modWks = parseFloat(s.modifiedWeeks) || 0;
      const imp = parseFloat(s.impairmentPct) || 0;
      const cont = parseFloat(s.contingencyPct) || 0;
      const disb = parseFloat(s.disbursements) || 0;

      const fullLoeWks = Math.max(0, recWks - modWks);
      const totalLoe = loeWeekly * fullLoeWks + loeWeekly * 0.3 * modWks;
      const nel = imp * 1051.5;
      const healthcare = recWks * 300;
      const futureLoe = imp > 10 ? loeWeekly * 0.5 * 52 * Math.min(imp / 20, 3) : 0;
      const total = totalLoe + nel + healthcare + futureLoe;
      const fees = total * (cont / 100);
      const netClient = total - fees - disb;

      return { label: s.label, loeWeekly: Math.round(loeWeekly), totalLoe: Math.round(totalLoe), nel: Math.round(nel), healthcare: Math.round(healthcare), futureLoe: Math.round(futureLoe), total: Math.round(total), fees: Math.round(fees), disb, netClient: Math.round(netClient), feeToFirm: Math.round(fees + disb), recWks, imp };
    });
    setResults(r);
  };

  const $ = (n) => "$" + (n || 0).toLocaleString();
  const colors = ["var(--blue)", "var(--green)", "var(--orange)"];

  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", backdropFilter: "blur(8px)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "#fff", borderRadius: 20, width: "100%", maxWidth: 820, boxShadow: "0 20px 60px rgba(0,0,0,.15)", maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--g100)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: -0.5 }}>Settlement scenario modeler</div>
            <div style={{ fontSize: 12, color: "var(--g500)" }}>{claim?.claimNumber ? claim.claimNumber + " — " : ""}Compare valuations across assumptions</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "var(--g400)" }}>×</button>
        </div>
        <div style={{ padding: "20px 24px" }}>
          {/* Input grid */}
          <div style={{ display: "grid", gridTemplateColumns: "140px 1fr 1fr 1fr", gap: 6, marginBottom: 16, fontSize: 12 }}>
            <div style={{ fontWeight: 700, color: "var(--g500)", padding: "8px 0" }}>Parameter</div>
            {scenarios.map((s, i) => (
              <div key={i} style={{ textAlign: "center" }}>
                <input value={s.label} onChange={(e) => update(i, "label", e.target.value)} style={{ width: "100%", textAlign: "center", border: "none", fontSize: 13, fontWeight: 700, color: colors[i], outline: "none", padding: "8px 0" }} />
              </div>
            ))}
            {[
              { key: "grossWeekly", label: "Gross weekly ($)", ph: "980" },
              { key: "recoveryWeeks", label: "Recovery weeks", ph: "12" },
              { key: "impairmentPct", label: "Impairment (%)", ph: "5" },
              { key: "modifiedWeeks", label: "Modified duty weeks", ph: "4" },
              { key: "contingencyPct", label: "Contingency (%)", ph: "30" },
              { key: "disbursements", label: "Disbursements ($)", ph: "2500" },
            ].map((f) => (
              <>
                <div key={f.key + "_l"} style={{ color: "var(--g600)", padding: "6px 0", display: "flex", alignItems: "center" }}>{f.label}</div>
                {scenarios.map((s, i) => (
                  <input key={f.key + i} type="number" value={s[f.key]} onChange={(e) => update(i, f.key, e.target.value)} placeholder={f.ph} style={{ width: "100%", padding: "7px 10px", borderRadius: 8, border: "1px solid var(--card-border)", fontSize: 13, outline: "none", textAlign: "center" }} />
                ))}
              </>
            ))}
          </div>

          <button onClick={calculate} style={{ width: "100%", padding: 13, borderRadius: 12, border: "none", fontSize: 14, fontWeight: 700, background: "linear-gradient(135deg, #1A1040, #3B5EC0)", color: "#fff", cursor: "pointer", marginBottom: 20 }}>
            Calculate all scenarios
          </button>

          {/* Results */}
          {results && (
            <>
              {/* Total comparison bar */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 20 }}>
                {results.map((r, i) => (
                  <div key={i} style={{ padding: "16px", background: colors[i] + "08", border: "1.5px solid " + colors[i] + "20", borderRadius: 14, textAlign: "center" }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: colors[i] }}>{r.label}</div>
                    <div style={{ fontSize: 28, fontWeight: 800, color: colors[i], letterSpacing: -1 }}>{$(r.total)}</div>
                    <div style={{ fontSize: 11, color: "var(--g500)", marginTop: 4 }}>Client gets {$(r.netClient)}</div>
                    <div style={{ fontSize: 11, color: "var(--g500)" }}>Fee to firm {$(r.feeToFirm)}</div>
                  </div>
                ))}
              </div>

              {/* Breakdown table */}
              <div style={{ display: "grid", gridTemplateColumns: "140px 1fr 1fr 1fr", gap: 6, fontSize: 12 }}>
                <div style={{ fontWeight: 700, color: "var(--g500)", padding: "6px 0", borderBottom: "1px solid var(--g200)" }}>Breakdown</div>
                {results.map((r, i) => (
                  <div key={i} style={{ textAlign: "center", fontWeight: 700, color: colors[i], padding: "6px 0", borderBottom: "1px solid var(--g200)" }}>{r.label}</div>
                ))}
                {[
                  { label: "Weekly LOE (85%)", key: "loeWeekly" },
                  { label: "Total LOE", key: "totalLoe" },
                  { label: "NEL award", key: "nel" },
                  { label: "Healthcare costs", key: "healthcare" },
                  { label: "Future LOE", key: "futureLoe" },
                  { label: "Total claim value", key: "total", bold: true },
                  { label: "Legal fees", key: "fees" },
                  { label: "Disbursements", key: "disb" },
                  { label: "Net to client", key: "netClient", bold: true },
                ].map((row) => (
                  <>
                    <div key={row.key + "_l"} style={{ color: "var(--g600)", padding: "5px 0", fontWeight: row.bold ? 700 : 400, borderBottom: row.bold ? "2px solid var(--g200)" : "1px solid var(--g100)" }}>{row.label}</div>
                    {results.map((r, i) => (
                      <div key={row.key + i} style={{ textAlign: "center", padding: "5px 0", fontWeight: row.bold ? 700 : 400, color: row.bold ? "var(--g900)" : "var(--g600)", borderBottom: row.bold ? "2px solid var(--g200)" : "1px solid var(--g100)" }}>{$(r[row.key])}</div>
                    ))}
                  </>
                ))}
              </div>

              <div style={{ padding: "12px 14px", background: "var(--g50)", borderRadius: 10, marginTop: 14, fontSize: 11, color: "var(--g500)", lineHeight: 1.6 }}>
                Estimates based on Ontario WSIB LOE at 85% of net earnings, NEL at ~$1,051.50 per 1% WPI, and average healthcare costs. Actual amounts determined by WSIB. Future LOE applies when impairment exceeds 10%.
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
