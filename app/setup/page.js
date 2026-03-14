"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * OrgSetup — Shown when user has no organization.
 *
 * Two paths:
 * 1. Create new org (becomes admin)
 * 2. Already invited — org auto-resolves from membership on login
 *
 * After org is created/joined, redirects to /dashboard.
 */
export default function OrgSetup({ user }) {
  const router = useRouter();
  const [orgName, setOrgName] = useState("");
  const [plan, setPlan] = useState("starter");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [checking, setChecking] = useState(true);

  // Check if user already has an org (invited users)
  useEffect(() => {
    async function check() {
      try {
        const res = await fetch("/api/org");
        const data = await res.json();
        if (data.org) {
          // User already belongs to an org — go to dashboard
          router.push("/dashboard");
          return;
        }
      } catch {}
      setChecking(false);
    }
    check();
  }, [router]);

  const handleCreate = async () => {
    if (!orgName.trim()) { setError("Organization name is required"); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/org", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: orgName.trim(), plan }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create organization");
      router.push("/dashboard");
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Plus Jakarta Sans', -apple-system, sans-serif" }}>
        <div style={{ textAlign: "center", color: "#86868B" }}>Loading...</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Plus Jakarta Sans', -apple-system, sans-serif", background: "#FAFAFA", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 480, background: "#fff", borderRadius: 20, boxShadow: "0 8px 40px rgba(0,0,0,.06)", overflow: "hidden" }}>
        {/* Header */}
        <div style={{ padding: "28px 32px 20px", background: "linear-gradient(135deg, #1A1040, #3B5EC0)", color: "#fff" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: "#1A1040" }}>CA</span>
            </div>
            <span style={{ fontSize: 17, fontWeight: 700 }}>CaseAssist</span>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.5, margin: 0 }}>Set up your organization</h1>
          <p style={{ fontSize: 13, opacity: .7, margin: "6px 0 0", lineHeight: 1.5 }}>
            Welcome{user?.name ? `, ${user.name}` : ""}. Create your team workspace to start managing claims.
          </p>
        </div>

        <div style={{ padding: "24px 32px 32px" }}>
          {/* Org name */}
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#6E6F76", marginBottom: 6 }}>Organization name</label>
          <input
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            placeholder="e.g. Smith & Associates, Acme HR, TPA Solutions"
            autoFocus
            style={{ width: "100%", padding: "12px 16px", borderRadius: 12, border: "1px solid #E0E1E6", fontSize: 15, outline: "none", fontFamily: "inherit", marginBottom: 16 }}
          />

          {/* Plan selection */}
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#6E6F76", marginBottom: 8 }}>Select a plan</label>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 20 }}>
            {[
              { id: "starter", name: "Starter", price: "Free", desc: "3 cases, 1 user", seats: 1 },
              { id: "pro", name: "Pro", price: "$79/mo", desc: "Unlimited cases, 5 users", seats: 5 },
              { id: "firm", name: "Firm", price: "$299/mo", desc: "Unlimited cases, 25 users", seats: 25 },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => setPlan(p.id)}
                style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "14px 16px", borderRadius: 12,
                  border: plan === p.id ? "2px solid #3B5EC0" : "1px solid #E0E1E6",
                  background: plan === p.id ? "rgba(59,94,192,.03)" : "#fff",
                  cursor: "pointer", textAlign: "left", fontFamily: "inherit",
                }}
              >
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#1D1D1F" }}>{p.name}</div>
                  <div style={{ fontSize: 12, color: "#86868B", marginTop: 1 }}>{p.desc}</div>
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: plan === p.id ? "#3B5EC0" : "#86868B" }}>{p.price}</div>
              </button>
            ))}
          </div>

          {error && (
            <div style={{ padding: "10px 14px", background: "#FFF0F0", border: "1px solid #FFD4D4", borderRadius: 10, fontSize: 13, color: "#E53935", marginBottom: 14 }}>
              {error}
            </div>
          )}

          <button
            onClick={handleCreate}
            disabled={loading || !orgName.trim()}
            style={{
              width: "100%", padding: 14, borderRadius: 12, border: "none",
              fontSize: 15, fontWeight: 700, cursor: loading ? "default" : "pointer",
              background: orgName.trim() ? "linear-gradient(135deg, #1A1040, #3B5EC0)" : "#E0E1E6",
              color: orgName.trim() ? "#fff" : "#A0A3AB",
              fontFamily: "inherit",
            }}
          >
            {loading ? "Creating..." : "Create organization"}
          </button>

          <p style={{ fontSize: 12, color: "#A0A3AB", textAlign: "center", marginTop: 14, lineHeight: 1.5 }}>
            If you've been invited to an existing org, it should connect automatically when you log in.
            Contact your admin if you're not seeing your team's workspace.
          </p>
        </div>
      </div>
    </div>
  );
}
