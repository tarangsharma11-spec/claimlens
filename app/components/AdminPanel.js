"use client";
import { useState, useEffect } from "react";
import { ROLES, DEFAULT_ROLE, FEATURES, getFeaturesByCategory } from "@/app/lib/rbac";

/**
 * AdminPanel — User management for admins.
 *
 * - View all team members
 * - Assign/change roles
 * - See which features each role unlocks
 * - Invite new users (generates invite code)
 *
 * Usage: <AdminPanel currentUser={user} onClose={() => {}} />
 */
export default function AdminPanel({ currentUser, onClose }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [previewRole, setPreviewRole] = useState(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("lawyer");
  const [inviteStatus, setInviteStatus] = useState(null);

  // Load team members from localStorage (until real DB)
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("ca_team_" + currentUser?.email) || "[]");
      // Always include current user as admin
      const hasCurrentUser = stored.some((u) => u.email === currentUser?.email);
      if (!hasCurrentUser) {
        stored.unshift({ email: currentUser?.email, name: currentUser?.name || currentUser?.email, role: "admin", plan: "firm", joinedAt: new Date().toISOString(), lastActive: new Date().toISOString() });
      }
      setUsers(stored);
    } catch { setUsers([{ email: currentUser?.email, name: currentUser?.name, role: "admin", plan: "firm", joinedAt: new Date().toISOString(), lastActive: new Date().toISOString() }]); }
    setLoading(false);
  }, [currentUser]);

  const saveUsers = (updated) => {
    setUsers(updated);
    try { localStorage.setItem("ca_team_" + currentUser?.email, JSON.stringify(updated)); } catch {}
  };

  const changeRole = (email, newRole) => {
    saveUsers(users.map((u) => u.email === email ? { ...u, role: newRole } : u));
  };

  const removeUser = (email) => {
    if (email === currentUser?.email) return;
    saveUsers(users.filter((u) => u.email !== email));
  };

  const inviteUser = () => {
    if (!inviteEmail.trim() || !inviteEmail.includes("@")) return;
    if (users.some((u) => u.email.toLowerCase() === inviteEmail.toLowerCase())) {
      setInviteStatus("User already on team");
      return;
    }
    saveUsers([...users, { email: inviteEmail.toLowerCase(), name: inviteEmail.split("@")[0], role: inviteRole, plan: "starter", joinedAt: new Date().toISOString(), lastActive: null, invited: true }]);
    setInviteStatus("Invited as " + ROLES[inviteRole].label);
    setInviteEmail("");
    setTimeout(() => setInviteStatus(null), 3000);
  };

  const roleColors = { lawyer: "#7F77DD", employer: "#1D9E75", adjudicator: "#D85A30", admin: "#1D1D1F" };

  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", backdropFilter: "blur(8px)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "#fff", borderRadius: 20, width: "100%", maxWidth: 700, boxShadow: "0 20px 60px rgba(0,0,0,.15)", maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--g100)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: -0.5 }}>Team management</div>
            <div style={{ fontSize: 12, color: "var(--g500)" }}>Assign roles to control which features each user sees</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "var(--g400)" }}>×</button>
        </div>

        <div style={{ padding: "20px 24px" }}>

          {/* Role overview cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 20 }}>
            {Object.entries(ROLES).filter(([k]) => k !== "admin").map(([key, role]) => {
              const count = users.filter((u) => u.role === key).length;
              const features = getFeaturesByCategory(key);
              const featureCount = Object.values(features).flat().length;
              return (
                <div key={key} onClick={() => setPreviewRole(previewRole === key ? null : key)} style={{ padding: "14px", background: roleColors[key] + "08", border: "1.5px solid " + roleColors[key] + (previewRole === key ? "40" : "15"), borderRadius: 14, cursor: "pointer", transition: "all .2s" }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: roleColors[key] }}>{role.label}</div>
                  <div style={{ fontSize: 11, color: "var(--g500)", marginTop: 2, lineHeight: 1.4 }}>{role.desc}</div>
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: "var(--g600)" }}>{count} user{count !== 1 ? "s" : ""}</span>
                    <span style={{ fontSize: 11, color: "var(--g400)" }}>{featureCount} features</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Feature preview for selected role */}
          {previewRole && (
            <div style={{ padding: "14px 16px", background: "var(--g50)", borderRadius: 12, marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: roleColors[previewRole], marginBottom: 8 }}>{ROLES[previewRole].label} features</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {Object.entries(getFeaturesByCategory(previewRole)).map(([cat, feats]) =>
                  feats.map((f) => (
                    <span key={f.id} style={{ padding: "3px 10px", borderRadius: 100, fontSize: 10, fontWeight: 600, color: f.category === "core" ? "var(--g600)" : roleColors[previewRole], background: f.category === "core" ? "var(--g200)" : roleColors[previewRole] + "12" }}>
                      {f.label}
                    </span>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Invite */}
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="Email address" onKeyDown={(e) => e.key === "Enter" && inviteUser()} style={{ flex: 1, padding: "10px 14px", borderRadius: 10, border: "1px solid var(--card-border)", fontSize: 13, outline: "none" }} />
            <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)} style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid var(--card-border)", fontSize: 13, outline: "none", background: "#fff" }}>
              {Object.entries(ROLES).filter(([k]) => k !== "admin").map(([key, r]) => (
                <option key={key} value={key}>{r.label}</option>
              ))}
            </select>
            <button onClick={inviteUser} style={{ padding: "10px 20px", borderRadius: 10, border: "none", background: "var(--blue)", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>Add</button>
          </div>
          {inviteStatus && <div style={{ fontSize: 12, color: "var(--green)", marginBottom: 12 }}>{inviteStatus}</div>}

          {/* User list */}
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--g500)", textTransform: "uppercase", letterSpacing: .5, marginBottom: 8 }}>Team ({users.length})</div>
          {users.map((u) => (
            <div key={u.email} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: "#fff", borderRadius: 10, border: "1px solid var(--card-border)", marginBottom: 4 }}>
              {/* Avatar */}
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: roleColors[u.role] + "15", color: roleColors[u.role], display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                {(u.name || u.email).charAt(0).toUpperCase()}
              </div>
              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--g900)" }}>
                  {u.name || u.email}
                  {u.email === currentUser?.email && <span style={{ fontSize: 10, color: "var(--g400)", marginLeft: 6 }}>(you)</span>}
                  {u.invited && <span style={{ fontSize: 10, color: "var(--orange)", marginLeft: 6 }}>Invited</span>}
                </div>
                <div style={{ fontSize: 11, color: "var(--g400)" }}>{u.email}</div>
              </div>
              {/* Role selector */}
              <select value={u.role} onChange={(e) => changeRole(u.email, e.target.value)} disabled={u.email === currentUser?.email} style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid var(--card-border)", fontSize: 11, fontWeight: 600, color: roleColors[u.role], outline: "none", background: "#fff", cursor: u.email === currentUser?.email ? "default" : "pointer" }}>
                {Object.entries(ROLES).map(([key, r]) => (
                  <option key={key} value={key}>{r.label}</option>
                ))}
              </select>
              {/* Remove */}
              {u.email !== currentUser?.email && (
                <button onClick={() => removeUser(u.email)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--g300)", fontSize: 16 }}>×</button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
