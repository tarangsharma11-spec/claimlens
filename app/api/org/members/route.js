import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import {
  addMember, getMembers, getMembership, updateMember, removeMember, getMemberCount,
  getOrg, logActivity,
} from "@/lib/db";

/**
 * GET /api/org/members — List all org members
 * POST /api/org/members — Invite a new member
 * PATCH /api/org/members — Update a member's role
 * DELETE /api/org/members — Remove a member
 */
export async function GET(request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const membership = await getMembership(session.user.email);
  if (!membership) {
    return NextResponse.json({ error: "Not a member of any organization." }, { status: 404 });
  }

  const members = await getMembers(membership.org_id);
  return NextResponse.json({ members, orgId: membership.org_id });
}

export async function POST(request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const membership = await getMembership(session.user.email);
  if (!membership || membership.role !== "admin") {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  try {
    const { email, name, role } = await request.json();
    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Valid email required." }, { status: 400 });
    }

    // Check seat limit
    const org = await getOrg(membership.org_id);
    const count = await getMemberCount(membership.org_id);
    if (count >= org.max_seats) {
      return NextResponse.json({
        error: `Seat limit reached (${count}/${org.max_seats}). Upgrade your plan for more seats.`,
      }, { status: 403 });
    }

    const member = await addMember(membership.org_id, {
      email,
      name: name || email,
      role: role || "lawyer",
      invitedBy: session.user.email,
    });

    await logActivity(membership.org_id, {
      email: session.user.email,
      action: "member_invited",
      detail: `Invited ${email} as ${role || "lawyer"}`,
    });

    return NextResponse.json({ member });
  } catch (err) {
    console.error("Invite member error:", err);
    return NextResponse.json({ error: "Failed to invite member." }, { status: 500 });
  }
}

export async function PATCH(request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const membership = await getMembership(session.user.email);
  if (!membership || membership.role !== "admin") {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  try {
    const { email, role, status } = await request.json();
    if (!email) {
      return NextResponse.json({ error: "Email required." }, { status: 400 });
    }

    // Prevent removing own admin role
    if (email.toLowerCase() === session.user.email.toLowerCase() && role && role !== "admin") {
      return NextResponse.json({ error: "Cannot remove your own admin role." }, { status: 400 });
    }

    const updated = await updateMember(membership.org_id, email, { role, status });
    if (!updated) {
      return NextResponse.json({ error: "Member not found." }, { status: 404 });
    }

    await logActivity(membership.org_id, {
      email: session.user.email,
      action: "member_updated",
      detail: `Updated ${email}: role=${role || "unchanged"}, status=${status || "unchanged"}`,
    });

    return NextResponse.json({ member: updated });
  } catch (err) {
    return NextResponse.json({ error: "Failed to update member." }, { status: 500 });
  }
}

export async function DELETE(request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const membership = await getMembership(session.user.email);
  if (!membership || membership.role !== "admin") {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const email = searchParams.get("email");
  if (!email) {
    return NextResponse.json({ error: "Email parameter required." }, { status: 400 });
  }

  // Prevent removing self
  if (email.toLowerCase() === session.user.email.toLowerCase()) {
    return NextResponse.json({ error: "Cannot remove yourself." }, { status: 400 });
  }

  await removeMember(membership.org_id, email);

  await logActivity(membership.org_id, {
    email: session.user.email,
    action: "member_removed",
    detail: `Removed ${email} from organization`,
  });

  return NextResponse.json({ success: true });
}
