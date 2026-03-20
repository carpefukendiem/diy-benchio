import { SCHEDULE_C_LINES } from "@/lib/tax/scheduleC-lines"

export type CategoryCoverageIssue = {
  category: string
  issue: "missing_schedule_mapping" | "missing_tax_treatment_classification"
  notes: string
}

function matchesAnyKeyword(category: string, keywords: string[]) {
  const lc = category.toLowerCase()
  return keywords.some((k) => lc.includes(k))
}

export function auditCategoryCoverage(uiCategories: string[]): CategoryCoverageIssue[] {
  const issues: CategoryCoverageIssue[] = []

  const personalKeywords = ["personal", "crypto", "atm withdrawal", "cash withdrawal"]
  const transferKeywords = [
    "member drawing",
    "member contribution",
    "internal transfer",
    "credit card payment",
    "zelle",
    "venmo",
    "owner draw",
    "brokerage transfer",
    "business treasury",
    "brokerage transfer",
  ]
  const capitalKeywords = ["business loan proceeds", "loan repayment - principal", "crypto treasury purchase"]
  const nondeductibleKeywords = ["nondeductible"]

  for (const cat of uiCategories) {
    if (!cat || cat.toLowerCase().includes("uncategorized")) {
      continue
    }

    // If it is explicitly on our schedule mapping, treat it as tax-treated (including N/A capital items).
    if (SCHEDULE_C_LINES[cat]) continue

    // Otherwise, allow categories we explicitly exclude from deductions/tax math.
    if (matchesAnyKeyword(cat, personalKeywords)) continue
    if (matchesAnyKeyword(cat, transferKeywords)) continue
    if (matchesAnyKeyword(cat, capitalKeywords)) continue
    if (matchesAnyKeyword(cat, nondeductibleKeywords)) continue

    issues.push({
      category: cat,
      issue: "missing_tax_treatment_classification",
      notes: "Not found in SCHEDULE_C_LINES and not classified as personal/transfer/capital/nondeductible/uncategorized.",
    })
  }

  return issues
}

