import { CategorizationRule } from "@/types"

/**
 * Lightweight keyword mapping layer for common expense descriptions.
 *
 * This produces `CategorizationRule` objects that plug into `categorizeByRules(..., customRules)`.
 * The rules are intentionally simple (contains/starts_with) to be fast and deterministic.
 *
 * Note: category_ids must exist in `CATEGORY_ID_TO_NAME` for UI mapping.
 */

type KeywordRow = {
  pattern: string
  category_id: string
  priority: number
  match_type?: CategorizationRule["match_type"]
  is_personal?: boolean
  is_transfer?: boolean
}

// Category IDs (must match your existing CATEGORY_ID_TO_NAME map)
const CAT = {
  advertising: "00000000-0000-0000-0002-000000000001",
  social: "00000000-0000-0000-0002-000000000002",
  gasAuto: "00000000-0000-0000-0002-000000000003",
  merchantFees: "00000000-0000-0000-0002-000000000005",
  contractLabor: "00000000-0000-0000-0002-000000000043",
  equipment: "00000000-0000-0000-0002-000000000045",
  insuranceBusiness: "00000000-0000-0000-0002-000000000008",
  insuranceAuto: "00000000-0000-0000-0002-000000000039",
  bankFees: "00000000-0000-0000-0002-000000000010",
  interest: "00000000-0000-0000-0002-000000000040",
  professional: "00000000-0000-0000-0002-000000000011",
  taxSoftware: "00000000-0000-0000-0002-000000000012",
  officeSupplies: "00000000-0000-0000-0002-000000000013",
  phoneInternet: "00000000-0000-0000-0002-000000000021",
  utilities: "00000000-0000-0000-0002-000000000020",
  software: "00000000-0000-0000-0002-000000000022",
  education: "00000000-0000-0000-0002-000000000023",
  meals: "00000000-0000-0000-0002-000000000019",
  travel: "00000000-0000-0000-0002-000000000034",
  licenseFees: "00000000-0000-0000-0002-000000000041",
  californiaFees: "00000000-0000-0000-0002-000000000048",
  homeOffice: "00000000-0000-0000-0002-000000000026",
  waste: "00000000-0000-0000-0002-000000000047",
  postage: "00000000-0000-0000-0002-000000000044",
  clientGifts: "00000000-0000-0000-0002-000000000033",
  eyeCare: "00000000-0000-0000-0002-000000000035",
  sepIra: "00000000-0000-0000-0002-000000000049",
  healthInsurance: "00000000-0000-0000-0002-000000000036",
  rent: "00000000-0000-0000-0002-000000000037",
  mealsAndDining: "00000000-0000-0000-0002-000000000019",
  // Hair stylist supplies still use existing categories (they'll map to Schedule C line 22)
  hairSupplies: "00000000-0000-0000-0002-000000000053",
  hairTools: "00000000-0000-0000-0002-000000000052",
  hairColor: "00000000-0000-0000-0002-000000000051",
  desktopDepreciation: "00000000-0000-0000-0002-000000000045",
}

