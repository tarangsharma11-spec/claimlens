import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { sql } from "@vercel/postgres";

const UNIVERSAL_ACCESS_CODE = process.env.ACCESS_CODE || "CASEASSIST2026";

/**
 * POST /api/auth/verify-code
 * Called after SSO login when the user's status is 'pending_code'.
 * Validates the access code and activates the account.
 */
export async function POST(request) {
  const session = await getServerSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  try {
    const { code } = await request.json();
    if (!code) {
      return NextResponse.json({ error: "Access code is required." }, { status: 400 });
    }

    if (code !== UNIVERSAL_ACCESS_CODE) {
      return NextResponse.json({ error: "Invalid access code." }, { status: 403 });
    }

    // Activate the user account
    await sql`
      UPDATE users SET status = 'active'
      WHERE email = ${session.user.email.toLowerCase()} AND status = 'pending_code'
    `;

    // Check for pending org invite (same as signup flow)
    let orgInfo = null;
    try {
      const inviteResult = await sql`
        SELECT m.*, o.name as org_name FROM memberships m
        JOIN organizations o ON o.id = m.org_id
        WHERE m.user_email = ${session.user.email.toLowerCase()} AND m.status = 'invited'
        LIMIT 1
      `;
      if (inviteResult.rows.length > 0) {
        const invite = inviteResult.rows[0];
        await sql`UPDATE memberships SET status = 'active', joined_at = NOW() WHERE id = ${invite.id}`;
        await sql`UPDATE users SET org_id = ${invite.org_id} WHERE email = ${session.user.email.toLowerCase()}`;
        orgInfo = { orgId: invite.org_id, orgName: invite.org_name, role: invite.role };
      }
    } catch {}

    // Send welcome email
    try {
      const RESEND_API_KEY = process.env.RESEND_API_KEY;
      if (RESEND_API_KEY) {
        const name = session.user.name || session.user.email.split("@")[0];
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: "Bearer " + RESEND_API_KEY, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: process.env.RESEND_FROM_EMAIL || "CaseAssist <onboarding@resend.dev>",
            to: [session.user.email.toLowerCase()],
            subject: "Welcome to CaseAssist",
            html: `<div style="font-family: -apple-system, sans-serif; max-width: 520px; margin: 0 auto; color: #1D1D1F;">
              <div style="padding: 24px 0; border-bottom: 2px solid #E8EAEF;">
                <div style="display: inline-flex; align-items: center; gap: 10px;">
                  <div style="width: 32px; height: 32px; border-radius: 8px; background: linear-gradient(135deg, #1A1040, #3B5EC0); display: inline-flex; align-items: center; justify-content: center;">
                    <span style="color: #fff; font-size: 13px; font-weight: 800;">CA</span>
                  </div>
                  <span style="font-size: 16px; font-weight: 700;">CaseAssist</span>
                </div>
              </div>
              <div style="padding: 28px 0;">
                <h1 style="font-size: 22px; font-weight: 700; margin: 0 0 12px;">Welcome, ${name}!</h1>
                <p style="font-size: 14px; color: #6E6F76; line-height: 1.7;">Your CaseAssist account is active. Start by creating your first case or setting up your organization.</p>
                <div style="margin-top: 24px;"><a href="https://www.caseassist.ca/dashboard" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #1A1040, #3B5EC0); color: #fff; text-decoration: none; border-radius: 12px; font-size: 15px; font-weight: 600;">Open CaseAssist</a></div>
              </div>
            </div>`,
          }),
        });
      }
    } catch {}

    return NextResponse.json({ success: true, org: orgInfo });
  } catch (err) {
    console.error("Verify code error:", err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
