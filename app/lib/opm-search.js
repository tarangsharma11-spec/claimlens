/**
 * OPM Policy Search — lightweight RAG without a vector DB.
 *
 * Instead of stuffing all 289 policies (~200k tokens) into every system
 * prompt, we retrieve only the relevant 5–10 policies per query using
 * a combination of:
 *   1. OPM code extraction (user mentions "15-02-01" → exact match)
 *   2. Injury-type routing (claim type → known policy set)
 *   3. TF-IDF keyword scoring over policy text + title + chapter
 *
 * This cuts the system prompt from ~200k tokens to ~5–10k per request.
 */

import { readFileSync } from "fs";
import { join } from "path";

let policiesIndex = null;

/** Load and index policies once on first call */
function getIndex() {
  if (policiesIndex) return policiesIndex;

  const opmPath = join(process.cwd(), "app/data/opm-policies.json");
  const opmData = JSON.parse(readFileSync(opmPath, "utf-8"));
  const policies = Object.values(opmData.policies);

  // Build term frequency index
  const docFreq = {}; // term → number of docs containing it
  const indexed = policies.map((p) => {
    const text = `${p.code} ${p.title} ${p.chapter} ${p.text}`.toLowerCase();
    const terms = text.match(/[a-z0-9]{3,}/g) || [];
    const termFreq = {};
    for (const t of terms) {
      termFreq[t] = (termFreq[t] || 0) + 1;
    }
    // Track document frequency
    for (const t of Object.keys(termFreq)) {
      docFreq[t] = (docFreq[t] || 0) + 1;
    }
    return { ...p, termFreq, termCount: terms.length };
  });

  policiesIndex = { policies: indexed, docFreq, totalDocs: indexed.length };
  return policiesIndex;
}

/** Extract OPM codes mentioned in text (e.g. "11-01-01", "OPM 15-02") */
function extractOpmCodes(text) {
  const matches = text.match(/\b(\d{2}-\d{2}(?:-\d{2})?)\b/g) || [];
  return [...new Set(matches)];
}

/** Map injury types to their known relevant policy codes */
const INJURY_POLICY_MAP = {
  "Acute Injury": ["11-01-01", "15-01-01", "15-02-01", "15-02-02", "15-02-03", "15-04-01", "17-01-01", "18-01-01", "19-01-01"],
  "Occupational Disease": ["11-01-01", "15-01-01", "15-02-01", "15-04-01", "16-01-01", "17-01-01", "18-01-01", "23-01-01"],
  "Traumatic Mental Stress": ["11-01-01", "15-01-01", "15-02-01", "15-03-02", "17-01-01", "18-01-01"],
  "Chronic Mental Stress": ["11-01-01", "15-01-01", "15-02-01", "15-03-14", "17-01-01", "18-01-01"],
  "PTSD (First Responder)": ["11-01-01", "15-01-01", "15-03-13", "15-03-14", "17-01-01", "18-01-01"],
  "Recurrence": ["11-01-01", "11-01-06", "15-01-01", "15-04-01", "17-01-01", "18-01-01"],
  "Aggravation of Pre-existing": ["11-01-01", "15-01-01", "15-02-01", "15-04-01", "15-04-02", "17-01-01", "18-01-01"],
};

/** Always-included core policies for any claim analysis */
const CORE_POLICIES = ["11-01-01", "11-01-02", "11-01-03", "11-01-13", "15-01-01", "15-02-01"];

/**
 * Search for relevant OPM policies given a query and optional claim context.
 *
 * @param {string} query - The user's message or question
 * @param {object} [claimContext] - Optional claim context { injuryType, description }
 * @param {number} [maxResults=12] - Maximum policies to return
 * @returns {object[]} Array of matching policy objects, scored and sorted
 */
export function searchPolicies(query, claimContext = null, maxResults = 12) {
  const { policies, docFreq, totalDocs } = getIndex();

  // 1. Exact OPM code matches (highest priority)
  const mentionedCodes = extractOpmCodes(query);
  const exactMatches = new Set();
  for (const code of mentionedCodes) {
    for (const p of policies) {
      if (p.code === code || p.code.startsWith(code)) {
        exactMatches.add(p.code);
      }
    }
  }

  // 2. Injury-type routing
  const typeMatches = new Set();
  if (claimContext?.injuryType && INJURY_POLICY_MAP[claimContext.injuryType]) {
    for (const code of INJURY_POLICY_MAP[claimContext.injuryType]) {
      typeMatches.add(code);
    }
  }

  // 3. Always include core policies for analysis requests
  const isAnalysis = /five.?point|ruling|adjudicat|analysis|allow|deny|compensab|entitlement/i.test(query);
  const coreMatches = new Set();
  if (isAnalysis) {
    for (const code of CORE_POLICIES) {
      coreMatches.add(code);
    }
  }

  // 4. TF-IDF keyword scoring
  const queryText = `${query} ${claimContext?.description || ""}`.toLowerCase();
  const queryTerms = queryText.match(/[a-z0-9]{3,}/g) || [];
  const queryTermSet = [...new Set(queryTerms)];

  const scored = policies.map((p) => {
    let score = 0;

    // Exact code match bonus
    if (exactMatches.has(p.code)) score += 100;
    // Injury-type routing bonus
    if (typeMatches.has(p.code)) score += 50;
    // Core policy bonus
    if (coreMatches.has(p.code)) score += 30;

    // TF-IDF score
    for (const term of queryTermSet) {
      const tf = (p.termFreq[term] || 0) / p.termCount;
      const df = docFreq[term] || 1;
      const idf = Math.log(totalDocs / df);
      score += tf * idf * 10;
    }

    // Boost for title/chapter match
    const titleLower = (p.title || "").toLowerCase();
    const chapterLower = (p.chapter || "").toLowerCase();
    for (const term of queryTermSet) {
      if (titleLower.includes(term)) score += 5;
      if (chapterLower.includes(term)) score += 3;
    }

    return { ...p, _score: score };
  });

  // Sort by score descending, take top results
  scored.sort((a, b) => b._score - a._score);
  return scored.filter((p) => p._score > 0).slice(0, maxResults);
}

/**
 * Format retrieved policies into a concise system prompt section.
 * Only includes the policies actually relevant to the query.
 */
export function formatPoliciesForPrompt(policies) {
  if (!policies.length) return "";

  return policies
    .map(
      (p) =>
        `\n--- OPM ${p.code}: ${p.title} ---\nChapter: ${p.chapter}\nEffective: ${p.effectiveDate || "N/A"}\nURL: ${p.url}\n\n${p.text}`
    )
    .join("\n");
}

/**
 * Get all policy codes and titles for reference (lightweight, no full text).
 * Used for the OPM reference panel in the UI.
 */
export function getPolicySummaries() {
  const { policies } = getIndex();
  return policies.map((p) => ({
    code: p.code,
    title: p.title,
    chapter: p.chapter,
    url: p.url,
    applies: p.applies,
  }));
}
