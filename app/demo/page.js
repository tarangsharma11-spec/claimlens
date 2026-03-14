"use client";
import { useState } from "react";
import Link from "next/link";

export default function DemoPage() {
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "", company: "", role: "", caseVolume: "", message: "" });
  const [step, setStep] = useState(1);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const update = (field, val) => setForm(prev => ({ ...prev, [field]: val }));

  const handleSubmit = async () => {
    setLoading(true);
    // In production, send to your CRM or email endpoint
    try {
      await fetch("/api/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: "hello@caseassist.ca",
          subject: `Demo Request: ${form.firstName} ${form.lastName} - ${form.company}`,
          body: `New demo request:\n\nName: ${form.firstName} ${form.lastName}\nEmail: ${form.email}\nPhone: ${form.phone}\nCompany: ${form.company}\nRole: ${form.role}\nMonthly Case Volume: ${form.caseVolume}\n\nMessage:\n${form.message}`,
          replyTo: form.email,
        }),
      });
    } catch (e) {
      // Silently handle - form still shows success
    }
    setLoading(false);
    setSubmitted(true);
  };

  const isStep1Valid = form.firstName && form.lastName && form.email;
  const isStep2Valid = form.company && form.role;

  return (
    <div style={{ minHeight: "100vh", background: "#F8F9FB", fontFamily: "'Plus Jakarta Sans', -apple-system, sans-serif" }}>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        *{margin:0;padding:0;box-sizing:border-box}
        input,select,textarea{font-family:'Plus Jakarta Sans',sans-serif}
        input:focus,select:focus,textarea:focus{outline:none;border-color:#3B5EC0!important;box-shadow:0 0 0 3px rgba(59,94,192,.1)}
        @keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
        .fade-up{animation:fadeUp .5s ease both}
      `}</style>

      {/* NAV */}
      <nav style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 32px", maxWidth: 1200, margin: "0 auto" }}>
        <Link href="/login" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
          <div style={{ width: 32, height: 32 }}>
            <svg width="32" height="32" viewBox="0 0 80 90" fill="none">
              <defs><linearGradient id="dl" x1="0" y1="0" x2="0.5" y2="1"><stop offset="0%" stopColor="#1A1040" /><stop offset="100%" stopColor="#2E3580" /></linearGradient></defs>
              <rect x="16" y="16" width="54" height="64" rx="12" fill="#3B5EC0" opacity="0.5" />
              <rect x="10" y="10" width="54" height="64" rx="12" fill="#2E3580" opacity="0.7" />
              <rect x="4" y="4" width="54" height="64" rx="12" fill="url(#dl)" />
              <line x1="16" y1="22" x2="44" y2="22" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" opacity="0.7" />
              <line x1="16" y1="34" x2="38" y2="34" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" opacity="0.5" />
              <line x1="16" y1="46" x2="32" y2="46" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" opacity="0.35" />
              <path d="M42 19L45.5 22.5L52 15" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
            </svg>
          </div>
          <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: -0.5, color: "#1D1D1F" }}>CaseAssist</span>
        </Link>
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <Link href="/pricing" style={{ fontSize: 13, fontWeight: 500, color: "#6E6E73", textDecoration: "none" }}>Pricing</Link>
          <Link href="/login" style={{ fontSize: 13, fontWeight: 500, color: "#6E6E73", textDecoration: "none" }}>Sign In</Link>
        </div>
      </nav>

      {/* HERO SECTION */}
      <section style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 24px 80px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 48, alignItems: "start" }}>

          {/* LEFT — Value Prop */}
          <div style={{ paddingTop: 20 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 14px", borderRadius: 100, background: "rgba(59,94,192,.06)", border: "1px solid rgba(59,94,192,.12)", marginBottom: 20 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#3B5EC0" }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: "#3B5EC0" }}>AI-Powered WSIB Claims Intelligence</span>
            </div>

            <h1 style={{ fontSize: "clamp(32px, 4vw, 44px)", fontWeight: 800, letterSpacing: -1.5, color: "#1D1D1F", lineHeight: 1.15, marginBottom: 16 }}>
              See how CaseAssist can transform your claims workflow
            </h1>

            <p style={{ fontSize: 16, color: "#6E6E73", lineHeight: 1.7, marginBottom: 32, maxWidth: 440 }}>
              Get a personalized walkthrough of our AI-powered platform. See how the Five Point Check automation, OPM policy reference, and smart workflow engine can save your team hours per claim.
            </p>

            {/* Social proof */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {[
                { stat: "60%", label: "faster claim review time" },
                { stat: "289", label: "OPM policies built into the AI" },
                { stat: "9", label: "AI-powered expert analysis tools" },
                { stat: "100%", label: "PIPEDA compliant with PII redaction" },
              ].map((item, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 48, height: 48, borderRadius: 12, background: "linear-gradient(135deg, #1A1040, #3B5EC0)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <span style={{ color: "#fff", fontSize: 14, fontWeight: 800 }}>{item.stat}</span>
                  </div>
                  <span style={{ fontSize: 14, color: "#3E3F44", fontWeight: 500 }}>{item.label}</span>
                </div>
              ))}
            </div>

            {/* Trusted by */}
            <div style={{ marginTop: 40, paddingTop: 24, borderTop: "1px solid #E0E1E6" }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#A0A1A8", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 12 }}>Built for</div>
              <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
                {["Injury Lawyers", "HR Professionals", "Claims Adjudicators", "TPAs", "Injured Workers"].map((role, i) => (
                  <span key={i} style={{ fontSize: 13, fontWeight: 500, color: "#6E6F76", padding: "4px 12px", borderRadius: 100, background: "#fff", border: "1px solid #E0E1E6" }}>{role}</span>
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT — Form */}
          <div style={{ background: "#fff", borderRadius: 20, boxShadow: "0 4px 32px rgba(0,0,0,.06)", border: "1px solid rgba(0,0,0,.06)", overflow: "hidden" }}>
            {/* Form header */}
            <div style={{ padding: "24px 28px 0", borderBottom: submitted ? "none" : "1px solid #F0F1F3" }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: "#1D1D1F", letterSpacing: -0.5, marginBottom: 4 }}>
                {submitted ? "Thank you!" : "Request a Demo"}
              </div>
              {!submitted && (
                <div style={{ fontSize: 13, color: "#6E6E73", marginBottom: 16 }}>
                  Fill out the form and our team will reach out within 24 hours.
                </div>
              )}
              {!submitted && (
                <div style={{ display: "flex", gap: 4, marginBottom: -1 }}>
                  {[1, 2].map(s => (
                    <div key={s} style={{ flex: 1, height: 3, borderRadius: 2, background: step >= s ? "linear-gradient(90deg, #1A1040, #3B5EC0)" : "#E0E1E6", transition: "background .3s" }} />
                  ))}
                </div>
              )}
            </div>

            <div className="fade-up" key={submitted ? "done" : step} style={{ padding: "24px 28px 28px" }}>
              {submitted ? (
                /* Success state */
                <div style={{ textAlign: "center", padding: "20px 0" }}>
                  <div style={{ width: 56, height: 56, borderRadius: "50%", background: "linear-gradient(135deg, #1A1040, #3B5EC0)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                    <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="#fff" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "#1D1D1F", marginBottom: 8 }}>Demo request received!</div>
                  <div style={{ fontSize: 14, color: "#6E6E73", lineHeight: 1.6, marginBottom: 24 }}>
                    We'll be in touch at <strong>{form.email}</strong> within 24 hours to schedule your personalized demo.
                  </div>
                  <div style={{ padding: "16px", background: "#F8F9FB", borderRadius: 12, textAlign: "left", marginBottom: 20 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#3E3F44", marginBottom: 8 }}>In the meantime:</div>
                    {[
                      { text: "Start with a free account", href: "/login" },
                      { text: "Explore our pricing plans", href: "/pricing" },
                      { text: "View the OPM policy reference", href: "/login" },
                    ].map((link, i) => (
                      <Link key={i} href={link.href} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#3B5EC0", fontWeight: 500, textDecoration: "none", padding: "6px 0" }}>
                        <span>→</span> {link.text}
                      </Link>
                    ))}
                  </div>
                </div>
              ) : step === 1 ? (
                /* Step 1: Contact info */
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                    <div>
                      <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#3E3F44", marginBottom: 6 }}>First name*</label>
                      <input value={form.firstName} onChange={e => update("firstName", e.target.value)} placeholder="John" style={{ width: "100%", padding: "11px 14px", borderRadius: 10, border: "1px solid #E0E1E6", fontSize: 14, color: "#1D1D1F" }} />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#3E3F44", marginBottom: 6 }}>Last name*</label>
                      <input value={form.lastName} onChange={e => update("lastName", e.target.value)} placeholder="Smith" style={{ width: "100%", padding: "11px 14px", borderRadius: 10, border: "1px solid #E0E1E6", fontSize: 14, color: "#1D1D1F" }} />
                    </div>
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#3E3F44", marginBottom: 6 }}>Work email*</label>
                    <input value={form.email} onChange={e => update("email", e.target.value)} type="email" placeholder="you@yourfirm.com" style={{ width: "100%", padding: "11px 14px", borderRadius: 10, border: "1px solid #E0E1E6", fontSize: 14, color: "#1D1D1F" }} />
                  </div>
                  <div style={{ marginBottom: 20 }}>
                    <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#3E3F44", marginBottom: 6 }}>Phone number</label>
                    <input value={form.phone} onChange={e => update("phone", e.target.value)} type="tel" placeholder="(555) 123-4567" style={{ width: "100%", padding: "11px 14px", borderRadius: 10, border: "1px solid #E0E1E6", fontSize: 14, color: "#1D1D1F" }} />
                  </div>
                  <button onClick={() => setStep(2)} disabled={!isStep1Valid} style={{ width: "100%", padding: "13px", borderRadius: 12, fontSize: 14, fontWeight: 700, border: "none", background: isStep1Valid ? "linear-gradient(135deg, #1A1040, #3B5EC0)" : "#E0E1E6", color: isStep1Valid ? "#fff" : "#A0A1A8", cursor: isStep1Valid ? "pointer" : "default", transition: "all .2s" }}>
                    Next Step
                  </button>
                </>
              ) : (
                /* Step 2: Company info */
                <>
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#3E3F44", marginBottom: 6 }}>Company / Firm name*</label>
                    <input value={form.company} onChange={e => update("company", e.target.value)} placeholder="Your firm or organization" style={{ width: "100%", padding: "11px 14px", borderRadius: 10, border: "1px solid #E0E1E6", fontSize: 14, color: "#1D1D1F" }} />
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#3E3F44", marginBottom: 6 }}>Your role*</label>
                    <select value={form.role} onChange={e => update("role", e.target.value)} style={{ width: "100%", padding: "11px 14px", borderRadius: 10, border: "1px solid #E0E1E6", fontSize: 14, color: form.role ? "#1D1D1F" : "#A0A1A8", background: "#fff", appearance: "none" }}>
                      <option value="">Select your role</option>
                      <option value="Injury Lawyer / Paralegal">Injury Lawyer / Paralegal</option>
                      <option value="Claims Adjudicator">Claims Adjudicator</option>
                      <option value="HR Manager / Director">HR Manager / Director</option>
                      <option value="TPA Administrator">TPA Administrator</option>
                      <option value="Injured Worker">Injured Worker</option>
                      <option value="Health Care Provider">Health Care Provider</option>
                      <option value="Employer / Business Owner">Employer / Business Owner</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#3E3F44", marginBottom: 6 }}>Monthly WSIB case volume</label>
                    <select value={form.caseVolume} onChange={e => update("caseVolume", e.target.value)} style={{ width: "100%", padding: "11px 14px", borderRadius: 10, border: "1px solid #E0E1E6", fontSize: 14, color: form.caseVolume ? "#1D1D1F" : "#A0A1A8", background: "#fff", appearance: "none" }}>
                      <option value="">Select volume</option>
                      <option value="1-5">1-5 cases/month</option>
                      <option value="6-20">6-20 cases/month</option>
                      <option value="21-50">21-50 cases/month</option>
                      <option value="51-100">51-100 cases/month</option>
                      <option value="100+">100+ cases/month</option>
                    </select>
                  </div>
                  <div style={{ marginBottom: 20 }}>
                    <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#3E3F44", marginBottom: 6 }}>Anything specific you'd like to see?</label>
                    <textarea value={form.message} onChange={e => update("message", e.target.value)} placeholder="Tell us about your workflow, pain points, or specific features you're interested in..." rows={3} style={{ width: "100%", padding: "11px 14px", borderRadius: 10, border: "1px solid #E0E1E6", fontSize: 14, color: "#1D1D1F", resize: "vertical", minHeight: 80 }} />
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => setStep(1)} style={{ padding: "13px 20px", borderRadius: 12, fontSize: 14, fontWeight: 600, border: "1px solid #E0E1E6", background: "#fff", color: "#6E6E73", cursor: "pointer" }}>
                      Back
                    </button>
                    <button onClick={handleSubmit} disabled={!isStep2Valid || loading} style={{ flex: 1, padding: "13px", borderRadius: 12, fontSize: 14, fontWeight: 700, border: "none", background: isStep2Valid ? "linear-gradient(135deg, #1A1040, #3B5EC0)" : "#E0E1E6", color: isStep2Valid ? "#fff" : "#A0A1A8", cursor: isStep2Valid && !loading ? "pointer" : "default", transition: "all .2s" }}>
                      {loading ? "Submitting..." : "Request Demo"}
                    </button>
                  </div>
                </>
              )}

              {!submitted && (
                <div style={{ marginTop: 16, fontSize: 11, color: "#A0A1A8", lineHeight: 1.5, textAlign: "center" }}>
                  By submitting, you agree to our{" "}
                  <a href="#" style={{ color: "#6E6E73", textDecoration: "underline" }}>Terms of Service</a>{" "}and{" "}
                  <a href="#" style={{ color: "#6E6E73", textDecoration: "underline" }}>Privacy Policy</a>.
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* WHAT YOU'LL SEE */}
      <section style={{ maxWidth: 900, margin: "0 auto", padding: "0 24px 80px" }}>
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#3B5EC0", textTransform: "uppercase", letterSpacing: 2, marginBottom: 8 }}>What to Expect</div>
          <h2 style={{ fontSize: 28, fontWeight: 800, letterSpacing: -0.8, color: "#1D1D1F" }}>Your personalized demo includes</h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          {[
            { num: "1", title: "Platform Walkthrough", desc: "See the full dashboard, case management workflow, and Kanban board in action with real sample data.", time: "15 min" },
            { num: "2", title: "AI Analysis Demo", desc: "Watch the Five Point Check analyze a sample claim in real-time, with OPM policy citations and ruling prediction.", time: "10 min" },
            { num: "3", title: "Your Questions", desc: "Discuss your specific workflow, integration needs, team size, and how CaseAssist fits your practice.", time: "5 min" },
          ].map((item, i) => (
            <div key={i} style={{ padding: "24px 20px", background: "#fff", borderRadius: 16, border: "1px solid rgba(0,0,0,.06)", boxShadow: "0 1px 3px rgba(0,0,0,.04)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, #1A1040, #3B5EC0)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 14, fontWeight: 800 }}>{item.num}</div>
                <span style={{ fontSize: 11, fontWeight: 600, color: "#A0A1A8", padding: "3px 8px", borderRadius: 100, background: "#F8F9FB" }}>{item.time}</span>
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#1D1D1F", marginBottom: 6 }}>{item.title}</div>
              <div style={{ fontSize: 13, color: "#6E6E73", lineHeight: 1.55 }}>{item.desc}</div>
            </div>
          ))}
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
