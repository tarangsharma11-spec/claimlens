"use client";
import Link from "next/link";

export default function BlogPost({ title, date, readTime, category, children }) {
  return (
    <div style={{ minHeight: "100vh", background: "#fff", fontFamily: "'Plus Jakarta Sans', -apple-system, sans-serif" }}>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Newsreader:ital,wght@0,400;0,500;0,600;1,400&display=swap');
        *{margin:0;padding:0;box-sizing:border-box}
        .post-body h2{font-size:22px;font-weight:800;color:#1D1D1F;letter-spacing:-0.5px;margin:32px 0 12px;font-family:'Plus Jakarta Sans',sans-serif}
        .post-body h3{font-size:17px;font-weight:700;color:#1D1D1F;margin:24px 0 8px;font-family:'Plus Jakarta Sans',sans-serif}
        .post-body p{font-size:16px;line-height:1.8;color:#3E3F44;margin-bottom:16px;font-family:'Newsreader',serif}
        .post-body ul,.post-body ol{margin:0 0 16px 24px;font-family:'Newsreader',serif}
        .post-body li{font-size:16px;line-height:1.7;color:#3E3F44;margin-bottom:6px}
        .post-body strong{color:#1D1D1F}
        .post-body blockquote{margin:20px 0;padding:16px 20px;border-left:3px solid #3B5EC0;background:rgba(59,94,192,.04);border-radius:0 10px 10px 0;font-style:italic}
        .post-body blockquote p{color:#251A5E;margin-bottom:0}
        .post-body .opm-ref{display:inline-block;padding:2px 8px;border-radius:4px;font-size:13px;font-weight:600;color:#3B5EC0;background:rgba(59,94,192,.06);font-family:'Plus Jakarta Sans',sans-serif;margin:0 2px}
        .post-body .cta-box{padding:24px;background:linear-gradient(135deg,#1A1040,#3B5EC0);border-radius:14px;color:#fff;margin:28px 0;text-align:center}
        .post-body .cta-box h3{color:#fff;margin:0 0 8px}
        .post-body .cta-box p{color:rgba(255,255,255,.8);margin-bottom:14px}
        .post-body .cta-box a{display:inline-block;padding:10px 24px;border-radius:100px;background:#fff;color:#251A5E;font-weight:700;font-size:14px;text-decoration:none;font-family:'Plus Jakarta Sans',sans-serif}
      `}</style>

      {/* NAV */}
      <nav style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 32px", maxWidth: 1200, margin: "0 auto", borderBottom: "1px solid #F0F1F3" }}>
        <Link href="/login" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
          <div style={{ width: 32, height: 32 }}><svg width="32" height="32" viewBox="0 0 80 90" fill="none"><defs><linearGradient id="bl" x1="0" y1="0" x2="0.5" y2="1"><stop offset="0%" stopColor="#1A1040" /><stop offset="100%" stopColor="#2E3580" /></linearGradient></defs><rect x="16" y="16" width="54" height="64" rx="12" fill="#3B5EC0" opacity="0.5" /><rect x="10" y="10" width="54" height="64" rx="12" fill="#2E3580" opacity="0.7" /><rect x="4" y="4" width="54" height="64" rx="12" fill="url(#bl)" /><line x1="16" y1="22" x2="44" y2="22" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" opacity="0.7" /><line x1="16" y1="34" x2="38" y2="34" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" opacity="0.5" /><line x1="16" y1="46" x2="32" y2="46" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" opacity="0.35" /><path d="M42 19L45.5 22.5L52 15" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" /></svg></div>
          <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: -0.5, color: "#1D1D1F" }}>CaseAssist</span>
        </Link>
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <Link href="/blog" style={{ fontSize: 13, fontWeight: 600, color: "#3B5EC0", textDecoration: "none" }}>Blog</Link>
          <Link href="/demo" style={{ fontSize: 13, fontWeight: 500, color: "#6E6E73", textDecoration: "none" }}>Request Demo</Link>
          <Link href="/login" style={{ padding: "8px 20px", borderRadius: 100, fontSize: 13, fontWeight: 600, background: "#1D1D1F", color: "#fff", textDecoration: "none" }}>Try Free</Link>
        </div>
      </nav>

      {/* ARTICLE */}
      <article style={{ maxWidth: 720, margin: "0 auto", padding: "48px 24px 80px" }}>
        <Link href="/blog" style={{ fontSize: 13, fontWeight: 500, color: "#3B5EC0", textDecoration: "none", display: "block", marginBottom: 24 }}>{"<-"} Back to Blog</Link>
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <span style={{ padding: "4px 12px", borderRadius: 100, fontSize: 11, fontWeight: 600, color: "#3B5EC0", background: "rgba(59,94,192,.06)" }}>{category}</span>
          <span style={{ padding: "4px 12px", borderRadius: 100, fontSize: 11, fontWeight: 500, color: "#A0A1A8", background: "#F8F9FB" }}>{readTime}</span>
        </div>
        <h1 style={{ fontSize: "clamp(28px, 4vw, 38px)", fontWeight: 800, letterSpacing: -1.2, color: "#1D1D1F", lineHeight: 1.2, marginBottom: 12 }}>{title}</h1>
        <div style={{ fontSize: 14, color: "#A0A1A8", marginBottom: 32, paddingBottom: 24, borderBottom: "1px solid #F0F1F3" }}>
          Published {date} by CaseAssist Team
        </div>
        <div className="post-body">{children}</div>
      </article>

      {/* FOOTER */}
      <footer style={{ padding: "24px 32px", display: "flex", justifyContent: "space-between", alignItems: "center", maxWidth: 1200, margin: "0 auto", fontSize: 12, color: "#AEAEB2", borderTop: "1px solid #E0E1E6" }}>
        <span>CaseAssist</span>
        <span>Advisory tool only. Final decisions by authorized WSIB adjudicators. &copy; 2026</span>
      </footer>
    </div>
  );
}
