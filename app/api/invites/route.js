import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { createInvite } from "@/lib/db";
import { sql } from "@vercel/postgres";
import crypto from "crypto";

// GET /api/invites — list all invites (admin only)
export async function GET() {
  const session = await getServerSession();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const { rows } = await sql`
    SELECT ic.*, u.email as used_by_email
    FROM invite_codes ic
    LEFT JOIN users u ON ic.used_by = u.id
    ORDER BY ic.created_at DESC
  `;

  return NextResponse.json({ invites: rows });
}

// POST /api/invites — create a new invite code
export async function POST(request) {
  const session = await getServerSession();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  try {
    const { email, role, expiresInDays } = await request.json();

    const code = crypto.randomBytes(6).toString("hex"); // e.g. "a3f2b1c9d0e4"
    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 86400000).toISOString()
      : null;

    const invite = await createInvite({
      code,
      email: email || null,
      role: role || "user",
      createdBy: parseInt(session.user.id),
      expiresAt,
    });

    return NextResponse.json({ invite });
  } catch (err) {
    console.error("Invite creation error:", err);
    return NextResponse.json({ error: "Failed to create invite." }, { status: 500 });
  }
}
