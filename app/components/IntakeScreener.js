"use client";
import { useState, useRef } from "react";
import { guessDocType, fmt, redactPII } from "@/app/lib/constants";
import { getClaimStrength, getRedFlags } from "@/app/lib/claim-engine";

/**
 * IntakeScreener — Quick case viability assessment for injury lawyers.
 *
 * Flow: Upload docs → AI analyzes in background → strength score + ruling
 * prediction + estimated value + red flags, all in under 30 seconds.
 *
 * Usage: <IntakeScreener user={user} onCreateCase={(claim) => { ... }} onClose={() => {}} />
 */
export default function IntakeScreener({ user, onCreateCase, onClose }) {
  const [step, setStep] = useState("upload"); // upload | analyzing | result
  const [files, setFiles] = useState([]);
  const [form, setForm] = useState({ worker: "", employer: "", injuryDate: "", injuryType: "Acute Injury", description: "" });
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(0);
  const fRef = useRef(null);

  const handleFiles = async (e) => {
    const newFiles = Array.from(e.target.files);
    setFiles((p) => [...p, ...newFiles]);
    e.target.value = "";
  };

  const analyze = async () => {
    setStep("analyzing");
    setProgress(10);
    setError(null);

    try {
      // Step 1: Extract text from uploaded files
      setProgress(20);
      const extractedTexts = {};

      const pdfFiles = files.filter((f) => f.type === "application/pdf" || f.name.endsWith(".pdf"));
      const textFiles = files.filter((f) => !f.type.includes("pdf") && !f.name.endsWith(".pdf"));

      // Text files — client-side
      for (const f of textFiles) {
        const text = await f.text();
        extractedTexts[f.name] = text;
      }

      // PDFs — server-side
      if (pdfFiles.length > 0) {
        const fd = new FormData();
        pdfFiles.forEach((f) => fd.append("files", f));
        const uploadRes = await fetch("/api/upload", { method: "POST", body: fd });
        const uploadData = await uploadRes.json();
        if (uploadData.files) {
          Object.entries(uploadData.files).forEach(([name, info]) => {
            extractedTexts[name] = info.text || "[extraction failed]";
          });
        }
      }

      setProgress(50);

      // Step 2: Run quick AI analysis
      const claimContext = `[QUICK INTAKE SCREENING]
Worker: ${form.worker || "Unknown"}
Employer: ${form.employer || "Unknown"}
Injury Date: ${form.injuryDate || "Unknown"}
Type: ${form.injuryType}
Description: ${form.description || "See documents"}
Documents uploaded: ${files.map((f) => f.name).join(", ")}`;

      const prompt = `You are performing a QUICK INTAKE SCREENING for an injury lawyer evaluating whether to take this case. Be concise and decisive.

${claimContext}

Analyze the uploaded documents and provide EXACTLY this format (no extra text):

VIABILITY: [Strong / Moderate / Weak / Do Not Take]
RULING_PREDICTION: [Allow / Deny / Further Investigation]
CONFIDENCE: [High / Medium / Low]
ESTIMATED_VALUE_LOW: [number in dollars]
ESTIMATED_VALUE_HIGH: [number in dollars]
KEY_STRENGTHS: [comma separated, max 3]
KEY_RISKS: [comma separated, max 3]
MISSING_EVIDENCE: [comma separated, max 3]
ONE_LINE_SUMMARY: [single sentence assessment]
RECOMMENDATION: [1-2 sentence recommendation for the lawyer]`;

      const msgs = [{ role: "user", content: prompt }];
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: msgs,
          documentTexts: Object.fromEntries(
            Object.entries(extractedTexts).map(([k, v]) => [k, redactPII(v, "standard")])
          ),
          claimContext: { injuryType: form.injuryType, description: form.description },
        }),
      });

      setProgress(85);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Analysis failed");

      // Step 3: Parse the structured response
      const reply = data.reply || "";
      const parsed = {};
      const lines = reply.split("\n");
      for (const line of lines) {
        const match = line.match(/^([A-Z_]+):\s*(.+)/);
        if (match) parsed[match[1]] = match[2].trim();
      }

      setProgress(100);
      setResult({
        viability: parsed.VIABILITY || "Unknown",
        ruling: parsed.RULING_PREDICTION || "Unknown",
        confidence: parsed.CONFIDENCE || "Unknown",
        valueLow: parseInt(parsed.ESTIMATED_VALUE_LOW) || 0,
        valueHigh: parseInt(parsed.ESTIMATED_VALUE_HIGH) || 0,
        strengths: (parsed.KEY_STRENGTHS || "").split(",").map((s) => s.trim()).filter(Boolean),
        risks: (parsed.KEY_RISKS || "").split(",").map((s) => s.trim()).filter(Boolean),
        missing: (parsed.MISSING_EVIDENCE || "").split(",").map((s) => s.trim()).filter(Boolean),
        summary: parsed.ONE_LINE_SUMMARY || "",
        recommendation: parsed.RECOMMENDATION || "",
        fullReply: reply,
        documentsAnalyzed: Object.keys(extractedTexts).length,
        extractedTexts,
      });
      setStep("result");
    } catch (err) {
      setError(err.message);
      setStep("upload");
    }
  };

  const createCase = () => {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const claim = {
      id,
      claimNumber: `CL-${id.slice(0, 6).toUpperCase()}`,
      worker: form.worker || "—",
      employer: form.employer || "—",
      injuryDate: form.injuryDate || "—",
      injuryType: form.injuryType,
      description: form.description || "",
      stage: "review",
      ownerEmail: user.email.toLowerCase(),
      timeline: [
        { date: new Date().toISOString(), type: "created", note: "Case created via Quick Intake Screener" },
        { date: new Date().toISOString(), type: "analysis", note: `Intake screening — ${result.viability} (${result.ruling})` },
      ],
      documents: files.map((f) => ({ name: f.name, tag: guessDocType(f.name), addedAt: new Date().toISOString() })),
      analyses: [{ date: new Date().toISOString(), ruling: result.ruling === "Allow" ? "Allow" : result.ruling === "Deny" ? "Deny" : "Further Investigation", snippet: result.summary }],
      messages: [],
      notes: [{ date: new Date().toISOString(), text: `Intake screening: ${result.viability}. ${result.recommendation}` }],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      intakeResult: result,
    };
    onCreateCase(claim);
  };

  const viabilityColor = { Strong: "var(--green)", Moderate: "var(--blue)", Weak: "var(--orange)", "Do Not Take": "var(--red)" };
  const rulingColor = { Allow: "var(--green)", Deny: "var(--red)", "Further Investigation": "var(--orange)" };

  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", backdropFilter: "blur(8px)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "#fff", borderRadius: 20, width: "100%", maxWidth: 620, boxShadow: "0 20px 60px rgba(0,0,0,.15)", maxHeight: "90vh", overflowY: "auto" }}>

        {/* Header */}
        <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--g100)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: -0.5 }}>Quick Intake Screener</div>
            <div style={{ fontSize: 12, color: "var(--g500)", marginTop: 2 }}>Upload docs, get a case viability score in 30 seconds</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "var(--g400)" }}>×</button>
        </div>

        <div style={{ padding: "20px 24px" }}>

          {/* === UPLOAD STEP === */}
          {step === "upload" && (
            <>
              {/* Quick form */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--g500)", marginBottom: 4 }}>Worker name / initials</label>
                  <input value={form.worker} onChange={(e) => setForm((p) => ({ ...p, worker: e.target.value }))} placeholder="J. Smith" style={{ width: "100%", padding: "9px 12px", borderRadius: 10, border: "1px solid var(--card-border)", fontSize: 13, outline: "none" }} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--g500)", marginBottom: 4 }}>Employer</label>
                  <input value={form.employer} onChange={(e) => setForm((p) => ({ ...p, employer: e.target.value }))} placeholder="Acme Corp" style={{ width: "100%", padding: "9px 12px", borderRadius: 10, border: "1px solid var(--card-border)", fontSize: 13, outline: "none" }} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--g500)", marginBottom: 4 }}>Injury date</label>
                  <input type="date" value={form.injuryDate} onChange={(e) => setForm((p) => ({ ...p, injuryDate: e.target.value }))} style={{ width: "100%", padding: "9px 12px", borderRadius: 10, border: "1px solid var(--card-border)", fontSize: 13, outline: "none" }} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--g500)", marginBottom: 4 }}>Injury type</label>
                  <select value={form.injuryType} onChange={(e) => setForm((p) => ({ ...p, injuryType: e.target.value }))} style={{ width: "100%", padding: "9px 12px", borderRadius: 10, border: "1px solid var(--card-border)", fontSize: 13, outline: "none", background: "#fff" }}>
                    <option>Acute Injury</option>
                    <option>Occupational Disease</option>
                    <option>Traumatic Mental Stress</option>
                    <option>Chronic Mental Stress</option>
                    <option>PTSD (First Responder)</option>
                    <option>Recurrence</option>
                    <option>Aggravation of Pre-existing</option>
                  </select>
                </div>
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--g500)", marginBottom: 4 }}>Brief description (optional)</label>
                <textarea value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} placeholder="What happened..." rows={2} style={{ width: "100%", padding: "9px 12px", borderRadius: 10, border: "1px solid var(--card-border)", fontSize: 13, outline: "none", resize: "none", fontFamily: "inherit" }} />
              </div>

              {/* File upload */}
              <input ref={fRef} type="file" multiple onChange={handleFiles} style={{ display: "none" }} accept=".pdf,.txt,.doc,.docx,.html,.md" />
              <div onClick={() => fRef.current?.click()} style={{ padding: 24, border: "2px dashed var(--card-border)", borderRadius: 14, textAlign: "center", cursor: "pointer", background: "var(--g50)", marginBottom: 12 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--g700)", marginBottom: 4 }}>Drop claim documents here</div>
                <div style={{ fontSize: 12, color: "var(--g500)" }}>Form 6, Form 7, medical reports, imaging — PDF or text</div>
              </div>

              {files.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  {files.map((f, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 10px", background: "var(--blue-light)", borderRadius: 8, marginBottom: 4, border: "1px solid var(--blue-border)" }}>
                      <span style={{ fontSize: 12, color: "var(--blue)", fontWeight: 500 }}>{f.name}</span>
                      <button onClick={() => setFiles((p) => p.filter((_, j) => j !== i))} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--g400)", fontSize: 14 }}>×</button>
                    </div>
                  ))}
                </div>
              )}

              {error && (
                <div style={{ padding: "10px 14px", background: "var(--red-light)", border: "1px solid var(--red-border)", borderRadius: 10, fontSize: 13, color: "var(--red)", marginBottom: 12 }}>{error}</div>
              )}

              <button onClick={analyze} disabled={files.length === 0} style={{ width: "100%", padding: 14, borderRadius: 12, border: "none", fontSize: 15, fontWeight: 700, background: files.length > 0 ? "linear-gradient(135deg, #1A1040, #3B5EC0)" : "var(--g200)", color: files.length > 0 ? "#fff" : "var(--g400)", cursor: files.length > 0 ? "pointer" : "default" }}>
                Screen this case
              </button>
            </>
          )}

          {/* === ANALYZING STEP === */}
          {step === "analyzing" && (
            <div style={{ textAlign: "center", padding: "40px 0" }}>
              <div style={{ width: 56, height: 56, borderRadius: "50%", background: "linear-gradient(135deg, #1A1040, #3B5EC0)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                <div style={{ width: 20, height: 20, border: "3px solid rgba(255,255,255,.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Analyzing {files.length} document{files.length > 1 ? "s" : ""}...</div>
              <div style={{ fontSize: 13, color: "var(--g500)", marginBottom: 16 }}>
                {progress < 30 ? "Extracting text from documents" : progress < 60 ? "Running Five Point Check analysis" : progress < 90 ? "Evaluating claim strength" : "Generating recommendation"}
              </div>
              <div style={{ height: 6, background: "var(--g200)", borderRadius: 3, overflow: "hidden", maxWidth: 300, margin: "0 auto" }}>
                <div style={{ width: `${progress}%`, height: "100%", background: "linear-gradient(90deg, #1A1040, #3B5EC0)", borderRadius: 3, transition: "width .5s ease" }} />
              </div>
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            </div>
          )}

          {/* === RESULT STEP === */}
          {step === "result" && result && (
            <>
              {/* Viability score — the hero */}
              <div style={{ padding: "20px 24px", background: `${viabilityColor[result.viability] || "var(--blue)"}08`, border: `1.5px solid ${viabilityColor[result.viability] || "var(--blue)"}25`, borderRadius: 16, marginBottom: 16, textAlign: "center" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--g500)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Case viability</div>
                <div style={{ fontSize: 32, fontWeight: 800, color: viabilityColor[result.viability] || "var(--blue)", letterSpacing: -1 }}>{result.viability}</div>
                <div style={{ fontSize: 13, color: "var(--g600)", marginTop: 6, lineHeight: 1.5 }}>{result.summary}</div>
              </div>

              {/* Key metrics */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 16 }}>
                <div style={{ padding: "12px", background: `${rulingColor[result.ruling] || "var(--blue)"}08`, borderRadius: 12, textAlign: "center" }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: "var(--g500)", textTransform: "uppercase" }}>Ruling</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: rulingColor[result.ruling] || "var(--blue)" }}>{result.ruling}</div>
                  <div style={{ fontSize: 10, color: "var(--g400)" }}>{result.confidence} confidence</div>
                </div>
                <div style={{ padding: "12px", background: "var(--g50)", borderRadius: 12, textAlign: "center" }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: "var(--g500)", textTransform: "uppercase" }}>Est. value</div>
                  <div style={{ fontSize: 16, fontWeight: 800 }}>${(result.valueLow / 1000).toFixed(0)}k–${(result.valueHigh / 1000).toFixed(0)}k</div>
                  <div style={{ fontSize: 10, color: "var(--g400)" }}>Total claim</div>
                </div>
                <div style={{ padding: "12px", background: "var(--g50)", borderRadius: 12, textAlign: "center" }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: "var(--g500)", textTransform: "uppercase" }}>Docs</div>
                  <div style={{ fontSize: 16, fontWeight: 800 }}>{result.documentsAnalyzed}</div>
                  <div style={{ fontSize: 10, color: "var(--g400)" }}>Analyzed</div>
                </div>
              </div>

              {/* Strengths + risks side by side */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--green)", textTransform: "uppercase", letterSpacing: .5, marginBottom: 6 }}>Strengths</div>
                  {result.strengths.map((s, i) => (
                    <div key={i} style={{ fontSize: 12, color: "var(--g700)", padding: "4px 0", display: "flex", gap: 6 }}>
                      <span style={{ color: "var(--green)", flexShrink: 0 }}>+</span>{s}
                    </div>
                  ))}
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--red)", textTransform: "uppercase", letterSpacing: .5, marginBottom: 6 }}>Risks</div>
                  {result.risks.map((r, i) => (
                    <div key={i} style={{ fontSize: 12, color: "var(--g700)", padding: "4px 0", display: "flex", gap: 6 }}>
                      <span style={{ color: "var(--red)", flexShrink: 0 }}>-</span>{r}
                    </div>
                  ))}
                </div>
              </div>

              {/* Missing evidence */}
              {result.missing.length > 0 && (
                <div style={{ padding: "12px 14px", background: "rgba(255,149,0,.04)", border: "1px solid rgba(255,149,0,.1)", borderRadius: 10, marginBottom: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--orange)", marginBottom: 4 }}>Missing evidence</div>
                  <div style={{ fontSize: 12, color: "var(--g600)" }}>{result.missing.join(" · ")}</div>
                </div>
              )}

              {/* Recommendation */}
              <div style={{ padding: "14px 16px", background: "var(--g50)", borderRadius: 12, marginBottom: 20, fontSize: 13, color: "var(--g700)", lineHeight: 1.6 }}>
                <strong>Recommendation:</strong> {result.recommendation}
              </div>

              {/* Actions */}
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={createCase} style={{ flex: 1, padding: 13, borderRadius: 12, border: "none", fontSize: 14, fontWeight: 700, background: "linear-gradient(135deg, #1A1040, #3B5EC0)", color: "#fff", cursor: "pointer" }}>
                  Take case — create in CaseAssist
                </button>
                <button onClick={onClose} style={{ padding: "13px 20px", borderRadius: 12, border: "1px solid var(--card-border)", background: "#fff", fontSize: 14, fontWeight: 600, color: "var(--g600)", cursor: "pointer" }}>
                  Pass
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
