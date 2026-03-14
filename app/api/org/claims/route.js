import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import { getMembership, getOrgClaims, getClaim, createClaim, updateClaim, deleteClaim, logActivity } from "@/lib/db";

/**
 * GET /api/org/claims — Get all claims for the user's org
 * POST /api/org/claims — Create a new claim
 * PATCH /api/org/claims — Update a claim
 * DELETE /api/org/claims — Delete a claim
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

  const claims = await getOrgClaims(membership.org_id, { email: session.user.email, role: membership.role });
  return NextResponse.json({ claims, orgId: membership.org_id, role: membership.role });
}

export async function POST(request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const membership = await getMembership(session.user.email);
  if (!membership) {
    return NextResponse.json({ error: "Not a member of any organization." }, { status: 404 });
  }

  try {
    const body = await request.json();
    const claim = await createClaim(membership.org_id, {
      ...body,
      createdBy: session.user.email,
      assignedTo: body.assignedTo || session.user.email,
    });

    await logActivity(membership.org_id, {
      claimId: claim.id,
      email: session.user.email,
      action: "claim_created",
      detail: `Created claim ${claim.claimNumber}`,
    });

    return NextResponse.json({ claim });
  } catch (err) {
    console.error("Create claim error:", err);
    return NextResponse.json({ error: "Failed to create claim." }, { status: 500 });
  }
}

export async function PATCH(request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const membership = await getMembership(session.user.email);
  if (!membership) {
    return NextResponse.json({ error: "Not a member of any organization." }, { status: 404 });
  }

  try {
    const body = await request.json();
    const { id, action, shareWith } = body;
    if (!id) {
      return NextResponse.json({ error: "Claim ID required." }, { status: 400 });
    }

    // Handle share/unshare actions
    if (action === "share" && shareWith) {
      const { shareClaim } = await import("@/lib/db");
      await shareClaim(membership.org_id, id, shareWith);
      await logActivity(membership.org_id, {
        claimId: id,
        email: session.user.email,
        action: "claim_shared",
        detail: `Shared with ${shareWith}`,
      });
      return NextResponse.json({ success: true });
    }
    if (action === "unshare" && shareWith) {
      const { unshareClaim } = await import("@/lib/db");
      await unshareClaim(membership.org_id, id, shareWith);
      await logActivity(membership.org_id, {
        claimId: id,
        email: session.user.email,
        action: "claim_unshared",
        detail: `Removed sharing with ${shareWith}`,
      });
      return NextResponse.json({ success: true });
    }

    const { id: _id, action: _a, shareWith: _sw, ...updates } = body;
    const claim = await updateClaim(membership.org_id, id, updates);
    if (!claim) {
      return NextResponse.json({ error: "Claim not found." }, { status: 404 });
    }

    // Log significant changes
    if (updates.stage) {
      await logActivity(membership.org_id, {
        claimId: id,
        email: session.user.email,
        action: "stage_changed",
        detail: `Changed status to ${updates.stage}`,
      });
    }

    return NextResponse.json({ claim });
  } catch (err) {
    console.error("Update claim error:", err);
    return NextResponse.json({ error: "Failed to update claim." }, { status: 500 });
  }
}

export async function DELETE(request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const membership = await getMembership(session.user.email);
  if (!membership) {
    return NextResponse.json({ error: "Not a member of any organization." }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Claim ID required." }, { status: 400 });
  }

  await deleteClaim(membership.org_id, id);

  await logActivity(membership.org_id, {
    claimId: id,
    email: session.user.email,
    action: "claim_deleted",
    detail: `Deleted claim ${id}`,
  });

  return NextResponse.json({ success: true });
}
