import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { searchPolicies, getPolicySummaries } from "@/app/lib/opm-search";

/**
 * GET /api/search?q=benefit+of+doubt&type=Acute+Injury&max=8
 * Returns relevant OPM policies for a search query.
 *
 * GET /api/search?list=1
 * Returns all policy summaries (code + title, no full text).
 */
export async function GET(request) {
  const session = await getServerSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);

  // List mode — return all policy summaries
  if (searchParams.get("list")) {
    return NextResponse.json({ policies: getPolicySummaries() });
  }

  // Search mode
  const query = searchParams.get("q") || "";
  const injuryType = searchParams.get("type") || null;
  const max = parseInt(searchParams.get("max") || "8", 10);

  if (!query.trim()) {
    return NextResponse.json({ error: "Query parameter 'q' is required." }, { status: 400 });
  }

  const claimContext = injuryType ? { injuryType } : null;
  const results = searchPolicies(query, claimContext, Math.min(max, 20));

  return NextResponse.json({
    query,
    results: results.map((p) => ({
      code: p.code,
      title: p.title,
      chapter: p.chapter,
      url: p.url,
      text: p.text,
      score: Math.round(p._score * 100) / 100,
    })),
  });
}
