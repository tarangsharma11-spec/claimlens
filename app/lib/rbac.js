"use client";

/**
 * Role-Based Access Control (RBAC) for CaseAssist.
 *
 * Three B2B roles: lawyer, employer, adjudicator.
 * Admin sees everything. Default role at signup is "lawyer".
 *
 * This file is the SINGLE SOURCE OF TRUTH for feature gating.
 * Sidebar, modals, and API all reference this config.
 */

export const ROLES = {
  lawyer: { label: "Injury Lawyer", desc: "Case evaluation, appeals, settlement valuation", color: "#7F77DD" },
  employer: { label: "Employer / HR", desc: "Compliance, premium impact, RTW management", color: "#1D9E75" },
  adjudicator: { label: "Adjudicator / TPA", desc: "Claim processing, batch analysis, decision letters", color: "#D85A30" },
  admin: { label: "Administrator", desc: "Full access to all features + user management", color: "#1D1D1F" },
};

export const DEFAULT_ROLE = "lawyer";

/**
 * Feature registry — every gated feature has an ID, display info,
 * and the list of roles that can access it.
 *
 * Universal features (available to ALL roles) have roles: ["*"].
 */
export const FEATURES = {
  // === UNIVERSAL (all roles) ===
  home:        { label: "Home",           roles: ["*"], category: "core" },
  claims:      { label: "My Cases",       roles: ["*"], category: "core" },
  board:       { label: "Board",          roles: ["*"], category: "core" },
  advisor:     { label: "AI Advisor",     roles: ["*"], category: "core" },
  templates:   { label: "Templates",      roles: ["*"], category: "core" },
  analytics:   { label: "Analytics",      roles: ["*"], category: "core" },
  glossary:    { label: "Glossary",       roles: ["*"], category: "core" },
  team:        { label: "Team",           roles: ["*"], category: "core" },

  // === LAWYER-SPECIFIC ===
  intake:      { label: "Intake Screener",     roles: ["lawyer", "admin"],      category: "lawyer" },
  settlement:  { label: "Settlement Modeler",  roles: ["lawyer", "admin"],      category: "lawyer" },
  limitations: { label: "Limitation Periods",  roles: ["lawyer", "admin"],      category: "lawyer" },

  // === EMPLOYER-SPECIFIC ===
  employer:    { label: "Employer Dashboard",  roles: ["employer", "admin"],    category: "employer" },
  emptools:    { label: "Employer Tools",      roles: ["employer", "admin"],    category: "employer" },

  // === ADJUDICATOR-SPECIFIC ===
  triage:      { label: "Triage Queue",        roles: ["adjudicator", "admin"], category: "adjudicator" },
  adjintel:    { label: "Intelligence",        roles: ["adjudicator", "admin"], category: "adjudicator" },

  // === SHARED SPECIALIST (multiple roles but not universal) ===
  worker:      { label: "Worker View",         roles: ["lawyer", "adjudicator", "admin"], category: "shared" },
};

/**
 * Check if a user role has access to a feature.
 * @param {string} role - User role (lawyer, employer, adjudicator, admin)
 * @param {string} featureId - Feature ID from FEATURES registry
 * @returns {boolean}
 */
export function hasAccess(role, featureId) {
  const feature = FEATURES[featureId];
  if (!feature) return false;
  if (feature.roles.includes("*")) return true;
  if (role === "admin") return true;
  return feature.roles.includes(role);
}

/**
 * Get all features accessible to a role.
 * @param {string} role
 * @returns {string[]} Array of feature IDs
 */
export function getAccessibleFeatures(role) {
  return Object.keys(FEATURES).filter((id) => hasAccess(role, id));
}

/**
 * Get features grouped by category for a role.
 * @param {string} role
 * @returns {Object} { core: [...], lawyer: [...], employer: [...], ... }
 */
export function getFeaturesByCategory(role) {
  const accessible = getAccessibleFeatures(role);
  const grouped = {};
  for (const id of accessible) {
    const cat = FEATURES[id].category;
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push({ id, ...FEATURES[id] });
  }
  return grouped;
}

/**
 * Plan limits — enforced separately from role gating.
 * Role determines WHAT you see. Plan determines HOW MUCH.
 */
export const PLAN_LIMITS = {
  starter: { maxCases: 3, aiTools: true, pdfExport: false, multiUser: false, batchAnalysis: false },
  pro:     { maxCases: Infinity, aiTools: true, pdfExport: true, multiUser: false, batchAnalysis: true },
  firm:    { maxCases: Infinity, aiTools: true, pdfExport: true, multiUser: true, batchAnalysis: true },
};

/**
 * Check if a plan allows a specific capability.
 * @param {string} plan
 * @param {string} capability
 * @returns {boolean}
 */
export function planAllows(plan, capability) {
  const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.starter;
  return !!limits[capability];
}
