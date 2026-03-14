"use client";
import { stageOf, daysAgo, daysBetween } from "./constants";

/* ═══ Deadline Calculator ═══ */
export function getDeadlines(claim) {
  if (!claim?.injuryDate || claim.injuryDate === "—") return [];
  const inj = new Date(claim.injuryDate);
  const now = new Date();
  const dl = [];

  const form7Due = new Date(inj);
  form7Due.setDate(form7Due.getDate() + 3);
  const hasForm7 = claim.documents?.some((d) => d.tag === "form7");
  if (!hasForm7) {
    const overdue = now > form7Due;
    dl.push({ label: "Form 7 filing deadline", date: form7Due.toISOString(), daysLeft: daysBetween(now, form7Due), status: overdue ? "overdue" : "upcoming", priority: "high" });
  }

  const rtwBenchmarks = {
    "Acute Injury": { modified: 21, full: 42 },
    "Occupational Disease": { modified: 42, full: 112 },
    "Traumatic Mental Stress": { modified: 28, full: 84 },
    "Chronic Mental Stress": { modified: 42, full: 112 },
    "PTSD (First Responder)": { modified: 28, full: 84 },
    "Recurrence": { modified: 14, full: 42 },
    "Aggravation of Pre-existing": { modified: 21, full: 56 },
  };
  const bench = rtwBenchmarks[claim.injuryType] || { modified: 21, full: 56 };

  const modDate = new Date(inj); modDate.setDate(modDate.getDate() + bench.modified);
  const fullDate = new Date(inj); fullDate.setDate(fullDate.getDate() + bench.full);

  if (claim.stage !== "closed" && claim.stage !== "denied") {
    dl.push({ label: "Expected modified duties", date: modDate.toISOString(), daysLeft: daysBetween(now, modDate), status: now > modDate ? "overdue" : "upcoming", priority: "medium" });
    dl.push({ label: "Expected full duties", date: fullDate.toISOString(), daysLeft: daysBetween(now, fullDate), status: now > fullDate ? "overdue" : "upcoming", priority: "medium" });
  }

  if (claim.stage === "denied") {
    const appealDate = new Date(claim.updatedAt || now);
    appealDate.setDate(appealDate.getDate() + 30);
    dl.push({ label: "Appeal window closes", date: appealDate.toISOString(), daysLeft: daysBetween(now, appealDate), status: now > appealDate ? "overdue" : "upcoming", priority: "high" });
  }

  if (claim.stage === "approved") {
    const loeReview = new Date(inj);
    loeReview.setMonth(loeReview.getMonth() + 72);
    dl.push({ label: "72-month LOE review", date: loeReview.toISOString(), daysLeft: daysBetween(now, loeReview), status: "upcoming", priority: "low" });
  }

  return dl.sort((a, b) => a.daysLeft - b.daysLeft);
}

/* ═══ RTW Progress ═══ */
export function getRTWProgress(claim) {
  if (!claim?.injuryDate || claim.injuryDate === "—") return null;
  const bench = { "Acute Injury": 42, "Occupational Disease": 112, "Traumatic Mental Stress": 84, "Chronic Mental Stress": 112, "PTSD (First Responder)": 84, "Recurrence": 42, "Aggravation of Pre-existing": 56 };
  const totalDays = bench[claim.injuryType] || 56;
  const elapsed = daysAgo(claim.injuryDate);
  const pct = Math.min(100, Math.round((elapsed / totalDays) * 100));
  const status = pct >= 100 ? (claim.stage === "approved" || claim.stage === "closed" ? "recovered" : "delayed") : pct >= 75 ? "late" : "on-track";
  return { elapsed, totalDays, pct, status, label: `Day ${elapsed} of ~${totalDays}` };
}

