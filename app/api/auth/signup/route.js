import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getInviteByCode, markInviteUsed, createUser, getUserByEmail } from "@/lib/db";

export async function POST(request) {
  try {
    const { email, password, name, inviteCode } = await request.json();

    if (!email || !password || !inviteCode) {
      return NextResponse.json({ error: "Email, password, and invite code are required." }, { status: 400 });
    }

    // Validate invite code
    const invite = await getInviteByCode(inviteCode);
    if (!invite) {
      return NextResponse.json({ error: "Invalid or expired invite code." }, { status: 403 });
    }

    // If invite is email-locked, check it matches
    if (invite.email && invite.email.toLowerCase() !== email.toLowerCase()) {
      return NextResponse.json({ error: "This invite code is reserved for a different email." }, { status: 403 });
    }

    // Check if invite has expired
    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      return NextResponse.json({ error: "This invite code has expired." }, { status: 403 });
    }

    // Check if user already exists
    const existing = await getUserByEmail(email);
    if (existing) {
      return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
    }

    // Create user
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await createUser({
      email: email.toLowerCase(),
      passwordHash,
      name: name || email.split("@")[0],
      role: invite.role || "user",
      status: "active", // Auto-approve since they have a valid invite
    });

    // Mark invite as used
    await markInviteUsed(inviteCode, user.id);

    return NextResponse.json({ success: true, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  } catch (err) {
    console.error("Signup error:", err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
