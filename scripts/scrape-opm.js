#!/usr/bin/env node
/**
 * WSIB OPM Scraper
 * 
 * Crawls the WSIB Operational Policy Manual and builds a comprehensive
 * JSON file of all policies for CaseAssist's AI reference.
 * 
 * Usage:
 *   node scripts/scrape-opm.js
 * 
 * Requirements:
 *   npm install cheerio node-fetch
 * 
 * Output:
 *   app/data/opm-policies.json
 */

const fs = require("fs");
const path = require("path");

const BASE = "https://www.wsib.ca";
const OPM_ROOT = "/en/operational-policy-manual";
const DELAY_MS = 1500; // Be respectful - 1.5s between requests

// The OPM section URLs from the table of contents
const SECTIONS = [
  // Chapter 11 - Decision Making
  { chapter: "11", name: "Decision Making", sections: [
    "/decision-making/adjudication-principles",
    "/decision-making/types-claims",
  ]},
  // Chapter 12 - Coverage
  { chapter: "12", name: "Coverage", sections: [
    "/coverage/employer-coverage",
    "/coverage/independent-operators",
    "/coverage/optional-insurance",
    "/coverage/special-cases-worker-coverage",
  ]},
  // Chapter 13 - Safety and Prevention
  { chapter: "13", name: "Safety and Prevention", sections: [
    "/safety-and-prevention/experience-rating",
  ]},
  // Chapter 14 - Employer Obligations
  { chapter: "14", name: "Employer Obligations", sections: [
    "/employer-obligations/employer-classification",
    "/employer-obligations/employer-accounts",
    "/employer-obligations/employer-billing",
    "/employer-obligations/employer-collections",
    "/employer-obligations/accident-cost-adjustments",
  ]},
  // Chapter 15 - Claims
  { chapter: "15", name: "Claims", sections: [
    "/claims/reporting-injury-disease",
    "/claims/work-relatedness",
    "/claims/course-and-arising-out",
    "/claims/disabilities-impairments-resulting-accidents",
    "/claims/secondary-conditions",
    "/claims/special-circumstances",
  ]},
  // Chapter 16 - Long Term Exposures
  { chapter: "16", name: "Long Term Exposures", sections: [
    "/long-term-exposures/disablements",
    "/long-term-exposures/occupational-diseases",
  ]},
  // Chapter 17 - Health Care
  { chapter: "17", name: "Health Care", sections: [
    "/health-care/general",
    "/health-care/reports",
    "/health-care/treatment-fees",
    "/health-care/examinations",
    "/health-care/independent-living",
    "/health-care/prosthetic-and-assistive-devices",
  ]},
  // Chapter 18 - Benefit Payments
  { chapter: "18", name: "Benefit Payments", sections: [
    "/benefit-payments/general",
    "/benefit-payments/average-earnings",
    "/benefit-payments/loss-earnings-loe-accidents-1998",
    "/benefit-payments/future-economic-loss-fel-accidents-1990-1997",
    "/benefit-payments/non-economic-loss-nel-accidents-1990",
    "/benefit-payments/temporary-disability-benefits-accidents-1998",
    "/benefit-payments/permanent-disability-benefits-accidents-1990",
  ]},
  // Chapter 19 - Return to Work
  { chapter: "19", name: "Return to Work", sections: [
    "/return-work/return-work-rtw",
    "/return-work/re-employment-construction-industry",
  ]},
  // Chapter 20 - Survivors
  { chapter: "20", name: "Survivors", sections: [
    "/survivors/general",
    "/survivors/services-survivors",
    "/survivors/benefits-survivors",
  ]},
  // Chapter 21 - Confidentiality
  { chapter: "21", name: "Confidentiality", sections: [
    "/confidentiality/access-information-employers",
    "/confidentiality/access-claim-file-information",
  ]},
  // Chapter 22 - Compliance
  { chapter: "22", name: "Compliance", sections: [
    "/compliance/compliance",
  ]},
  // Chapter 23 - Occupational Diseases
  { chapter: "23", name: "Occupational Diseases", sections: [
    "/occupational-diseases/acute-exposures",
    "/occupational-diseases/chronic-exposures",
  ]},
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchPage(url) {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "CaseAssist OPM Scraper/1.0 (research tool)",
        "Accept": "text/html",
      },
    });
    if (!res.ok) {
      console.warn(`  [${res.status}] ${url}`);
      return null;
    }
    return await res.text();
  } catch (e) {
    console.warn(`  [ERROR] ${url}: ${e.message}`);
    return null;
  }
}

function extractPolicyLinks(html, sectionUrl) {
  // Find links to individual policy pages within the section
  // WSIB policy links look like: /en/operational-policy-manual/policy-name
  const links = [];
  const regex = /href="(\/en\/operational-policy-manual\/[^"]+)"/g;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const href = match[1];
    // Skip section/chapter links, archives, and the current page
    if (
      href.includes("/archive-") ||
      href === `/en/operational-policy-manual` ||
      href.endsWith("/user-guide") ||
      SECTIONS.some(s => s.sections.some(sec => `/en/operational-policy-manual${sec}` === href)) ||
      SECTIONS.some(s => `/en/operational-policy-manual/${s.name.toLowerCase().replace(/ /g, '-')}` === href)
    ) continue;
    
    if (!links.includes(href)) {
      links.push(href);
    }
  }
  return links;
}

