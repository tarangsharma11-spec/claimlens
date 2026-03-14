import { sql } from "@vercel/postgres";

// ═══════════════════════════════════════════════════════════
// EXISTING USER FUNCTIONS (preserve current contract)
// ═══════════════════════════════════════════════════════════

export async function createUser({ email, passwordHash, name, role, status }) {
  const result = await sql`
    INSERT INTO users (email, password_hash, name, role, status, created_at)
    VALUES (${email}, ${passwordHash}, ${name}, ${role || "user"}, ${status || "active"}, NOW())
    RETURNING id, email, name, role, status, created_at
  `;
  return result.rows[0];
}

export async function getUserByEmail(email) {
  const result = await sql`
    SELECT id, email, password_hash, name, role, status, org_id, created_at
    FROM users WHERE email = ${email}
  `;
  return result.rows[0] || null;
}

// ═══════════════════════════════════════════════════════════
// ORGANIZATIONS
// ═══════════════════════════════════════════════════════════

export async function createOrg({ name, plan, billingEmail, createdBy }) {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+$/, "");
  const maxSeats = plan === "enterprise" ? 50 : plan === "pro" ? 10 : plan === "starter" ? 3 : 1;

  const result = await sql`
    INSERT INTO organizations (name, slug, plan, billing_email, max_seats, created_by)
    VALUES (${name}, ${slug}, ${plan || "starter"}, ${billingEmail}, ${maxSeats}, ${createdBy})
    RETURNING *
  `;
  return result.rows[0];
}

export async function getOrg(orgId) {
  const result = await sql`SELECT * FROM organizations WHERE id = ${orgId}`;
  return result.rows[0] || null;
}

export async function getOrgBySlug(slug) {
  const result = await sql`SELECT * FROM organizations WHERE slug = ${slug}`;
  return result.rows[0] || null;
}

export async function updateOrg(orgId, { name, plan, billingEmail, maxSeats, stripeCustomerId, stripeSubscriptionId }) {
  const result = await sql`
    UPDATE organizations SET
      name = COALESCE(${name}, name),
      plan = COALESCE(${plan}, plan),
      billing_email = COALESCE(${billingEmail}, billing_email),
      max_seats = COALESCE(${maxSeats}, max_seats),
      stripe_customer_id = COALESCE(${stripeCustomerId}, stripe_customer_id),
      stripe_subscription_id = COALESCE(${stripeSubscriptionId}, stripe_subscription_id)
    WHERE id = ${orgId}
    RETURNING *
  `;
  return result.rows[0] || null;
}

// ═══════════════════════════════════════════════════════════
// MEMBERSHIPS
// ═══════════════════════════════════════════════════════════

export async function addMember(orgId, { email, name, role, invitedBy }) {
  const result = await sql`
    INSERT INTO memberships (org_id, user_email, user_name, role, status, invited_by)
    VALUES (${orgId}, ${email.toLowerCase()}, ${name || email}, ${role || "lawyer"}, ${invitedBy ? "invited" : "active"}, ${invitedBy || null})
    ON CONFLICT (org_id, user_email) DO UPDATE SET
      role = EXCLUDED.role,
      user_name = COALESCE(EXCLUDED.user_name, memberships.user_name)
    RETURNING *
  `;
  // Link user to org
  await sql`UPDATE users SET org_id = ${orgId} WHERE email = ${email.toLowerCase()}`;
  return result.rows[0];
}

export async function getMembers(orgId) {
  const result = await sql`
    SELECT m.*, u.status as user_status
    FROM memberships m
    LEFT JOIN users u ON u.email = m.user_email
    WHERE m.org_id = ${orgId}
    ORDER BY m.joined_at ASC
  `;
  return result.rows;
}

export async function getMembership(email) {
  const result = await sql`
    SELECT m.*, o.name as org_name, o.slug as org_slug, o.plan as org_plan
    FROM memberships m
    JOIN organizations o ON o.id = m.org_id
    WHERE m.user_email = ${email.toLowerCase()} AND m.status != 'disabled'
    LIMIT 1
  `;
  return result.rows[0] || null;
}

