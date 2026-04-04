/**
 * Rows that were dropped by an overly aggressive dedupe (same date/amount + merchantName).
 * Idempotent inject by stable id; suppress via BusinessData.suppressedSyntheticIds.
 */

import type { StripeAdjustmentUiTxn } from "@/lib/stripeReconciliation"

export const RECOVERED_TRANSACTION_IDS_2025 = [
  "recovered-2025-01-06-amzn-zp6y4",
  "recovered-2025-01-07-amzn-zp9af",
  "recovered-2025-01-09-amzn-zp5sd7",
  "recovered-2025-01-31-amzn-z71o9",
  "recovered-2025-01-31-amzn-zc80u",
  "recovered-2025-04-24-amzn-fi0h3",
  "recovered-2025-04-25-amzn-yf2r0",
  "recovered-2025-04-28-amzn-yl3tl",
  "recovered-2025-04-28-amzn-iz9w1",
  "recovered-2025-05-12-benchmark-eatery",
  "recovered-2025-05-19-amzn-nw7y5",
  "recovered-2025-06-02-amzn-n61s9",
  "recovered-2025-06-03-amzn-return",
  "recovered-2025-09-15-finneys",
  "recovered-2025-10-06-finneys",
  "recovered-2025-10-15-amzn-nf15j8",
  "recovered-2025-11-07-jeannines",
  "recovered-2025-11-17-taqueria-lilly",
  "recovered-2025-11-19-starbucks-goleta",
  "recovered-2025-11-25-starbucks-sb",
  "recovered-2025-12-18-cheesecake-anaheim",
  "recovered-2025-12-29-amzn-lt6oe",
] as const

function baseRecovered(
  id: string,
  date: string,
  description: string,
  amount: number,
  category: string,
  isIncome: boolean,
): StripeAdjustmentUiTxn {
  return {
    id,
    date,
    description,
    amount,
    category,
    account: "Recovered import",
    isIncome,
    is_personal: false,
    is_transfer: false,
    manual_entry: true,
    source: "recovered_import",
    notes: "Recovered row previously dropped by duplicate detection (same date/amount + merchant).",
    categorized_by: "user",
    confidence: 1,
  }
}

const RECOVERED_ROWS: StripeAdjustmentUiTxn[] = [
  baseRecovered("recovered-2025-01-06-amzn-zp6y4", "2025-01-06", "AMAZON MKTPL*ZP6Y4", 20.46, "Software & Web Hosting Expense", false),
  baseRecovered("recovered-2025-01-07-amzn-zp9af", "2025-01-07", "AMAZON MKTPL*ZP9AF", 42.01, "Software & Web Hosting Expense", false),
  baseRecovered("recovered-2025-01-09-amzn-zp5sd7", "2025-01-09", "AMAZON MKTPL*ZP5SD7RS1", 171.32, "Software & Web Hosting Expense", false),
  baseRecovered("recovered-2025-01-31-amzn-z71o9", "2025-01-31", "AMAZON MKTPL*Z71O9", 42.0, "Software & Web Hosting Expense", false),
  baseRecovered("recovered-2025-01-31-amzn-zc80u", "2025-01-31", "AMAZON MKTPL*ZC80U", 20.44, "Software & Web Hosting Expense", false),
  baseRecovered("recovered-2025-04-24-amzn-fi0h3", "2025-04-24", "AMAZON MKTPL*FI0H3", 57.1, "Software & Web Hosting Expense", false),
  baseRecovered("recovered-2025-04-25-amzn-yf2r0", "2025-04-25", "AMAZON MKTPL*YF2R0", 50.62, "Software & Web Hosting Expense", false),
  baseRecovered("recovered-2025-04-28-amzn-yl3tl", "2025-04-28", "AMAZON MKTPL*YL3TL", 26.93, "Software & Web Hosting Expense", false),
  baseRecovered("recovered-2025-04-28-amzn-iz9w1", "2025-04-28", "AMAZON MKTPL*IZ9W1", 26.69, "Software & Web Hosting Expense", false),
  baseRecovered(
    "recovered-2025-05-12-benchmark-eatery",
    "2025-05-12",
    "TST*BENCHMARK EATE Santa Barbara",
    73.7,
    "Business Meals Expense",
    false,
  ),
  baseRecovered("recovered-2025-05-19-amzn-nw7y5", "2025-05-19", "AMAZON MKTPL*NW7Y5", 324.01, "Software & Web Hosting Expense", false),
  baseRecovered("recovered-2025-06-02-amzn-n61s9", "2025-06-02", "AMAZON MKTPL*N61S9", 7.53, "Software & Web Hosting Expense", false),
  baseRecovered(
    "recovered-2025-06-03-amzn-return",
    "2025-06-03",
    "AMAZON MKTPLACE PM (return/credit)",
    -324.01,
    "Software & Web Hosting Expense",
    false,
  ),
  baseRecovered("recovered-2025-09-15-finneys", "2025-09-15", "FINNEY'S GOLETA", 87.0, "Business Meals Expense", false),
  baseRecovered("recovered-2025-10-06-finneys", "2025-10-06", "FINNEY'S GOLETA", 68.51, "Business Meals Expense", false),
  baseRecovered("recovered-2025-10-15-amzn-nf15j8", "2025-10-15", "Amazon.com*NF15J8R", 16.15, "Software & Web Hosting Expense", false),
  baseRecovered(
    "recovered-2025-11-07-jeannines",
    "2025-11-07",
    "TST* JEANNINE'S SANTA BARBARA",
    63.99,
    "Business Meals Expense",
    false,
  ),
  baseRecovered(
    "recovered-2025-11-17-taqueria-lilly",
    "2025-11-17",
    "TAQUERIA LILLYS GOLETA",
    14.05,
    "Business Meals Expense",
    false,
  ),
  baseRecovered("recovered-2025-11-19-starbucks-goleta", "2025-11-19", "STARBUCKS GOLETA", 2.25, "Business Meals Expense", false),
  baseRecovered(
    "recovered-2025-11-25-starbucks-sb",
    "2025-11-25",
    "STARBUCKS SANTA BARBARA",
    5.95,
    "Business Meals Expense",
    false,
  ),
  baseRecovered("recovered-2025-12-18-cheesecake-anaheim", "2025-12-18", "CHEESECAKE ANAHEIM", 118.47, "Business Meals Expense", false),
  baseRecovered("recovered-2025-12-29-amzn-lt6oe", "2025-12-29", "AMAZON MKTPL*LT6OE", 10.23, "Software & Web Hosting Expense", false),
]

export function ensureRecoveredTransactions2025<T extends { id: string }>(
  transactions: T[],
  opts: { suppressedIds: string[]; has2025Activity: boolean },
): T[] {
  if (!opts.has2025Activity) return transactions
  let out = transactions
  for (const row of RECOVERED_ROWS) {
    if (opts.suppressedIds.includes(row.id)) continue
    if (out.some((t) => t.id === row.id)) continue
    out = [...out, row as unknown as T]
  }
  return out
}
