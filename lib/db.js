import { sql } from "@vercel/postgres";

// ═══════════════════════════════════════════════════════
// DATABASE SCHEMA & HELPERS
// Run initDB() once on first deploy (or via the /api/init endpoint)
// ═══════════════════════════════════════════════════════

export async function initDB() {
  // Users table — invite-only, approved by admin
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      name VARCHAR(255),
      role VARCHAR(50) DEFAULT 'user',
      status VARCHAR(50) DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `;

  // Invite codes — admin creates these, users redeem at signup
  await sql`
    CREATE TABLE IF NOT EXISTS invite_codes (
      id SERIAL PRIMARY KEY,
      code VARCHAR(100) UNIQUE NOT NULL,
      email VARCHAR(255),
      role VARCHAR(50) DEFAULT 'user',
      used BOOLEAN DEFAULT FALSE,
      used_by INTEGER REFERENCES users(id),
      created_by INTEGER REFERENCES users(id),
      created_at TIMESTAMP DEFAULT NOW(),
      expires_at TIMESTAMP
    )
  `;

  // Claims table
  await sql`
    CREATE TABLE IF NOT EXISTS claims (
      id SERIAL PRIMARY KEY,
      claim_number VARCHAR(100) UNIQUE NOT NULL,
      user_id INTEGER REFERENCES users(id),
      worker VARCHAR(255),
      employer VARCHAR(255),
      injury_date VARCHAR(50),
      injury_type VARCHAR(100),
      description TEXT,
      stage VARCHAR(50) DEFAULT 'new',
      data JSONB DEFAULT '{}',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `;

  // Timeline events
  await sql`
    CREATE TABLE IF NOT EXISTS timeline_events (
      id SERIAL PRIMARY KEY,
      claim_id INTEGER REFERENCES claims(id) ON DELETE CASCADE,
      type VARCHAR(50) NOT NULL,
      note TEXT,
      data JSONB DEFAULT '{}',
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;

  // Chat messages per claim
  await sql`
    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      claim_id INTEGER REFERENCES claims(id) ON DELETE CASCADE,
      role VARCHAR(20) NOT NULL,
      content TEXT NOT NULL,
      display TEXT,
      files JSONB DEFAULT '[]',
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;

  // Analyses (AI ruling results)
  await sql`
    CREATE TABLE IF NOT EXISTS analyses (
      id SERIAL PRIMARY KEY,
      claim_id INTEGER REFERENCES claims(id) ON DELETE CASCADE,
      ruling VARCHAR(50),
      snippet TEXT,
      full_response TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;

  return { success: true };
}

// ── User helpers ──

export async function getUserByEmail(email) {
  const { rows } = await sql`SELECT * FROM users WHERE email = ${email}`;
  return rows[0] || null;
}

export async function createUser({ email, passwordHash, name, role, status }) {
  const { rows } = await sql`
    INSERT INTO users (email, password_hash, name, role, status)
    VALUES (${email}, ${passwordHash}, ${name}, ${role || "user"}, ${status || "active"})
    RETURNING *
  `;
  return rows[0];
}

// ── Invite helpers ──

export async function getInviteByCode(code) {
  const { rows } = await sql`SELECT * FROM invite_codes WHERE code = ${code} AND used = FALSE`;
  return rows[0] || null;
}

export async function markInviteUsed(code, userId) {
  await sql`UPDATE invite_codes SET used = TRUE, used_by = ${userId} WHERE code = ${code}`;
}

export async function createInvite({ code, email, role, createdBy, expiresAt }) {
  const { rows } = await sql`
    INSERT INTO invite_codes (code, email, role, created_by, expires_at)
    VALUES (${code}, ${email || null}, ${role || "user"}, ${createdBy || null}, ${expiresAt || null})
    RETURNING *
  `;
  return rows[0];
}

// ── Claim helpers ──

export async function getClaimsByUser(userId) {
  const { rows } = await sql`
    SELECT * FROM claims WHERE user_id = ${userId} ORDER BY updated_at DESC
  `;
  return rows;
}

export async function getClaimById(id) {
  const { rows } = await sql`SELECT * FROM claims WHERE id = ${id}`;
  return rows[0] || null;
}

export async function createClaim({ claimNumber, userId, worker, employer, injuryDate, injuryType, description }) {
  const { rows } = await sql`
    INSERT INTO claims (claim_number, user_id, worker, employer, injury_date, injury_type, description)
    VALUES (${claimNumber}, ${userId}, ${worker}, ${employer}, ${injuryDate}, ${injuryType}, ${description})
    RETURNING *
  `;
  return rows[0];
}

export async function updateClaim(id, fields) {
  const { stage, data, description } = fields;
  const { rows } = await sql`
    UPDATE claims
    SET stage = COALESCE(${stage || null}, stage),
        data = COALESCE(${data ? JSON.stringify(data) : null}::jsonb, data),
        description = COALESCE(${description || null}, description),
        updated_at = NOW()
    WHERE id = ${id}
    RETURNING *
  `;
  return rows[0];
}

export async function deleteClaim(id) {
  await sql`DELETE FROM claims WHERE id = ${id}`;
}

// ── Timeline helpers ──

export async function addTimelineEvent(claimId, type, note, data = {}) {
  const { rows } = await sql`
    INSERT INTO timeline_events (claim_id, type, note, data)
    VALUES (${claimId}, ${type}, ${note}, ${JSON.stringify(data)}::jsonb)
    RETURNING *
  `;
  // Also bump claim updated_at
  await sql`UPDATE claims SET updated_at = NOW() WHERE id = ${claimId}`;
  return rows[0];
}

export async function getTimeline(claimId) {
  const { rows } = await sql`
    SELECT * FROM timeline_events WHERE claim_id = ${claimId} ORDER BY created_at DESC
  `;
  return rows;
}

// ── Message helpers ──

export async function addMessage(claimId, role, content, display = null, files = []) {
  const { rows } = await sql`
    INSERT INTO messages (claim_id, role, content, display, files)
    VALUES (${claimId}, ${role}, ${content}, ${display}, ${JSON.stringify(files)}::jsonb)
    RETURNING *
  `;
  return rows[0];
}

export async function getMessages(claimId) {
  const { rows } = await sql`
    SELECT * FROM messages WHERE claim_id = ${claimId} ORDER BY created_at ASC
  `;
  return rows;
}

// ── Analysis helpers ──

export async function addAnalysis(claimId, ruling, snippet, fullResponse) {
  const { rows } = await sql`
    INSERT INTO analyses (claim_id, ruling, snippet, full_response)
    VALUES (${claimId}, ${ruling}, ${snippet}, ${fullResponse})
    RETURNING *
  `;
  return rows[0];
}

export async function getAnalyses(claimId) {
  const { rows } = await sql`
    SELECT * FROM analyses WHERE claim_id = ${claimId} ORDER BY created_at DESC
  `;
  return rows;
}