export async function updateMember(orgId, email, { role, status, name }) {
  const result = await sql`
    UPDATE memberships SET
      role = COALESCE(${role}, role),
      status = COALESCE(${status}, status),
      user_name = COALESCE(${name}, user_name)
    WHERE org_id = ${orgId} AND user_email = ${email.toLowerCase()}
    RETURNING *
  `;
  return result.rows[0] || null;
}

export async function removeMember(orgId, email) {
  await sql`DELETE FROM memberships WHERE org_id = ${orgId} AND user_email = ${email.toLowerCase()}`;
  await sql`UPDATE users SET org_id = NULL WHERE email = ${email.toLowerCase()}`;
}

export async function getMemberCount(orgId) {
  const result = await sql`SELECT COUNT(*) as count FROM memberships WHERE org_id = ${orgId} AND status != 'disabled'`;
  return parseInt(result.rows[0]?.count || 0);
}

// ═══════════════════════════════════════════════════════════
// CLAIMS (org-scoped)
// ═══════════════════════════════════════════════════════════

/**
 * Get claims visible to a specific user.
 * - admin role: sees all claims in the org
 * - other roles: sees claims they own, are assigned to, or are shared with
 */
export async function getOrgClaims(orgId, { email, role } = {}) {
  // Admins see everything
  if (role === "admin" || !email) {
    const result = await sql`
      SELECT * FROM claims
      WHERE org_id = ${orgId}
      ORDER BY updated_at DESC
    `;
    return result.rows.map(deserializeClaim);
  }

  // Non-admins: own + assigned + shared
  const emailLower = email.toLowerCase();
  const result = await sql`
    SELECT * FROM claims
    WHERE org_id = ${orgId}
    AND (
      created_by = ${emailLower}
      OR assigned_to = ${emailLower}
      OR shared_with ? ${emailLower}
    )
    ORDER BY updated_at DESC
  `;
  return result.rows.map(deserializeClaim);
}

export async function getClaim(orgId, claimId) {
  const result = await sql`
    SELECT * FROM claims
    WHERE id = ${claimId} AND org_id = ${orgId}
  `;
  return result.rows[0] ? deserializeClaim(result.rows[0]) : null;
}

export async function createClaim(orgId, claim) {
  const s = serializeClaim(claim);
  const result = await sql`
    INSERT INTO claims (
      org_id, claim_number, worker, employer, injury_date, injury_type,
      description, stage, assigned_to, created_by,
      documents, analyses, messages, timeline, notes,
      comms, emails, tasks, providers, appeal,
      three_point, valuation, modified_duties
    ) VALUES (
      ${orgId}, ${s.claim_number}, ${s.worker}, ${s.employer}, ${s.injury_date}, ${s.injury_type},
      ${s.description}, ${s.stage || "new"}, ${s.assigned_to}, ${s.created_by},
      ${s.documents}, ${s.analyses}, ${s.messages}, ${s.timeline}, ${s.notes},
      ${s.comms}, ${s.emails}, ${s.tasks}, ${s.providers}, ${s.appeal},
      ${s.three_point}, ${s.valuation}, ${s.modified_duties}
    )
    RETURNING *
  `;
  return deserializeClaim(result.rows[0]);
}

