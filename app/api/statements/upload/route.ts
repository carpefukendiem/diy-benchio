import { type NextRequest, NextResponse } from "next/server"
import { generateText } from "ai"
import { categorizeByRules } from "@/lib/categorization/rules-engine"

// Route segment config for Next.js App Router
export const maxDuration = 60

// ========================================
// Category map for human-readable names
// ========================================
const CAT: Record<string, { name: string; isPersonal: boolean; isTransfer: boolean }> = {
  "00000000-0000-0000-0001-000000000001": { name: "Sales Revenue", isPersonal: false, isTransfer: false },
  "00000000-0000-0000-0001-000000000002": { name: "Refunds Given", isPersonal: false, isTransfer: false },
  "00000000-0000-0000-0001-000000000003": { name: "Other Income", isPersonal: false, isTransfer: false },
  "00000000-0000-0000-0001-000000000004": { name: "Freelance Income", isPersonal: false, isTransfer: false },
  "00000000-0000-0000-0002-000000000001": { name: "Advertising & Marketing", isPersonal: false, isTransfer: false },
  "00000000-0000-0000-0002-000000000002": { name: "Social Media & Online Presence", isPersonal: false, isTransfer: false },
  "00000000-0000-0000-0002-000000000003": { name: "Gas & Auto Expense", isPersonal: false, isTransfer: false },
  "00000000-0000-0000-0002-000000000005": { name: "Merchant Processing Fees", isPersonal: false, isTransfer: false },
  "00000000-0000-0000-0002-000000000008": { name: "Insurance Expense - Business", isPersonal: false, isTransfer: false },
  "00000000-0000-0000-0002-000000000010": { name: "Bank & ATM Fee Expense", isPersonal: false, isTransfer: false },
  "00000000-0000-0000-0002-000000000011": { name: "Professional Service Expense", isPersonal: false, isTransfer: false },
  "00000000-0000-0000-0002-000000000012": { name: "Tax Software & Services", isPersonal: false, isTransfer: false },
  "00000000-0000-0000-0002-000000000013": { name: "Office Supplies", isPersonal: false, isTransfer: false },
  "00000000-0000-0000-0002-000000000019": { name: "Business Meals Expense", isPersonal: false, isTransfer: false },
  "00000000-0000-0000-0002-000000000020": { name: "Utilities Expense", isPersonal: false, isTransfer: false },
  "00000000-0000-0000-0002-000000000021": { name: "Phone & Internet Expense", isPersonal: false, isTransfer: false },
  "00000000-0000-0000-0002-000000000022": { name: "Software & Web Hosting Expense", isPersonal: false, isTransfer: false },
  "00000000-0000-0000-0002-000000000023": { name: "Education & Training", isPersonal: false, isTransfer: false },
  "00000000-0000-0000-0002-000000000025": { name: "Utilities Expense", isPersonal: false, isTransfer: false },
  "00000000-0000-0000-0002-000000000026": { name: "Home Office Expense", isPersonal: false, isTransfer: false },
  "00000000-0000-0000-0003-000000000001": { name: "Member Drawing - Ruben Ruiz", isPersonal: false, isTransfer: true },
  "00000000-0000-0000-0003-000000000002": { name: "Member Contribution - Ruben Ruiz", isPersonal: false, isTransfer: true },
  "00000000-0000-0000-0003-000000000003": { name: "Internal Transfer", isPersonal: false, isTransfer: true },
  "00000000-0000-0000-0003-000000000005": { name: "Credit Card Payment", isPersonal: false, isTransfer: true },
  "00000000-0000-0000-0004-000000000001": { name: "Personal Expense", isPersonal: true, isTransfer: false },
  "00000000-0000-0000-0004-000000000002": { name: "Personal - Groceries", isPersonal: true, isTransfer: false },
  "00000000-0000-0000-0004-000000000003": { name: "Personal - Entertainment", isPersonal: true, isTransfer: false },
  "00000000-0000-0000-0004-000000000004": { name: "Personal - Shopping", isPersonal: true, isTransfer: false },
  "00000000-0000-0000-0004-000000000005": { name: "Personal - Food & Drink", isPersonal: true, isTransfer: false },
  "00000000-0000-0000-0004-000000000006": { name: "Personal - Health", isPersonal: true, isTransfer: false },
  "00000000-0000-0000-0004-000000000007": { name: "Owner Draw", isPersonal: false, isTransfer: true },
  "00000000-0000-0000-0004-000000000008": { name: "Zelle / Venmo Transfer", isPersonal: false, isTransfer: true },
  "00000000-0000-0000-0004-000000000009": { name: "Crypto / Investments", isPersonal: true, isTransfer: false },
  "00000000-0000-0000-0002-000000000030": { name: "Soccer Team Sponsorship", isPersonal: false, isTransfer: false },
  "00000000-0000-0000-0002-000000000031": { name: "Office Kitchen Supplies", isPersonal: false, isTransfer: false },
  "00000000-0000-0000-0002-000000000032": { name: "Parking Expense", isPersonal: false, isTransfer: false },
  "00000000-0000-0000-0002-000000000033": { name: "Client Gifts", isPersonal: false, isTransfer: false },
  "00000000-0000-0000-0002-000000000034": { name: "Travel Expense", isPersonal: false, isTransfer: false },
  "00000000-0000-0000-0002-000000000035": { name: "Eye Care - Business Expense", isPersonal: false, isTransfer: false },
  "00000000-0000-0000-0002-000000000036": { name: "Health Insurance", isPersonal: false, isTransfer: false },
  "00000000-0000-0000-0002-000000000037": { name: "Rent Expense", isPersonal: false, isTransfer: false },
  "00000000-0000-0000-0003-000000000006": { name: "Owner Draw", isPersonal: false, isTransfer: true },
  "00000000-0000-0000-0003-000000000007": { name: "Brokerage Transfer", isPersonal: false, isTransfer: true },
  "00000000-0000-0000-0002-000000000038": { name: "Business Treasury Investment", isPersonal: false, isTransfer: false },
}

