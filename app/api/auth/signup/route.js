import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createUser, getUserByEmail } from "@/lib/db";
import { sql } from "@vercel/postgres";

const UNIVERSAL_ACCESS_CODE = process.env.ACCESS_CODE || "CASEASSIST2026";

export async function POST(request) {
  try {
    const { email, password, name, inviteCode } = await request.json();
    if (!email || !password || !inviteCode)
      return NextResponse.json({ error: "Email, password, and access code are required." }, { status: 400 });
    if (inviteCode !== UNIVERSAL_ACCESS_CODE)
      return NextResponse.json({ error: "Invalid access code." }, { status: 403 });
    const existing = await getUserByEmail(email);
    if (existing)
      return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await createUser({
      email: email.toLowerCase(),
      passwordHash,
      name: name || email.split("@")[0],
      role: "user",
      status: "active",
    });

    // Check for pending org invite
    let orgInfo = null;
    try {
      const inviteResult = await sql`
        SELECT m.*, o.name as org_name FROM memberships m
        JOIN organizations o ON o.id = m.org_id
        WHERE m.user_email = ${email.toLowerCase()} AND m.status = 'invited'
        LIMIT 1
      `;

      if (inviteResult.rows.length > 0) {
        const invite = inviteResult.rows[0];
        await sql`
          UPDATE memberships SET status = 'active', joined_at = NOW()
          WHERE id = ${invite.id}
        `;
        await sql`UPDATE users SET org_id = ${invite.org_id} WHERE email = ${email.toLowerCase()}`;

        orgInfo = { orgId: invite.org_id, orgName: invite.org_name, role: invite.role };

        await sql`
          INSERT INTO activity_log (org_id, user_email, action, detail)
          VALUES (${invite.org_id}, ${email.toLowerCase()}, 'member_joined', ${`${name || email} accepted invite and joined as ${invite.role}`})
        `;
      }
    } catch (dbErr) {
      // If org tables don't exist yet, silently continue — user still gets created
      console.log("Org invite check skipped (tables may not exist yet):", dbErr.message);
    }

    // Send welcome email (non-blocking — don't fail signup if email fails)
    try {
      const RESEND_API_KEY = process.env.RESEND_API_KEY;
      if (RESEND_API_KEY) {
        const welcomeName = name || email.split("@")[0];
        const welcomeHtml = `
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
              <h1 style="font-size: 22px; font-weight: 700; margin: 0 0 12px;">Welcome to CaseAssist, ${welcomeName}!</h1>
              <p style="font-size: 14px; color: #6E6F76; line-height: 1.7; margin: 0 0 20px;">Your account has been created. CaseAssist is an AI-powered WSIB claims intelligence platform that helps you analyze claims, track deadlines, and make better decisions.</p>
              ${orgInfo ? '<div style="padding: 14px 18px; background: #F0F7FF; border: 1px solid #CCE0FF; border-radius: 12px; margin-bottom: 20px;"><div style="font-size: 12px; font-weight: 600; color: #0071E3;">YOUR ORGANIZATION</div><div style="font-size: 16px; font-weight: 700; margin-top: 4px;">' + orgInfo.orgName + '</div><div style="font-size: 13px; color: #6E6F76; margin-top: 2px;">Role: ' + orgInfo.role + "</div></div>" : ""}
              <h3 style="font-size: 15px; font-weight: 600; margin: 0 0 10px;">Getting started:</h3>
              <div style="font-size: 14px; color: #48484A; line-height: 1.7;">1. <strong>Create your first case</strong> with a claim number and worker details<br>2. <strong>Upload documents</strong> — Form 6, Form 7, medical reports<br>3. <strong>Run the AI analysis</strong> — Five Point Check in seconds<br>4. <strong>Track deadlines</strong> — never miss a filing window</div>
              <div style="margin-top: 24px;"><a href="https://www.caseassist.ca/dashboard" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #1A1040, #3B5EC0); color: #fff; text-decoration: none; border-radius: 12px; font-size: 15px; font-weight: 600;">Open CaseAssist</a></div>
            </div>
            <div style="padding: 16px 0; border-top: 1px solid #E8EAEF; font-size: 11px; color: #A0A3AB;">Sent by <a href="https://www.caseassist.ca" style="color: #0071E3; text-decoration: none;">CaseAssist</a></div>
          </div>`;
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: "Bearer " + RESEND_API_KEY, "Content-Type": "application/json" },
          body: JSON.stringify({ from: process.env.RESEND_FROM_EMAIL || "CaseAssist <onboarding@resend.dev>", to: [email.toLowerCase()], subject: "Welcome to CaseAssist", html: welcomeHtml }),
        });
      }
    } catch (emailErr) {
      console.log("Welcome email failed (non-blocking):", emailErr.message);
    }

    return NextResponse.json({
      success: true,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      org: orgInfo,
    });
  } catch (err) {
    console.error("Signup error:", err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
