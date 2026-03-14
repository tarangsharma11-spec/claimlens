import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import { searchPolicies, formatPoliciesForPrompt } from "@/app/lib/opm-search";

/**
 * System prompt — core instructions only (~3k tokens).
 * Policy text is injected dynamically via RAG, not hardcoded.
 */
const SYSTEM_BASE = `You are CaseAssist — a specialized AI advisor for workers' compensation claims analysis. You help injury lawyers, WSIB employees, employers, and health care providers analyze workers' compensation claims against the WSIB Operational Policy Manual (OPM) and medical evidence standards.

You operate under Canadian (WCB/WSIB) and US (state workers' comp) regulatory frameworks.

WHEN USERS UPLOAD DOCUMENTS OR DESCRIBE CLAIMS:
- Read everything carefully before responding
- Extract key facts: injury description, dates, diagnosis, mechanism, treatment, worker/employer info
- Identify relevant OPM policies and medical guidelines
- Proceed directly to analysis

WHEN DOCUMENT TEXT IS PROVIDED:
- The user may include extracted text from uploaded PDFs, Form 6, Form 7, Form 8, medical reports, imaging reports, specialist letters, etc.
- Analyze the full text carefully. Extract all relevant medical and claim details.
- Cross-reference extracted information against OPM requirements.
- Identify any inconsistencies, gaps, or red flags in the documentation.

YOUR CAPABILITIES:
1. RULING GUIDANCE — Apply Five Point Check (OPM 11-01-01), evaluate medical evidence, cross-reference OPM, identify red flags, predict ruling with confidence, recommend next steps.
2. COMPLIANCE REVIEW — Filing timeliness, treatment duration, policy compliance checks.
3. RETURN-TO-WORK ASSESSMENT — RTW plan evaluation, milestone reasonableness, employer co-operation, recovery progress.
4. BENEFITS ESTIMATION — LOE framework, NEL for permanent impairment, health care entitlements, timeline expectations.
5. MEDICAL CHRONOLOGY — When asked, build a detailed chronological timeline from all medical documents provided.
6. OPM POLICY ANALYSIS — When asked about specific policies, provide the full policy text and explain how it applies.

MEDICAL DATABASE:
ICD-10: M54.5 Low back, M75.1 Rotator cuff, G56.0 Carpal tunnel, M51.1 Disc herniation, F43.1 PTSD, H83.3 Hearing loss, S62 Hand/wrist fracture, S82 Lower leg fracture, M23 Internal knee derangement, S52 Forearm fracture, F32 Depressive episode.
Recovery: strains 4-12wks, disc 3-6mo, fractures simple 6-12wks/complex 12-24wks, PTSD 8-26wks, carpal tunnel conservative 4-8wks/surgical 8-16wks, rotator cuff conservative 6-12wks/surgical 12-26wks.
RTW: Soft tissue modified 1-3d/full 2-6wks. Fractures upper 4-8/lower 8-16wks. Disc non-surg 4-8/8-16wks, surg 8-12/16-26wks. PTSD gradual 4-12wks.
Red flags: Delayed reporting >72hrs, no witnesses, inconsistent mechanism, prior claims on same body part, symptom magnification, non-organic signs.

JURISDICTION: Default Ontario WSIB. Ask if unclear.
PRIVACY: Never output full names/SINs/SSNs/DOBs in analysis. Claim ID only. PIPEDA/HIPAA compliant.

RESPONSE FORMAT for ruling guidance:
## Claim Summary
## Five Point Check (✓/✗ each point)
## Medical Evidence Assessment
## Policy References (cite OPM codes with section numbers)
## Red Flags (⚠ or "None identified")
## Ruling Prediction (**RULING PREDICTION: Allow/Deny/Further Investigation Required** + confidence + reasoning)
## Recommendations

Advisory only — final decisions by authorized WSIB decision-makers.`;