const KEYWORD_MAPPING_TABLE: KeywordRow[] = [
  // GHL / Stripe agency billing — priority above generic "stripe" (85) so usage charges are not Merchant Fees
  { pattern: "app.rankingsb.com", category_id: CAT.software, priority: 100 },
  { pattern: "company-billing/billing", category_id: CAT.software, priority: 100 },
  { pattern: "automated recharge", category_id: CAT.software, priority: 100 },
  { pattern: "messaging credits", category_id: CAT.software, priority: 100 },
  { pattern: "leadconnector", category_id: CAT.software, priority: 99 },
  { pattern: "lead connector", category_id: CAT.software, priority: 99 },
  { pattern: "gohighlevel.com", category_id: CAT.software, priority: 99 },
  // High-signal vendor keywords
  { pattern: "ghl", category_id: CAT.software, priority: 95 },
  { pattern: "gohighlevel", category_id: CAT.software, priority: 95 },
  { pattern: "go high level", category_id: CAT.software, priority: 95 },
  { pattern: "claude", category_id: CAT.software, priority: 95 },
  { pattern: "anthropic", category_id: CAT.software, priority: 95 },
  { pattern: "yext", category_id: CAT.software, priority: 80 },
  { pattern: "zoom", category_id: CAT.software, priority: 75 },

  // Mileage
  { pattern: "miles", category_id: CAT.gasAuto, priority: 80 },
  { pattern: "mileage", category_id: CAT.gasAuto, priority: 80 },

  // Advertising / marketing
  { pattern: "facebook ads", category_id: CAT.advertising, priority: 60 },
  { pattern: "meta ads", category_id: CAT.advertising, priority: 60 },
  { pattern: "google ads", category_id: CAT.advertising, priority: 60 },
  { pattern: "instagram", category_id: CAT.social, priority: 40 },
  { pattern: "webflow", category_id: CAT.software, priority: 20 },

  // Software / subscriptions
  { pattern: "gohighlevel", category_id: CAT.software, priority: 80 },
  { pattern: "highlevel", category_id: CAT.software, priority: 80 },
  { pattern: "mailgun", category_id: CAT.software, priority: 60 },
  { pattern: "openai", category_id: CAT.software, priority: 60 },
  { pattern: "cursor", category_id: CAT.software, priority: 70 },
  { pattern: "loom", category_id: CAT.software, priority: 50 },

  // Merchant processing / fees
  { pattern: "stripe", category_id: CAT.merchantFees, priority: 85 },
  { pattern: "paypal", category_id: CAT.merchantFees, priority: 80 },
  { pattern: "square", category_id: CAT.merchantFees, priority: 65 },
  { pattern: "merchant fee", category_id: CAT.merchantFees, priority: 75 },

  // Professional services
  { pattern: "cpa", category_id: CAT.professional, priority: 75 },
  { pattern: "accounting", category_id: CAT.professional, priority: 50 },
  { pattern: "bench", category_id: CAT.professional, priority: 50 },
  { pattern: "law", category_id: CAT.professional, priority: 35 },

  // Tax software
  { pattern: "turbo tax", category_id: CAT.taxSoftware, priority: 75 },
  { pattern: "turbotax", category_id: CAT.taxSoftware, priority: 75 },
  { pattern: "coinledger", category_id: CAT.taxSoftware, priority: 70 },

  // Office supplies / shipping
  { pattern: "staples", category_id: CAT.officeSupplies, priority: 55 },
  { pattern: "ups store", category_id: CAT.officeSupplies, priority: 55 },
  { pattern: "usps", category_id: CAT.officeSupplies, priority: 40 },
  { pattern: "fedex", category_id: CAT.officeSupplies, priority: 40 },
  { pattern: "office depot", category_id: CAT.officeSupplies, priority: 55 },
  { pattern: "postage", category_id: CAT.postage, priority: 70 },

  // Phone / internet and utilities
  { pattern: "cox", category_id: CAT.phoneInternet, priority: 85 },
  { pattern: "cox communications", category_id: CAT.phoneInternet, priority: 90 },
  { pattern: "verizon", category_id: CAT.phoneInternet, priority: 80 },
  { pattern: "at&t", category_id: CAT.phoneInternet, priority: 70 },
  { pattern: "t-mobile", category_id: CAT.phoneInternet, priority: 70 },
  { pattern: "internet", category_id: CAT.phoneInternet, priority: 30 },

  { pattern: "pg&e", category_id: CAT.utilities, priority: 65 },
  { pattern: "edison", category_id: CAT.utilities, priority: 65 },
  { pattern: "water utility", category_id: CAT.utilities, priority: 55 },

  // Travel
  { pattern: "uber", category_id: CAT.travel, priority: 60 },
  { pattern: "lyft", category_id: CAT.travel, priority: 60 },
  { pattern: "airbnb", category_id: CAT.travel, priority: 55 },
  { pattern: "hotel", category_id: CAT.travel, priority: 45 },
  { pattern: "flight", category_id: CAT.travel, priority: 35 },

  // Meals (client meals)
  { pattern: "restaurant", category_id: CAT.meals, priority: 65 },
  { pattern: "dinner", category_id: CAT.meals, priority: 55 },
  { pattern: "lunch", category_id: CAT.meals, priority: 55 },
  { pattern: "yelp", category_id: CAT.meals, priority: 50 },
  { pattern: "grubhub", category_id: CAT.meals, priority: 45 },
  { pattern: "doordash", category_id: CAT.meals, priority: 45 },

  // Rent
  { pattern: "regus", category_id: CAT.rent, priority: 65 },
  { pattern: "wework", category_id: CAT.rent, priority: 65 },
  { pattern: "co-working", category_id: CAT.rent, priority: 60 },
  { pattern: "coworking", category_id: CAT.rent, priority: 60 },

  // Taxes & licenses
  { pattern: "license", category_id: CAT.licenseFees, priority: 75 },
  { pattern: "permit", category_id: CAT.licenseFees, priority: 75 },
  { pattern: "renewal", category_id: CAT.licenseFees, priority: 65 },
  { pattern: "franchise tax", category_id: CAT.californiaFees, priority: 80 },
  { pattern: "ftb", category_id: CAT.californiaFees, priority: 60 },

  // Home office
  { pattern: "home office", category_id: CAT.homeOffice, priority: 50 },
  { pattern: "home studio", category_id: CAT.homeOffice, priority: 45 },

  // Waste & disposal
  { pattern: "waste", category_id: CAT.waste, priority: 60 },
  { pattern: "marborg", category_id: CAT.waste, priority: 70 },
  { pattern: "trash", category_id: CAT.waste, priority: 40 },
  { pattern: "recycling", category_id: CAT.waste, priority: 40 },

  // SEP-IRA + health insurance
  { pattern: "sep-ira", category_id: CAT.sepIra, priority: 90 },
  { pattern: "solo 401k", category_id: CAT.sepIra, priority: 90 },
  { pattern: "health insurance", category_id: CAT.healthInsurance, priority: 80 },
  { pattern: "dental", category_id: CAT.healthInsurance, priority: 50 },
]

function buildKeywordRules(): CategorizationRule[] {
  const now = new Date().toISOString()
  return KEYWORD_MAPPING_TABLE.map((row, i) => {
    const rule: CategorizationRule = {
      id: `keyword-rule-${i}`,
      business_id: "00000000-0000-0000-0000-000000000000",
      pattern: row.pattern,
      match_type: row.match_type ?? "contains",
      category_id: row.category_id,
      is_personal: row.is_personal ?? false,
      is_transfer: row.is_transfer ?? false,
      priority: row.priority,
      created_by: "user",
      created_at: now,
    }
    return rule
  })
}

export const KEYWORD_MAPPING_RULES: CategorizationRule[] = buildKeywordRules()

