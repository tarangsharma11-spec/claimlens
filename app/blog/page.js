"use client";
import Link from "next/link";

const POSTS = [
  {
    slug: "wsib-five-point-check-explained",
    title: "The WSIB Five Point Check Explained: A Complete Guide for 2026",
    excerpt: "Everything you need to know about the Five Point Check system used by WSIB decision-makers to determine initial entitlement to benefits under the WSIA.",
    date: "March 13, 2026",
    readTime: "8 min read",
    category: "Adjudication",
    keywords: ["Five Point Check", "OPM 11-01-01", "Entitlement"],
  },
  {
    slug: "wsib-claim-denied-red-flags",
    title: "Top 10 WSIB Red Flags That Can Get Your Claim Denied",
    excerpt: "From late reporting to inconsistent statements, these are the most common red flags that WSIB decision-makers look for \u2014 and how to address them proactively.",
    date: "March 13, 2026",
    readTime: "7 min read",
    category: "Claims",
    keywords: ["Claim Denied", "Red Flags", "Credibility"],
  },
];

const CATEGORIES = [...new Set(POSTS.map(p => p.category))];

export default function BlogPage() {
  return (
    <div style={{ minHeight: "100vh", background: "#F8F9FB", fontFamily: "'Plus Jakarta Sans', -apple-system, sans-serif" }}>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        *{margin:0;padding:0;box-sizing:border-box}
        a{text-decoration:none}
        .blog-card{transition:transform .2s,box-shadow .2s}
        .blog-card:hover{transform:translateY(-3px);box-shadow:0 8px 24px rgba(0,0,0,.08)}
      `}</style>

      {/* NAV */}
      <nav style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 32px", maxWidth: 1200, margin: "0 auto" }}>
        <Link href="/login" style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32 }}>
            <svg width="32" height="32" viewBox="0 0 80 90" fill="none"><defs><linearGradient id="bl" x1="0" y1="0" x2="0.5" y2="1"><stop offset="0%" stopColor="#1A1040" /><stop offset="100%" stopColor="#2E3580" /></linearGradient></defs><rect x="16" y="16" width="54" height="64" rx="12" fill="#3B5EC0" opacity="0.5" /><rect x="10" y="10" width="54" height="64" rx="12" fill="#2E3580" opacity="0.7" /><rect x="4" y="4" width="54" height="64" rx="12" fill="url(#bl)" /><line x1="16" y1="22" x2="44" y2="22" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" opacity="0.7" /><line x1="16" y1="34" x2="38" y2="34" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" opacity="0.5" /><line x1="16" y1="46" x2="32" y2="46" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" opacity="0.35" /><path d="M42 19L45.5 22.5L52 15" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" /></svg>
          </div>
          <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: -0.5, color: "#1D1D1F" }}>CaseAssist</span>
        </Link>
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <Link href="/pricing" style={{ fontSize: 13, fontWeight: 500, color: "#6E6E73" }}>Pricing</Link>
          <Link href="/demo" style={{ fontSize: 13, fontWeight: 500, color: "#6E6E73" }}>Request Demo</Link>
          <Link href="/login" style={{ padding: "8px 20px", borderRadius: 100, fontSize: 13, fontWeight: 600, background: "#1D1D1F", color: "#fff" }}>Sign In</Link>
        </div>
      </nav>

      {/* HERO */}
      <section style={{ textAlign: "center", padding: "60px 24px 40px" }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#3B5EC0", textTransform: "uppercase", letterSpacing: 2, marginBottom: 12 }}>CaseAssist Blog</div>
        <h1 style={{ fontSize: "clamp(32px, 5vw, 48px)", fontWeight: 800, letterSpacing: -1.5, color: "#1D1D1F", marginBottom: 14 }}>
          WSIB Claims Intelligence
        </h1>
        <p style={{ fontSize: 16, color: "#6E6E73", maxWidth: 520, margin: "0 auto" }}>
          Expert guides on workers' compensation claims, OPM policy analysis, and claims management best practices for Ontario professionals.
        </p>
      </section>

      {/* CATEGORY PILLS */}
      <div style={{ display: "flex", justifyContent: "center", gap: 6, padding: "0 24px 40px", flexWrap: "wrap" }}>
        <span style={{ padding: "6px 16px", borderRadius: 100, fontSize: 12, fontWeight: 600, background: "#1D1D1F", color: "#fff", cursor: "pointer" }}>All Posts</span>
        {CATEGORIES.map(cat => (
          <span key={cat} style={{ padding: "6px 16px", borderRadius: 100, fontSize: 12, fontWeight: 500, background: "#fff", color: "#6E6E73", border: "1px solid #E0E1E6", cursor: "pointer" }}>{cat}</span>
        ))}
      </div>

      {/* FEATURED POST */}
      <section style={{ maxWidth: 1000, margin: "0 auto", padding: "0 24px 32px" }}>
        <Link href={`/blog/${POSTS[0].slug}`} className="blog-card" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0, background: "linear-gradient(135deg, #1A1040 0%, #251A5E 50%, #3B5EC0 100%)", borderRadius: 20, overflow: "hidden", color: "#fff" }}>
          <div style={{ padding: "40px 36px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              <span style={{ padding: "3px 10px", borderRadius: 100, fontSize: 11, fontWeight: 600, background: "rgba(255,255,255,.15)", color: "#fff" }}>{POSTS[0].category}</span>
              <span style={{ padding: "3px 10px", borderRadius: 100, fontSize: 11, fontWeight: 500, background: "rgba(255,255,255,.1)", color: "rgba(255,255,255,.7)" }}>Featured</span>
            </div>
            <h2 style={{ fontSize: 26, fontWeight: 800, letterSpacing: -0.8, lineHeight: 1.25, marginBottom: 12 }}>{POSTS[0].title}</h2>
            <p style={{ fontSize: 14, color: "rgba(255,255,255,.7)", lineHeight: 1.6, marginBottom: 20 }}>{POSTS[0].excerpt}</p>
            <div style={{ display: "flex", gap: 12, fontSize: 12, color: "rgba(255,255,255,.5)" }}>
              <span>{POSTS[0].date}</span>
              <span>{POSTS[0].readTime}</span>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 40 }}>
            <div style={{ width: 200, height: 200, borderRadius: 20, background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="80" height="80" viewBox="0 0 80 90" fill="none"><rect x="16" y="16" width="54" height="64" rx="12" fill="rgba(255,255,255,.15)" /><rect x="10" y="10" width="54" height="64" rx="12" fill="rgba(255,255,255,.2)" /><rect x="4" y="4" width="54" height="64" rx="12" fill="rgba(255,255,255,.25)" /><line x1="16" y1="22" x2="44" y2="22" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" opacity="0.5" /><line x1="16" y1="34" x2="38" y2="34" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" opacity="0.35" /><line x1="16" y1="46" x2="32" y2="46" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" opacity="0.2" /><path d="M42 19L45.5 22.5L52 15" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" opacity="0.7" /></svg>
            </div>
          </div>
        </Link>
      </section>

      {/* POST GRID */}
      <section style={{ maxWidth: 1000, margin: "0 auto", padding: "0 24px 60px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          {POSTS.slice(1).map((post) => (
            <Link href={`/blog/${post.slug}`} key={post.slug} className="blog-card" style={{ background: "#fff", borderRadius: 16, border: "1px solid rgba(0,0,0,.06)", overflow: "hidden", display: "flex", flexDirection: "column" }}>
              <div style={{ height: 8, background: `linear-gradient(90deg, #1A1040, #3B5EC0)` }} />
              <div style={{ padding: "20px 20px 24px", flex: 1, display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
                  <span style={{ padding: "2px 8px", borderRadius: 100, fontSize: 10, fontWeight: 600, color: "#3B5EC0", background: "rgba(59,94,192,.06)" }}>{post.category}</span>
                  <span style={{ padding: "2px 8px", borderRadius: 100, fontSize: 10, fontWeight: 500, color: "#A0A1A8", background: "#F8F9FB" }}>{post.readTime}</span>
                </div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: "#1D1D1F", lineHeight: 1.35, marginBottom: 8 }}>{post.title}</h3>
                <p style={{ fontSize: 13, color: "#6E6E73", lineHeight: 1.55, flex: 1 }}>{post.excerpt}</p>
                <div style={{ fontSize: 11, color: "#A0A1A8", marginTop: 12, display: "flex", gap: 8 }}>
                  <span>{post.date}</span>
                  <span style={{ display: "flex", gap: 4 }}>{post.keywords.map(k => <span key={k} style={{ padding: "1px 6px", borderRadius: 4, background: "#F0F1F3", fontSize: 10 }}>{k}</span>)}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section style={{ maxWidth: 800, margin: "0 auto", padding: "40px 24px 60px" }}>
        <div style={{ padding: "40px", background: "linear-gradient(135deg, #1A1040 0%, #3B5EC0 100%)", borderRadius: 20, textAlign: "center" }}>
          <h2 style={{ fontSize: 24, fontWeight: 800, color: "#fff", letterSpacing: -0.5, marginBottom: 10 }}>Ready to streamline your WSIB claims?</h2>
          <p style={{ fontSize: 14, color: "rgba(255,255,255,.7)", marginBottom: 24 }}>Start free or request a personalized demo from our team.</p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            <Link href="/login" style={{ padding: "12px 28px", borderRadius: 100, fontSize: 14, fontWeight: 700, background: "#fff", color: "#251A5E" }}>Start Free</Link>
            <Link href="/demo" style={{ padding: "12px 28px", borderRadius: 100, fontSize: 14, fontWeight: 600, background: "rgba(255,255,255,.15)", color: "#fff", border: "1px solid rgba(255,255,255,.2)" }}>Request Demo</Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ padding: "24px 32px", display: "flex", justifyContent: "space-between", alignItems: "center", maxWidth: 1200, margin: "0 auto", fontSize: 12, color: "#AEAEB2", borderTop: "1px solid #E0E1E6" }}>
        <span>CaseAssist</span>
        <span>Advisory tool only. Final decisions by authorized WSIB adjudicators. &copy; 2026</span>
      </footer>
    </div>
  );
}
