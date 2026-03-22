/**
 * Prospect audit script:
 * - Uses Google Places API to identify the target place
 * - Searches top 10 Places results for niche keywords (approx. Google Maps ranking)
 * - Audits the target website with quick heuristics
 * - Computes pain score (1-10), estimated monthly revenue lost, and outreach messages
 *
 * Usage:
 *   node prospect-audit.js "Santa Barbara Dental" "Santa Barbara" dental
 */

/* eslint-disable no-console */

const fs = require("node:fs");
const path = require("node:path");

// dotenv is required by prompt; it's present in this project via nested deps.
const dotenv = require("dotenv");
dotenv.config();

const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY;
if (!GOOGLE_PLACES_API_KEY) {
  console.error("Missing GOOGLE_PLACES_API_KEY in your .env file.");
  process.exit(1);
}

function usageAndExit() {
  console.error(
    'Usage: node prospect-audit.js "business name" "city" niche\n' +
      'niche must be one of: dental | medspa | roofing | hvac'
  );
  process.exit(1);
}

const [businessNameRaw, cityRaw, nicheRaw] = process.argv.slice(2);
if (!businessNameRaw || !cityRaw || !nicheRaw) usageAndExit();

const businessName = String(businessNameRaw).trim();
const city = String(cityRaw).trim();
const niche = String(nicheRaw).trim().toLowerCase();

const NICHES = ["dental", "medspa", "roofing", "hvac"];
if (!NICHES.includes(niche)) usageAndExit();

