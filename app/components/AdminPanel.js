"use client";
import { useState, useEffect } from "react";
import { ROLES, FEATURES, getFeaturesByCategory } from "@/app/lib/rbac";

const PLAN_DETAILS = {
  starter: { label: "Starter", price: "Free", seats: 1, color: "#86868B" },
  pro: { label: "Pro", price: "$79/mo", seats: 5, color: "#0071E3" },
  firm: { label: "Firm", price: "$299/mo", seats: 25, color: "#1A1040" },
};

export default function AdminPanel({ currentUser, onClose }) {
  const [org, setOrg] = useState(null);
  const [members, setMembers] = useState([]);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("team");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState("lawyer");
  const [inviteStatus, setInviteStatus] = useState(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [editingMember, setEditingMember] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/org");
        const data = await res.json();
        if (data.org) setOrg(data.org);
        if (data.members) setMembers(data.members);
        if (data.activity) setActivity(data.activity);
      } catch (err) {
        console.log("Failed to load org:", err.message);
      }
      setLoading(false);
    }
    load();
  }, []);

  const plan = PLAN_DETAILS[org?.plan] || PLAN_DETAILS.starter;
  const activeMembers = members.filter((m) => m.status !== "disabled");
  const seatsUsed = activeMembers.length;
  const seatsMax = org?.max_seats || plan.seats;
  const seatsRemaining = seatsMax - seatsUsed;

  const handleInvite = async () => {
    if (!inviteEmail || !inviteEmail.includes("@")) {
      setInviteStatus({ type: "error", msg: "Enter a valid email address." });
      return;
    }
    if (seatsRemaining <= 0) {
      setInviteStatus({ type: "error", msg: `No seats remaining (${seatsUsed}/${seatsMax}). Upgrade your plan.` });
      return;
    }
    if (members.some((m) => m.user_email.toLowerCase() === inviteEmail.toLowerCase())) {
      setInviteStatus({ type: "error", msg: "This person is already a member." });
      return;
    }

    setInviteLoading(true);
    setInviteStatus(null);
    try {
      const res = await fetch("/api/org/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail.trim(), name: inviteName.trim() || inviteEmail.trim(), role: inviteRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Invite failed");

      // Send invite email
      try {
        await fetch("/api/email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: inviteEmail.trim(),
            subject: `You've been invited to ${org?.name || "CaseAssist"}`,
            body: `Hi ${inviteName.trim() || inviteEmail.split("@")[0]},\n\n${currentUser?.name || currentUser?.email} has invited you to join ${org?.name || "CaseAssist"} as a ${inviteRole}.\n\nSign up at https://www.caseassist.ca/login to get started.\n\nAccess code: CASEASSIST2026\n\nYou can also sign in with Google if your admin used this email address for the invitation.\n\n— CaseAssist`,
            senderName: currentUser?.name || "CaseAssist",
            senderEmail: currentUser?.email,
          }),
        });
      } catch {}

      setMembers((p) => [...p, data.member]);
      setInviteEmail("");
      setInviteName("");
      setInviteStatus({ type: "success", msg: `Invitation sent to ${inviteEmail}` });
    } catch (err) {
      setInviteStatus({ type: "error", msg: err.message });
    }
    setInviteLoading(false);
  };

  const handleRoleChange = async (email, newRole) => {
    try {
      const res = await fetch("/api/org/members", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role: newRole }),
      });
      if (res.ok) {
        setMembers((p) => p.map((m) => (m.user_email === email ? { ...m, role: newRole } : m)));
        setEditingMember(null);
      }
    } catch {}
  };

  const handleRemove = async (email, name) => {
    if (!confirm(`Remove ${name || email} from the organization?`)) return;
    try {
      const res = await fetch(`/api/org/members?email=${encodeURIComponent(email)}`, { method: "DELETE" });
      if (res.ok) setMembers((p) => p.filter((m) => m.user_email !== email));
    } catch {}
  };

  const s = {
    overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", backdropFilter: "blur(8px)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 },
    panel: { background: "#fff", borderRadius: 20, width: "100%", maxWidth: 640, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,.15)", animation: "scaleIn .3s ease" },
    header: { padding: "20px 24px", background: "linear-gradient(135deg, #1A1040, #3B5EC0)", color: "#fff", borderRadius: "20px 20px 0 0" },
    tab: (active) => ({ padding: "8px 16px", borderRadius: 8, border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer", background: active ? "rgba(255,255,255,.2)" : "transparent", color: active ? "#fff" : "rgba(255,255,255,.6)" }),
    body: { padding: "20px 24px" },
    input: { width: "100%", padding: "10px 14px", borderRadius: 12, border: "1px solid #E0E1E6", fontSize: 14, outline: "none", fontFamily: "inherit", marginBottom: 10 },
    select: { padding: "10px 14px", borderRadius: 12, border: "1px solid #E0E1E6", fontSize: 14, outline: "none", fontFamily: "inherit", background: "#fff" },
    btn: (primary) => ({ padding: "10px 20px", borderRadius: 12, border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer", background: primary ? "#0071E3" : "#F5F5F7", color: primary ? "#fff" : "#3D3F47", fontFamily: "inherit" }),
    badge: (color) => ({ display: "inline-block", padding: "3px 10px", borderRadius: 100, fontSize: 11, fontWeight: 600, background: color + "12", color }),
  };

  if (loading) return <div style={s.overlay}><div style={s.panel}><div style={{ padding: 40, textAlign: "center", color: "#86868B" }}>Loading...</div></div></div>;

  return (
    <div style={s.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={s.panel}>
        {/* Header */}
        <div style={s.header}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>{org?.name || "Organization"}</h2>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                <span style={{ fontSize: 12, padding: "3px 10px", borderRadius: 100, background: "rgba(255,255,255,.15)", fontWeight: 600 }}>{plan.label} plan</span>
                <span style={{ fontSize: 12, opacity: .7 }}>{seatsUsed} / {seatsMax} seats</span>
              </div>
            </div>
            <button onClick={onClose} style={{ background: "none", border: "none", color: "rgba(255,255,255,.7)", fontSize: 22, cursor: "pointer", padding: "0 4px" }}>×</button>
          </div>
          <div style={{ display: "flex", gap: 4, marginTop: 16 }}>
            {["team", "invite", "plan", "activity"].map((t) => (
              <button key={t} onClick={() => setTab(t)} style={s.tab(tab === t)}>{t === "team" ? "Team" : t === "invite" ? "Invite" : t === "plan" ? "Plan" : "Activity"}</button>
            ))}
          </div>
        </div>

        <div style={s.body}>
          {/* === TEAM TAB === */}
          {tab === "team" && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#86868B", marginBottom: 12, textTransform: "uppercase", letterSpacing: .5 }}>
                {activeMembers.length} member{activeMembers.length !== 1 ? "s" : ""} · {seatsRemaining} seat{seatsRemaining !== 1 ? "s" : ""} remaining
              </div>
              {members.map((m) => (
                <div key={m.user_email} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: "1px solid #F0F0F2" }}>
                  <div style={{ width: 36, height: 36, borderRadius: "50%", background: m.role === "admin" ? "#1A1040" : "#E8EAEF", display: "flex", alignItems: "center", justifyContent: "center", color: m.role === "admin" ? "#fff" : "#6E6F76", fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
                    {(m.user_name || m.user_email)?.[0]?.toUpperCase() || "?"}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#1D1D1F", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.user_name || m.user_email}</div>
                    <div style={{ fontSize: 12, color: "#86868B" }}>{m.user_email}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                    {m.status === "invited" && <span style={s.badge("#EF9F27")}>Invited</span>}
                    {editingMember === m.user_email ? (
                      <select value={m.role} onChange={(e) => handleRoleChange(m.user_email, e.target.value)} onBlur={() => setEditingMember(null)} autoFocus style={s.select}>
                        <option value="lawyer">Lawyer</option>
                        <option value="employer">Employer</option>
                        <option value="adjudicator">Adjudicator</option>
                        <option value="admin">Admin</option>
                      </select>
                    ) : (
                      <button onClick={() => m.user_email !== currentUser?.email && setEditingMember(m.user_email)} style={{ ...s.badge(ROLES[m.role]?.color || "#86868B"), cursor: m.user_email === currentUser?.email ? "default" : "pointer" }}>
                        {ROLES[m.role]?.label || m.role}
                      </button>
                    )}
                    {m.user_email !== currentUser?.email && (
                      <button onClick={() => handleRemove(m.user_email, m.user_name)} style={{ background: "none", border: "none", cursor: "pointer", color: "#CC2D26", fontSize: 16, padding: "2px 4px" }}>×</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* === INVITE TAB === */}
          {tab === "invite" && (
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Invite a team member</div>
              <div style={{ fontSize: 12, color: "#86868B", marginBottom: 16 }}>
                {seatsRemaining > 0
                  ? `You have ${seatsRemaining} seat${seatsRemaining !== 1 ? "s" : ""} remaining on your ${plan.label} plan.`
                  : `No seats remaining. Upgrade to ${org?.plan === "pro" ? "Firm" : "Pro"} for more.`}
              </div>

              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#6E6F76", marginBottom: 4 }}>Email address</label>
              <input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="jane@acmelaw.com" style={s.input} />

              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#6E6F76", marginBottom: 4 }}>Name (optional)</label>
              <input value={inviteName} onChange={(e) => setInviteName(e.target.value)} placeholder="Jane Smith" style={s.input} />

              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#6E6F76", marginBottom: 4 }}>Role</label>
              <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
                {["lawyer", "employer", "adjudicator", "admin"].map((r) => (
                  <button key={r} onClick={() => setInviteRole(r)} style={{ padding: "8px 14px", borderRadius: 10, border: inviteRole === r ? "2px solid #0071E3" : "1px solid #E0E1E6", background: inviteRole === r ? "rgba(0,113,227,.04)" : "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", color: inviteRole === r ? "#0071E3" : "#6E6F76", fontFamily: "inherit" }}>
                    {ROLES[r]?.label || r}
                  </button>
                ))}
              </div>

              {inviteStatus && (
                <div style={{ padding: "10px 14px", borderRadius: 10, marginBottom: 12, background: inviteStatus.type === "success" ? "rgba(40,167,69,.05)" : "rgba(255,59,48,.05)", border: "1px solid " + (inviteStatus.type === "success" ? "rgba(40,167,69,.12)" : "rgba(255,59,48,.1)"), color: inviteStatus.type === "success" ? "#28A745" : "#CC2D26", fontSize: 13, fontWeight: 500 }}>
                  {inviteStatus.msg}
                </div>
              )}

              <button onClick={handleInvite} disabled={inviteLoading || seatsRemaining <= 0} style={{ ...s.btn(true), width: "100%", opacity: seatsRemaining <= 0 ? .5 : 1 }}>
                {inviteLoading ? "Sending invite..." : "Send invite"}
              </button>

              <div style={{ fontSize: 12, color: "#A0A3AB", marginTop: 12, lineHeight: 1.5 }}>
                The invited user will receive an email with signup instructions. They can sign in with email/password using access code <strong>CASEASSIST2026</strong>, or use Google SSO if you invite their Google email.
              </div>
            </div>
          )}

          {/* === PLAN TAB === */}
          {tab === "plan" && (
            <div>
              <div style={{ padding: 20, borderRadius: 16, border: "2px solid " + plan.color + "20", background: plan.color + "06", marginBottom: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: "#1D1D1F" }}>{plan.label}</div>
                    <div style={{ fontSize: 24, fontWeight: 800, color: plan.color, marginTop: 4 }}>{plan.price}</div>
                  </div>
                  <span style={s.badge(plan.color)}>Current plan</span>
                </div>
                <div style={{ marginTop: 16, fontSize: 13, color: "#6E6F76", lineHeight: 1.7 }}>
                  <div><strong>Seats:</strong> {seatsUsed} of {seatsMax} used</div>
                  <div><strong>Cases:</strong> {org?.plan === "starter" ? "Up to 3 active" : "Unlimited"}</div>
                  <div><strong>AI analysis:</strong> {org?.plan === "starter" ? "5/month" : "Unlimited"}</div>
                  <div><strong>Document storage:</strong> {org?.plan === "firm" ? "Unlimited" : org?.plan === "pro" ? "10 GB" : "1 GB"}</div>
                  <div><strong>API access:</strong> {org?.plan === "firm" ? "Yes" : "No"}</div>
                </div>
                {/* Seat usage bar */}
                <div style={{ marginTop: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 600, color: "#86868B", marginBottom: 4 }}>
                    <span>Seat usage</span>
                    <span>{seatsUsed}/{seatsMax}</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 3, background: "#E8EAEF" }}>
                    <div style={{ height: "100%", borderRadius: 3, background: seatsUsed >= seatsMax ? "#E53935" : plan.color, width: Math.min(100, (seatsUsed / seatsMax) * 100) + "%", transition: "width .3s" }} />
                  </div>
                </div>
              </div>

              {/* Plan comparison */}
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: "#6E6F76" }}>Compare plans</div>
              <div style={{ display: "flex", gap: 8 }}>
                {Object.entries(PLAN_DETAILS).map(([key, p]) => (
                  <div key={key} style={{ flex: 1, padding: "14px", borderRadius: 12, border: key === org?.plan ? "2px solid " + p.color : "1px solid #E0E1E6", background: key === org?.plan ? p.color + "06" : "#fff", textAlign: "center" }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#1D1D1F" }}>{p.label}</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: p.color, marginTop: 2 }}>{p.price}</div>
                    <div style={{ fontSize: 11, color: "#86868B", marginTop: 4 }}>{p.seats} seat{p.seats !== 1 ? "s" : ""}</div>
                    {key !== org?.plan && key !== "starter" && (
                      <button onClick={() => window.open("/pricing", "_blank")} style={{ marginTop: 8, padding: "6px 12px", borderRadius: 8, border: "1px solid " + p.color + "40", background: "transparent", color: p.color, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Upgrade</button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* === ACTIVITY TAB === */}
          {tab === "activity" && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#86868B", marginBottom: 12, textTransform: "uppercase", letterSpacing: .5 }}>Recent activity</div>
              {activity.length === 0 && <div style={{ padding: 24, textAlign: "center", color: "#A0A3AB", fontSize: 14 }}>No activity yet</div>}
              {activity.slice(0, 30).map((a, i) => (
                <div key={i} style={{ padding: "10px 0", borderBottom: "1px solid #F0F0F2", display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: a.action.includes("created") ? "#28A745" : a.action.includes("deleted") ? "#E53935" : "#0071E3", flexShrink: 0, marginTop: 6 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, color: "#3D3F47" }}>{a.detail || a.action}</div>
                    <div style={{ fontSize: 11, color: "#A0A3AB", marginTop: 2 }}>{a.user_email} · {new Date(a.created_at).toLocaleString()}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
