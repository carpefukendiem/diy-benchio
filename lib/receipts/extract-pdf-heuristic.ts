/**
 * Lightweight text heuristics for digital PDF receipts (no vision).
 */

import type { ExtractedReceipt } from "./extract-receipt-ai"

function pickDate(text: string): string | null {
  const iso = text.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
  const us = text.match(/\b(\d{1,2})[\/\-](\d{1,2})[\/\-](20\d{2})\b/)
  if (us) {
    const m = us[1].padStart(2, "0")
    const d = us[2].padStart(2, "0")
    return `${us[3]}-${m}-${d}`
  }
  return null
}

function pickAmount(text: string): number | null {
  const lines = text.split("\n").slice(-40).join("\n")
  const patterns = [
    /(?:total|amount\s*due|balance\s*due|grand\s*total|total\s*due)[:\s]*\$?\s*([\d,]+\.?\d{0,2})/i,
    /\$\s*([\d,]+\.\d{2})\s*$/m,
    /(?:^|\s)\$?\s*([\d,]+\.\d{2})\s*(?:USD|usd)?\s*$/,
  ]
  let best: number | null = null
  for (const re of patterns) {
    const m = lines.match(re)
    if (m) {
      const n = parseFloat(m[1].replace(/,/g, ""))
      if (!Number.isNaN(n) && n > 0 && n < 1_000_000) {
        if (best == null || n > best) best = n
      }
    }
  }
  return best
}

function pickMerchant(text: string): string | null {
  const first = text
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.length > 2 && !/^(receipt|invoice|page|total)/i.test(l))
  return first ? first.substring(0, 120) : null
}

/**
 * Best-effort extraction from raw PDF text (e.g. Square/Toast-style receipts).
 */
export function extractReceiptFromPdfText(text: string): ExtractedReceipt | null {
  const t = text.replace(/\r/g, "\n")
  if (t.length < 10) return null
  const total_amount = pickAmount(t)
  const date = pickDate(t)
  const merchant_name = pickMerchant(t)
  if (total_amount == null && merchant_name == null && date == null) return null
  return {
    merchant_name,
    total_amount,
    date,
    category_hint: null,
    notes: "Extracted from PDF text (verify totals)",
    confidence: 0.45,
  }
}
