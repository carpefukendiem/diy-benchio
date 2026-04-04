/**
 * Reference totals for crypto / brokerage-style categories (excluded from Schedule C).
 * "Outlay" = non-income rows: money deployed into investments / treasury crypto, not proceeds.
 */

export function isCryptoOrInvestmentOutlayCategory(category: string): boolean {
  const c = (category || "").toLowerCase()
  return (
    c.includes("crypto / investments") ||
    c.includes("personal - investments") ||
    c.includes("crypto treasury purchase") ||
    c.includes("business treasury investment")
  )
}

export function sumCryptoInvestmentOutlayForYear(
  transactions: readonly { date: string; category?: string; isIncome: boolean; amount: number }[],
  year: string,
): { total: number; count: number } {
  const y = year.slice(0, 4)
  let total = 0
  let count = 0
  for (const t of transactions) {
    if (!(t.date || "").startsWith(y)) continue
    if (!isCryptoOrInvestmentOutlayCategory(t.category || "")) continue
    if (t.isIncome) continue
    total += Math.abs(Number(t.amount) || 0)
    count++
  }
  return { total, count }
}
