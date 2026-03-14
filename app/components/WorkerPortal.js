"use client";
import { useState } from "react";
import { stageOf, fmt, daysAgo } from "@/app/lib/constants";
import { getDeadlines, getRTWProgress, getWhatsNeeded, getWorkflowStatus } from "@/app/lib/claim-engine";

/**
 * WorkerPortal — Simplified view for injured workers.
 *
 * Plain language. No OPM codes. No legal jargon.
 * Shows: where your claim is, what you're entitled to,
 * what documents to submit, and how to appeal if denied.
 *
 * Usage: <WorkerPortal claim={claim} onClose={() => {}} onOpenChat={(prompt) => {}} />
 */
export default function WorkerPortal({ claim, onClose, onOpenChat }) {
  const [tab, setTab] = useState("status"); // status | rights | docs | appeal
  const [appealStep, setAppealStep] = useState(0);

  if (!claim) {
    return (
      <div onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", backdropFilter: "blur(8px)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
        <div style={{ background: "#fff", borderRadius: 20, padding: "40px 24px", maxWidth: 480, textAlign: "center" }}>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Select a claim first</div>
          <div style={{ fontSize: 14, color: "var(--g500)", marginBottom: 16 }}>Open one of your cases to see the worker portal view.</div>
          <button onClick={onClose} style={{ padding: "10px 24px", borderRadius: 10, border: "none", background: "var(--blue)", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Go back</button>
        </div>
      </div>
    );
  }

  const stage = stageOf(claim.stage);
  const rtw = getRTWProgress(claim);
  const deadlines = getDeadlines(claim);
  const needed = getWhatsNeeded(claim);
  const wf = getWorkflowStatus(claim);
  const lastRuling = claim.analyses?.[claim.analyses.length - 1]?.ruling;

  // Plain-language status messages
  const statusMessages = {
    new: { title: "Your claim has been filed", desc: "WSIB has received your claim and it's being set up in the system. A decision-maker will be assigned to review it.", next: "You may be contacted by WSIB, your employer, or a healthcare provider. Please respond promptly to any requests." },
    review: { title: "Your claim is being reviewed", desc: "A WSIB decision-maker is looking at your claim to determine if you're entitled to benefits. They're checking your injury report, medical evidence, and employer information.", next: "Make sure your doctor has submitted the Health Professional Report (Form 8). If WSIB asks for more information, try to provide it within a week." },
    investigating: { title: "WSIB needs more information", desc: "The decision-maker needs additional evidence before they can make a decision on your claim. This is normal and doesn't mean your claim will be denied.", next: "Check below for what documents are still needed. Your doctor, employer, or specialist may need to provide additional reports." },
    approved: { title: "Your claim has been approved!", desc: "WSIB has determined that your injury is work-related and you're entitled to benefits. You should start receiving loss of earnings payments if you're off work.", next: "Focus on your recovery and follow your treatment plan. Work with your employer on a return-to-work plan when you're ready. Keep WSIB updated on any changes." },
    denied: { title: "Your claim was not approved", desc: "WSIB reviewed your claim and determined that it doesn't meet the requirements for benefits at this time. This is not necessarily the final decision — you have the right to appeal.", next: "Read the denial letter carefully to understand why. You can appeal this decision. See the Appeal tab for a step-by-step guide." },
    appeal: { title: "Your appeal is in progress", desc: "You've started the appeal process. A different decision-maker will review your case with any new evidence you provide.", next: "Gather any additional medical evidence or documentation that supports your claim. The stronger your evidence, the better your chances." },
    closed: { title: "Your case is closed", desc: "This case has been resolved. If your condition worsens or your symptoms return, you may be able to reopen it as a recurrence.", next: "Keep records of any ongoing symptoms. If your condition changes, contact WSIB about filing a recurrence claim." },
  };
  const status = statusMessages[claim.stage] || statusMessages.new;

  // Plain-language entitlement info
  const entitlements = [
    { title: "Wage replacement", desc: "If you can't work due to your injury, you may receive 85% of your take-home pay (before taxes). This is called Loss of Earnings (LOE).", applies: claim.stage === "approved" },
    { title: "Medical costs", desc: "WSIB covers the cost of treatment related to your injury — doctor visits, physiotherapy, prescriptions, and medical equipment.", applies: true },
    { title: "Permanent impairment", desc: "If your injury causes lasting effects, you may receive a one-time payment based on how much the injury affects your life.", applies: claim.stage === "approved" },
    { title: "Return to work support", desc: "Your employer must offer you modified work that fits your abilities. WSIB can help if your employer doesn't cooperate.", applies: true },
    { title: "Retraining", desc: "If you can't go back to your old job, WSIB may help you train for a new one that works with your limitations.", applies: claim.stage === "approved" },
  ];

  // Plain-language document names
  const docNames = {
    form6: { name: "Your injury report", desc: "The form you filled out describing what happened" },
    form7: { name: "Employer's report", desc: "Your employer's account of the incident" },
    form8: { name: "Doctor's report", desc: "Your doctor's medical assessment" },
    medical: { name: "Medical records", desc: "Clinical notes from your doctor or specialist" },
    imaging: { name: "Diagnostic scans", desc: "X-rays, MRI, CT scan results" },
    specialist: { name: "Specialist report", desc: "Assessment from a specialist doctor" },
    physio: { name: "Therapy records", desc: "Physiotherapy or rehabilitation notes" },
    witness: { name: "Witness statement", desc: "Account from someone who saw the incident" },
  };

  // Appeal steps in plain language
  const appealSteps = [
    { title: "Understand the decision", desc: "Read your denial letter carefully. It will explain exactly why WSIB didn't approve your claim and what evidence was missing or insufficient. Understanding this helps you build a stronger case.", action: "Ask CaseAssist to explain the denial in plain language" },
    { title: "Gather new evidence", desc: "Get additional medical reports, specialist assessments, or witness statements that address the reasons for denial. Your doctor can provide a more detailed report linking your injury to your work.", action: "See what documents you still need" },
    { title: "File your objection", desc: "Submit an Intent to Object within 6 months of the decision (30 days for return-to-work decisions). This tells WSIB you disagree and want a review.", action: "Generate an Intent to Object letter" },
    { title: "Wait for reconsideration", desc: "WSIB will review the original decision with your new evidence. They may reverse the decision at this stage without a formal hearing.", action: null },
    { title: "Hearing (if needed)", desc: "If reconsideration doesn't work, your case goes to an Appeals Resolution Officer for a hearing. You can bring a representative. This is where having strong evidence matters most.", action: "Prepare hearing arguments" },
    { title: "Tribunal (final appeal)", desc: "If the hearing doesn't go your way, you can appeal to WSIAT — an independent tribunal separate from WSIB. This is the final level of appeal.", action: null },
  ];

  const tabStyle = (t) => ({
    flex: 1, padding: "10px 0", borderRadius: 10, border: "none", fontSize: 12, fontWeight: 600,
    cursor: "pointer", background: tab === t ? "#fff" : "transparent",
    color: tab === t ? "var(--g900)" : "var(--g500)",
    boxShadow: tab === t ? "0 1px 3px rgba(0,0,0,.06)" : "none",
  });

  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", backdropFilter: "blur(8px)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "#fff", borderRadius: 20, width: "100%", maxWidth: 600, boxShadow: "0 20px 60px rgba(0,0,0,.15)", maxHeight: "90vh", overflowY: "auto" }}>

        <div style={{ padding: "20px 24px", background: "linear-gradient(135deg, #1A1040, #3B5EC0)", borderRadius: "20px 20px 0 0", color: "#fff" }}>
          <div style={{ fontSize: 11, opacity: .6, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Your claim</div>
          <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.5 }}>{claim.claimNumber}</div>
          <div style={{ fontSize: 13, opacity: .7, marginTop: 4 }}>{claim.injuryType} · Injury date: {fmt(claim.injuryDate)}</div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 2, padding: "12px 24px 0" }}>
          <div style={{ display: "flex", gap: 2, padding: 3, background: "var(--g100)", borderRadius: 12, flex: 1 }}>
            {[{ id: "status", label: "Status" }, { id: "rights", label: "Your rights" }, { id: "docs", label: "Documents" }, { id: "appeal", label: "Appeal" }].map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)} style={tabStyle(t.id)}>{t.label}</button>
            ))}
          </div>
        </div>

        <div style={{ padding: "20px 24px" }}>

          {/* === STATUS TAB === */}
          {tab === "status" && (
            <>
              {/* Progress bar */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  {["Filed", "Reviewed", "Decision", "Recovery"].map((s, i) => {
                    const done = i <= { new: 0, review: 1, investigating: 1, approved: 3, denied: 2, appeal: 2, closed: 3 }[claim.stage];
                    return (
                      <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                        <div style={{ width: 28, height: 28, borderRadius: "50%", background: done ? "var(--blue)" : "var(--g200)", color: done ? "#fff" : "var(--g400)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700 }}>{done ? "✓" : i + 1}</div>
                        <span style={{ fontSize: 10, fontWeight: 600, color: done ? "var(--g900)" : "var(--g400)" }}>{s}</span>
                      </div>
                    );
                  })}
                </div>
                <div style={{ height: 4, background: "var(--g200)", borderRadius: 2, overflow: "hidden" }}>
                  <div style={{ width: `${wf.pct}%`, height: "100%", background: "var(--blue)", borderRadius: 2, transition: "width .5s" }} />
                </div>
              </div>

              {/* Status message */}
              <div style={{ padding: "20px", background: claim.stage === "approved" ? "rgba(40,167,69,.04)" : claim.stage === "denied" ? "rgba(229,57,53,.04)" : "var(--blue-light)", border: `1px solid ${claim.stage === "approved" ? "rgba(40,167,69,.12)" : claim.stage === "denied" ? "var(--red-border)" : "var(--blue-border)"}`, borderRadius: 14, marginBottom: 16 }}>
                <div style={{ fontSize: 17, fontWeight: 800, color: "var(--g900)", marginBottom: 6 }}>{status.title}</div>
                <div style={{ fontSize: 14, color: "var(--g600)", lineHeight: 1.7, marginBottom: 12 }}>{status.desc}</div>
                <div style={{ padding: "10px 14px", background: "rgba(255,255,255,.7)", borderRadius: 10, fontSize: 13, color: "var(--g700)", lineHeight: 1.6 }}>
                  <strong>What to do next:</strong> {status.next}
                </div>
              </div>

              {/* RTW progress if applicable */}
              {rtw && claim.stage === "approved" && (
                <div style={{ padding: "14px 16px", background: "var(--g50)", borderRadius: 12, marginBottom: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--g700)", marginBottom: 6 }}>Recovery timeline</div>
                  <div style={{ height: 8, background: "var(--g200)", borderRadius: 4, overflow: "hidden", marginBottom: 6 }}>
                    <div style={{ width: `${rtw.pct}%`, height: "100%", background: rtw.status === "delayed" ? "var(--red)" : "var(--blue)", borderRadius: 4 }} />
                  </div>
                  <div style={{ fontSize: 12, color: "var(--g500)" }}>
                    Day {rtw.elapsed} of approximately {rtw.totalDays} days expected recovery
                  </div>
                </div>
              )}

              {/* Ask a question */}
              <button onClick={() => { onOpenChat("Explain my claim status in plain, simple language. What stage is it at, what does that mean for me, and what should I do next? Assume I have no legal background."); onClose(); }} style={{ width: "100%", padding: 14, borderRadius: 12, border: "1px solid var(--blue-border)", background: "var(--blue-light)", fontSize: 14, fontWeight: 600, color: "var(--blue)", cursor: "pointer" }}>
                Ask a question about my claim
              </button>
            </>
          )}

          {/* === RIGHTS TAB === */}
          {tab === "rights" && (
            <>
              <div style={{ fontSize: 14, color: "var(--g600)", lineHeight: 1.7, marginBottom: 16 }}>
                As an injured worker in Ontario, you have legal rights under the Workplace Safety and Insurance Act. Here's what you may be entitled to:
              </div>

              {entitlements.map((e, i) => (
                <div key={i} style={{ padding: "14px 16px", background: e.applies ? "rgba(40,167,69,.03)" : "var(--g50)", border: `1px solid ${e.applies ? "rgba(40,167,69,.1)" : "var(--g200)"}`, borderRadius: 12, marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: "var(--g900)" }}>{e.title}</span>
                    {e.applies && <span style={{ fontSize: 10, fontWeight: 600, color: "var(--green)", padding: "2px 8px", borderRadius: 100, background: "var(--green-light)" }}>You may qualify</span>}
                  </div>
                  <div style={{ fontSize: 13, color: "var(--g600)", lineHeight: 1.6 }}>{e.desc}</div>
                </div>
              ))}

              <div style={{ padding: "14px 16px", background: "var(--g50)", borderRadius: 12, marginTop: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--g700)", marginBottom: 4 }}>Important rights</div>
                <div style={{ fontSize: 13, color: "var(--g600)", lineHeight: 1.7 }}>
                  You have the right to see your claim file, to appeal any decision, and to have the benefit of the doubt when evidence is balanced. WSIB cannot penalize you for filing a claim.
                </div>
              </div>

              <button onClick={() => { onOpenChat("Explain my specific rights and entitlements under WSIB for my type of injury. What benefits am I likely eligible for, and how much should I expect to receive? Use plain language, no legal jargon."); onClose(); }} style={{ width: "100%", padding: 14, borderRadius: 12, border: "1px solid var(--blue-border)", background: "var(--blue-light)", fontSize: 14, fontWeight: 600, color: "var(--blue)", cursor: "pointer", marginTop: 12 }}>
                Calculate my specific entitlements
              </button>
            </>
          )}

          {/* === DOCUMENTS TAB === */}
          {tab === "docs" && (
            <>
              <div style={{ fontSize: 14, color: "var(--g600)", lineHeight: 1.7, marginBottom: 16 }}>
                These are the documents that help WSIB decide your claim. The more complete your file, the faster and fairer the decision.
              </div>

              {/* What's been submitted */}
              {(claim.documents || []).length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--green)", textTransform: "uppercase", letterSpacing: .5, marginBottom: 8 }}>Submitted ({claim.documents.length})</div>
                  {claim.documents.map((d, i) => {
                    const info = docNames[d.tag] || { name: d.name, desc: "" };
                    return (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: "rgba(40,167,69,.03)", borderRadius: 8, border: "1px solid rgba(40,167,69,.1)", marginBottom: 4 }}>
                        <div style={{ width: 20, height: 20, borderRadius: "50%", background: "var(--green)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, flexShrink: 0 }}>✓</div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--g800)" }}>{info.name}</div>
                          <div style={{ fontSize: 11, color: "var(--g500)" }}>{d.name} · {d.addedAt ? fmt(d.addedAt) : ""}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* What's still needed */}
              {needed.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--orange)", textTransform: "uppercase", letterSpacing: .5, marginBottom: 8 }}>Still needed ({needed.length})</div>
                  {needed.map((n, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "rgba(255,149,0,.03)", borderRadius: 8, border: "1px solid rgba(255,149,0,.1)", marginBottom: 4 }}>
                      <div style={{ width: 20, height: 20, borderRadius: "50%", border: "2px solid var(--orange)", flexShrink: 0 }} />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--g800)" }}>{n.label}</div>
                        <div style={{ fontSize: 12, color: "var(--g500)" }}>{n.desc}</div>
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 600, color: n.priority === "required" ? "var(--red)" : "var(--orange)", padding: "2px 8px", borderRadius: 100, background: n.priority === "required" ? "var(--red-light)" : "rgba(255,149,0,.06)", marginLeft: "auto", flexShrink: 0 }}>{n.priority}</span>
                    </div>
                  ))}
                </div>
              )}

              {needed.length === 0 && (claim.documents || []).length > 0 && (
                <div style={{ padding: 20, textAlign: "center", background: "rgba(40,167,69,.04)", borderRadius: 12, border: "1px solid rgba(40,167,69,.1)" }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "var(--green)" }}>Your file looks complete</div>
                  <div style={{ fontSize: 13, color: "var(--g500)", marginTop: 4 }}>All required documents are on file.</div>
                </div>
              )}
            </>
          )}

          {/* === APPEAL TAB === */}
          {tab === "appeal" && (
            <>
              {claim.stage === "denied" || claim.stage === "appeal" ? (
                <>
                  <div style={{ fontSize: 14, color: "var(--g600)", lineHeight: 1.7, marginBottom: 16 }}>
                    If your claim was denied, you have the right to appeal. Here's a step-by-step guide to the process. You don't need a lawyer, but having one can help.
                  </div>

                  {appealSteps.map((s, i) => {
                    const isActive = i === appealStep;
                    const isDone = i < appealStep;
                    return (
                      <div key={i} onClick={() => setAppealStep(i)} style={{ padding: "14px 16px", background: isActive ? "var(--blue-light)" : isDone ? "rgba(40,167,69,.03)" : "#fff", border: `1px solid ${isActive ? "var(--blue-border)" : isDone ? "rgba(40,167,69,.1)" : "var(--card-border)"}`, borderRadius: 12, marginBottom: 6, cursor: "pointer" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: isActive ? 8 : 0 }}>
                          <div style={{ width: 24, height: 24, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flexShrink: 0, background: isDone ? "var(--green)" : isActive ? "var(--blue)" : "var(--g200)", color: isDone || isActive ? "#fff" : "var(--g500)" }}>
                            {isDone ? "✓" : i + 1}
                          </div>
                          <span style={{ fontSize: 14, fontWeight: 700, color: "var(--g900)" }}>{s.title}</span>
                        </div>
                        {isActive && (
                          <>
                            <div style={{ fontSize: 13, color: "var(--g600)", lineHeight: 1.7, paddingLeft: 34, marginBottom: s.action ? 10 : 0 }}>{s.desc}</div>
                            {s.action && (
                              <button onClick={(e) => { e.stopPropagation(); onOpenChat(s.action + " for claim " + claim.claimNumber + ". Use plain language. I am the injured worker."); onClose(); }} style={{ marginLeft: 34, padding: "8px 16px", borderRadius: 8, border: "none", background: "var(--blue)", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                                {s.action}
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })}

                  <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                    <button onClick={() => setAppealStep(Math.max(0, appealStep - 1))} disabled={appealStep === 0} style={{ flex: 1, padding: 10, borderRadius: 10, border: "1px solid var(--card-border)", background: "#fff", fontSize: 13, fontWeight: 600, color: "var(--g600)", cursor: appealStep > 0 ? "pointer" : "default", opacity: appealStep === 0 ? .4 : 1 }}>Previous step</button>
                    <button onClick={() => setAppealStep(Math.min(appealSteps.length - 1, appealStep + 1))} disabled={appealStep === appealSteps.length - 1} style={{ flex: 1, padding: 10, borderRadius: 10, border: "none", background: "var(--blue)", fontSize: 13, fontWeight: 600, color: "#fff", cursor: appealStep < appealSteps.length - 1 ? "pointer" : "default", opacity: appealStep >= appealSteps.length - 1 ? .4 : 1 }}>Next step</button>
                  </div>
                </>
              ) : (
                <div style={{ padding: "32px 20px", textAlign: "center" }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "var(--g700)", marginBottom: 6 }}>Appeal not needed right now</div>
                  <div style={{ fontSize: 14, color: "var(--g500)", lineHeight: 1.7 }}>
                    {claim.stage === "approved" ? "Great news — your claim has been approved! You don't need to appeal." : "Your claim is still being processed. The appeal process is available if your claim is denied."}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
