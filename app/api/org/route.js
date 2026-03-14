import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import {
  createOrg, getOrg, updateOrg,
  addMember, getMembers, getMembership, updateMember, removeMember, getMemberCount,
  getActivity, logActivity,
} from "@/lib/db";

/**
 * GET /api/org — Get current user's org + membership + members
 * POST /api/org — Create a new org (user becomes admin)
 * PATCH /api/org — Update org settings (admin only)
 */
export async function GET(request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const membership = await getMembership(session.user.email);
  if (!membership) {
    return NextResponse.json({ org: null, membership: null, members: [] });
  }

  const org = await getOrg(membership.org_id);
  const members = await getMembers(membership.org_id);
  const activity = await getActivity(membership.org_id, { limit: 20 });

  return NextResponse.json({ org, membership, members, activity });
}

export async function POST(request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check if user already belongs to an org
  const existing = await getMembership(session.user.email);
  if (existing) {
    return NextResponse.json({ error: "You already belong to an organization." }, { status: 409 });
  }

  try {
    const { name, plan } = await request.json();
    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Organization name is required." }, { status: 400 });
    }

    const org = await createOrg({
      name: name.trim(),
      plan: plan || "starter",
      billingEmail: session.user.email,
      createdBy: session.user.email,
    });

    // Creator becomes admin
    const membership = await addMember(org.id, {
      email: session.user.email,
      name: session.user.name || session.user.email,
      role: "admin",
      invitedBy: null,
    });

    await logActivity(org.id, {
      email: session.user.email,
      action: "org_created",
      detail: `Organization "${name}" created`,
    });

    return NextResponse.json({ org, membership });
  } catch (err) {
    console.error("Create org error:", err);
    return NextResponse.json({ error: err.message || "Failed to create organization." }, { status: 500 });
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
    const updates = await request.json();
    const org = await updateOrg(membership.org_id, updates);

    await logActivity(membership.org_id, {
      email: session.user.email,
      action: "org_updated",
      detail: `Organization settings updated`,
    });

    return NextResponse.json({ org });
  } catch (err) {
    return NextResponse.json({ error: "Failed to update organization." }, { status: 500 });
  }
}