/* ═══ Red Flags ═══ */
export function getRedFlags(c) {
  const f = [];
  if (!c) return f;
  const inj = c.injuryDate && c.injuryDate !== "—" ? new Date(c.injuryDate) : null;
  const cr = new Date(c.createdAt);
  const docs = c.documents || [];
  const has = (t) => docs.some((d) => d.tag === t);

  if (inj) {
    const rd = Math.floor((cr - inj) / 864e5);
    if (rd > 7) f.push({ severity: "high", label: "Late reporting (" + rd + "d)", desc: "Claim created " + rd + " days after injury" });
    if (rd > 21) f.push({ severity: "critical", label: "Severely delayed reporting", desc: rd + "-day delay raises credibility concerns" });
  }
  if (!has("form6") && docs.length > 0) f.push({ severity: "medium", label: "Missing Form 6", desc: "Worker report not on file" });
  if (!has("form7") && docs.length > 0) f.push({ severity: "high", label: "Missing Form 7", desc: "Employer report not on file" });
  if (!has("form8") && c.stage !== "new") f.push({ severity: "medium", label: "Missing Form 8", desc: "Health professional report missing" });
  if (!docs.some((d) => ["medical", "imaging", "specialist", "physio"].includes(d.tag)) && c.stage !== "new") f.push({ severity: "medium", label: "No medical evidence", desc: "No medical reports on file" });
  if (/pre-existing|aggravation/i.test(c.injuryType || "")) f.push({ severity: "medium", label: "Pre-existing condition", desc: "Thin skull principle may apply" });
  if (c.analyses?.length > 1 && new Set(c.analyses.map((a) => a.ruling)).size > 1) f.push({ severity: "medium", label: "Inconsistent rulings", desc: "Multiple analyses produced different outcomes" });
  if (inj && Math.floor((Date.now() - inj) / 864e5) > 90 && c.stage === "new") f.push({ severity: "high", label: "Stale claim", desc: "In New status over 90 days" });

  return f.sort((a, b) => ({ critical: 0, high: 1, medium: 2, low: 3 }[a.severity] || 3) - ({ critical: 0, high: 1, medium: 2, low: 3 }[b.severity] || 3));
}

/* ═══ Risk Score ═══ */
export function getRiskScore(claim) {
  if (!claim) return null;
  let risk = 0;
  const factors = [];
  const inj = claim.injuryDate && claim.injuryDate !== "—" ? new Date(claim.injuryDate) : null;

  if (inj) {
    const days = Math.floor((Date.now() - inj) / 864e5);
    if (days > 90) risk += 3; else if (days > 30) risk += 1;
    factors.push({ label: "Days open: " + days, impact: days > 90 ? "high" : days > 30 ? "medium" : "low" });
  }

  const flags = getRedFlags(claim);
  risk += flags.filter((f) => f.severity === "critical").length * 4;
  risk += flags.filter((f) => f.severity === "high").length * 2;
  risk += flags.filter((f) => f.severity === "medium").length;
  if (flags.length > 0) factors.push({ label: flags.length + " red flag" + (flags.length > 1 ? "s" : ""), impact: flags.some((f) => f.severity === "critical") ? "high" : "medium" });

  if (/mental|ptsd|chronic/i.test(claim.injuryType || "")) risk += 2;
  if (!claim.documents?.length) risk += 2;
  if (!claim.analyses?.length) risk += 1;

  const dl = getDeadlines(claim);
  const overdue = dl.filter((d) => d.status === "overdue");
  risk += overdue.length * 2;
  if (overdue.length) factors.push({ label: overdue.length + " overdue deadline" + (overdue.length > 1 ? "s" : ""), impact: "high" });

  const level = risk >= 10 ? "Critical" : risk >= 6 ? "High" : risk >= 3 ? "Medium" : "Low";
  const color = risk >= 10 ? "var(--red)" : risk >= 6 ? "var(--orange)" : risk >= 3 ? "var(--blue)" : "var(--green)";
  return { score: risk, level, color, factors };
}

