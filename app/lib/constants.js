"use client";

/* ═══ Stages ═══ */
export const STAGES = [
  { id: "new", label: "New", color: "#86868B", icon: "○", guidance: "Upload documents and run your first AI analysis to get a ruling prediction." },
  { id: "review", label: "Under Review", color: "#0071E3", icon: "◎", guidance: "Review the AI analysis. Check compliance, assess RTW plan, and identify missing evidence." },
  { id: "investigating", label: "Investigating", color: "#FF9500", icon: "◉", guidance: "Gather additional evidence. Upload new documents as they come in." },
  { id: "approved", label: "Approved", color: "#34C759", icon: "●", guidance: "Claim approved. Monitor return-to-work progress and benefit payments." },
  { id: "denied", label: "Denied", color: "#FF3B30", icon: "●", guidance: "Claim denied. Review the ruling rationale and consider appeal options." },
  { id: "appeal", label: "Appeal", color: "#AF52DE", icon: "◈", guidance: "Prepare appeal submission. Gather additional evidence and policy arguments." },
  { id: "closed", label: "Closed", color: "#48484A", icon: "■", guidance: "This case is closed." },
];
export const stageOf = (id) => STAGES.find((s) => s.id === id) || STAGES[0];

/* ═══ Document Types ═══ */
export const DOC_TYPES = [
  { id: "form6", label: "Form 6", color: "#0071E3" },
  { id: "form7", label: "Form 7", color: "#34C759" },
  { id: "form8", label: "Form 8", color: "#FF9500" },
  { id: "medical", label: "Medical Report", color: "#AF52DE" },
  { id: "imaging", label: "Imaging", color: "#FF2D55" },
  { id: "specialist", label: "Specialist", color: "#5856D6" },
  { id: "witness", label: "Witness Statement", color: "#00C7BE" },
  { id: "employer", label: "Employer Statement", color: "#FF9500" },
  { id: "physio", label: "Physio/Rehab", color: "#30B0C7" },
  { id: "fce", label: "FCE", color: "#AC8E68" },
  { id: "other", label: "Other", color: "#86868B" },
];
export const docTypeOf = (id) => DOC_TYPES.find((d) => d.id === id) || DOC_TYPES[DOC_TYPES.length - 1];

export function guessDocType(name) {
  const n = name.toLowerCase();
  if (/form.?6|worker.?report/i.test(n)) return "form6";
  if (/form.?7|employer.?report/i.test(n)) return "form7";
  if (/form.?8|health|practitioner/i.test(n)) return "form8";
  if (/mri|xray|x-ray|ct.?scan|imaging|radiology/i.test(n)) return "imaging";
  if (/physio|rehab|therapy/i.test(n)) return "physio";
  if (/witness/i.test(n)) return "witness";
  if (/specialist|referral|consult/i.test(n)) return "specialist";
  if (/fce|capacity|functional/i.test(n)) return "fce";
  if (/medical|doctor|physician|clinical/i.test(n)) return "medical";
  if (/employer|company/i.test(n)) return "employer";
  return "other";
}

/* ═══ Date Helpers ═══ */
export const fmt = (iso) => {
  if (!iso || iso === "—") return "—";
  try { return new Date(iso).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" }); } catch { return iso; }
};
export const fmtTime = (iso) => {
  try { return new Date(iso).toLocaleString("en-CA", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }); } catch { return ""; }
};
export const daysBetween = (a, b) => {
  try { return Math.floor((new Date(b) - new Date(a)) / (1000 * 60 * 60 * 24)); } catch { return 0; }
};
export const daysAgo = (iso) => {
  try { return Math.floor((Date.now() - new Date(iso)) / (1000 * 60 * 60 * 24)); } catch { return 0; }
};

/* ═══ Storage ═══ */
export function storageKey(e) { return `caseassist_claims_${e?.toLowerCase()}`; }
export function loadClaims(e) {
  if (!e) return [];
  try { return JSON.parse(window.localStorage.getItem(storageKey(e)) || "[]"); } catch { return []; }
}
export function persistClaims(e, c) {
  if (!e) return;
  try { window.localStorage.setItem(storageKey(e), JSON.stringify(c)); } catch { /* quota */ }
}

