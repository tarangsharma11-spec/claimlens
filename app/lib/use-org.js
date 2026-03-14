"use client";
import { useState, useEffect, useCallback } from "react";

/**
 * useOrg — Fetches the current user's organization, membership, and members.
 *
 * Returns: { org, membership, members, activity, loading, error, refresh, createOrg, updateMember, inviteMember, removeMember }
 */
export function useOrg() {
  const [data, setData] = useState({ org: null, membership: null, members: [], activity: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/org");
      const json = await res.json();
      if (res.ok) setData(json);
      else setError(json.error);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const createOrg = async (name, plan) => {
    const res = await fetch("/api/org", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, plan }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error);
    await refresh();
    return json;
  };

  const inviteMember = async (email, name, role) => {
    const res = await fetch("/api/org/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, name, role }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error);
    await refresh();
    return json.member;
  };

  const updateMember = async (email, updates) => {
    const res = await fetch("/api/org/members", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, ...updates }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error);
    await refresh();
    return json.member;
  };

  const removeMember = async (email) => {
    const res = await fetch(`/api/org/members?email=${encodeURIComponent(email)}`, { method: "DELETE" });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error);
    await refresh();
  };

  return {
    org: data.org,
    membership: data.membership,
    members: data.members,
    activity: data.activity,
    loading,
    error,
    refresh,
    createOrg,
    inviteMember,
    updateMember,
    removeMember,
    userRole: data.membership?.role || "lawyer",
    orgId: data.membership?.org_id || null,
  };
}

/**
 * useOrgClaims — Fetches claims scoped to the user's org from Postgres.
 *
 * Returns: { claims, loading, error, refresh, saveClaim, createClaim, deleteClaim }
 */
export function useOrgClaims() {
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/org/claims");
      const json = await res.json();
      if (res.ok) setClaims(json.claims || []);
      else setError(json.error);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const createClaim = async (claimData) => {
    const res = await fetch("/api/org/claims", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(claimData),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error);
    setClaims((p) => [json.claim, ...p]);
    return json.claim;
  };

  const saveClaim = async (claimData) => {
    const res = await fetch("/api/org/claims", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(claimData),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error);
    setClaims((p) => p.map((c) => c.id === json.claim.id ? json.claim : c));
    return json.claim;
  };

  const deleteClaim = async (id) => {
    const res = await fetch(`/api/org/claims?id=${id}`, { method: "DELETE" });
    if (!res.ok) { const json = await res.json(); throw new Error(json.error); }
    setClaims((p) => p.filter((c) => c.id !== id));
  };

  return { claims, loading, error, refresh, createClaim, saveClaim, deleteClaim };
}
