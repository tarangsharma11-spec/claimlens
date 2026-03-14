"use client";

/**
 * AI Message Renderer — parses markdown-like AI responses into
 * styled components with ruling predictions, checkmarks, OPM refs, etc.
 */
export function AiMessage({ text }) {
  const lines = (text || "").split("\n");
  return (
    <div className="ai-text">
      {lines.map((raw, i) => {
        const t = raw.trim();
        if (!t) return <div key={i} style={{ height: 10 }} />;

        // Headers
        if (/^#{1,3}\s/.test(t)) {
          const l = t.match(/^(#+)/)[1].length;
          return <div key={i} className={`ai-h ai-h${l}`}>{t.replace(/^#+\s*/, "")}</div>;
        }

        // Ruling prediction
        if (/\*\*RULING PREDICTION/i.test(t) || /^RULING PREDICTION/i.test(t)) {
          const a = /allow/i.test(t), d = /deny/i.test(t);
          return (
            <div key={i} className={`ai-ruling ${a ? "allow" : d ? "deny" : "inv"}`}>
              <span className="ai-rdot" />
              {t.replace(/\*\*/g, "")}
            </div>
          );
        }

        // Red flags
        if (/^⚠/.test(t)) return <div key={i} className="ai-flag">{t}</div>;

        // OPM references
        if (/^(OPM\s+)?\d{2}-\d{2}-\d{2}/i.test(t)) return <div key={i} className="ai-opm">{t}</div>;

        // Checkmarks (pass)
        if (/^[✓✔]\s/.test(t)) return (
          <div key={i} className="ai-chk pass">
            <span className="ai-ci">✓</span>
            <span>{t.replace(/^[✓✔]\s*/, "")}</span>
          </div>
        );

        // Cross marks (fail)
        if (/^[✗✘]\s/.test(t)) return (
          <div key={i} className="ai-chk fail">
            <span className="ai-ci">✗</span>
            <span>{t.replace(/^[✗✘]\s*/, "")}</span>
          </div>
        );

        // Bullet points
        if (/^[-•]\s/.test(t)) return <div key={i} className="ai-li">{t.replace(/^[-•]\s*/, "")}</div>;

        // Numbered lists
        if (/^\d+[.)]\s/.test(t)) {
          const n = t.match(/^(\d+)/)[1];
          return (
            <div key={i} className="ai-ol">
              <span className="ai-oln">{n}</span>
              {t.replace(/^\d+[.)]\s*/, "")}
            </div>
          );
        }

        // Bold text within paragraphs
        const p = t.split(/(\*\*[^*]+\*\*)/g);
        if (p.length > 1) return (
          <div key={i} className="ai-p">
            {p.map((s, j) =>
              /^\*\*/.test(s) ? <strong key={j}>{s.replace(/\*\*/g, "")}</strong> : <span key={j}>{s}</span>
            )}
          </div>
        );

        // Regular paragraph
        return <div key={i} className="ai-p">{t}</div>;
      })}
    </div>
  );
}