/* ═══ Claim Strength ═══ */
export function getClaimStrength(claim) {
  if (!claim) return null;
  let s = 0, mx = 0;
  const f = [];
  const docs = claim.documents || [];
  const has = (t) => docs.some((d) => d.tag === t);
  const chk = (l, met, pts) => { mx += pts; if (met) s += pts; f.push({ label: l, met }); };

  chk("Form 6", has("form6"), 15);
  chk("Form 7", has("form7"), 15);
  chk("Form 8", has("form8"), 10);
  chk("Medical evidence", docs.some((d) => ["medical", "imaging", "specialist", "physio"].includes(d.tag)), 15);
  chk("Witness", has("witness"), 10);

  const inj = claim.injuryDate && claim.injuryDate !== "—" ? new Date(claim.injuryDate) : null;
  if (inj) chk("Timely reporting", Math.floor((new Date(claim.createdAt) - inj) / 864e5) <= 3, 5);
  chk("Detailed description", (claim.description?.length || 0) > 50, 10);

  const lr = claim.analyses?.[claim.analyses.length - 1]?.ruling;
  if (lr === "Allow") { mx += 10; s += 10; f.push({ label: "AI: Allow", met: true }); }
  else if (lr === "Deny") { mx += 10; f.push({ label: "AI: Deny", met: false }); }
  else if (lr) { mx += 10; s += 5; f.push({ label: "AI: Investigate", met: null }); }

  chk("No critical flags", getRedFlags(claim).filter((x) => x.severity === "critical" || x.severity === "high").length === 0, 10);
  const pct = mx > 0 ? Math.round((s / mx) * 100) : 0;
  return { score: pct, grade: pct >= 80 ? "Strong" : pct >= 60 ? "Moderate" : pct >= 40 ? "Weak" : "Insufficient", color: pct >= 80 ? "var(--green)" : pct >= 60 ? "var(--blue)" : pct >= 40 ? "var(--orange)" : "var(--red)", factors: f };
}

/* ═══ What's Needed ═══ */
export function getWhatsNeeded(c) {
  if (!c) return [];
  const n = [];
  const docs = c.documents || [];
  const has = (t) => docs.some((d) => d.tag === t);
  if (!has("form6")) n.push({ label: "Form 6 (Worker Report)", priority: "required", desc: "Essential for claim establishment" });
  if (!has("form7")) n.push({ label: "Form 7 (Employer Report)", priority: "required", desc: "Must be filed within 3 business days" });
  if (!has("form8") && c.stage !== "new") n.push({ label: "Form 8 (Health Professional)", priority: "required", desc: "Medical confirmation" });
  if (!docs.some((d) => ["medical", "specialist"].includes(d.tag)) && c.stage !== "new") n.push({ label: "Medical report", priority: "recommended", desc: "Clinical evidence" });
  if (!has("imaging") && /back|lumbar|spinal|fracture|disc/i.test(c.description || "")) n.push({ label: "Diagnostic imaging", priority: "recommended", desc: "Objective evidence" });
  if (!(c.analyses?.length) && c.stage !== "closed") n.push({ label: "AI analysis", priority: "recommended", desc: "Run the Five Point Check" });
  return n;
}

/* ═══ Notifications ═══ */
export function getNotifications(claims) {
  const n = [];
  claims.forEach((c) => {
    getDeadlines(c).forEach((d) => {
      if (d.status === "overdue") n.push({ type: "urgent", title: c.claimNumber + ": " + d.label, desc: "Overdue by " + Math.abs(d.daysLeft) + " days", caseId: c.id });
      else if (d.daysLeft <= 3 && d.daysLeft >= 0) n.push({ type: "warning", title: c.claimNumber + ": " + d.label, desc: "Due in " + d.daysLeft + " days", caseId: c.id });
    });
    if (c.stage === "new" && !c.analyses?.length) n.push({ type: "info", title: c.claimNumber + ": Needs analysis", desc: "Run the AI adjudication", caseId: c.id });
    const fl = getRedFlags(c).filter((f) => f.severity === "critical" || f.severity === "high");
    if (fl.length) n.push({ type: "urgent", title: c.claimNumber + ": " + fl.length + " red flag" + (fl.length > 1 ? "s" : ""), desc: fl[0].label, caseId: c.id });
    const miss = getWhatsNeeded(c).filter((m) => m.priority === "required");
    if (miss.length && c.stage !== "closed") n.push({ type: "warning", title: c.claimNumber + ": Missing docs", desc: miss.map((m) => m.label).join(", "), caseId: c.id });
  });
  return n.sort((a, b) => ({ urgent: 0, warning: 1, info: 2 }[a.type] || 2) - ({ urgent: 0, warning: 1, info: 2 }[b.type] || 2));
}