/* ═══ Search ═══ */
export function searchClaims(claims, query) {
  if (!query.trim()) return claims;
  const q = query.toLowerCase();
  return claims.filter((c) => {
    const haystack = [c.claimNumber, c.worker, c.employer, c.injuryType, c.description, stageOf(c.stage).label, ...(c.notes || []).map((n) => n.text), ...(c.analyses || []).map((a) => a.ruling)].join(" ").toLowerCase();
    return haystack.includes(q);
  });
}

/* ═══ PII Redaction ═══ */
const PII_PATTERNS = [
  { name: "SIN", pattern: /\b\d{3}[-\s]?\d{3}[-\s]?\d{3}\b/g, replace: "[SIN-REDACTED]" },
  { name: "Phone", pattern: /(?:\+?1[-\s]?)?\(?\d{3}\)?[-\s]?\d{3}[-\s]?\d{4}\b/g, replace: "[PHONE-REDACTED]" },
  { name: "Email", pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, replace: "[EMAIL-REDACTED]" },
  { name: "DOB", pattern: /\b(?:DOB|Date of Birth|Born)[:\s]*(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},?\s+\d{4}/gi, replace: "[DOB-REDACTED]" },
  { name: "DOB-numeric", pattern: /\b(?:DOB|Date of Birth|Born)[:\s]*\d{4}[-/]\d{2}[-/]\d{2}/gi, replace: "[DOB-REDACTED]" },
  { name: "Postal", pattern: /\b[A-Z]\d[A-Z]\s?\d[A-Z]\d\b/gi, replace: "[POSTAL-REDACTED]" },
  { name: "Address", pattern: /\d+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Boulevard|Blvd|Crescent|Cres|Court|Ct|Lane|Ln|Way|Place|Pl|Circle|Cir)[.\s,]*/gi, replace: "[ADDRESS-REDACTED]" },
  { name: "HealthCard", pattern: /\b\d{4}[-\s]?\d{3}[-\s]?\d{3}[-\s]?[A-Z]{2}\b/g, replace: "[HEALTHCARD-REDACTED]" },
];

export function redactPII(text, level) {
  if (!text || level === "off") return text;
  let redacted = text;
  PII_PATTERNS.forEach((p) => {
    if (level === "maximum" || (level === "standard" && !["Address"].includes(p.name))) {
      redacted = redacted.replace(p.pattern, p.replace);
    }
  });
  if (level === "maximum") {
    redacted = redacted.replace(/(?:Worker|Patient|Employee|Claimant|Name)[:\s]+([A-Z][a-z]+\s+[A-Z]?\.?\s*[A-Z][a-z]+)/g, "Worker: [NAME-REDACTED]");
  }
  return redacted;
}

/* ═══ Case Templates ═══ */
export const CASE_TEMPLATES = [
  { label: "Acute Back Injury", type: "Acute Injury", desc: "Worker sustained acute lumbar strain/sprain from lifting, bending, or twisting. Sudden onset of lower back pain.", icon: "BI" },
  { label: "Slip & Fall", type: "Acute Injury", desc: "Worker slipped/tripped and fell at the workplace. May involve multiple body parts.", icon: "SF" },
  { label: "Repetitive Strain", type: "Occupational Disease", desc: "Gradual onset of pain/dysfunction from repetitive workplace tasks.", icon: "RS" },
  { label: "Occupational Hearing Loss", type: "Occupational Disease", desc: "Progressive hearing loss from prolonged exposure to workplace noise.", icon: "HL" },
  { label: "First Responder PTSD", type: "PTSD (First Responder)", desc: "PTSD claim from first responder with presumptive coverage under OPM 15-03-13.", icon: "PT" },
  { label: "Workplace Mental Stress", type: "Traumatic Mental Stress", desc: "Acute or chronic mental stress arising from workplace events or conditions.", icon: "MS" },
  { label: "Pre-existing Aggravation", type: "Aggravation of Pre-existing", desc: "Workplace incident aggravated a pre-existing condition. Thin skull principle may apply.", icon: "PA" },
  { label: "Recurrence", type: "Recurrence", desc: "Return of symptoms from a previously accepted WSIB claim.", icon: "RC" },
];

