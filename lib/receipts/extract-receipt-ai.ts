/**
 * Vision-based receipt extraction using Anthropic Claude.
 * Returns null if API key missing or on failure (caller may fall back to manual entry).
 */

import Anthropic from "@anthropic-ai/sdk"

export interface ExtractedReceipt {
  merchant_name: string | null
  total_amount: number | null
  date: string | null // YYYY-MM-DD preferred
  category_hint: string | null
  notes: string | null
  confidence: number
}

const EXTRACTION_PROMPT = `You are reading a photo of a purchase receipt or invoice for a small business tax record.

Extract the following and respond with ONLY a single JSON object (no markdown, no code fences):
{
  "merchant_name": string or null,
  "total_amount": number or null (final total paid, in USD),
  "date": string or null (ISO date YYYY-MM-DD if visible; otherwise null),
  "category_hint": string or null (short guess: e.g. "Office Supplies", "Meals", "Gas & Auto", "Software", "Professional Services"),
  "notes": string or null (one line: payment method, items, or tax if helpful),
  "confidence": number between 0 and 1
}

Rules:
- Prefer TOTAL / AMOUNT DUE / BALANCE over subtotals.
- If multiple currencies, convert is not required — use USD-looking total if labeled.
- If unreadable, use nulls and low confidence.`

function parseJsonObject(text: string): ExtractedReceipt | null {
  const trimmed = text.trim()
  const match = trimmed.match(/\{[\s\S]*\}/)
  if (!match) return null
  try {
    const o = JSON.parse(match[0]) as Record<string, unknown>
    const confidence = typeof o.confidence === "number" ? Math.min(1, Math.max(0, o.confidence)) : 0.5
    const total =
      typeof o.total_amount === "number"
        ? o.total_amount
        : typeof o.total_amount === "string"
          ? parseFloat(o.total_amount.replace(/[^0-9.-]/g, ""))
          : null
    return {
      merchant_name: typeof o.merchant_name === "string" ? o.merchant_name : null,
      total_amount: total != null && !Number.isNaN(total) ? total : null,
      date: typeof o.date === "string" ? o.date : null,
      category_hint: typeof o.category_hint === "string" ? o.category_hint : null,
      notes: typeof o.notes === "string" ? o.notes : null,
      confidence,
    }
  } catch {
    return null
  }
}

export async function extractReceiptWithVision(
  imageBase64: string,
  mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp",
): Promise<ExtractedReceipt | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    console.warn("[receipts] ANTHROPIC_API_KEY not set — skipping vision extraction")
    return null
  }

  const client = new Anthropic({ apiKey })
  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mediaType, data: imageBase64 },
          },
          { type: "text", text: EXTRACTION_PROMPT },
        ],
      },
    ],
  })

  const text = response.content
    .filter((block) => block.type === "text")
    .map((block) => (block as { type: "text"; text: string }).text)
    .join("")
  return parseJsonObject(text)
}