// ========================================
// AI-powered PDF transaction extraction
// Uses GPT-4o which can natively read PDFs
// ========================================
async function extractTransactionsFromPDF(base64: string, fileName: string): Promise<{
  transactions: any[];
  statementMonth: string;
  statementYear: string;
}> {
  console.log("[pdf-ai] Sending PDF to GPT-4o for extraction, base64 length:", base64.length)

  const result = await generateText({
    model: "openai/gpt-4o",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "file",
            data: base64,
            mediaType: "application/pdf",
          },
          {
            type: "text",
            text: `You are a bank statement parser. Extract ALL transactions from this bank/credit card statement PDF.

For EACH transaction, extract:
- date: The transaction date in YYYY-MM-DD format
- description: The full merchant/description text
- amount: The dollar amount as a positive number (no $ sign, no commas)
- type: "credit" for deposits/payments/refunds IN, "debit" for purchases/withdrawals/charges OUT

Also determine:
- statementMonth: The statement month name (e.g. "January", "February")
- statementYear: The 4-digit year (e.g. "2025")

IMPORTANT RULES:
- Include EVERY single transaction, do not skip any
- For credit card statements: purchases are "debit", payments are "credit"
- For bank statements: deposits/transfers in are "credit", withdrawals/purchases are "debit"
- Amount must always be positive
- Do NOT include summary lines, totals, or balance rows
- Do NOT include interest calculations or fee summaries unless they are actual line-item charges

Respond with ONLY valid JSON in this exact format, nothing else:
{
  "statementMonth": "January",
  "statementYear": "2025",
  "transactions": [
    {"date": "2025-01-02", "description": "STRIPE TRANSFER", "amount": 301.75, "type": "credit"},
    {"date": "2025-01-03", "description": "GOHIGHLEVEL", "amount": 497.00, "type": "debit"}
  ]
}`,
          },
        ],
      },
    ],
  })

  const text = result.text.trim()
  console.log("[pdf-ai] Response length:", text.length)

  // Extract JSON from the response (handle markdown code blocks)
  let jsonStr = text
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim()
  }

  try {
    const parsed = JSON.parse(jsonStr)
    console.log(`[pdf-ai] Parsed ${parsed.transactions?.length || 0} transactions for ${parsed.statementMonth} ${parsed.statementYear}`)
    return {
      transactions: (parsed.transactions || []).map((tx: any) => ({
        date: tx.date,
        description: tx.description,
        amount: Math.abs(parseFloat(tx.amount) || 0),
        type: tx.type === "credit" ? "credit" : "debit",
        raw_line: tx.description,
      })),
      statementMonth: parsed.statementMonth || "Unknown",
      statementYear: parsed.statementYear || "2025",
    }
  } catch (e: any) {
    console.error("[pdf-ai] JSON parse error:", e.message, "Raw:", jsonStr.substring(0, 200))
    throw new Error("AI could not parse this PDF. Please try uploading the CSV version instead.")
  }
}