/* ═══ WSIB Glossary ═══ */
export const GLOSSARY = {
  "Form 6": "Worker's Report of Injury/Disease. Filed by the injured worker.",
  "Form 7": "Employer's Report of Injury/Disease. Filed within 3 business days.",
  "Form 8": "Health Professional's Report. Filed by the treating physician.",
  "LOE": "Loss of Earnings benefits. Paid at 85% of pre-injury net earnings.",
  "NEL": "Non-Economic Loss benefit. Lump-sum for permanent impairment.",
  "OPM": "Operational Policy Manual. WSIB's official policy guide.",
  "RTW": "Return to Work. Safe transition back to employment.",
  "WSIAT": "Workplace Safety and Insurance Appeals Tribunal.",
  "ARO": "Appeals Resolution Officer. First level of appeal within WSIB.",
  "Five Point Check": "The 5 criteria every claim must meet for entitlement.",
  "Thin Skull": "WSIB takes the worker as they find them. Pre-existing condition does not bar a claim.",
  "Benefit of Doubt": "OPM 11-01-13: When evidence is equally balanced, favour the worker.",
  "IME": "Independent Medical Examination.",
  "AWW": "Average Weekly Wage. Baseline for LOE calculations.",
  "72-Month Review": "Mandatory LOE review at 72 months.",
};

/* ═══ Provider Types ═══ */
export const PROVIDER_TYPES = ["Family Doctor", "Emergency", "Specialist", "Surgeon", "Physiotherapist", "Chiropractor", "Psychologist", "Imaging Clinic", "Pharmacy", "Other"];

/* ═══ Letter Templates ═══ */
export const LETTER_TEMPLATES = [
  { id: "representation", label: "Letter of Representation", desc: "Notify WSIB that you represent the injured worker", prompt: "Generate a formal Letter of Representation for this WSIB claim." },
  { id: "records_request", label: "Medical Records Request", desc: "Request records from a treating physician", prompt: "Generate a Medical Records Request letter for this WSIB claim." },
  { id: "intent_object", label: "Intent to Object", desc: "Notify WSIB you disagree with a decision", prompt: "Generate an Intent to Object letter for this denied WSIB claim." },
  { id: "employer_response", label: "Employer Response Request", desc: "Request information from the employer", prompt: "Generate a letter requesting information from the employer." },
  { id: "faf_request", label: "FAF Update Request", desc: "Request updated Functional Abilities Form", prompt: "Generate a letter requesting an updated FAF from the treating physician." },
];

/* ═══ Valuation Fields ═══ */
export const VALUATION_FIELDS = [
  { id: "medicalToDate", label: "Medical Costs to Date", desc: "Total medical expenses incurred" },
  { id: "medicalFuture", label: "Projected Future Medical", desc: "Estimated remaining treatment costs" },
  { id: "loeToDate", label: "LOE Benefits to Date", desc: "Loss of earnings paid so far" },
  { id: "loeFuture", label: "Projected Future LOE", desc: "Estimated remaining wage loss" },
  { id: "nel", label: "NEL Award Estimate", desc: "Non-Economic Loss lump sum" },
  { id: "legalFees", label: "Legal Fees", desc: "Contingency or hourly fees" },
  { id: "disbursements", label: "Disbursements", desc: "Filing fees, expert reports, travel" },
  { id: "otherCosts", label: "Other Costs", desc: "Any additional claim-related costs" },
];

/* ═══ Scenario Prompts ═══ */
export const SCENARIOS = [
  { l: "Back injury claim", t: "A warehouse worker injured their lower back lifting a 50lb box on March 3, 2026. Reported same day, Form 7 filed March 5. Doctor diagnosed lumbar strain (M54.5), recommended 4 weeks off. No pre-existing conditions. What would WSIB rule?" },
  { l: "Disputed late reporting", t: "A construction worker reports a shoulder injury 3 weeks after the alleged incident. No witnesses. Employer is disputing. How would WSIB approach this?" },
  { l: "Pre-existing aggravation", t: "Worker has documented degenerative disc disease at L4-L5. Claims a workplace slip aggravated this, now needs surgery. How does the thin skull principle apply?" },
  { l: "First responder PTSD", t: "A paramedic with 12 years of service is filing a PTSD claim after a fatal MVA involving children. What does OPM 15-03-13 say about presumptive coverage?" },
];
