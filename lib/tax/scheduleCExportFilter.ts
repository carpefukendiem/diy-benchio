/**
 * Rows that must never appear in Schedule C CSV/TSV exports.
 * Uses category name + optional flags from categorized transactions.
 */
export function isExcludedFromScheduleCExport(
  category: string,
  opts?: { isTransfer?: boolean; isPersonal?: boolean; exclude?: boolean }
): boolean {
  if (opts?.exclude === true) return true
  if (opts?.isTransfer === true) return true
  if (opts?.isPersonal === true) return true
  const c = (category || "").toLowerCase()
  const substringMatches = [
    "member drawing",
    "member contribution",
    "owner's contribution",
    "loan proceeds",
    "owner draw",
    "credit card payment",
    "crypto / investments",
    "brokerage transfer",
    "internal transfer",
    "business treasury",
    "personal -",
    "personal expense",
    "personal - entertainment",
    "personal - investments",
    "zelle / venmo transfer",
  ]
  if (substringMatches.some((k) => c.includes(k))) return true
  return false
}
