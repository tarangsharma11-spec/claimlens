"use client";

/**
 * Export a claim as a professional PDF report.
 * Opens a new tab with the styled HTML report that includes a print button.
 *
 * @param {object} claim - The full claim object
 * @param {object} [options] - Export options
 * @param {boolean} [options.includeTimeline=true] - Include case timeline
 * @param {boolean} [options.includeValuation=true] - Include claim valuation
 */
export async function exportCasePdf(claim, options = {}) {
  const { includeTimeline = true, includeValuation = true } = options;

  try {
    const response = await fetch("/api/pdf-export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        claim,
        analyses: claim.analyses || [],
        documents: claim.documents || [],
        includeTimeline,
        includeValuation,
      }),
    });

    if (!response.ok) {
      throw new Error("Export failed");
    }

    const html = await response.text();

    // Open in new tab for print
    const win = window.open("", "_blank");
    if (win) {
      win.document.write(html);
      win.document.close();
    } else {
      // Fallback: download as HTML
      const blob = new Blob([html], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${claim.claimNumber}-report.html`;
      a.click();
      URL.revokeObjectURL(url);
    }
  } catch (err) {
    console.error("PDF export error:", err);
    alert("Failed to generate report. Please try again.");
  }
}