export async function updateClaim(orgId, claimId, updates) {
  const s = serializeClaim(updates);
  // Build dynamic SET clause for non-null fields
  const fields = [];
  const values = [];

  const mappable = {
    claim_number: s.claim_number, worker: s.worker, employer: s.employer,
    injury_date: s.injury_date, injury_type: s.injury_type, description: s.description,
    stage: s.stage, assigned_to: s.assigned_to,
    documents: s.documents, analyses: s.analyses, messages: s.messages,
    timeline: s.timeline, notes: s.notes, comms: s.comms, emails: s.emails,
    tasks: s.tasks, providers: s.providers, appeal: s.appeal,
    three_point: s.three_point, valuation: s.valuation, modified_duties: s.modified_duties,
  };

  // For simplicity, do a full replace of all fields
  const result = await sql`
    UPDATE claims SET
      claim_number = COALESCE(${s.claim_number}, claim_number),
      worker = COALESCE(${s.worker}, worker),
      employer = COALESCE(${s.employer}, employer),
      injury_date = COALESCE(${s.injury_date}, injury_date),
      injury_type = COALESCE(${s.injury_type}, injury_type),
      description = COALESCE(${s.description}, description),
      stage = COALESCE(${s.stage}, stage),
      assigned_to = COALESCE(${s.assigned_to}, assigned_to),
      documents = COALESCE(${s.documents}, documents),
      analyses = COALESCE(${s.analyses}, analyses),
      messages = COALESCE(${s.messages}, messages),
      timeline = COALESCE(${s.timeline}, timeline),
      notes = COALESCE(${s.notes}, notes),
      comms = COALESCE(${s.comms}, comms),
      emails = COALESCE(${s.emails}, emails),
      tasks = COALESCE(${s.tasks}, tasks),
      providers = COALESCE(${s.providers}, providers),
      appeal = COALESCE(${s.appeal}, appeal),
      three_point = COALESCE(${s.three_point}, three_point),
      valuation = COALESCE(${s.valuation}, valuation),
      modified_duties = COALESCE(${s.modified_duties}, modified_duties)
    WHERE id = ${claimId} AND org_id = ${orgId}
    RETURNING *
  `;
  return result.rows[0] ? deserializeClaim(result.rows[0]) : null;
}

export async function deleteClaim(orgId, claimId) {
  await sql`DELETE FROM claims WHERE id = ${claimId} AND org_id = ${orgId}`;
}

export async function shareClaim(orgId, claimId, email) {
  // Add email to the shared_with JSONB array
  await sql`
    UPDATE claims
    SET shared_with = COALESCE(shared_with, '[]'::jsonb) || ${JSON.stringify([email.toLowerCase()])}::jsonb
    WHERE id = ${claimId} AND org_id = ${orgId}
    AND NOT (COALESCE(shared_with, '[]'::jsonb) ? ${email.toLowerCase()})
  `;
}

export async function unshareClaim(orgId, claimId, email) {
  await sql`
    UPDATE claims
    SET shared_with = COALESCE(shared_with, '[]'::jsonb) - ${email.toLowerCase()}
    WHERE id = ${claimId} AND org_id = ${orgId}
  `;
}

// ═══════════════════════════════════════════════════════════
// ACTIVITY LOG
// ═══════════════════════════════════════════════════════════

export async function logActivity(orgId, { claimId, email, action, detail, metadata }) {
  await sql`
    INSERT INTO activity_log (org_id, claim_id, user_email, action, detail, metadata)
    VALUES (${orgId}, ${claimId || null}, ${email}, ${action}, ${detail || ""}, ${JSON.stringify(metadata || {})})
  `;
}

export async function getActivity(orgId, { claimId, email, limit } = {}) {
  if (claimId) {
    const result = await sql`
      SELECT * FROM activity_log
      WHERE org_id = ${orgId} AND claim_id = ${claimId}
      ORDER BY created_at DESC LIMIT ${limit || 50}
    `;
    return result.rows;
  }
  if (email) {
    const result = await sql`
      SELECT * FROM activity_log
      WHERE org_id = ${orgId} AND user_email = ${email}
      ORDER BY created_at DESC LIMIT ${limit || 50}
    `;
    return result.rows;
  }
  const result = await sql`
    SELECT * FROM activity_log
    WHERE org_id = ${orgId}
    ORDER BY created_at DESC LIMIT ${limit || 50}
  `;
  return result.rows;
}

// ═══════════════════════════════════════════════════════════
// API USAGE TRACKING & RATE LIMITING
// ═══════════════════════════════════════════════════════════

