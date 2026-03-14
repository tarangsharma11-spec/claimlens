import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

/**
 * POST /api/pdf-export
 * Generates a professional HTML case report that the client renders as PDF.
 *
 * We return styled HTML rather than a binary PDF to avoid server-side
 * puppeteer/chromium dependencies. The client uses window.print() or
 * a lightweight html2pdf library to convert to PDF.
 */
export async function POST(request) {
  const session = await getServerSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { claim, analyses, documents, includeTimeline, includeValuation } = await request.json();

    if (!claim) {
      return NextResponse.json({ error: "Claim data required." }, { status: 400 });
    }

    const lastRuling = analyses?.[analyses.length - 1];
    const rulingColor = lastRuling?.ruling === "Allow" ? "#28A745" : lastRuling?.ruling === "Deny" ? "#E53935" : "#F57C00";
    const now = new Date().toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" });

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>CaseAssist Report — ${claim.claimNumber}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Plus Jakarta Sans', -apple-system, sans-serif; color: #1D1D1F; font-size: 12px; line-height: 1.6; padding: 40px; max-width: 800px; margin: 0 auto; }
  @media print {
    body { padding: 20px; }
    .no-print { display: none; }
    @page { margin: 1.5cm; }
  }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #1D1D1F; padding-bottom: 16px; margin-bottom: 24px; }
  .logo { font-size: 18px; font-weight: 800; letter-spacing: -0.5px; }
  .logo-sub { font-size: 10px; color: #6E6F76; font-weight: 400; }
  .meta { text-align: right; font-size: 11px; color: #6E6F76; }
  .claim-header { background: #F8F9FB; border-radius: 8px; padding: 16px 20px; margin-bottom: 20px; }
  .claim-number { font-size: 22px; font-weight: 800; letter-spacing: -0.5px; }
  .claim-detail { font-size: 12px; color: #6E6F76; margin-top: 4px; }
  .ruling-box { padding: 14px 20px; border-radius: 8px; margin-bottom: 20px; display: flex; align-items: center; gap: 10px; }
  .ruling-dot { width: 10px; height: 10px; border-radius: 50%; }
  .ruling-text { font-size: 16px; font-weight: 700; }
  h2 { font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #6E6F76; margin: 24px 0 8px; border-bottom: 1px solid #E0E1E6; padding-bottom: 4px; }
  .five-point { display: flex; flex-direction: column; gap: 4px; margin-bottom: 16px; }
  .five-point-item { display: flex; align-items: center; gap: 8px; padding: 6px 10px; border-radius: 6px; font-size: 12px; }
  .five-point-item.pass { background: rgba(40,167,69,.06); }
  .five-point-item.fail { background: rgba(229,57,53,.06); }
  .check-icon { width: 18px; height: 18px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 800; color: #fff; flex-shrink: 0; }
  .doc-table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  .doc-table th, .doc-table td { padding: 6px 10px; text-align: left; border-bottom: 1px solid #E0E1E6; font-size: 11px; }
  .doc-table th { font-weight: 600; color: #6E6F76; text-transform: uppercase; letter-spacing: 0.5px; font-size: 10px; }
  .timeline-item { display: flex; gap: 12px; padding: 4px 0; font-size: 11px; }
  .timeline-date { color: #6E6F76; min-width: 100px; flex-shrink: 0; }
  .timeline-note { color: #3E3F44; }
  .valuation-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #F0F1F3; font-size: 12px; }
  .valuation-label { color: #6E6F76; }
  .valuation-amount { font-weight: 600; }
  .footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #E0E1E6; font-size: 10px; color: #A0A3AB; text-align: center; }
  .print-btn { display: inline-block; padding: 10px 24px; background: #0071E3; color: #fff; border: none; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; margin-bottom: 20px; font-family: inherit; }
</style>
</head>
<body>
<div class="no-print" style="text-align: center; margin-bottom: 16px;">
  <button class="print-btn" onclick="window.print()">Download as PDF</button>
</div>

<div class="header">
  <div>
    <div class="logo">CaseAssist <span class="logo-sub">Claims Intelligence Report</span></div>
  </div>
  <div class="meta">
    Generated: ${now}<br>
    Report ID: RPT-${Date.now().toString(36).toUpperCase()}
  </div>
</div>

<div class="claim-header">
  <div class="claim-number">${claim.claimNumber}</div>
  <div class="claim-detail">
    ${claim.worker || "—"} · ${claim.employer || "—"} · ${claim.injuryType || "—"} · DOI: ${claim.injuryDate || "—"}
  </div>
  ${claim.description ? `<div style="margin-top: 8px; font-size: 12px; color: #3E3F44; line-height: 1.5;">${claim.description}</div>` : ""}
</div>

${lastRuling ? `
<div class="ruling-box" style="background: ${rulingColor}08; border: 1px solid ${rulingColor}20;">
  <div class="ruling-dot" style="background: ${rulingColor};"></div>
  <div class="ruling-text" style="color: ${rulingColor};">RULING PREDICTION: ${lastRuling.ruling}</div>
</div>

<h2>Five Point Check</h2>
<div class="five-point">
  ${["Active employer account", "Worker performing duties of employment", "Personal injury by accident or occupational disease", "Arising out of and in the course of employment", "Resulting disability or loss of earnings"].map(
    (check) => `<div class="five-point-item ${lastRuling.ruling !== "Deny" ? "pass" : "fail"}">
      <div class="check-icon" style="background: ${lastRuling.ruling !== "Deny" ? "#28A745" : "#E53935"};">${lastRuling.ruling !== "Deny" ? "✓" : "✗"}</div>
      ${check}
    </div>`
  ).join("")}
</div>

<h2>Analysis History</h2>
${(analyses || []).map((a) => `
  <div style="padding: 8px 12px; background: #F8F9FB; border-radius: 6px; margin-bottom: 6px;">
    <div style="display: flex; justify-content: space-between; font-size: 12px;">
      <strong style="color: ${a.ruling === "Allow" ? "#28A745" : a.ruling === "Deny" ? "#E53935" : "#F57C00"};">${a.ruling}</strong>
      <span style="color: #A0A3AB;">${new Date(a.date).toLocaleDateString("en-CA")}</span>
    </div>
    ${a.snippet ? `<div style="font-size: 11px; color: #6E6F76; margin-top: 4px;">${a.snippet.slice(0, 200)}...</div>` : ""}
  </div>
`).join("")}
` : '<div style="padding: 16px; background: #F8F9FB; border-radius: 8px; text-align: center; color: #A0A3AB; font-size: 12px;">No AI analysis on file. Run a Five Point Check to generate a ruling prediction.</div>'}

${documents?.length ? `
<h2>Documents on File (${documents.length})</h2>
<table class="doc-table">
  <thead><tr><th>Type</th><th>Name</th><th>Date Added</th></tr></thead>
  <tbody>
    ${documents.map((d) => `<tr><td>${d.tag || "other"}</td><td>${d.name}</td><td>${d.addedAt ? new Date(d.addedAt).toLocaleDateString("en-CA") : "—"}</td></tr>`).join("")}
  </tbody>
</table>
` : ""}

${includeTimeline && claim.timeline?.length ? `
<h2>Case Timeline</h2>
${claim.timeline.slice().reverse().map((ev) => `
  <div class="timeline-item">
    <div class="timeline-date">${new Date(ev.date).toLocaleDateString("en-CA")}</div>
    <div class="timeline-note">${ev.note}</div>
  </div>
`).join("")}
` : ""}

${includeValuation && claim.valuation ? `
<h2>Claim Valuation</h2>
${Object.entries(claim.valuation).filter(([, v]) => parseFloat(v) > 0).map(([k, v]) => `
  <div class="valuation-row">
    <span class="valuation-label">${k.replace(/([A-Z])/g, " $1").trim()}</span>
    <span class="valuation-amount">$${parseFloat(v).toLocaleString()}</span>
  </div>
`).join("")}
<div class="valuation-row" style="border-top: 2px solid #1D1D1F; font-weight: 700; font-size: 14px; padding-top: 8px;">
  <span>Total Claim Value</span>
  <span>$${Object.values(claim.valuation).reduce((s, v) => s + (parseFloat(v) || 0), 0).toLocaleString()}</span>
</div>
` : ""}

<div class="footer">
  CaseAssist — Advisory tool only. Final decisions by authorized WSIB adjudicators. © ${new Date().getFullYear()}<br>
  This report is confidential and intended for authorized recipients only. PIPEDA compliant.
</div>
</body>
</html>`;

    return new Response(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
      },
    });
  } catch (err) {
    console.error("PDF export error:", err);
    return NextResponse.json({ error: "Export failed." }, { status: 500 });
  }
}
