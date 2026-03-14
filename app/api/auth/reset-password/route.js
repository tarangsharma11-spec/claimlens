import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import bcrypt from "bcryptjs";

/**
 * POST /api/auth/reset-password
 * Validates the reset token and sets a new password.
 */
export async function POST(request) {
  try {
    const { email, token, newPassword } = await request.json();

    if (!email || !token || !newPassword) {
      return NextResponse.json({ error: "Email, token, and new password are required." }, { status: 400 });
    }

    if (newPassword.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
    }

    // Look up user with matching token
    const result = await sql`
      SELECT id, email, reset_token, reset_token_expiry
      FROM users
      WHERE email = ${email.toLowerCase()} AND reset_token = ${token}
    `;

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Invalid or expired reset link. Please request a new one." }, { status: 400 });
    }

    const user = result.rows[0];

    // Check token expiry
    if (user.reset_token_expiry && new Date(user.reset_token_expiry) < new Date()) {
      // Clear expired token
      await sql`UPDATE users SET reset_token = NULL, reset_token_expiry = NULL WHERE id = ${user.id}`;
      return NextResponse.json({ error: "Reset link has expired. Please request a new one." }, { status: 400 });
    }

    // Hash new password and update
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await sql`
      UPDATE users SET
        password_hash = ${passwordHash},
        reset_token = NULL,
        reset_token_expiry = NULL
      WHERE id = ${user.id}
    `;

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Reset password error:", err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