const PLAN_LIMITS = {
  free:       { seats: 1,   cases: 3,   aiPerMonth: 5,   storage: "500 MB" },
  starter:    { seats: 3,   cases: 25,  aiPerMonth: 50,  storage: "2 GB" },
  pro:        { seats: 10,  cases: -1,  aiPerMonth: -1,  storage: "10 GB" },
  enterprise: { seats: 50,  cases: -1,  aiPerMonth: -1,  storage: "Unlimited" },
};

export function getPlanLimits(plan) {
  return PLAN_LIMITS[plan] || PLAN_LIMITS.free;
}

export async function trackUsage(orgId, { email, action, claimId, tokensUsed }) {
  try {
    await sql`
      INSERT INTO api_usage (org_id, user_email, action, claim_id, tokens_used)
      VALUES (${orgId}, ${email}, ${action}, ${claimId || null}, ${tokensUsed || 0})
    `;
  } catch (err) {
    console.log("Usage tracking failed (non-blocking):", err.message);
  }
}

export async function getMonthlyUsage(orgId, action) {
  const result = await sql`
    SELECT COUNT(*) as count, COALESCE(SUM(tokens_used), 0) as tokens
    FROM api_usage
    WHERE org_id = ${orgId}
    AND action = ${action}
    AND created_at >= date_trunc('month', NOW())
  `;
  return { count: parseInt(result.rows[0]?.count || 0), tokens: parseInt(result.rows[0]?.tokens || 0) };
}

export async function checkRateLimit(orgId, plan, action) {
  const limits = getPlanLimits(plan);
  if (action === "ai_analysis" && limits.aiPerMonth > 0) {
    const usage = await getMonthlyUsage(orgId, "ai_analysis");
    if (usage.count >= limits.aiPerMonth) {
      return { allowed: false, used: usage.count, limit: limits.aiPerMonth, message: `AI analysis limit reached (${usage.count}/${limits.aiPerMonth} this month). Upgrade your plan for more.` };
    }
    return { allowed: true, used: usage.count, limit: limits.aiPerMonth };
  }
  return { allowed: true };
}

// ═══════════════════════════════════════════════════════════
// INVITE CODES (single-use, org-bound)
// ═══════════════════════════════════════════════════════════

function generateCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no O/0/1/I to avoid confusion
  let code = "CA-";
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  code += "-";
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export async function createInviteCode(orgId, { email, role, invitedBy }) {
  const code = generateCode();
  const result = await sql`
    INSERT INTO invite_codes (code, org_id, email, role, invited_by)
    VALUES (${code}, ${orgId}, ${email.toLowerCase()}, ${role || "lawyer"}, ${invitedBy})
    RETURNING *
  `;
  return result.rows[0];
}

export async function validateInviteCode(code, email) {
  const result = await sql`
    SELECT ic.*, o.name as org_name, o.plan as org_plan
    FROM invite_codes ic
    JOIN organizations o ON o.id = ic.org_id
    WHERE ic.code = ${code.toUpperCase().trim()}
    AND ic.status = 'pending'
    AND ic.expires_at > NOW()
  `;
  const invite = result.rows[0];
  if (!invite) return { valid: false, error: "Invalid or expired invite code." };
  if (invite.email !== email.toLowerCase()) return { valid: false, error: "This invite code was issued for a different email address." };
  return { valid: true, invite };
}

export async function consumeInviteCode(code, usedBy) {
  await sql`
    UPDATE invite_codes SET status = 'used', used_by = ${usedBy.toLowerCase()}, used_at = NOW()
    WHERE code = ${code.toUpperCase().trim()} AND status = 'pending'
  `;
}

export async function getOrgInviteCodes(orgId) {
  const result = await sql`
    SELECT * FROM invite_codes
    WHERE org_id = ${orgId}
    ORDER BY created_at DESC
  `;
  return result.rows;
}

export async function revokeInviteCode(orgId, codeId) {
  await sql`
    UPDATE invite_codes SET status = 'revoked'
    WHERE id = ${codeId} AND org_id = ${orgId} AND status = 'pending'
  `;
}

