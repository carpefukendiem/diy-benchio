/**
 * Withheld platform fees not shown as separate bank lines — synthetic ledger rows + Stripe reference totals.
 * Sources: Stripe Balance Summary CSV; Upwork earnings report CSV (fees paid).
 */

export const STRIPE_ANNUAL_FEE_ADJUSTMENT_ID = "manual-adjustment-stripe-fees-2025"

export const UPWORK_SERVICE_FEE_SEO_2025_ID = "manual-adjustment-upwork-service-fee-seo-2025"
export const UPWORK_SERVICE_FEE_QA_2025_ID = "manual-adjustment-upwork-service-fee-qa-2025"

/** Stable ids for rows this module may inject; used to suppress re-add after user delete. */
export const SYNTHETIC_WITHHELD_FEE_IDS_2025: readonly string[] = [
  STRIPE_ANNUAL_FEE_ADJUSTMENT_ID,
  UPWORK_SERVICE_FEE_SEO_2025_ID,
  UPWORK_SERVICE_FEE_QA_2025_ID,
]

/** Reported totals from Stripe Dashboard Balance Summary USD 2025 (America/Los_Angeles). */
export const STRIPE_BALANCE_SUMMARY_2025_USD = {
  year: 2025,
  grossActivity: 55_018.52,
  feesWithheld: 1_748.49,
} as const

export type LedgerInjectionSource = "manual_adjustment" | "platform_fee_import" | "recovered_import"

export type StripeAdjustmentUiTxn = {
  id: string
  date: string
  description: string
  amount: number
  category: string
  account: string
  isIncome: boolean
  exclude?: boolean
  manual_entry?: boolean
  source?: LedgerInjectionSource
  notes?: string
  is_personal?: boolean
  is_transfer?: boolean
  categorized_by?: "rule" | "ai" | "user" | null
  confidence?: number
}

export function buildStripeAnnualFeeAdjustment2025(): StripeAdjustmentUiTxn {
  return {
    id: STRIPE_ANNUAL_FEE_ADJUSTMENT_ID,
    date: "2025-12-31",
    description: "Stripe Processing Fees 2025 (withheld from payouts)",
    amount: STRIPE_BALANCE_SUMMARY_2025_USD.feesWithheld,
    category: "Merchant Processing Fees",
    account: "Stripe",
    isIncome: false,
    is_personal: false,
    is_transfer: false,
    manual_entry: true,
    source: "platform_fee_import",
    notes:
      "Synthetic: Stripe withheld this before payout (not on bank statements). Balance Summary 2025 gross activity $" +
      STRIPE_BALANCE_SUMMARY_2025_USD.grossActivity.toLocaleString("en-US", { minimumFractionDigits: 2 }) +
      ".",
    categorized_by: "user",
    confidence: 1,
  }
}

/** Upwork earnings report: Active Marketing / SEO Optimizations — Fees paid 1501.67 */
export function buildUpworkServiceFeeSeo2025(): StripeAdjustmentUiTxn {
  return {
    id: UPWORK_SERVICE_FEE_SEO_2025_ID,
    date: "2025-12-30",
    description: "Upwork Service Fee - Active Marketing (SEO Optimizations)",
    amount: 1501.67,
    category: "Merchant Processing Fees",
    account: "Upwork",
    isIncome: false,
    is_personal: false,
    is_transfer: false,
    manual_entry: true,
    source: "platform_fee_import",
    notes:
      "Synthetic: Upwork service fee withheld per official earnings report (not a separate bank line).",
    categorized_by: "user",
    confidence: 1,
  }
}

/** Upwork earnings report: Technical QA Specialist — Fees paid 1849.05 */
export function buildUpworkServiceFeeQa2025(): StripeAdjustmentUiTxn {
  return {
    id: UPWORK_SERVICE_FEE_QA_2025_ID,
    date: "2025-12-30",
    description: "Upwork Service Fee - Active Marketing (Technical QA Specialist)",
    amount: 1849.05,
    category: "Merchant Processing Fees",
    account: "Upwork",
    isIncome: false,
    is_personal: false,
    is_transfer: false,
    manual_entry: true,
    source: "platform_fee_import",
    notes:
      "Synthetic: Upwork service fee withheld per official earnings report (not a separate bank line).",
    categorized_by: "user",
    confidence: 1,
  }
}

export function businessHas2025LedgerActivity(args: {
  transactions: { date: string }[]
  uploadedStatements?: { year: string }[]
}): boolean {
  if (args.transactions.some((t) => t.date.startsWith("2025"))) return true
  if (args.uploadedStatements?.some((s) => s.year === "2025")) return true
  return false
}

/** Idempotent: append annual Stripe fee row when 2025 activity exists and user has not removed it. */
export function ensureStripeAnnualFeeAdjustment2025<T extends { id: string }>(
  transactions: T[],
  opts: { suppressedIds: string[]; has2025Activity: boolean },
): T[] {
  if (!opts.has2025Activity) return transactions
  if (opts.suppressedIds.includes(STRIPE_ANNUAL_FEE_ADJUSTMENT_ID)) return transactions
  if (transactions.some((t) => t.id === STRIPE_ANNUAL_FEE_ADJUSTMENT_ID)) return transactions
  const row = buildStripeAnnualFeeAdjustment2025() as unknown as T
  return [...transactions, row]
}

/** Idempotent: append Upwork withheld service fee rows from 2025 earnings report. */
export function ensureUpworkServiceFeeAdjustments2025<T extends { id: string }>(
  transactions: T[],
  opts: { suppressedIds: string[]; has2025Activity: boolean },
): T[] {
  if (!opts.has2025Activity) return transactions
  let out = transactions
  if (!opts.suppressedIds.includes(UPWORK_SERVICE_FEE_SEO_2025_ID) && !out.some((t) => t.id === UPWORK_SERVICE_FEE_SEO_2025_ID)) {
    out = [...out, buildUpworkServiceFeeSeo2025() as unknown as T]
  }
  if (!opts.suppressedIds.includes(UPWORK_SERVICE_FEE_QA_2025_ID) && !out.some((t) => t.id === UPWORK_SERVICE_FEE_QA_2025_ID)) {
    out = [...out, buildUpworkServiceFeeQa2025() as unknown as T]
  }
  return out
}

/** Stripe + Upwork withheld fees (Dec 30 Upwork, Dec 31 Stripe). */
export function ensureAllWithheldFeeAdjustments2025<T extends { id: string }>(
  transactions: T[],
  opts: { suppressedIds: string[]; has2025Activity: boolean },
): T[] {
  let t = ensureUpworkServiceFeeAdjustments2025(transactions, opts)
  t = ensureStripeAnnualFeeAdjustment2025(t, opts)
  return t
}
