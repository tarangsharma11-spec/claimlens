"use client";
import { useState } from "react";
import { fmt, daysAgo, daysBetween } from "@/app/lib/constants";

/**
 * LimitationsTracker — All filing windows and appeal deadlines for a claim.
 * Shows countdown timers, status (open/closing/expired), and action buttons.
 */
export default function LimitationsTracker({ claim, onClose, onOpenChat }) {
  if (!claim) return null;

  const now = new Date();
  const injDate = claim.injuryDate && claim.injuryDate !== "—" ? new Date(claim.injuryDate) : null;
  const denialDate = claim.stage === "denied" ? new Date(claim.updatedAt || now) : null;
  const aroDate = claim.appeal?.aroDate ? new Date(claim.appeal.aroDate) : null;
  const wsiatDate = claim.appeal?.wsiatDate ? new Date(claim.appeal.wsiatDate) : null;

  const addDays = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };
  const addMonths = (d, n) => { const r = new Date(d); r.setMonth(r.getMonth() + n); return r; };

  const deadlines = [];

  // Worker filing — 6 months from injury
  if (injDate) {
    const due = addMonths(injDate, 6);
    const left = daysBetween(now, due);
    const hasFiled = claim.documents?.some((d) => d.tag === "form6") || claim.createdAt;
    deadlines.push({ id: "worker_filing", label: "Worker claim filing", desc: "Worker must report injury to WSIB within 6 months of date of injury (OPM 15-01-01).", due, daysLeft: left, status: hasFiled ? "complete" : left < 0 ? "expired" : left <= 14 ? "closing" : "open", category: "Filing", opm: "15-01-01" });
  }

  // Employer Form 7 — 3 business days from learning of injury
  if (injDate) {
    const due = addDays(injDate, 5); // ~3 business days
    const left = daysBetween(now, due);
    const hasF7 = claim.documents?.some((d) => d.tag === "form7");
    deadlines.push({ id: "form7", label: "Employer Form 7 filing", desc: "Employer must file Form 7 within 3 business days of learning of the injury. Penalty for non-compliance.", due, daysLeft: left, status: hasF7 ? "complete" : left < 0 ? "expired" : "closing", category: "Filing", opm: "15-01-01" });
  }

  // Form 8 — first medical visit
  if (injDate) {
    const due = addDays(injDate, 7);
    const left = daysBetween(now, due);
    const hasF8 = claim.documents?.some((d) => d.tag === "form8");
    deadlines.push({ id: "form8", label: "Health professional Form 8", desc: "Treating physician should submit Form 8 after first visit related to the injury.", due, daysLeft: left, status: hasF8 ? "complete" : left < 0 ? "expired" : "closing", category: "Filing", opm: "15-01-01" });
  }

  // Intent to Object — 30 days (RTW) or 6 months (other) from decision
  if (denialDate) {
    const dueRTW = addDays(denialDate, 30);
    const dueOther = addMonths(denialDate, 6);
    const leftRTW = daysBetween(now, dueRTW);
    const leftOther = daysBetween(now, dueOther);
    const hasObjection = claim.appeal?.intentFiled;
    deadlines.push({ id: "intent_rtw", label: "Intent to Object (RTW decisions)", desc: "Must file within 30 days of the return-to-work decision letter.", due: dueRTW, daysLeft: leftRTW, status: hasObjection ? "complete" : leftRTW < 0 ? "expired" : leftRTW <= 7 ? "closing" : "open", category: "Appeal", opm: "11-01-02" });
    deadlines.push({ id: "intent_other", label: "Intent to Object (other decisions)", desc: "Must file within 6 months of the decision letter for all non-RTW decisions.", due: dueOther, daysLeft: leftOther, status: hasObjection ? "complete" : leftOther < 0 ? "expired" : leftOther <= 30 ? "closing" : "open", category: "Appeal", opm: "11-01-02" });
  }

  // WSIAT appeal — 6 months from ARO decision
  if (aroDate) {
    const due = addMonths(aroDate, 6);
    const left = daysBetween(now, due);
    deadlines.push({ id: "wsiat", label: "WSIAT Tribunal appeal", desc: "Must file Notice of Appeal to WSIAT within 6 months of the ARO decision.", due, daysLeft: left, status: left < 0 ? "expired" : left <= 30 ? "closing" : "open", category: "Appeal", opm: "N/A" });
  }

  // Judicial review — 30 days from WSIAT decision
  if (wsiatDate) {
    const due = addDays(wsiatDate, 30);
    const left = daysBetween(now, due);
    deadlines.push({ id: "judicial", label: "Judicial review (Divisional Court)", desc: "Application for judicial review must be filed within 30 days of the WSIAT decision.", due, daysLeft: left, status: left < 0 ? "expired" : left <= 7 ? "closing" : "open", category: "Judicial", opm: "N/A" });
  }

  // 72-month LOE review
  if (injDate && (claim.stage === "approved" || claim.stage === "closed")) {
    const due = addMonths(injDate, 72);
    const left = daysBetween(now, due);
    deadlines.push({ id: "loe72", label: "72-month LOE final review", desc: "WSIB conducts final LOE determination at 72 months. Benefits may be adjusted or converted to FEL supplement.", due, daysLeft: left, status: left < 0 ? "expired" : left <= 90 ? "closing" : "open", category: "Review", opm: "18-01-01" });
  }

  // Recurrence — no time limit but flag if >2 years
  if (injDate && claim.stage === "closed") {
    const yearsSince = Math.floor(daysBetween(injDate, now) / 365);
    deadlines.push({ id: "recurrence", label: "Recurrence claim window", desc: "No statutory deadline for recurrence claims, but longer gaps make causation harder to establish. Current gap: " + yearsSince + " years.", due: null, daysLeft: null, status: yearsSince > 5 ? "closing" : "open", category: "Review", opm: "11-01-06" });
  }

  const statusColors = { complete: "var(--green)", open: "var(--blue)", closing: "var(--orange)", expired: "var(--red)" };
  const statusLabels = { complete: "Filed", open: "Open", closing: "Closing soon", expired: "Expired" };
  const categories = [...new Set(deadlines.map((d) => d.category))];

  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", backdropFilter: "blur(8px)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "#fff", borderRadius: 20, width: "100%", maxWidth: 640, boxShadow: "0 20px 60px rgba(0,0,0,.15)", maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--g100)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: -0.5 }}>Limitation periods</div>
            <div style={{ fontSize: 12, color: "var(--g500)" }}>{claim.claimNumber} — All filing windows and appeal deadlines</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "var(--g400)" }}>×</button>
        </div>
        <div style={{ padding: "20px 24px" }}>
          {/* Summary badges */}
          <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
            {["expired", "closing", "open", "complete"].map((s) => {
              const count = deadlines.filter((d) => d.status === s).length;
              return count > 0 ? (
                <div key={s} style={{ padding: "6px 14px", borderRadius: 100, fontSize: 12, fontWeight: 600, color: statusColors[s], background: statusColors[s] + "10", border: "1px solid " + statusColors[s] + "20" }}>
                  {count} {statusLabels[s]}
                </div>
              ) : null;
            })}
          </div>

          {categories.map((cat) => (
            <div key={cat} style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--g500)", textTransform: "uppercase", letterSpacing: .5, marginBottom: 8 }}>{cat}</div>
              {deadlines.filter((d) => d.category === cat).map((d) => (
                <div key={d.id} style={{ padding: "12px 16px", background: d.status === "expired" ? "var(--red-light)" : d.status === "closing" ? "rgba(255,149,0,.03)" : d.status === "complete" ? "rgba(40,167,69,.03)" : "#fff", border: "1px solid " + (d.status === "expired" ? "var(--red-border)" : d.status === "closing" ? "rgba(255,149,0,.1)" : d.status === "complete" ? "rgba(40,167,69,.1)" : "var(--card-border)"), borderRadius: 12, marginBottom: 6 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: statusColors[d.status], flexShrink: 0 }} />
                      <span style={{ fontSize: 14, fontWeight: 700, color: "var(--g900)" }}>{d.label}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      {d.opm !== "N/A" && <span style={{ padding: "2px 6px", borderRadius: 4, fontSize: 10, fontWeight: 600, color: "var(--blue)", background: "var(--blue-light)", fontFamily: "monospace" }}>{d.opm}</span>}
                      <span style={{ fontSize: 11, fontWeight: 600, color: statusColors[d.status], padding: "2px 8px", borderRadius: 100, background: statusColors[d.status] + "10" }}>
                        {d.status === "complete" ? "Filed" : d.daysLeft === null ? statusLabels[d.status] : d.daysLeft < 0 ? Math.abs(d.daysLeft) + "d expired" : d.daysLeft + "d left"}
                      </span>
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--g500)", lineHeight: 1.5, marginLeft: 16 }}>{d.desc}</div>
                  {d.due && <div style={{ fontSize: 11, color: "var(--g400)", marginLeft: 16, marginTop: 2 }}>Deadline: {fmt(d.due.toISOString())}</div>}
                  {d.status !== "complete" && d.status !== "expired" && d.id.startsWith("intent") && onOpenChat && (
                    <button onClick={() => { onOpenChat("Generate an Intent to Object letter for claim " + claim.claimNumber + ". The decision was " + (claim.stage === "denied" ? "denied" : "disputed") + ". Include appeal rights and OPM 11-01-13 benefit of doubt."); onClose(); }} style={{ marginTop: 6, marginLeft: 16, padding: "5px 14px", borderRadius: 8, border: "none", background: "var(--blue)", color: "#fff", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                      Draft Intent to Object
                    </button>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
