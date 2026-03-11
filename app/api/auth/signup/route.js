import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createUser, getUserByEmail } from "@/lib/db";

const UNIVERSAL_ACCESS_CODE = process.env.ACCESS_CODE || "CASEASSIST2026";

export async function POST(request) {
  try {
    const { email, password, name, inviteCode } = await request.json();

    if (!email || !password || !inviteCode) {
      return NextResponse.json({ error: "Email, password, and access code are required." }, { status: 400 });
    }

    if (inviteCode !== UNIVERSAL_ACCESS_CODE) {
      return NextResponse.json({ error: "Invalid access code." }, { status: 403 });
    }

    const existing = await getUserByEmail(email);
    if (existing) {
      return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await createUser({
      email: email.toLowerCase(),
      passwordHash,
      name: name || email.split("@")[0],
      role: "user",
      status: "active",
    });

    return NextResponse.json({ success: true, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  } catch (err) {
    console.error("Signup error:", err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
