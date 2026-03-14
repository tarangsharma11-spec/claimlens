import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createUser, getUserByEmail, validateInviteCode, consumeInviteCode, addMember } from "@/lib/db";
import { sql } from "@vercel/postgres";

export async function POST(request) {
  try {
    const { email, password, name, inviteCode } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
    }
    if (!inviteCode) {
      return NextResponse.json({ error: "Invite code is required. Ask your administrator to invite you." }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
    }

    // Validate the invite code
    const validation = await validateInviteCode(inviteCode, email);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 403 });
    }

    const { invite } = validation;

    // Check if user already exists
    const existing = await getUserByEmail(email);
    if (existing) {
      return NextResponse.json({ error: "An account with this email already exists. Try signing in instead." }, { status: 409 });
    }

    // Create the user account
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await createUser({
      email: email.toLowerCase(),
      passwordHash,
      name: name || email.split("@")[0],
      role: "user",
      status: "active",
    });

    // Consume the invite code (mark as used)
    await consumeInviteCode(inviteCode, email);

    // Activate/create the membership
    let orgInfo = null;
    try {
      // Check for existing pending membership (created when admin invited)
      const memberResult = await sql`
        SELECT id FROM memberships
        WHERE org_id = ${invite.org_id} AND user_email = ${email.toLowerCase()}
        LIMIT 1
      `;

      if (memberResult.rows.length > 0) {
        // Activate existing membership
        await sql`
          UPDATE memberships SET status = 'active', joined_at = NOW(), user_name = ${name || email.split("@")[0]}
          WHERE org_id = ${invite.org_id} AND user_email = ${email.toLowerCase()}
        `;
      } else {
        // Create new membership
        await addMember(invite.org_id, {
          email: email.toLowerCase(),
          name: name || email.split("@")[0],
          role: invite.role,
          invitedBy: invite.invited_by,
        });
      }

      // Link user to org
      await sql`UPDATE users SET org_id = ${invite.org_id} WHERE email = ${email.toLowerCase()}`;

      orgInfo = { orgId: invite.org_id, orgName: invite.org_name, role: invite.role };

      // Log the join
      await sql`
        INSERT INTO activity_log (org_id, user_email, action, detail)
        VALUES (${invite.org_id}, ${email.toLowerCase()}, 'member_joined', ${`${name || email} joined using invite code ${inviteCode}`})
      `;
    } catch (dbErr) {
      console.log("Org setup during signup:", dbErr.message);
    }

    // Send welcome email (non-blocking)
    try {
      const RESEND_API_KEY = process.env.RESEND_API_KEY;
      if (RESEND_API_KEY) {
        const welcomeName = name || email.split("@")[0];
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: "Bearer " + RESEND_API_KEY, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: process.env.RESEND_FROM_EMAIL || "CaseAssist <onboarding@resend.dev>",
            to: [email.toLowerCase()],
            subject: "Welcome to CaseAssist",
            html: `<div style="font-family:-apple-system,sans-serif;max-width:520px;margin:0 auto;color:#1D1D1F"><div style="padding:24px 0;border-bottom:2px solid #E8EAEF"><div style="display:inline-flex;align-items:center;gap:10px"><div style="width:32px;height:32px;border-radius:8px;background:linear-gradient(135deg,#1A1040,#3B5EC0);display:inline-flex;align-items:center;justify-content:center"><span style="color:#fff;font-size:13px;font-weight:800">CA</span></div><span style="font-size:16px;font-weight:700">CaseAssist</span></div></div><div style="padding:28px 0"><h1 style="font-size:22px;font-weight:700;margin:0 0 12px">Welcome, ${welcomeName}!</h1><p style="font-size:14px;color:#6E6F76;line-height:1.7">Your account is active.${orgInfo ? " You've joined <strong>" + orgInfo.orgName + "</strong> as " + orgInfo.role + "." : ""}</p><div style="margin-top:24px"><a href="https://www.caseassist.ca/dashboard" style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#1A1040,#3B5EC0);color:#fff;text-decoration:none;border-radius:12px;font-size:15px;font-weight:600">Open CaseAssist</a></div></div></div>`,
          }),
        });
      }
    } catch {}

    return NextResponse.json({
      success: true,
      user: { id: user.id, email: user.email, name: user.name },
      org: orgInfo,
    });
  } catch (err) {
    console.error("Signup error:", err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