// NOTE: Old regex-based PDF parsers removed.
// PDF parsing is now handled by GPT-4o AI which can natively read any bank PDF.

// ========================================
// Parse CSV text into transactions
// Handles 3 formats:
//   1. Wells Fargo text export (no headers, multiline, amount on its own line)
//   2. Standard CSV with headers (Date, Description, Amount OR Date, Desc, Credit, Debit)
//   3. Chase CSV (Transaction Date, Post Date, Description, Category, Type, Amount)
// ========================================
function parseCSVText(csvText: string) {
  const rawLines = csvText.split("\n")

  // ------- Detect format -------
  const firstNonEmpty = rawLines.find(l => l.trim().length > 0) || ""

  // FORMAT 1: Standard CSV with comma-separated headers
  if (firstNonEmpty.includes(",") && /date/i.test(firstNonEmpty)) {
    console.log("[csv] Detected standard CSV with headers")
    return parseStandardCSV(rawLines)
  }

  // FORMAT 2: Wells Fargo text export (starts with M/D pattern, no commas in first line typically)
  if (/^\d{1,2}\/\d{1,2}\s/.test(firstNonEmpty.trim())) {
    console.log("[csv] Detected Wells Fargo text export format")
    return parseWellsFargoTextExport(rawLines)
  }

  // FORMAT 3: Try standard CSV anyway as fallback
  console.log("[csv] Attempting standard CSV fallback")
  return parseStandardCSV(rawLines)
}

