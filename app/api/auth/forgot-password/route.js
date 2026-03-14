import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import crypto from "crypto";

/**
 * POST /api/auth/forgot-password
 * Sends a password reset email with a time-limited token.
 */
export async function POST(request) {
  try {
    const { email } = await request.json();
    if (!email) {
      return NextResponse.json({ error: "Email is required." }, { status: 400 });
    }

    // Check if user exists
    const userResult = await sql`SELECT id, email, name FROM users WHERE email = ${email.toLowerCase()}`;
    if (userResult.rows.length === 0) {
      // Don't reveal whether the email exists — always return success
      return NextResponse.json({ success: true });
    }

    const user = userResult.rows[0];

    // Generate a secure reset token (64 hex chars)
    const token = crypto.randomBytes(32).toString("hex");
    const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

    // Store token in DB
    await sql`
      UPDATE users SET
        reset_token = ${token},
        reset_token_expiry = ${expiry.toISOString()}
      WHERE email = ${email.toLowerCase()}
    `;

    // Send reset email via Resend
    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    if (!RESEND_API_KEY) {
      console.error("RESEND_API_KEY not configured — cannot send reset email");
      return NextResponse.json({ success: true }); // Still don't reveal the error to user
    }

    const origin = request.headers.get("origin") || "https://www.caseassist.ca";
    const resetUrl = `${origin}/reset-password?token=${token}&email=${encodeURIComponent(email.toLowerCase())}`;

    const emailHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 520px; margin: 0 auto; color: #1D1D1F;">
        <div style="padding: 24px 0; border-bottom: 2px solid #E8EAEF;">
          <div style="display: inline-flex; align-items: center; gap: 10px;">
            <div style="width: 32px; height: 32px; border-radius: 8px; background: linear-gradient(135deg, #1A1040, #3B5EC0); display: inline-flex; align-items: center; justify-content: center;">
              <span style="color: #fff; font-size: 13px; font-weight: 800;">CA</span>
            </div>
            <span style="font-size: 16px; font-weight: 700;">CaseAssist</span>
          </div>
        </div>
        <div style="padding: 28px 0;">
          <h1 style="font-size: 22px; font-weight: 700; margin: 0 0 12px;">Reset your password</h1>
          <p style="font-size: 14px; color: #6E6F76; line-height: 1.6; margin: 0 0 24px;">
            Hi${user.name ? " " + user.name : ""},<br><br>
            We received a request to reset your CaseAssist password. Click the button below to set a new one. This link expires in 1 hour.
          </p>
          <a href="${resetUrl}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #1A1040, #3B5EC0); color: #fff; text-decoration: none; border-radius: 12px; font-size: 15px; font-weight: 600;">
            Reset password
          </a>
          <p style="font-size: 12px; color: #A0A3AB; margin: 24px 0 0; line-height: 1.6;">
            If you didn't request this, you can safely ignore this email. Your password won't change unless you click the link above.
          </p>
          <p style="font-size: 11px; color: #C8C9CC; margin: 20px 0 0;">
            Can't click the button? Copy this link:<br>
            <span style="word-break: break-all; color: #86868B;">${resetUrl}</span>
          </p>
        </div>
        <div style="padding: 16px 0; border-top: 1px solid #E8EAEF; font-size: 11px; color: #A0A3AB;">
          Sent by <a href="https://www.caseassist.ca" style="color: #0071E3; text-decoration: none;">CaseAssist</a> — WSIB Claims Intelligence
        </div>
      </div>
    `;

    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL || "CaseAssist <onboarding@resend.dev>",
        to: [email.toLowerCase()],
        subject: "Reset your CaseAssist password",
        html: emailHtml,
      }),
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Forgot password error:", err);
    // Always return success to not reveal user existence
    return NextResponse.json({ success: true });
  }
}
