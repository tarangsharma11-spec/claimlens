"use client";
import { useState } from "react";
import Link from "next/link";

const PLANS = [
  {
    id: "starter",
    name: "Starter",
    price: 0,
    period: "forever",
    desc: "For individual workers navigating a claim",
    cta: "Get Started Free",
    features: [
      "3 active cases",
      "AI ruling predictions",
      "Document uploads (10 per case)",
      "Five Point Check analysis",
      "Basic workflow tracking",
      "WSIB glossary",
    ],
    limits: [
      "No email integration",
      "No CSV import/export",
      "No AI Tools panel",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: 79,
    period: "/month",
    desc: "For injury lawyers and HR professionals",
    cta: "Start 14-Day Free Trial",
    popular: true,
    features: [
      "Unlimited cases",
      "All AI tools (9 expert tools)",
      "Email integration via Resend",
      "Unlimited document uploads",
      "Claim board (Kanban pipeline)",
      "CSV import & export",
      "Case comparison",
      "PDF export",
      "Medical provider tracking",
      "Benefit & AWW calculator",
      "Priority support",
    ],
    limits: [],
  },
  {
    id: "firm",
    name: "Firm",
    price: 299,
    period: "/month",
    desc: "For firms and TPA offices managing caseloads",
    cta: "Contact Sales",
    features: [
      "Everything in Pro",
      "Up to 5 team members",
      "Case assignment & routing",
      "Shared workspace",
      "Team analytics dashboard",
      "Bulk operations",
      "Audit log",
      "Role-based permissions",
      "Custom branding",
      "Dedicated onboarding",
      "SLA & priority support",
    ],
    limits: [],
  },
];

const FAQ = [
  { q: "Can I switch plans later?", a: "Yes, you can upgrade or downgrade at any time. Changes take effect on your next billing cycle. If you upgrade mid-cycle, you'll be charged the prorated difference." },
  { q: "Is there a free trial?", a: "The Pro plan includes a 14-day free trial. No credit card required to start. You'll only be charged after the trial ends if you choose to continue." },
  { q: "What payment methods do you accept?", a: "We accept all major credit cards (Visa, Mastercard, Amex) through our secure payment processor, Stripe. All transactions are encrypted and PCI compliant." },
  { q: "Is my data secure?", a: "CaseAssist is 100% PIPEDA compliant. No PII is included in AI outputs. All data is encrypted at rest and in transit. We never share your data with third parties." },
  { q: "Can I cancel anytime?", a: "Yes, cancel anytime from your billing settings. Your access continues until the end of your current billing period. No cancellation fees." },
  { q: "Do you offer discounts for annual billing?", a: "Yes! Annual billing saves you 20%. Pro annual is $63/month ($756/year) and Firm annual is $239/month ($2,868/year)." },
];

export default function PricingPage() {
  const [annual, setAnnual] = useState(false);
  const [loading, setLoading] = useState(null);
  const [openFaq, setOpenFaq] = useState(null);

  async function handleCheckout(planId) {
    if (planId === "starter") {
      window.location.href = "/login";
      return;
    }
    if (planId === "firm") {
      window.location.href = "mailto:hello@caseassist.ca?subject=CaseAssist Firm Plan Inquiry";
      return;
    }
    setLoading(planId);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, email: "" }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || "Failed to start checkout");
      }
    } catch (err) {
      alert("Something went wrong. Please try again.");
    } finally {
      setLoading(null);
    }
  }

  const getPrice = (plan) => {
    if (plan.price === 0) return "Free";
    const p = annual ? Math.round(plan.price * 0.8) : plan.price;
    return `$${p}`;
  };

  return (
    <div style={{ minHeight: "100vh", background: "#FAFBFC", fontFamily: "'Plus Jakarta Sans', -apple-system, sans-serif" }}>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap');
        :root{--blue:#0071E3;--blue-light:rgba(0,113,227,.06);--blue-border:rgba(0,113,227,.15);--g50:#F8F9FB;--g100:#F0F1F3;--g200:#E0E1E6;--g300:#C8C9CE;--g400:#A0A1A8;--g500:#6E6F76;--g600:#56575C;--g700:#3E3F44;--g800:#2A2B2E;--g900:#1D1D1F;--card-border:rgba(0,0,0,.06);--card-shadow:0 1px 3px rgba(0,0,0,.04);--bg:#F8F9FB;--green:#28A745;--red:#E53935}
        *{margin:0;padding:0;box-sizing:border-box}
        .pricing-card{transition:transform .2s,box-shadow .2s}
        .pricing-card:hover{transform:translateY(-4px);box-shadow:0 12px 40px rgba(0,0,0,.1)}
      `}</style>

      {/* NAV */}
      <nav style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 32px", maxWidth: 1200, margin: "0 auto" }}>
        <Link href="/login" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
          <div style={{ width: 32, height: 32 }}>
            <svg width="32" height="32" viewBox="0 0 80 90" fill="none">
              <defs><linearGradient id="pl" x1="0" y1="0" x2="0.5" y2="1"><stop offset="0%" stopColor="#1A1040" /><stop offset="100%" stopColor="#2E3580" /></linearGradient></defs>
              <rect x="16" y="16" width="54" height="64" rx="12" fill="#3B5EC0" opacity="0.5" />
              <rect x="10" y="10" width="54" height="64" rx="12" fill="#2E3580" opacity="0.7" />
              <rect x="4" y="4" width="54" height="64" rx="12" fill="url(#pl)" />
              <line x1="16" y1="22" x2="44" y2="22" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" opacity="0.7" />
              <line x1="16" y1="34" x2="38" y2="34" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" opacity="0.5" />
              <line x1="16" y1="46" x2="32" y2="46" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" opacity="0.35" />
              <path d="M42 19L45.5 22.5L52 15" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
            </svg>
          </div>
          <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: -0.5, color: "#1D1D1F" }}>CaseAssist</span>
        </Link>
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <Link href="/demo" style={{ fontSize: 13, fontWeight: 500, color: "#6E6E73", textDecoration: "none" }}>Request Demo</Link>
          <Link href="/login" style={{ fontSize: 13, fontWeight: 500, color: "#6E6E73", textDecoration: "none" }}>Sign In</Link>
          <Link href="/login" style={{ padding: "8px 20px", borderRadius: 100, fontSize: 13, fontWeight: 600, background: "#1D1D1F", color: "#fff", textDecoration: "none" }}>Get Started</Link>
        </div>
      </nav>

      {/* HERO */}
      <section style={{ textAlign: "center", padding: "60px 24px 20px" }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#3B5EC0", textTransform: "uppercase", letterSpacing: 2, marginBottom: 12 }}>Pricing</div>
        <h1 style={{ fontSize: "clamp(32px, 5vw, 48px)", fontWeight: 800, letterSpacing: -1.5, color: "#1D1D1F", marginBottom: 14 }}>
          Simple, transparent pricing
        </h1>
        <p style={{ fontSize: 16, color: "#6E6E73", maxWidth: 480, margin: "0 auto 28px" }}>
          Start free. Upgrade when you need more power. No hidden fees.
        </p>

        {/* Annual toggle */}
        <div style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "4px 6px", background: "#fff", borderRadius: 100, border: "1px solid var(--card-border)", marginBottom: 48 }}>
          <button onClick={() => setAnnual(false)} style={{ padding: "8px 20px", borderRadius: 100, fontSize: 13, fontWeight: 600, border: "none", background: !annual ? "#1D1D1F" : "transparent", color: !annual ? "#fff" : "#6E6E73", cursor: "pointer" }}>Monthly</button>
          <button onClick={() => setAnnual(true)} style={{ padding: "8px 20px", borderRadius: 100, fontSize: 13, fontWeight: 600, border: "none", background: annual ? "#1D1D1F" : "transparent", color: annual ? "#fff" : "#6E6E73", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
            Annual
            <span style={{ padding: "2px 8px", borderRadius: 100, fontSize: 10, fontWeight: 700, background: "#28A74510", color: "#28A745", border: "1px solid #28A74520" }}>Save 20%</span>
          </button>
        </div>
      </section>

      {/* PRICING CARDS */}
      <section style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px 60px", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20, alignItems: "start" }}>
        {PLANS.map((plan) => (
          <div key={plan.id} className="pricing-card" style={{
            padding: "32px 28px",
            background: plan.popular ? "linear-gradient(180deg, #1A1040 0%, #251A5E 50%, #2E3580 100%)" : "#fff",
            borderRadius: 20,
            border: plan.popular ? "none" : "1px solid var(--card-border)",
            position: "relative",
            color: plan.popular ? "#fff" : "#1D1D1F",
          }}>
            {plan.popular && (
              <div style={{ position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)", padding: "4px 16px", borderRadius: 100, fontSize: 11, fontWeight: 700, background: "#fff", color: "#251A5E", boxShadow: "0 2px 12px rgba(0,0,0,.1)" }}>Most Popular</div>
            )}

            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4, opacity: plan.popular ? 0.8 : 0.5 }}>{plan.name}</div>

            <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 6 }}>
              <span style={{ fontSize: 44, fontWeight: 800, letterSpacing: -2 }}>{getPrice(plan)}</span>
              {plan.price > 0 && <span style={{ fontSize: 14, opacity: 0.6 }}>{annual ? "/mo (billed annually)" : "/month"}</span>}
            </div>

            <div style={{ fontSize: 13, opacity: 0.6, marginBottom: 20, lineHeight: 1.5 }}>{plan.desc}</div>

            <button
              onClick={() => handleCheckout(plan.id)}
              disabled={loading === plan.id}
              style={{
                width: "100%",
                padding: "13px 0",
                borderRadius: 12,
                fontSize: 14,
                fontWeight: 700,
                border: plan.popular ? "none" : "1px solid var(--card-border)",
                background: plan.popular ? "#fff" : plan.id === "firm" ? "transparent" : "#1D1D1F",
                color: plan.popular ? "#251A5E" : plan.id === "firm" ? "#1D1D1F" : "#fff",
                cursor: loading === plan.id ? "wait" : "pointer",
                marginBottom: 24,
                opacity: loading === plan.id ? 0.6 : 1,
              }}
            >
              {loading === plan.id ? "Redirecting..." : plan.cta}
            </button>

            <div style={{ fontSize: 12, fontWeight: 600, opacity: 0.5, textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>
              {plan.id === "firm" ? "Everything in Pro, plus:" : "Includes:"}
            </div>

            {plan.features.map((f, i) => (
              <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "6px 0", fontSize: 13, lineHeight: 1.5 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, marginTop: 2 }}>
                  <path d="M9 12.75L11.25 15 15 9.75" stroke={plan.popular ? "#2EC4B6" : "#28A745"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span style={{ opacity: 0.85 }}>{f}</span>
              </div>
            ))}

            {plan.limits.map((f, i) => (
              <div key={"l" + i} style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "6px 0", fontSize: 13, lineHeight: 1.5, opacity: 0.4 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, marginTop: 2 }}>
                  <path d="M6 18L18 6M6 6l12 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                <span>{f}</span>
              </div>
            ))}
          </div>
        ))}
      </section>

      {/* COMPARISON TABLE */}
      <section style={{ maxWidth: 900, margin: "0 auto", padding: "40px 24px 60px" }}>
        <h2 style={{ fontSize: 24, fontWeight: 800, letterSpacing: -0.5, textAlign: "center", marginBottom: 32 }}>Compare plans in detail</h2>
        <div style={{ borderRadius: 16, border: "1px solid var(--card-border)", overflow: "hidden", background: "#fff" }}>
          {[
            { feature: "Active cases", starter: "3", pro: "Unlimited", firm: "Unlimited" },
            { feature: "AI ruling predictions", starter: true, pro: true, firm: true },
            { feature: "Five Point Check", starter: true, pro: true, firm: true },
            { feature: "Document uploads", starter: "10/case", pro: "Unlimited", firm: "Unlimited" },
            { feature: "Workflow tracking", starter: "Basic", pro: "Full 7-step", firm: "Full 7-step" },
            { feature: "Claim board (Kanban)", starter: false, pro: true, firm: true },
            { feature: "AI Tools (9 expert tools)", starter: false, pro: true, firm: true },
            { feature: "Email integration", starter: false, pro: true, firm: true },
            { feature: "CSV import/export", starter: false, pro: true, firm: true },
            { feature: "Case comparison", starter: false, pro: true, firm: true },
            { feature: "PDF export", starter: false, pro: true, firm: true },
            { feature: "Medical providers", starter: false, pro: true, firm: true },
            { feature: "Benefit calculator", starter: "Basic", pro: "Full + AWW", firm: "Full + AWW" },
            { feature: "Team members", starter: "1", pro: "1", firm: "Up to 5" },
            { feature: "Case assignment", starter: false, pro: false, firm: true },
            { feature: "Shared workspace", starter: false, pro: false, firm: true },
            { feature: "Audit log", starter: false, pro: false, firm: true },
            { feature: "Custom branding", starter: false, pro: false, firm: true },
            { feature: "Support", starter: "Community", pro: "Priority email", firm: "Dedicated + SLA" },
          ].map((row, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 100px 100px 100px", padding: "10px 20px", fontSize: 13, borderBottom: i < 18 ? "1px solid var(--g100)" : "none", background: i % 2 === 0 ? "#fff" : "var(--g50)" }}>
              <span style={{ fontWeight: 500, color: "var(--g700)" }}>{row.feature}</span>
              {["starter", "pro", "firm"].map((plan) => (
                <span key={plan} style={{ textAlign: "center", color: row[plan] === true ? "#28A745" : row[plan] === false ? "var(--g300)" : "var(--g600)", fontWeight: 500 }}>
                  {row[plan] === true ? "\u2713" : row[plan] === false ? "\u2014" : row[plan]}
                </span>
              ))}
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section style={{ maxWidth: 680, margin: "0 auto", padding: "40px 24px 80px" }}>
        <h2 style={{ fontSize: 24, fontWeight: 800, letterSpacing: -0.5, textAlign: "center", marginBottom: 32 }}>Frequently asked questions</h2>
        {FAQ.map((item, i) => (
          <div key={i} style={{ borderBottom: "1px solid var(--g100)", padding: "16px 0" }}>
            <button onClick={() => setOpenFaq(openFaq === i ? null : i)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: "var(--g800)", textAlign: "left" }}>{item.q}</span>
              <span style={{ fontSize: 18, color: "var(--g400)", transform: openFaq === i ? "rotate(45deg)" : "none", transition: "transform .2s" }}>+</span>
            </button>
            {openFaq === i && (
              <div style={{ fontSize: 13, color: "var(--g600)", lineHeight: 1.7, marginTop: 10, paddingRight: 32 }}>{item.a}</div>
            )}
          </div>
        ))}
      </section>

      {/* CTA */}
      <section style={{ padding: "60px 24px", background: "linear-gradient(135deg, #1A1040 0%, #2E3580 50%, #3B5EC0 100%)", textAlign: "center" }}>
        <h2 style={{ fontSize: "clamp(24px, 4vw, 36px)", fontWeight: 800, color: "#fff", letterSpacing: -1, marginBottom: 14 }}>Ready to transform your claims workflow?</h2>
        <p style={{ fontSize: 15, color: "rgba(255,255,255,.7)", maxWidth: 440, margin: "0 auto 28px" }}>Join professionals across Ontario who use CaseAssist to adjudicate with confidence.</p>
        <Link href="/login" style={{ display: "inline-block", padding: "14px 32px", borderRadius: 100, fontSize: 14, fontWeight: 700, background: "#fff", color: "#251A5E", textDecoration: "none" }}>Start Free Trial</Link>
      </section>

      {/* FOOTER */}
      <footer style={{ padding: "24px 32px", display: "flex", justifyContent: "space-between", alignItems: "center", maxWidth: 1200, margin: "0 auto", fontSize: 12, color: "#AEAEB2" }}>
        <span>CaseAssist</span>
        <span>Advisory tool only. Final decisions by authorized WSIB adjudicators. &copy; 2026</span>
      </footer>
    </div>
  );
}