// ═══════════════════════════════════════════════════════════
// SERIALIZATION HELPERS
// ═══════════════════════════════════════════════════════════
// Convert between the camelCase JS objects used in client.js
// and the snake_case + JSONB columns in Postgres.

function serializeClaim(c) {
  return {
    claim_number: c.claimNumber ?? c.claim_number ?? null,
    worker: c.worker ?? null,
    employer: c.employer ?? null,
    injury_date: (c.injuryDate && c.injuryDate !== "—" && c.injuryDate !== "") ? (c.injuryDate ?? c.injury_date) : null,
    injury_type: c.injuryType ?? c.injury_type ?? null,
    description: c.description ?? null,
    stage: c.stage ?? null,
    assigned_to: c.assignedTo ?? c.assigned_to ?? c.ownerEmail ?? null,
    created_by: c.createdBy ?? c.created_by ?? c.ownerEmail ?? null,
    documents: c.documents ? JSON.stringify(c.documents) : null,
    analyses: c.analyses ? JSON.stringify(c.analyses) : null,
    messages: c.messages ? JSON.stringify(c.messages) : null,
    timeline: c.timeline ? JSON.stringify(c.timeline) : null,
    notes: c.notes ? JSON.stringify(c.notes) : null,
    comms: c.comms ? JSON.stringify(c.comms) : null,
    emails: c.emails ? JSON.stringify(c.emails) : null,
    tasks: c.tasks ? JSON.stringify(c.tasks) : null,
    providers: c.providers ? JSON.stringify(c.providers) : null,
    appeal: c.appeal ? JSON.stringify(c.appeal) : null,
    three_point: c.threePoint ?? c.three_point ? JSON.stringify(c.threePoint ?? c.three_point) : null,
    valuation: c.valuation ? JSON.stringify(c.valuation) : null,
    modified_duties: c.modifiedDuties ?? c.modified_duties ? JSON.stringify(c.modifiedDuties ?? c.modified_duties) : null,
  };
}

function deserializeClaim(row) {
  return {
    id: row.id,
    orgId: row.org_id,
    claimNumber: row.claim_number,
    worker: row.worker,
    employer: row.employer,
    injuryDate: row.injury_date ? row.injury_date.toISOString?.().split("T")[0] || row.injury_date : "—",
    injuryType: row.injury_type,
    description: row.description,
    stage: row.stage,
    assignedTo: row.assigned_to,
    createdBy: row.created_by,
    ownerEmail: row.assigned_to || row.created_by,
    documents: typeof row.documents === "string" ? JSON.parse(row.documents) : row.documents || [],
    analyses: typeof row.analyses === "string" ? JSON.parse(row.analyses) : row.analyses || [],
    messages: typeof row.messages === "string" ? JSON.parse(row.messages) : row.messages || [],
    timeline: typeof row.timeline === "string" ? JSON.parse(row.timeline) : row.timeline || [],
    notes: typeof row.notes === "string" ? JSON.parse(row.notes) : row.notes || [],
    comms: typeof row.comms === "string" ? JSON.parse(row.comms) : row.comms || [],
    emails: typeof row.emails === "string" ? JSON.parse(row.emails) : row.emails || [],
    tasks: typeof row.tasks === "string" ? JSON.parse(row.tasks) : row.tasks || [],
    providers: typeof row.providers === "string" ? JSON.parse(row.providers) : row.providers || [],
    appeal: typeof row.appeal === "string" ? JSON.parse(row.appeal) : row.appeal || {},
    threePoint: typeof row.three_point === "string" ? JSON.parse(row.three_point) : row.three_point || {},
    valuation: typeof row.valuation === "string" ? JSON.parse(row.valuation) : row.valuation || {},
    modifiedDuties: typeof row.modified_duties === "string" ? JSON.parse(row.modified_duties) : row.modified_duties || [],
    sharedWith: typeof row.shared_with === "string" ? JSON.parse(row.shared_with) : row.shared_with || [],
    createdAt: row.created_at?.toISOString?.() || row.created_at,
    updatedAt: row.updated_at?.toISOString?.() || row.updated_at,
  };
}