export async function POST(request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Rate limiting check
    let orgPlan = "free";
    let orgId = null;
    try {
      const { getMembership, checkRateLimit, trackUsage } = await import("@/lib/db");
      const membership = await getMembership(session.user.email);
      if (membership) {
        orgId = membership.org_id;
        orgPlan = membership.org_plan || "free";
        const limit = await checkRateLimit(orgId, orgPlan, "ai_analysis");
        if (!limit.allowed) {
          return NextResponse.json({ error: limit.message, rateLimited: true }, { status: 429 });
        }
      }
    } catch {}

    const { messages, documentTexts, claimContext, stream: wantStream } = await request.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: "Messages array required." }, { status: 400 });
    }

    // Build messages with document context if provided
    let enhancedMessages = messages.slice(-20);

    // If document texts provided, prepend as context
    if (documentTexts && Object.keys(documentTexts).length > 0) {
      const docContext = Object.entries(documentTexts)
        .map(([name, text]) => `--- Document: ${name} ---\n${text.slice(0, 8000)}`)
        .join("\n\n");

      if (enhancedMessages.length > 0 && enhancedMessages[enhancedMessages.length - 1].role === "user") {
        const lastMsg = enhancedMessages[enhancedMessages.length - 1];
        enhancedMessages = [
          ...enhancedMessages.slice(0, -1),
          {
            role: "user",
            content: `${lastMsg.content}\n\n--- UPLOADED DOCUMENTS ---\n${docContext}`,
          },
        ];
      }
    }

    // --- RAG: Retrieve relevant policies instead of sending all 289 ---
    const lastUserMsg = enhancedMessages.filter((m) => m.role === "user").pop();
    const queryText = lastUserMsg?.content || "";
    const relevantPolicies = searchPolicies(queryText, claimContext || null, 12);
    const policySection = formatPoliciesForPrompt(relevantPolicies);

    const systemPrompt = policySection
      ? `${SYSTEM_BASE}\n\n--- RELEVANT OPM POLICIES (${relevantPolicies.length} retrieved) ---\n${policySection}`
      : SYSTEM_BASE;

    // --- Streaming mode ---
    if (wantStream) {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 4096,
          system: systemPrompt,
          messages: enhancedMessages,
          stream: true,
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        return NextResponse.json({ error: err.error?.message || "AI service error." }, { status: 502 });
      }

      // Transform Anthropic SSE stream into our own SSE stream
      const encoder = new TextEncoder();
      const readable = new ReadableStream({
        async start(controller) {
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";

          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split("\n");
              buffer = lines.pop() || "";

              for (const line of lines) {
                if (!line.startsWith("data: ")) continue;
                const data = line.slice(6);
                if (data === "[DONE]") continue;

                try {
                  const event = JSON.parse(data);
                  if (event.type === "content_block_delta" && event.delta?.text) {
                    controller.enqueue(
                      encoder.encode(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`)
                    );
                  }
                  if (event.type === "message_stop") {
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
                  }
                } catch {
                  // Skip malformed events
                }
              }
            }
          } catch (err) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ error: err.message })}\n\n`)
            );
          } finally {
            controller.close();
          }
        },
      });

      return new Response(readable, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    // --- Non-streaming mode (backward compatible) ---
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        system: systemPrompt,
        messages: enhancedMessages,
      }),
    });

    const data = await response.json();

    if (data.error) {
      console.error("Anthropic API error:", data.error);
      return NextResponse.json({ error: data.error.message || "AI service error." }, { status: 502 });
    }

    const reply = data.content?.map((c) => c.text || "").join("") || "No response.";

    // Track usage (non-blocking)
    if (orgId) {
      try {
        const { trackUsage } = await import("@/lib/db");
        await trackUsage(orgId, { email: session.user.email, action: "ai_analysis", tokensUsed: data.usage?.output_tokens || 0 });
      } catch {}
    }

    return NextResponse.json({
      reply,
      _debug: {
        policiesRetrieved: relevantPolicies.length,
        policyCodes: relevantPolicies.map((p) => p.code),
        systemPromptTokens: Math.round(systemPrompt.length / 4),
      },
    });
  } catch (err) {
    console.error("Chat API error:", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
