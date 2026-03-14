"use client";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

/**
 * /verify — Shown to SSO users with status 'pending_code'.
 * They authenticated with Google/Microsoft but need an access code.
 */
export default function VerifyCodePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
    if (session?.user?.status === "active") router.push("/dashboard");
  }, [session, status, router]);

  const handleVerify = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Verification failed.");
        setLoading(false);
        return;
      }
      // Force session refresh then redirect
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Something went wrong.");
      setLoading(false);
    }
  };

  if (status === "loading") {
    return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Loading...</div>;
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Plus Jakarta Sans', -apple-system, sans-serif", background: "#FAFBFC", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 420, background: "#fff", borderRadius: 20, boxShadow: "0 8px 40px rgba(0,0,0,.06)", overflow: "hidden" }}>
        <div style={{ padding: "24px 28px 16px", background: "linear-gradient(135deg, #1A1040, #3B5EC0)", color: "#fff" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <div style={{ width: 28, height: 28, borderRadius: 7, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: "#1A1040" }}>CA</span>
            </div>
            <span style={{ fontSize: 15, fontWeight: 700 }}>CaseAssist</span>
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>Almost there</h1>
          <p style={{ fontSize: 12, opacity: .7, margin: "4px 0 0" }}>
            Welcome{session?.user?.name ? `, ${session.user.name}` : ""}. One more step to activate your account.
          </p>
        </div>

        <div style={{ padding: "24px 28px 28px" }}>
          <p style={{ fontSize: 14, color: "#6E6F76", lineHeight: 1.6, marginBottom: 20 }}>
            You've signed in with {session?.user?.provider === "google" ? "Google" : session?.user?.provider === "azure-ad" ? "Microsoft" : "SSO"}.
            To complete your registration, enter the access code provided by your administrator.
          </p>

          <form onSubmit={handleVerify}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#6E6F76", marginBottom: 6 }}>Access code</label>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Enter your access code"
              required
              autoFocus
              style={{ width: "100%", padding: "12px 16px", borderRadius: 12, border: "1px solid #E0E1E6", fontSize: 15, outline: "none", fontFamily: "inherit", marginBottom: 14, letterSpacing: 1 }}
            />

            {error && (
              <div style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(255,59,48,.05)", border: "1px solid rgba(255,59,48,.1)", color: "#CC2D26", fontSize: 13, fontWeight: 500, marginBottom: 14 }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading || !code.trim()} style={{
              width: "100%", padding: 13, borderRadius: 12, border: "none",
              background: code.trim() ? (loading ? "#D2D2D7" : "linear-gradient(135deg, #1A1040, #3B5EC0)") : "#E0E1E6",
              color: code.trim() ? "#fff" : "#A0A3AB",
              fontSize: 15, fontWeight: 600, cursor: loading ? "wait" : "pointer", fontFamily: "inherit",
            }}>
              {loading ? "Verifying..." : "Activate account"}
            </button>
          </form>

          <p style={{ fontSize: 12, color: "#AEAEB2", textAlign: "center", marginTop: 14, lineHeight: 1.5 }}>
            Don't have an access code? Contact your firm administrator or email help@caseassist.ca
          </p>
        </div>
      </div>
    </div>
  );
}
