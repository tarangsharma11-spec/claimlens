"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

function ResetForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const email = searchParams.get("email") || "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (password !== confirm) { setError("Passwords don't match."); return; }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, token, newPassword: password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Reset failed."); setLoading(false); return; }
      setSuccess(true);
      setTimeout(() => router.push("/login"), 3000);
    } catch {
      setError("Something went wrong.");
      setLoading(false);
    }
  };

  if (!token || !email) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Plus Jakarta Sans', -apple-system, sans-serif", background: "#FAFBFC", padding: 20 }}>
        <div style={{ textAlign: "center", maxWidth: 400 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>Invalid reset link</h1>
          <p style={{ fontSize: 14, color: "#86868B", marginBottom: 20 }}>This password reset link is missing required parameters. Please request a new one from the login page.</p>
          <a href="/login" style={{ display: "inline-block", padding: "12px 28px", background: "#0071E3", color: "#fff", borderRadius: 12, fontSize: 14, fontWeight: 600, textDecoration: "none" }}>Back to login</a>
        </div>
      </div>
    );
  }

  const inp = { width: "100%", padding: "12px 16px", borderRadius: 12, border: "1px solid #E0E1E6", fontSize: 15, outline: "none", fontFamily: "inherit", marginBottom: 14 };

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
          <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>Set your new password</h1>
          <p style={{ fontSize: 12, opacity: .7, margin: "4px 0 0" }}>For {email}</p>
        </div>

        <div style={{ padding: "24px 28px 28px" }}>
          {success ? (
            <div style={{ textAlign: "center", padding: "16px 0" }}>
              <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#E8F5E9", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px", fontSize: 22 }}>✓</div>
              <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Password updated</h2>
              <p style={{ fontSize: 13, color: "#86868B" }}>Redirecting you to sign in...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#6E6F76", marginBottom: 6 }}>New password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" required minLength={8} style={inp} />

              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#6E6F76", marginBottom: 6 }}>Confirm password</label>
              <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Re-enter your password" required minLength={8} style={inp} />

              {error && <div style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(255,59,48,.05)", border: "1px solid rgba(255,59,48,.1)", color: "#CC2D26", fontSize: 13, fontWeight: 500, marginBottom: 14 }}>{error}</div>}

              <button type="submit" disabled={loading} style={{ width: "100%", padding: 13, borderRadius: 12, border: "none", background: loading ? "#D2D2D7" : "#0071E3", color: "#fff", fontSize: 15, fontWeight: 600, cursor: loading ? "wait" : "pointer", fontFamily: "inherit" }}>
                {loading ? "Updating..." : "Set new password"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>Loading...</div>}>
      <ResetForm />
    </Suspense>
  );
}