function parseStandardCSV(lines: string[]) {
  const txns: any[] = []
  let headerLine = ""
  let dataStartIdx = 0

  // Find header row
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    if (/date/i.test(lines[i]) && (lines[i].includes(",") || lines[i].includes("\t"))) {
      headerLine = lines[i].toLowerCase()
      dataStartIdx = i + 1
      break
    }
  }

  const sep = headerLine.includes("\t") ? "\t" : ","
  const headers = headerLine.split(sep).map(h => h.trim().replace(/^"|"$/g, ""))

  // Find column indices
  const dateIdx = headers.findIndex(h => /^(transaction\s*)?date$/i.test(h))
  const descIdx = headers.findIndex(h => /description|memo|merchant/i.test(h))
  const amountIdx = headers.findIndex(h => /^amount$/i.test(h))
  const creditIdx = headers.findIndex(h => /credit|deposit/i.test(h))
  const debitIdx = headers.findIndex(h => /debit|withdrawal|withdraw/i.test(h))

  for (let i = dataStartIdx; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line || /^Transaction History|^Totals|Monthly service/i.test(line)) continue

    const parts = line.split(sep === "\t" ? "\t" : /,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map(p => p.trim().replace(/^"|"$/g, ""))
    if (parts.length < 2) continue

    const dateStr = parts[dateIdx >= 0 ? dateIdx : 0] || ""
    if (!/\d{1,2}\/\d{1,2}/.test(dateStr)) continue

    const desc = parts[descIdx >= 0 ? descIdx : 1] || ""

    let amount = 0
    let isIncome = false

    if (amountIdx >= 0) {
      amount = parseFloat((parts[amountIdx] || "0").replace(/[,$"]/g, "")) || 0
      isIncome = amount > 0
      amount = Math.abs(amount)
    } else {
      const credit = parseFloat((parts[creditIdx >= 0 ? creditIdx : 2] || "0").replace(/[,$"]/g, "")) || 0
      const debit = parseFloat((parts[debitIdx >= 0 ? debitIdx : 3] || "0").replace(/[,$"]/g, "")) || 0
      if (credit === 0 && debit === 0) continue
      isIncome = credit > 0
      amount = Math.abs(isIncome ? credit : debit)
    }

    if (amount === 0) continue

    const dateParts = dateStr.split("/")
    const mo = (dateParts[0] || "01").padStart(2, "0")
    const da = (dateParts[1] || "01").padStart(2, "0")
    const yr = dateParts[2] ? (dateParts[2].length === 2 ? "20" + dateParts[2] : dateParts[2]) : "2025"

    txns.push({
      date: `${yr}-${mo}-${da}`,
      description: desc.substring(0, 200),
      amount,
      type: isIncome ? "credit" : "debit",
      raw_line: line,
    })
  }

  // Determine month from most common transaction month
  const monthCounts: Record<string, number> = {}
  txns.forEach(t => {
    const m = t.date.substring(5, 7)
    monthCounts[m] = (monthCounts[m] || 0) + 1
  })
  const topMonth = Object.entries(monthCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "01"
  const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"]
  const stmtMonth = monthNames[parseInt(topMonth) - 1] || "Unknown"
  const stmtYear = txns[0]?.date?.substring(0, 4) || "2025"

  return { transactions: txns, statementMonth: stmtMonth, statementYear: stmtYear }
}

function parseWellsFargoTextExport(lines: string[]) {
  const txns: any[] = []
  const txRe = /^(\d{1,2})\/(\d{1,2})\s+(.+)/

  // Credit keywords (these are deposits / income)
  const creditKW = ["stripe transfer", "online transfer from", "deposit", "credit memo", "interest payment"]

  let current: { date: string; description: string; amounts: number[]; type: string; raw: string } | null = null

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) continue
    if (/Transaction History|^Date\b|Check Number|Totals|Monthly service|Beginning balance|Ending balance/i.test(line)) continue

    const m = line.match(txRe)
    if (m) {
      // Save previous transaction
      if (current) {
        const amount = current.amounts[0] || 0
        if (amount > 0) {
          txns.push({
            date: current.date,
            description: current.description.replace(/\s+/g, " ").trim(),
            amount,
            type: current.type,
            raw_line: current.raw,
          })
        }
      }

      const mo = m[1].padStart(2, "0")
      const da = m[2].padStart(2, "0")
      const rest = m[3]

      // Extract amounts from the rest of the line (could be at end)
      const amtMatches = rest.match(/[\d,]+\.\d{2}/g)
      const amounts = amtMatches ? amtMatches.map(a => parseFloat(a.replace(/,/g, ""))) : []
      const desc = rest.replace(/\s+[\d,]+\.\d{2}(\s+[\d,]+\.\d{2})?$/g, "").trim()

      const dl = desc.toLowerCase()
      const isCr = creditKW.some(k => dl.includes(k))

      current = {
        date: `2025-${mo}-${da}`,
        description: desc,
        amounts,
        type: isCr ? "credit" : "debit",
        raw: line,
      }
    } else if (current) {
      // This line is a continuation OR a standalone amount
      const pureAmount = line.match(/^([\d,]+\.\d{2})(\s+([\d,]+\.\d{2}))?$/)
      if (pureAmount) {
        // Line is just amount(s) -- first is transaction amount, second is running balance
        if (current.amounts.length === 0) {
          current.amounts.push(parseFloat(pureAmount[1].replace(/,/g, "")))
        }
        if (pureAmount[3]) {
          // Second number is balance, ignore it
        }
      } else {
        // Continuation of description
        const cleaned = line.replace(/\s*[\d,]+\.\d{2}(\s+[\d,]+\.\d{2})?$/g, "").trim()
        if (cleaned.length > 0 && cleaned.length < 150) {
          current.description += " " + cleaned
          // Check if this line also has amounts at the end
          const lineAmts = line.match(/[\d,]+\.\d{2}/g)
          if (lineAmts && current.amounts.length === 0) {
            current.amounts.push(parseFloat(lineAmts[0].replace(/,/g, "")))
          }
        }
      }
    }
  }

  // Don't forget the last transaction
  if (current) {
    const amount = current.amounts[0] || 0
    if (amount > 0) {
      txns.push({
        date: current.date,
        description: current.description.replace(/\s+/g, " ").trim(),
        amount,
        type: current.type,
        raw_line: current.raw,
      })
    }
  }

  // Determine statement month from most common month
  const monthCounts: Record<string, number> = {}
  txns.forEach(t => {
    const m = t.date.substring(5, 7)
    monthCounts[m] = (monthCounts[m] || 0) + 1
  })
  const topMonth = Object.entries(monthCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "01"
  const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"]

  console.log(`[csv-wf] Parsed ${txns.length} transactions, top month: ${topMonth}`)

  return {
    transactions: txns,
    statementMonth: monthNames[parseInt(topMonth) - 1] || "Unknown",
    statementYear: "2025",
  }
}

// ========================================
// Convert parsed+categorized transactions to UI format
// ========================================
function toUIFormat(categorized: any[]) {
  return categorized.map(tx => {
    const catInfo = tx.category_id ? CAT[tx.category_id] : null
    const categoryName = catInfo?.name || "Uncategorized Expense"
    let merchantName = tx.description
      .replace(/Purchase authorized on \d{2}\/\d{2}\s*/i,"")
      .replace(/Recurring Payment authorized on \d{2}\/\d{2}\s*/i,"")
      .replace(/Recurring Payment -?\s*/i,"")
      .replace(/Purchase with Cash Back \$?\s*authorized on \d{2}\/\d{2}\s*/i,"")
      .split(/\s{2,}/)[0].substring(0,50).trim()
    return {
      date: tx.date, description: tx.description, amount: Math.abs(tx.amount),
      category: categoryName, isIncome: tx.type === "credit", merchantName, pending: false,
    }
  })
}

// ========================================
// MAIN UPLOAD HANDLER
// ========================================
export async function POST(request: NextRequest) {
  try {
    // Frontend sends JSON with file content already read
    const body = await request.json()
    const { fileName, fileContent, isPDF, accountName, accountType } = body

    if (!fileName || !fileContent || !accountName || !accountType) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    console.log("[upload] Processing:", fileName, "isPDF:", isPDF, "contentLength:", fileContent.length, "Account:", accountName)

    let parsed: { transactions: any[]; statementMonth: string; statementYear: string }

    // === PDF (base64 from frontend) ===
    if (isPDF) {
      console.log("[upload] Processing PDF with AI, base64 length:", fileContent.length)

      try {
        parsed = await extractTransactionsFromPDF(fileContent, fileName)
        console.log(`[upload] AI extracted ${parsed.transactions.length} txns for ${parsed.statementMonth} ${parsed.statementYear}`)
      } catch (e: any) {
        console.error("[upload] AI PDF extraction failed:", e.message)
        return NextResponse.json({
          error: e.message || "Failed to process PDF. Try uploading the CSV version instead.",
          success: false,
        }, { status: 500 })
      }
    }
    // === CSV (raw text from frontend) ===
    else {
      parsed = parseCSVText(fileContent)
      console.log(`[upload] CSV parsed: ${parsed.transactions.length} txns`)
    }

    if (parsed.transactions.length === 0) {
      return NextResponse.json({
        error: `No transactions found in ${fileName}. Supports Wells Fargo, Chase, and Barclays statements.`,
        success: false,
      }, { status: 400 })
    }

    // Categorize
    const categorized = categorizeByRules(parsed.transactions)
    const transactions = toUIFormat(categorized).map((t, i) => ({
      ...t,
      id: `${accountName}-${Date.now()}-${i}`,
      account: accountName,
    }))

    const catCount = transactions.filter(t => t.category !== "Uncategorized Expense").length
    console.log(`[upload] Done: ${transactions.length} txns, ${catCount} categorized`)

    return NextResponse.json({
      success: true,
      transactions,
      month: parsed.statementMonth,
      year: parsed.statementYear,
      message: `Processed ${transactions.length} transactions from ${fileName}`,
    })

  } catch (error: any) {
    console.error("[upload] Unhandled error:", error.message, error.stack)
    return NextResponse.json({ error: error.message || "Upload failed", success: false }, { status: 500 })
  }
}