function extractPolicyContent(html) {
  // Extract the main content area text
  // The policy content is typically in the main-content area
  // Strip HTML tags and navigation
  
  // Try to find the article/main content
  let content = html;
  
  // Remove everything before main-content
  const mainIdx = content.indexOf('id="main-content"');
  if (mainIdx > 0) {
    content = content.substring(mainIdx);
  }
  
  // Remove script and style tags
  content = content.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");
  content = content.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");
  content = content.replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "");
  
  // Strip HTML tags
  content = content.replace(/<[^>]+>/g, " ");
  
  // Clean up whitespace
  content = content.replace(/\s+/g, " ").trim();
  
  // Extract title (usually first significant text)
  const titleMatch = content.match(/^[^|]+/);
  const title = titleMatch ? titleMatch[0].trim().split("  ")[0] : "";
  
  // Extract policy code (e.g., "11-01-01")
  const codeMatch = content.match(/\b(\d{2}-\d{2}-\d{2})\b/);
  const code = codeMatch ? codeMatch[1] : "";
  
  // Extract effective date
  const dateMatch = content.match(/This (?:policy|document) applies to all (?:decisions|claims|reconsiderations)[^.]*on or after ([^,.\n]+)/i);
  const effectiveDate = dateMatch ? dateMatch[1].trim() : "";
  
  // Extract legislation reference
  const legMatch = content.match(/Workplace Safety and Insurance Act[^.]*Section[s]?\s+([^.]+)/i);
  const legislation = legMatch ? `WSIA s. ${legMatch[1].trim()}` : "";
  
  // Get the main body text (skip navigation and footer stuff)
  // Find text between the title and the footer/related content
  let bodyText = content;
  
  // Remove common footer text
  bodyText = bodyText.replace(/Businesses Registration and coverage.*$/s, "");
  bodyText = bodyText.replace(/This document (?:replaces|was previously).*$/m, "");
  
  // Trim to reasonable length
  if (bodyText.length > 5000) {
    bodyText = bodyText.substring(0, 5000) + "...";
  }
  
  return { title, code, effectiveDate, legislation, text: bodyText };
}

async function main() {
  console.log("═══════════════════════════════════════");
  console.log("  WSIB OPM Scraper for CaseAssist");
  console.log("═══════════════════════════════════════\n");
  
  const opm = {
    version: new Date().toISOString().split("T")[0],
    source: "WSIB Operational Policy Manual (wsib.ca/en/operational-policy-manual)",
    disclaimer: "Scraped from publicly available WSIB OPM pages. For authoritative text, visit the URL for each policy.",
    scrapedAt: new Date().toISOString(),
    chapters: {},
    policies: {},
  };
  
  // Register chapters
  for (const ch of SECTIONS) {
    opm.chapters[ch.chapter] = ch.name;
  }
  
  let totalPolicies = 0;
  
  for (const chapter of SECTIONS) {
    console.log(`\nChapter ${chapter.chapter}: ${chapter.name}`);
    console.log("─".repeat(40));
    
    for (const sectionPath of chapter.sections) {
      const sectionUrl = `${BASE}${OPM_ROOT}${sectionPath}`;
      console.log(`  Section: ${sectionPath}`);
      
      await sleep(DELAY_MS);
      const sectionHtml = await fetchPage(sectionUrl);
      
      if (!sectionHtml) {
        console.log("    [SKIP] Could not fetch section page");
        continue;
      }
      
      // Find individual policy links
      const policyLinks = extractPolicyLinks(sectionHtml, sectionPath);
      console.log(`    Found ${policyLinks.length} policy links`);
      
      for (const link of policyLinks) {
        const policyUrl = `${BASE}${link}`;
        await sleep(DELAY_MS);
        
        const policyHtml = await fetchPage(policyUrl);
        if (!policyHtml) continue;
        
        const extracted = extractPolicyContent(policyHtml);
        
        if (!extracted.code && !extracted.title) {
          // Try to derive from URL
          const slug = link.split("/").pop();
          extracted.title = slug
            .replace(/-/g, " ")
            .replace(/\b\w/g, (c) => c.toUpperCase());
        }
        
        const policyCode = extracted.code || `${chapter.chapter}-xx-xx`;
        
        opm.policies[policyCode] = {
          code: policyCode,
          title: extracted.title,
          chapter: `${chapter.chapter} - ${chapter.name}`,
          section: sectionPath.split("/").pop().replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
          url: policyUrl,
          effectiveDate: extracted.effectiveDate || "",
          legislation: extracted.legislation || "",
          text: extracted.text,
          keyPoints: [],
          applies: ["all"],
        };
        
        totalPolicies++;
        console.log(`      [${policyCode}] ${extracted.title?.substring(0, 50)}`);
      }
    }
  }
  
  // Write output
  const outputPath = path.join(__dirname, "..", "app", "data", "opm-policies.json");
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(opm, null, 2));
  
  console.log("\n═══════════════════════════════════════");
  console.log(`  Done! ${totalPolicies} policies scraped`);
  console.log(`  Output: ${outputPath}`);
  console.log(`  Size: ${(fs.statSync(outputPath).size / 1024).toFixed(1)} KB`);
  console.log("═══════════════════════════════════════");
}

main().catch(console.error);
