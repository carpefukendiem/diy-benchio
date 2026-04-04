import { SCHEDULE_C_LINES } from "@/lib/tax/scheduleC-lines"

export type UiTransactionLike = {
  category?: string
  isIncome: boolean
  amount: number
  description?: string
  is_personal?: boolean
  is_transfer?: boolean
  /** Non-revenue credits — omit from gross receipts / revenue rollups */
  exclude?: boolean
}

export function getScheduleCLineForCategory(category: string) {
  return SCHEDULE_C_LINES[category]
}

export function getDeductibleAmountForExpense(category: string, amount: number): number {
  const sc = getScheduleCLineForCategory(category)
  const deductPctFromSchedule = sc?.deductPct

  // Fallback to meal heuristic for backward compatibility with existing category-name checks.
  const deductPct = deductPctFromSchedule != null ? deductPctFromSchedule / 100 : category.toLowerCase().includes("meals") ? 0.5 : 1

  return amount * deductPct
}

export function formatScheduleCLine(category: string): string {
  const sc = getScheduleCLineForCategory(category)
  if (!sc) return ""
  return `Line ${sc.line} - ${sc.label}`
}

export function computeUiExpenseTotals(transactions: UiTransactionLike[]) {
  // Matches the existing dashboard assumptions:
  // - exclude personal, transfers, capital items
  // - treat health insurance + SEP-IRA as above-the-line
  // - apply 50% rule for meals via Schedule C mapping
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
  ]
  const capitalKeywords = [
    "business loan proceeds",
    "loan proceeds",
    "loan repayment - principal",
    "crypto treasury purchase",
  ]
  const aboveTheLineKeywords = ["health insurance", "sep-ira"]

  let totalExpenses = 0
  let schedCDeductions = 0
  let healthInsuranceTotal = 0
  let sepIraTotal = 0

  for (const t of transactions) {
    if (t.isIncome) continue
    if (t.exclude === true) continue

    const cl = (t.category || "").toLowerCase()
    if (!cl || cl.includes("uncategorized")) continue

    // Prefer structured flags when available.
    if (t.is_personal === true) continue
    if (t.is_transfer === true) continue

    // Back-compat: fall back to category-name keywords.
    if (personalKeywords.some((k) => cl.includes(k))) continue
    if (transferKeywords.some((k) => cl.includes(k))) continue
    if (capitalKeywords.some((k) => cl.includes(k))) continue

    // Above-the-line deductions (Schedule 1)
    if (aboveTheLineKeywords.some((k) => cl.includes(k))) {
      if (cl.includes("health insurance")) healthInsuranceTotal += t.amount
      if (cl.includes("sep-ira")) sepIraTotal += t.amount
      continue
    }

    totalExpenses += t.amount
    schedCDeductions += getDeductibleAmountForExpense(t.category || "", t.amount)
  }

  return { totalExpenses, schedCDeductions, healthInsuranceTotal, sepIraTotal }
}

