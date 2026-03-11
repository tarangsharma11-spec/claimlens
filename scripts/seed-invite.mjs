#!/usr/bin/env node

/**
 * Seed script — creates the first admin user.
 *
 * Usage:
 *   1. Set your .env.local with POSTGRES_URL
 *   2. Run: node scripts/seed-invite.mjs
 *
 * This creates:
 *   - An admin user (email: admin@claimlens.app, password: changeme123)
 *   - A reusable invite code for your first batch of users
 *
 * CHANGE THE PASSWORD after first login.
 */

import { sql } from "@vercel/postgres";
import bcrypt from "bcryptjs";
import crypto from "crypto";

async function seed() {
  console.log("🌱 Seeding ClaimLens database...\n");

  // Create admin user
  const email = "admin@claimlens.app";
  const password = "changeme123";
  const hash = await bcrypt.hash(password, 12);

  try {
    await sql`
      INSERT INTO users (email, password_hash, name, role, status)
      VALUES (${email}, ${hash}, 'Admin', 'admin', 'active')
      ON CONFLICT (email) DO NOTHING
    `;
    console.log(`✅ Admin user created: ${email} / ${password}`);
    console.log(`   ⚠️  Change this password immediately after first login.\n`);
  } catch (e) {
    console.log(`ℹ️  Admin user already exists.\n`);
  }

  // Create a general invite code
  const code = crypto.randomBytes(6).toString("hex");
  try {
    await sql`
      INSERT INTO invite_codes (code, role, created_by)
      VALUES (${code}, 'user', 1)
    `;
    console.log(`✅ Invite code created: ${code}`);
    console.log(`   Share this with your first users to sign up.\n`);
  } catch (e) {
    console.log(`ℹ️  Could not create invite code: ${e.message}\n`);
  }

  console.log("🎉 Seeding complete!");
  process.exit(0);
}

seed().catch((e) => {
  console.error("Seed failed:", e);
  process.exit(1);
});
