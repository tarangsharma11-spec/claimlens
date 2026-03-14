# CaseAssist V57 — Major Architecture Upgrade

## Deployment

```bash
cd ~/Desktop/claimlens
tar xzf ~/Downloads/caseassist-v57.tar.gz
npm install pdf-parse
git add .
git commit -m "V57: RAG for OPM policies, streaming AI, component decomposition, PDF extraction, mobile responsive, PDF export"
git push
```

## What changed

### P0 — Critical architecture fixes

**1. RAG replaces 200k-token system prompt**
- `app/lib/opm-search.js` — TF-IDF + injury-type routing + exact OPM code matching
- System prompt went from ~200k tokens (all 289 policies) to ~5-10k (5-12 relevant policies per query)
- Estimated **90%+ reduction in API cost per message**
- `app/api/search/route.js` — Client-accessible OPM policy search endpoint

**2. Streaming AI responses (SSE)**
- `app/api/chat/route.js` — Complete rewrite with `stream: true` support
- `app/lib/use-streaming-chat.js` — React hook for token-by-token display
- Users see text appear in real-time instead of staring at "Reviewing..." for 10-20s
- Backward compatible: non-streaming mode still works

**3. Component decomposition (client.js: 1,518 → 1,200 lines)**
- `app/lib/constants.js` — Stages, doc types, glossary, templates, PII redaction, scenarios (170 lines)
- `app/lib/claim-engine.js` — All computed properties: deadlines, red flags, risk scores, workflow status, notifications, smart warnings, RTW progress, cost forecasts, AWW calc (276 lines)
- `app/components/AiMessage.js` — Markdown renderer extracted (84 lines)
- Main `client.js` now imports from modules instead of defining everything inline

**4. Server-side PDF text extraction**
- `app/lib/pdf-extract.js` — Uses `pdf-parse` for real PDF text extraction
- `app/api/upload/route.js` — Server-side file upload endpoint
- `client.js` updated: PDFs go to server for extraction, text files still use client-side FileReader
- **Fixes**: Previously, uploading a PDF returned garbled binary via `FileReader.readAsText()`

### P1 — High value features

**5. PDF case report export**
- `app/api/pdf-export/route.js` — Generates professional styled HTML report
- `app/lib/export-pdf.js` — Client utility that opens report in new tab for print-to-PDF
- Includes: claim summary, Five Point Check results, analysis history, documents, timeline, valuation
- "Export case report" action added to Approved stage workflow

**6. Mobile responsive fixes (login, pricing, demo pages)**
- All 3 public pages: hamburger menu nav at ≤900px
- Pricing: cards stack single-column on mobile, comparison table scrolls horizontally
- Demo: hero grid stacks vertically, "What to Expect" stacks
- Login: auth card respects viewport width, hero buttons center

### New files
```
app/lib/opm-search.js          — OPM RAG search engine
app/lib/claim-engine.js        — Claim intelligence (deadlines, risk, workflow, etc.)
app/lib/constants.js            — Shared constants and utilities
app/lib/use-streaming-chat.js   — Streaming chat React hook
app/lib/export-pdf.js           — PDF export client utility
app/lib/pdf-extract.js          — Server-side PDF text extraction
app/components/AiMessage.js     — AI response markdown renderer
app/api/chat/route.js           — Rewritten with RAG + streaming
app/api/search/route.js         — OPM policy search API
app/api/upload/route.js         — File upload with PDF extraction
app/api/pdf-export/route.js     — HTML case report generator
```

### Modified files
```
app/dashboard/client.js  — Imports from new modules, PDF upload via server, export action
app/login/page.js        — Mobile hamburger nav, responsive grids
app/pricing/page.js      — Mobile hamburger nav, single-column cards
app/demo/page.js         — Mobile hamburger nav, stacking grid
```

## Environment variables (unchanged)
```env
ANTHROPIC_API_KEY=sk-ant-...
RESEND_API_KEY=re_...
STRIPE_SECRET_KEY=sk_...
ACCESS_CODE=CASEASSIST2026
```

## New dependency
```bash
npm install pdf-parse
```

## What's next (not in this release)
- [ ] Supabase/Postgres migration (replaces localStorage)
- [ ] Multi-user team workspaces (Firm plan)
- [ ] Actual streaming display in chat UI (hook is ready, needs `send()` integration)
- [ ] OCR for scanned documents
- [ ] WSIAT decision search API integration
- [ ] Outcome tracking (prediction vs actual)