function slugify(input) {
  return String(input)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function safeText(v) {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  return "";
}

function normalizeForMatch(s) {
  return safeText(s)
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokens(s) {
  const t = normalizeForMatch(s).split(/\s+/).filter(Boolean);
  // remove common stopwords to avoid false positives
  return t.filter((x) => !["the", "and", "or", "inc", "llc", "co", "company", "dental"].includes(x));
}

function jaccard(a, b) {
  const A = new Set(a);
  const B = new Set(b);
  const inter = [...A].filter((x) => B.has(x)).length;
  const union = new Set([...a, ...b]).size;
  if (!union) return 0;
  return inter / union;
}

function formatMoney(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return null;
  return num.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function toHttpUrl(maybeUrl) {
  const u = safeText(maybeUrl).trim();
  if (!u) return null;
  if (/^https?:\/\//i.test(u)) return u;
  return `https://${u}`;
}

function extractDisplayName(place) {
  return safeText(place?.displayName?.text) || safeText(place?.displayName) || safeText(place?.shortFormattedAddress) || "";
}

function extractWebsiteUri(place) {
  return safeText(place?.websiteUri) || safeText(place?.websiteUri?.value) || "";
}

function extractPhone(place) {
  return safeText(place?.internationalPhoneNumber) || safeText(place?.formattedPhoneNumber) || "";
}

function extractRating(place) {
  const r = place?.rating;
  return typeof r === "number" ? r : null;
}

function extractReviewCount(place) {
  const c = place?.userRatingCount;
  return typeof c === "number" ? c : null;
}

function extractTypes(place) {
  const arr = place?.types;
  if (Array.isArray(arr)) return arr.filter((x) => typeof x === "string");
  return [];
}

function extractPhotosCount(place) {
  const arr = place?.photos;
  if (!Array.isArray(arr)) return null;
  return arr.length;
}

function extractPlaceId(place) {
  // Often returned as string id, but sometimes wrapped depending on endpoint/field masks.
  return safeText(place?.id) || safeText(place?.placeId) || "";
}

function parseLatestReviewPublishTimeMs(placeDetails) {
  // Place Details can return reviews[] with publishTime; we use latest publishTime as a proxy
  // for GBP "last post date" because Posts aren't available via this endpoint.
  const reviews = placeDetails?.reviews;
  if (!Array.isArray(reviews) || reviews.length === 0) return null;
  const times = reviews
    .map((r) => r?.publishTime)
    .map((t) => (t ? Date.parse(t) : NaN))
    .filter((x) => Number.isFinite(x));
  if (times.length === 0) return null;
  return Math.max(...times);
}

async function googlePlacesTextSearch({ query, pageSize = 10, fieldMask }) {
  const url = "https://places.googleapis.com/v1/places:searchText";

  const body = {
    textQuery: query,
    pageSize,
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": GOOGLE_PLACES_API_KEY,
      "X-Goog-FieldMask": fieldMask,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Google Places searchText failed: ${res.status} ${res.statusText}. ${text}`);
  }

  return res.json();
}

async function googlePlacesGetPlace({ placeId, fieldMask }) {
  const url = `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`;
  const res = await fetch(url, {
    method: "GET",
    headers: {
      "X-Goog-Api-Key": GOOGLE_PLACES_API_KEY,
      "X-Goog-FieldMask": fieldMask,
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Google Places get failed: ${res.status} ${res.statusText}. ${text}`);
  }

  return res.json();
}

function ctrForPosition(pos) {
  // Heuristic CTR curve for map/GBP-like listings.
  // position 1..10, where pos=11+ is treated as 10th.
  const table = {
    1: 0.25,
    2: 0.18,
    3: 0.13,
    4: 0.10,
    5: 0.08,
    6: 0.06,
    7: 0.05,
    8: 0.04,
    9: 0.03,
    10: 0.02,
  };
  const p = clamp(Math.floor(pos), 1, 10);
  return table[p] ?? 0.02;
}

const KEYWORDS_BY_NICHE = {
  dental: [
    (c) => `cosmetic dentist ${c}`,
    (c) => `dental implants ${c}`,
  ],
  medspa: [
    (c) => `med spa ${c}`,
    (c) => `botox ${c}`,
  ],
  roofing: [
    (c) => `roofer ${c}`,
    (c) => `emergency roof repair ${c}`,
  ],
  hvac: [
    (c) => `HVAC ${c}`,
    (c) => `plumber ${c}`,
  ],
};

const AVG_JOB_VALUE_BY_NICHE = {
  dental: 4000,
  medspa: 800,
  roofing: 12000,
  hvac: 1500,
};

// Revenue estimate calibration for the Santa Barbara / Ventura market.
const LOCAL_MARKET_MULTIPLIER_SB_VC = 0.03;
const CLICK_TO_LEAD_RATE = 0.15;
const LEAD_TO_CUSTOMER_RATE = 0.2;

// CTR + search volume are assumptions so the script can compute revenue.
// If you want true volumes, we can later add Google Ads API integration.
const MONTHLY_SEARCH_VOLUME_ASSUMPTIONS = {
  dental: {
    // for each keyword we compute independently
    "cosmetic dentist": 6600,
    "dental implants": 7400,
  },
  medspa: {
    "med spa": 12000,
    botox: 9000,
  },
  roofing: {
    roofer: 10000,
    "emergency roof repair": 5400,
  },
  hvac: {
    HVAC: 18000,
    plumber: 9500,
  },
};

function keywordLookupKey(keywordQuery) {
  // map full query (e.g. "cosmetic dentist Santa Barbara") back to assumption key.
  // This is intentionally heuristic.
  const q = keywordQuery.toLowerCase();
  if (niche === "dental") {
    if (q.includes("cosmetic dentist")) return "cosmetic dentist";
    if (q.includes("dental implants")) return "dental implants";
  }
  if (niche === "medspa") {
    if (q.includes("med spa")) return "med spa";
    if (q.includes("botox")) return "botox";
  }
  if (niche === "roofing") {
    if (q.includes("roofer")) return "roofer";
    if (q.includes("emergency roof repair")) return "emergency roof repair";
  }
  if (niche === "hvac") {
    if (q.includes("hvac")) return "HVAC";
    if (q.includes("plumber")) return "plumber";
  }
  return keywordQuery;
}

function normalizeWordTokens(s) {
  return normalizeForMatch(s)
    .split(/\s+/)
    .map((x) => x.trim())
    .filter(Boolean);
}

function nameWordsForMatching(name, { city: cityName } = {}) {
  const stop = new Set([
    "the",
    "and",
    "or",
    "inc",
    "llc",
    "pllc",
    "ltd",
    "co",
    "company",
    "center",
    "clinic",
    "suite",
    "office",
  ]);

  // Exclude the city tokens and very niche-generic tokens so we don't "strong-match"
  // every local business that happens to share "dental", "spa", etc.
  const cityTokens = new Set(
    cityName
      ? normalizeWordTokens(cityName)
          .filter((w) => w.length >= 2)
          .map((w) => w.trim())
      : []
  );

  const nicheGeneric = (() => {
    switch (niche) {
      case "dental":
        return new Set(["dental", "dentist", "dentistry", "dds"]);
      case "medspa":
        return new Set(["med", "medspa", "spa", "botox", "aesthetics", "aesthetic"]);
      case "roofing":
        return new Set(["roof", "roofer", "roofing", "repair", "repairs", "emergency"]);
      case "hvac":
        return new Set(["hvac", "heating", "air", "cooling"]);
      default:
        return new Set();
    }
  })();

  const words = normalizeWordTokens(name)
    .filter((w) => !stop.has(w))
    .filter((w) => w.length >= 2)
    .filter((w) => !cityTokens.has(w))
    .filter((w) => !nicheGeneric.has(w));

  // If we filtered everything, return an empty list.
  // That intentionally triggers the "ambiguous match" path rather than guessing
  // with overly-generic tokens like "dental".
  return words;
}

function pickBiggestPainPoint({ rankingNorm, reviewGapNorm, daysNorm, websiteNorm }) {
  const entries = [
    ["ranking_position", rankingNorm],
    ["review_gap", reviewGapNorm],
    ["days_since_post", daysNorm],
    ["website_issues", websiteNorm],
  ];
  entries.sort((a, b) => b[1] - a[1]);
  return entries[0][0];
}

function labelPainPoint(id) {
  switch (id) {
    case "ranking_position":
      return "Google Maps ranking position";
    case "review_gap":
      return "review volume vs the local leader";
    case "days_since_post":
      return "stale Google Business Profile activity";
    case "website_issues":
      return "website mobile/UX + trust gaps";
    default:
      return "conversion blockers";
  }
}

function websiteAuditIssues({ html, city }) {
  const issues = [];
  const lower = html.toLowerCase();

  const viewportMeta = /<meta[^>]+name=["']viewport["'][^>]*>/i.test(html) && /width\s*=\s*device-width/i.test(html);
  if (!viewportMeta) issues.push("Missing viewport meta tag (mobile friendly)");

  const schemaPresent = /<script[^>]+type=["']application\/ld\+json["'][^>]*>/i.test(html);
  if (!schemaPresent) issues.push("Missing schema.org (LD+JSON) markup");

  // Very heuristic location page check:
  // - Look for city mention in link hrefs
  // - or common "locations/service-area" URLs
  const citySlug = city
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  const locationHrefHit =
    new RegExp(`href=["'][^"']*(${citySlug}|${city.toLowerCase()}|locations|location|service-area|service-areas)`, "i").test(html) ||
    /locations|service-areas|service-area|our-locations|office-location/i.test(lower);

  if (!locationHrefHit) issues.push("No obvious location/city page signals");

  const scriptTags = [...html.matchAll(/<script[^>]*src=["'][^"']+["'][^>]*>/gi)].map((m) => m[0]);
  const blockingScripts = scriptTags.filter((tag) => !/\b(async|defer)\b/i.test(tag));
  if (blockingScripts.length > 2) issues.push(`Potentially blocking scripts (${blockingScripts.length} without async/defer)`);

  // Basic load sanity
  const hasTitle = /<title[^>]*>[\s\S]*?<\/title>/i.test(html);
  if (!hasTitle) issues.push("Missing <title> tag");

  return {
    issues,
    issueCount: issues.length,
    checks: {
      viewportMeta,
      schemaPresent,
      locationHrefHit,
      blockingScriptCount: blockingScripts.length,
      htmlByteLength: Buffer.byteLength(html, "utf8"),
    },
  };
}

async function fetchWithTimeout(url, { timeoutMs = 15000, headers = {} } = {}) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { method: "GET", headers, signal: controller.signal, redirect: "follow" });
    return res;
  } finally {
    clearTimeout(id);
  }
}

async function auditWebsite({ url, city }) {
  if (!url) {
    return { url: null, ok: false, error: "No website URL available from Places API." };
  }

  const finalUrl = toHttpUrl(url);
  if (!finalUrl) {
    return { url, ok: false, error: "Could not normalize website URL." };
  }

  console.log(`Fetching website: ${finalUrl}`);
  const res = await fetchWithTimeout(finalUrl, {});
  const ct = res.headers.get("content-type") || "";
  const body = await res.text();

  if (!res.ok) {
    return {
      url: finalUrl,
      ok: false,
      status: res.status,
      contentType: ct,
      error: `HTTP ${res.status}`,
    };
  }

  const audit = websiteAuditIssues({ html: body, city });
  return {
    url: finalUrl,
    ok: true,
    contentType: ct,
    ...audit,
  };
}

function keywordPhraseWithoutCity(keyword, cityName) {
  const k = safeText(keyword).trim();
  const c = safeText(cityName).trim();
  if (!k) return "";
  if (!c) return k;
  const escaped = c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return k.replace(new RegExp(`\\s+${escaped}\\s*$`, "i"), "").trim() || k;
}

/**
 * Pick the keyword result whose prospect rank is worst (highest position number),
 * for outreach competitor context (rank 1 & 2 names on that SERP).
 */
function pickOutreachRankingEntry(rankingByKeyword) {
  if (!Array.isArray(rankingByKeyword) || rankingByKeyword.length === 0) return null;
  const usable = rankingByKeyword.filter((e) => e && Array.isArray(e.top10) && e.top10.length >= 2);
  if (usable.length === 0) return null;
  const withPos = usable.filter((e) => e.position !== null && e.position !== undefined);
  if (withPos.length === 0) return usable[0];
  return withPos.reduce((worst, e) => (e.position > worst.position ? e : worst), withPos[0]);
}

/** First N whitespace-separated words only — for outreach copy; JSON keeps full names. */
function truncateCompetitorNameForOutreach(name, maxWords = 3) {
  const words = safeText(name)
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return "";
  return words.slice(0, maxWords).join(" ");
}

function buildOutreachMessages({
  businessName,
  city,
  painPointId,
  painLabel,
  revenueLostPerMonth,
  rankingWorst,
  prospectReviewCount,
  topCompetitorReviewCount,
  maxCompetitorReviewCount,
  daysSinceLastPostProxy,
  websiteIssueCount,
  nicheKeywordPhrase,
  competitor1Name,
  competitor2Name,
  daysSincePost,
}) {
  const revenueLostStr = formatMoney(revenueLostPerMonth) || `$${Math.round(revenueLostPerMonth).toLocaleString("en-US")}`;
  const painDetail = (() => {
    if (painPointId === "ranking_position") return `you’re not consistently showing at the very top of the Map Pack (worst rank: #${rankingWorst})`;
    if (painPointId === "review_gap") return `your review volume trails the local leader (${prospectReviewCount ?? "?"} vs ${maxCompetitorReviewCount ?? "?"} reviews)`;
    if (painPointId === "days_since_post") return `your GBP freshness looks low (last GBP activity proxy: ~${Math.round(daysSinceLastPostProxy)} days ago)`;
    if (painPointId === "website_issues") return `your website has a few conversion blockers (${websiteIssueCount} issues found)`;
    return "your presence has conversion gaps";
  })();

  function truncateToWordLimitPreservingTrailingQuestion(text, maxWords) {
    const trimmed = safeText(text).trim();
    if (!trimmed) return trimmed;
    const hasQuestion = trimmed.endsWith("?");
    const cleaned = hasQuestion ? trimmed.slice(0, -1).trim() : trimmed;
    const words = cleaned.split(/\s+/).filter(Boolean);
    if (words.length <= maxWords) return hasQuestion ? `${cleaned}?` : cleaned;
    const sliced = words.slice(0, maxWords).join(" ");
    return hasQuestion ? `${sliced}?` : sliced;
  }

  const prospectRc = typeof prospectReviewCount === "number" ? prospectReviewCount : 0;
  const topRc = typeof topCompetitorReviewCount === "number" ? topCompetitorReviewCount : 0;

  const competitor1Short = truncateCompetitorNameForOutreach(competitor1Name);
  const competitor2Short = truncateCompetitorNameForOutreach(competitor2Name);

  const gbpMessage =
    `Hi ${businessName},\n\n` +
    `I was searching for a ${nicheKeywordPhrase} in ${city} and noticed ${competitor1Short} and ${competitor2Short} are consistently showing above you. Your profile has ${prospectRc} reviews vs their ${topRc} — and your last GBP post was ${daysSincePost} days ago.\n\n` +
    `That gap is costing you roughly ${revenueLostStr}/month in missed patients. I can show you exactly what to fix — worth a look?`;

  const emailSubject = `Why ${competitor1Short} is ranking above ${businessName} on Google Maps`;

  let smsMessage =
    `Hi — ${businessName} has ${prospectRc} Google reviews vs ${competitor1Short}'s ${topRc}. That gap costs ~${revenueLostStr}/mo. Want the quick fix?`;

  // Enforce SMS < 50 words.
  smsMessage = truncateToWordLimitPreservingTrailingQuestion(smsMessage, 50);

  // Enforce GBP < 120 words.
  const gbpWordCount = safeText(gbpMessage)
    .replace(/\n+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
  const maxGbpWords = 120;
  let safeGbpMessage = gbpMessage;
  if (gbpWordCount > maxGbpWords) {
    safeGbpMessage = truncateToWordLimitPreservingTrailingQuestion(gbpMessage, maxGbpWords);
  }

  return { gbpMessage: safeGbpMessage, emailSubject, smsMessage };
}

async function main() {
  console.log(`Loading environment + inputs...`);
  console.log(`Target: "${businessName}" | City: "${city}" | Niche: "${niche}"`);

  const businessSearchQuery = `${businessName} ${city}`;
  console.log(`\n[1/6] Finding target place via Places API: "${businessSearchQuery}"`);

  const baseFieldMaskForSearch = [
    "places.id",
    "places.displayName",
    "places.rating",
    "places.userRatingCount",
    "places.websiteUri",
    "places.internationalPhoneNumber",
    "places.types",
  ].join(",");

  const placeSearch = await googlePlacesTextSearch({
    query: businessSearchQuery,
    pageSize: 10,
    fieldMask: baseFieldMaskForSearch,
  });

  const candidatePlaces = Array.isArray(placeSearch?.places) ? placeSearch.places : [];
  if (candidatePlaces.length === 0) {
    throw new Error("No Places candidates found for the target business query.");
  }

  const matchingWords = nameWordsForMatching(businessName, { city });
  const inputNameTokensJaccard = tokens(businessName);

  const normalizeCandidateNameTokens = (place) => normalizeWordTokens(extractDisplayName(place));

  const websiteHostFromFirst = (() => {
    const first = candidatePlaces[0];
    const site = toHttpUrl(extractWebsiteUri(first));
    if (!site) return null;
    try {
      return new URL(site).hostname;
    } catch {
      return null;
    }
  })();

  const scoredCandidates = candidatePlaces.map((p) => {
    const placeName = extractDisplayName(p);
    const placeTokens = normalizeCandidateNameTokens(p);
    const matchedWords = matchingWords.filter((w) => placeTokens.includes(w));
    const strongMatch = matchedWords.length > 0;

    const scoreNameSimilarity = jaccard(inputNameTokensJaccard, tokens(placeName));

    let scoreWebsite = 0;
    const candSite = toHttpUrl(extractWebsiteUri(p));
    if (websiteHostFromFirst && candSite) {
      try {
        const host = new URL(candSite).hostname;
        scoreWebsite = host === websiteHostFromFirst ? 0.35 : 0;
      } catch {
        scoreWebsite = 0;
      }
    }

    // Score is mostly driven by word containment; jaccard only refines ranking.
    const score = matchedWords.length * 2 + scoreNameSimilarity + scoreWebsite;

    return { place: p, placeName, matchedWords, strongMatch, score };
  });

  const strongCandidates = scoredCandidates.filter((x) => x.strongMatch);

  let bestCandidate = null;
  let candidateSelection = {
    mode: null,
    topCandidates: [],
    selectedIndex: null,
  };

  if (strongCandidates.length > 0) {
    bestCandidate = strongCandidates.sort((a, b) => b.score - a.score)[0].place;
    candidateSelection.mode = "strong_name_word_match";
  } else {
    // Requirement: if no strong match found, return top 3 candidates and ask the user to confirm.
    const top3 = scoredCandidates.sort((a, b) => b.score - a.score).slice(0, 3);
    candidateSelection.mode = "user_confirm_candidate";
    candidateSelection.topCandidates = top3.map((x, idx) => ({
      index: idx + 1,
      name: x.placeName,
      matchedWords: x.matchedWords,
      score: x.score,
      rating: extractRating(x.place),
      reviewCount: extractReviewCount(x.place),
      websiteUri: extractWebsiteUri(x.place),
      phone: extractPhone(x.place),
      placeId: extractPlaceId(x.place),
    }));

    console.log("\n[1/6] Name matching was ambiguous. Top candidates returned by Places API:");
    for (const c of candidateSelection.topCandidates) {
      console.log(
        `  ${c.index}) ${c.name} | rating: ${c.rating ?? "?"} | reviews: ${c.reviewCount ?? "?"} | website: ${c.websiteUri ?? "?"}`
      );
    }

    let selectedIndex = 0;
    if (process.stdin.isTTY) {
      const rl = require("node:readline/promises");
      const readline = rl;
      const rlIface = readline.createInterface({ input: process.stdin, output: process.stdout });
      try {
        const answer = await rlIface.question(`\nWhich candidate is the correct one? Enter 1-${top3.length}: `);
        const parsed = Number(String(answer).trim());
        selectedIndex = Number.isFinite(parsed) && parsed >= 1 && parsed <= top3.length ? parsed - 1 : 0;
      } finally {
        rlIface.close();
      }
    } else {
      console.warn("\nstdin is not interactive; defaulting to candidate #1.");
      selectedIndex = 0;
    }

    candidateSelection.selectedIndex = selectedIndex + 1;
    bestCandidate = top3[selectedIndex]?.place;
  }

  if (!bestCandidate) throw new Error("Could not select a candidate place match.");

  const targetPlaceId = extractPlaceId(bestCandidate);
  if (!targetPlaceId) throw new Error("Best candidate did not include a place id.");

  console.log(`Target place selected (id: ${targetPlaceId})`);

  console.log(`\n[2/6] Pulling target place details (reviews, photos, website, categories)...`);
  const detailsFieldMask = [
    "id",
    "displayName",
    "rating",
    "userRatingCount",
    "photos",
    "types",
    "websiteUri",
    "internationalPhoneNumber",
    "reviews",
  ].join(",");

  const targetDetails = await googlePlacesGetPlace({ placeId: targetPlaceId, fieldMask: detailsFieldMask });

  const targetReviewCount = extractReviewCount(targetDetails);
  const targetRating = extractRating(targetDetails);
  const targetPhotosCount = extractPhotosCount(targetDetails);
  const targetTypes = extractTypes(targetDetails);
  const targetWebsiteUri = extractWebsiteUri(targetDetails);
  const targetPhone = extractPhone(targetDetails);

  const lastPostProxyMs = parseLatestReviewPublishTimeMs(targetDetails);
  const lastPostProxyDate = lastPostProxyMs ? new Date(lastPostProxyMs).toISOString() : null;
  const daysSinceLastPostProxy = (() => {
    if (!lastPostProxyMs) return null;
    return Math.max(0, (Date.now() - lastPostProxyMs) / (1000 * 60 * 60 * 24));
  })();

  console.log(`\n[3/6] Searching top 10 competitors by niche keywords...`);

  const nicheKeywords = KEYWORDS_BY_NICHE[niche].map((fn) => fn(city));
  const searchFieldMask = baseFieldMaskForSearch;

  const rankingByKeyword = [];
  let rankingWorst = 0;
  let hasAnyKnownRank = false;

  let maxTopCompetitorReviewCount = 0;
  let prospectReviewCountForPain = targetReviewCount ?? 0;

  for (const keyword of nicheKeywords) {
    console.log(`Searching: "${keyword}"`);
    // Helps keep within rate limits a bit.
    await sleep(350);

    const searchResp = await googlePlacesTextSearch({
      query: keyword,
      pageSize: 10,
      fieldMask: searchFieldMask,
    });

    const places = Array.isArray(searchResp?.places) ? searchResp.places : [];
    const results = places.slice(0, 10);

    const topCompetitor = results.reduce(
      (acc, p) => {
        const rc = extractReviewCount(p) ?? 0;
        if (rc > acc.reviewCount) return { place: p, reviewCount: rc };
        return acc;
      },
      { place: null, reviewCount: 0 }
    );

    maxTopCompetitorReviewCount = Math.max(maxTopCompetitorReviewCount, topCompetitor.reviewCount);

    // Find target rank within the top 10 by strict name token containment.
    const targetWebsiteHost = (() => {
      const site = toHttpUrl(targetWebsiteUri);
      if (!site) return null;
      try {
        return new URL(site).hostname;
      } catch {
        return null;
      }
    })();

    let bestRank = null; // 1..10
    let bestMatchScore = 0; // higher is better
    let bestCandidate = null;

    const targetNameTokensForStrictMatch = matchingWords;
    for (let i = 0; i < results.length; i++) {
      const p = results[i];
      const placeName = extractDisplayName(p);
      const placeTokens = normalizeWordTokens(placeName);
      const matchedWords = targetNameTokensForStrictMatch.filter((w) => placeTokens.includes(w));
      const strongMatch = matchedWords.length > 0;
      if (!strongMatch) continue;

      let scoreWebsite = 0;
      if (targetWebsiteHost) {
        const candSite = toHttpUrl(extractWebsiteUri(p));
        if (candSite) {
          try {
            const host = new URL(candSite).hostname;
            scoreWebsite = host === targetWebsiteHost ? 0.35 : 0;
          } catch {
            scoreWebsite = 0;
          }
        }
      }

      const score = matchedWords.length * 2 + scoreWebsite;
      if (score > bestMatchScore) {
        bestMatchScore = score;
        bestRank = i + 1; // 1-index
        bestCandidate = p;
      }
    }

    let position = null;
    let targetResult = null;
    if (bestCandidate && bestRank) {
      position = bestRank;
      hasAnyKnownRank = true;
      rankingWorst = Math.max(rankingWorst, position);
      targetResult = bestCandidate;
    } else {
      // No strong match within top 10 for this keyword.
      position = null;
      targetResult = null;
    }

    rankingByKeyword.push({
      keyword,
      position,
      bestMatchScore,
      targetCandidate: targetResult
        ? {
            name: extractDisplayName(targetResult),
            placeId: extractPlaceId(targetResult),
            rating: extractRating(targetResult),
            reviewCount: extractReviewCount(targetResult),
            websiteUri: extractWebsiteUri(targetResult),
          }
        : null,
      topCompetitor: topCompetitor.place
        ? {
            rank: 1, // not necessarily true but helps
            name: extractDisplayName(topCompetitor.place),
            placeId: extractPlaceId(topCompetitor.place),
            rating: extractRating(topCompetitor.place),
            reviewCount: extractReviewCount(topCompetitor.place),
            websiteUri: extractWebsiteUri(topCompetitor.place),
          }
        : null,
      top10: results.map((p, idx) => ({
        rank: idx + 1,
        placeId: extractPlaceId(p),
        name: extractDisplayName(p),
        rating: extractRating(p),
        reviewCount: extractReviewCount(p),
        websiteUri: extractWebsiteUri(p),
        phone: extractPhone(p),
      })),
    });
  }

  const websiteUrl = targetWebsiteUri ? toHttpUrl(targetWebsiteUri) : null;

  console.log(`\n[4/6] Auditing target website for mobile/UX + trust signals...`);
  const websiteAudit = await auditWebsite({ url: websiteUrl, city });

  const websiteIssueCount = websiteAudit?.issueCount ?? 0;

  console.log(`\n[5/6] Computing pain score (1-10) and revenue lost estimate...`);

  const worstRankForScoring = hasAnyKnownRank ? rankingWorst : 10;
  // Keep `rankingWorst` in sync for message tone.
  rankingWorst = worstRankForScoring;
  const rankingNorm = clamp((Math.min(worstRankForScoring, 10) - 1) / 9, 0, 1);
  const reviewGapNorm = (() => {
    const prospect = prospectReviewCountForPain || 0;
    const top = maxTopCompetitorReviewCount || 0;
    if (top <= 0) return 0;
    const diff = Math.max(0, top - prospect);
    return clamp(diff / top, 0, 1);
  })();
  const daysNorm = clamp((daysSinceLastPostProxy ?? 180) / 180, 0, 1);
  const websiteNorm = clamp(websiteIssueCount / 4, 0, 1);

  const painWeighting = {
    ranking_position: 0.4,
    review_gap: 0.2,
    days_since_post: 0.2,
    website_issues: 0.2,
  };

  const weighted =
    painWeighting.ranking_position * rankingNorm +
    painWeighting.review_gap * reviewGapNorm +
    painWeighting.days_since_post * daysNorm +
    painWeighting.website_issues * websiteNorm;

  const painScore = Math.round(1 + 9 * weighted);

  const painPointId = pickBiggestPainPoint({
    rankingNorm,
    reviewGapNorm,
    daysNorm,
    websiteNorm,
  });

  const painLabel = labelPainPoint(painPointId);

  // Revenue estimate.
  const avgJobValue = AVG_JOB_VALUE_BY_NICHE[niche];
  const keywordRevenue = [];
  let estimatedMonthlyRevenueLost = 0;

  for (const keyword of nicheKeywords) {
    const keywordKey = keywordLookupKey(keyword);
    const monthSearches = MONTHLY_SEARCH_VOLUME_ASSUMPTIONS[niche]?.[keywordKey] ?? 5000;

    const entry = rankingByKeyword.find((x) => x.keyword === keyword);
    const prospectPos = entry?.position ?? 11;
    const ctrDiff = Math.max(0, ctrForPosition(1) - ctrForPosition(prospectPos));
    // New calibrated revenue formula (national search -> local market -> click funnel -> patient value).
    const revenueLost =
      monthSearches *
      LOCAL_MARKET_MULTIPLIER_SB_VC *
      ctrDiff *
      CLICK_TO_LEAD_RATE *
      LEAD_TO_CUSTOMER_RATE *
      avgJobValue;

    keywordRevenue.push({
      keyword,
      monthlySearchesAssumed: monthSearches,
      prospectPosition: prospectPos,
      ctrPosition1: ctrForPosition(1),
      ctrProspect: ctrForPosition(prospectPos),
      ctrDiff,
      avgJobValue,
      localMarketMultiplier: LOCAL_MARKET_MULTIPLIER_SB_VC,
      clickToLeadRate: CLICK_TO_LEAD_RATE,
      leadToCustomerRate: LEAD_TO_CUSTOMER_RATE,
      estimatedMonthlyRevenueLost: revenueLost,
    });
    estimatedMonthlyRevenueLost += revenueLost;
  }

  console.log(`Pain score: ${painScore}/10`);
  console.log(`Estimated monthly revenue lost: ${formatMoney(estimatedMonthlyRevenueLost)}`);

  console.log(`\n[6/6] Generating outreach messages...`);
  const outreachEntry = pickOutreachRankingEntry(rankingByKeyword);
  if (!outreachEntry?.top10 || outreachEntry.top10.length < 2) {
    throw new Error("Not enough Google Places results to build outreach messages (need rank 1 and 2 competitors in the same search).");
  }
  const competitor1Name = safeText(outreachEntry.top10[0].name);
  const competitor2Name = safeText(outreachEntry.top10[1].name);
  const nicheKeywordPhrase = keywordPhraseWithoutCity(outreachEntry.keyword, city) || safeText(outreachEntry.keyword);
  const rankOneCompetitorReviewCount =
    typeof outreachEntry.top10[0].reviewCount === "number" ? outreachEntry.top10[0].reviewCount : 0;
  const daysSincePost = Math.round(Number(daysSinceLastPostProxy) || 0);

  const messages = buildOutreachMessages({
    businessName,
    city,
    painPointId,
    painLabel,
    revenueLostPerMonth: estimatedMonthlyRevenueLost,
    rankingWorst,
    prospectReviewCount: targetReviewCount ?? 0,
    topCompetitorReviewCount: rankOneCompetitorReviewCount,
    maxCompetitorReviewCount: maxTopCompetitorReviewCount || 0,
    daysSinceLastPostProxy: daysSinceLastPostProxy ?? 0,
    websiteIssueCount,
    nicheKeywordPhrase,
    competitor1Name,
    competitor2Name,
    daysSincePost,
  });

  const output = {
    generatedAt: new Date().toISOString(),
    inputs: { businessName, city, niche },
    assumptions: {
      // This script cannot fetch GBP Posts via Places API; we proxy with latest review date.
      lastPostDateProxy: {
        usedAs: "latest review publishTime from Place Details",
        field: "reviews[].publishTime",
      },
      ctrCurve: {
        position1: ctrForPosition(1),
        position2: ctrForPosition(2),
        position10: ctrForPosition(10),
      },
      localMarketMultiplier: {
        // Santa Barbara / Ventura County multiplier of national search volume.
        value: LOCAL_MARKET_MULTIPLIER_SB_VC,
        basis: "Heuristic calibration for SB/VC vs national demand",
      },
      clickToLeadRate: CLICK_TO_LEAD_RATE,
      leadToCustomerRate: LEAD_TO_CUSTOMER_RATE,
      monthlySearchVolumeAssumptions: MONTHLY_SEARCH_VOLUME_ASSUMPTIONS[niche],
      avgJobValue: avgJobValue,
      painWeights: painWeighting,
    },
    googlePlaces: {
      targetPlace: {
        placeId: targetPlaceId,
        name: extractDisplayName(targetDetails),
        rating: targetRating,
        reviewCount: targetReviewCount,
        photosCount: targetPhotosCount,
        categories: targetTypes,
        websiteUri: targetWebsiteUri,
        phone: targetPhone,
        lastPostDate: lastPostProxyDate,
        daysSinceLastPost: daysSinceLastPostProxy,
      },
      selection: candidateSelection,
    },
    rankingAnalysis: {
      keywordQueries: nicheKeywords,
      rankingWorst,
      maxTopCompetitorReviewCount,
      rankingByKeyword,
    },
    websiteAudit,
    painScore: {
      score: painScore,
      components: {
        rankingWorst,
        rankingNorm,
        reviewGapNorm,
        maxTopCompetitorReviewCount,
        prospectReviewCount: targetReviewCount ?? null,
        daysSinceLastPostProxy,
        daysNorm,
        websiteIssueCount,
        websiteNorm,
      },
      biggestPainPoint: { id: painPointId, label: painLabel },
    },
    revenueEstimate: {
      avgJobValue,
      estimatedMonthlyRevenueLost,
      byKeyword: keywordRevenue,
    },
    outreachMessages: messages,
  };

  const fileBase = slugify(businessName) || "business";
  const outFile = path.join(process.cwd(), `${fileBase}-audit.json`);
  fs.writeFileSync(outFile, JSON.stringify(output, null, 2), "utf8");
  console.log(`\nSaved JSON audit to: ${outFile}`);
}

main().catch((err) => {
  console.error("\nScript failed:");
  console.error(err && err.stack ? err.stack : String(err));
  process.exit(1);
});