/* ═══ Smart Warnings ═══ */
export function getSmartWarnings(claim) {
  if (!claim) return [];
  const w = [];
  const lastAct = claim.timeline?.[claim.timeline.length - 1];
  if (lastAct) {
    const d = Math.floor((Date.now() - new Date(lastAct.date)) / 864e5);
    if (d >= 14) w.push({ type: "critical", label: "Going Dark", desc: "No activity for " + d + " d" });
    else if (d >= 7) w.push({ type: "warning", label: "Losing Momentum", desc: "No activity for " + d + " d" });
  }
  if (!claim.threePoint?.worker && !claim.threePoint?.employer) w.push({ type: "warning", label: "No Contact", desc: "Three-point contact incomplete" });
  if ((claim.documents?.length || 0) === 0 && claim.stage !== "new") w.push({ type: "critical", label: "No Evidence", desc: "No documents uploaded" });
  if (!claim.analyses?.length && (claim.documents?.length || 0) > 0) w.push({ type: "warning", label: "Needs Analysis", desc: "Docs uploaded, no AI analysis" });
  if (claim.stage === "denied" && !(claim.appeal?.stage)) w.push({ type: "critical", label: "No Appeal", desc: "Denied, appeal not started" });
  return w;
}

/* ═══ Workflow Status ═══ */
const WORKFLOW_STEPS = [
  { id: "report", phase: "Intake", title: "Report the Injury", checks: [{ id: "form6", label: "Form 6 filed", test: (c) => c.documents?.some((d) => d.tag === "form6") }, { id: "form7", label: "Form 7 filed", test: (c) => c.documents?.some((d) => d.tag === "form7") }, { id: "description", label: "Incident described", test: (c) => (!!c.description && c.description.trim().length > 0) }], actionNav: "documents" },
  { id: "contact", phase: "Intake", title: "Three-Point Contact", desc: "WSIB requires ongoing contact between all three parties for co-operation obligations. Document each contact below.", checks: [{ id: "worker_contact", label: "Worker contacted", desc: "Initial contact with the injured worker about their status and RTW plan", test: (c) => c.threePoint?.worker }, { id: "employer_contact", label: "Employer contacted", desc: "Confirm employer has filed Form 7 and is aware of modified duty obligations", test: (c) => c.threePoint?.employer }, { id: "medical_contact", label: "Healthcare provider contacted", desc: "Confirm treating physician has submitted Form 8 with functional abilities info", test: (c) => c.threePoint?.medical }], actionNav: "overview" },
  { id: "medical", phase: "Evidence", title: "Gather Medical Evidence", checks: [{ id: "form8", label: "Form 8 received", test: (c) => c.documents?.some((d) => d.tag === "form8") }, { id: "medical_doc", label: "Medical records", test: (c) => c.documents?.some((d) => ["medical", "specialist", "imaging", "physio"].includes(d.tag)) }], actionNav: "providers" },
  { id: "analyze", phase: "Assessment", title: "Run AI Analysis", checks: [{ id: "analysis_done", label: "AI analysis completed", test: (c) => c.analyses?.length > 0 }], actionNav: "chat" },
  { id: "decision", phase: "Assessment", title: "Review Decision", checks: [{ id: "ruling_received", label: "Ruling received", test: (c) => c.analyses?.length > 0 || c.stage === "approved" || c.stage === "denied" }, { id: "stage_set", label: "Status updated", test: (c) => c.stage !== "new" }], actionNav: "valuation" },
  { id: "rtw", phase: "Resolution", title: "Return-to-Work Planning", checks: [{ id: "modified_duties", label: "Modified duties documented", test: (c) => c.modifiedDuties?.length > 0 }], actionNav: "modified" },
  { id: "resolve", phase: "Resolution", title: "Close or Appeal", checks: [{ id: "resolved", label: "Claim resolved", test: (c) => c.stage === "closed" || c.stage === "approved" || (c.appeal?.stage && c.appeal.stage !== "none") }], actionNav: "appeal" },
];

export function getWorkflowStatus(claim) {
  if (!claim) return { steps: [], currentIdx: 0, pct: 0 };
  const steps = WORKFLOW_STEPS.map((s) => {
    const checks = s.checks.map((ch) => ({ ...ch, done: ch.test(claim) }));
    const complete = checks.every((ch) => ch.done);
    const partial = checks.some((ch) => ch.done);
    return { ...s, checks, complete, partial };
  });
  let currentIdx = steps.findIndex((s) => !s.complete);
  if (currentIdx < 0) currentIdx = steps.length - 1;
  const done = steps.filter((s) => s.complete).length;
  const pct = Math.round((done / steps.length) * 100);
  return { steps, currentIdx, pct };
}

/* ═══ AI Brief ═══ */
export function getAIBrief(claim) {
  if (!claim) return "";
  const parts = [];
  const days = claim.injuryDate && claim.injuryDate !== "—" ? Math.floor((Date.now() - new Date(claim.injuryDate)) / 864e5) : 0;
  parts.push(claim.worker + " vs " + claim.employer + " - " + claim.injuryType + " (Day " + days + ").");
  const wf = getWorkflowStatus(claim);
  parts.push("Progress: " + wf.pct + "%.");
  const rs = getRiskScore(claim);
  if (rs) parts.push("Risk: " + rs.level + ".");
  const lr = claim.analyses?.[claim.analyses.length - 1];
  if (lr) parts.push("Ruling: " + lr.ruling + ".");
  return parts.join(" ");
}

/* ═══ Cost Forecast ═══ */
export function getClaimCostForecast(c) {
  if (!c?.injuryDate || c.injuryDate === "—") return null;
  const r = {
    "Acute Injury": { l: 8000, h: 25000, w: 6 },
    "Occupational Disease": { l: 15000, h: 80000, w: 16 },
    "Traumatic Mental Stress": { l: 12000, h: 45000, w: 12 },
    "PTSD (First Responder)": { l: 15000, h: 60000, w: 12 },
    "Recurrence": { l: 5000, h: 20000, w: 6 },
    "Aggravation of Pre-existing": { l: 10000, h: 50000, w: 10 },
  }[c.injuryType] || { l: 10000, h: 40000, w: 8 };
  const we = Math.floor((Date.now() - new Date(c.injuryDate)) / (864e5 * 7));
  return { lowEst: r.l, highEst: r.h, avgWeeks: r.w, weeksElapsed: we, expectedResolution: Math.max(1, r.w - we) };
}

/* ═══ AWW Calculator ═══ */
export function calcAWW(grossWeekly) {
  if (!grossWeekly || grossWeekly <= 0) return null;
  const cpp = grossWeekly * 0.0595;
  const ei = grossWeekly * 0.0229;
  const fedTax = grossWeekly * 0.15;
  const provTax = grossWeekly * 0.0505;
  const netWeekly = grossWeekly - cpp - ei - fedTax - provTax;
  const loe85 = netWeekly * 0.85;
  return { gross: grossWeekly, cpp: cpp.toFixed(2), ei: ei.toFixed(2), fedTax: fedTax.toFixed(2), provTax: provTax.toFixed(2), net: netWeekly.toFixed(2), loe85: loe85.toFixed(2), loeMonthly: (loe85 * 4.33).toFixed(2) };
}

/* ═══ Three-Point Contact ═══ */
export function getThreePointContact(claim) {
  return {
    worker: { label: "Injured Worker", contacted: claim.threePoint?.worker || false, date: claim.threePoint?.workerDate || null },
    employer: { label: "Employer", contacted: claim.threePoint?.employer || false, date: claim.threePoint?.employerDate || null },
    medical: { label: "Medical Provider", contacted: claim.threePoint?.medical || false, date: claim.threePoint?.medicalDate || null },
  };
}
