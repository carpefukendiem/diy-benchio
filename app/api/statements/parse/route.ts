import { NextResponse } from "next/server"
import { Buffer } from "buffer"
import { categorizeByRules } from "@/lib/categorization/rules-engine"

// Category ID -> human-readable name map
const CATEGORY_MAP: Record<string, { name: string; isPersonal: boolean; isTransfer: boolean }> = {
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
  "00000000-0000-0000-0002-000000000026": { name: "Home Improvement", isPersonal: false, isTransfer: false },
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
  "00000000-0000-0000-0004-000000000007": { name: "ATM Withdrawal", isPersonal: true, isTransfer: false },
  "00000000-0000-0000-0004-000000000008": { name: "Zelle / Venmo Transfer", isPersonal: false, isTransfer: true },
  "00000000-0000-0000-0004-000000000009": { name: "Crypto / Investments", isPersonal: true, isTransfer: false },
}

// ========================================
// Inline Wells Fargo PDF text parser
// (No external dependency — works on raw text from pdf-parse)
// ========================================
function parseWFText(text: string) {
  const lines = text.split("\n")

  // Extract year from statement header
  const yearMatch = text.match(/(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+(\d{4})/)
  const year = yearMatch ? parseInt(yearMatch[1]) : 2025

  // Extract statement month
  const monthNames: Record<string, string> = {
    January: "01", February: "02", March: "03", April: "04", May: "05", June: "06",
    July: "07", August: "08", September: "09", October: "10", November: "11", December: "12",
  }
  const monthMatch = text.match(/(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}/)
  const statementMonth = monthMatch ? `${year}-${monthNames[monthMatch[1]] || "01"}` : `${year}-01`

  // Parse transactions
  const txStartRe = /^(\d{1,2})\/(\d{1,2})\s+(.+)/
  const transactions: any[] = []
  let inTxSection = false
  let currentTx: any = null

  const creditKeywords = ["stripe transfer", "zelle from", "online transfer from", "upwork escrow",
    "purchase return", "refund", "overdraft protection from", "instant pmt from"]
  const debitKeywords = ["purchase authorized", "recurring payment", "online transfer to", "atm withdrawal",
    "zelle to", "overdraft fee", "monthly service fee", "chase credit crd",
    "so cal edison", "vz wireless", "recurring transfer to", "save as you go",
    "united fin cas"]

  for (const line of lines) {
    const trimmed = line.trim()

    if (/transaction history/i.test(trimmed)) {
      inTxSection = true
      continue
    }
    if (/^Totals|Monthly service fee summary|Account transaction fees/i.test(trimmed)) {
      if (currentTx) { transactions.push(currentTx); currentTx = null }
      inTxSection = false
      continue
    }
    if (!inTxSection || trimmed.length < 3) continue
    if (/^Date\b.*(?:Number|Description)/i.test(trimmed)) continue
    if (/Ending daily.*balance/i.test(trimmed)) continue

    const m = trimmed.match(txStartRe)
    if (m) {
      if (currentTx) transactions.push(currentTx)

      const monthNum = parseInt(m[1])
      const dayNum = parseInt(m[2])
      const rest = m[3]

      // Extract amounts (numbers with decimals at end of line)
      const amounts = rest.match(/[\d,]+\.\d{2}/g) || []
      let desc = rest.replace(/\s+[\d,]+\.\d{2}/g, "").replace(/\s*-[\d,]+\.\d{2}/g, "").trim()
      const amount = amounts.length > 0 ? parseFloat(amounts[0].replace(/,/g, "")) : 0

      // Determine credit vs debit
      const descLower = desc.toLowerCase()
      const isCredit = creditKeywords.some(k => descLower.includes(k))
      const isDebit = debitKeywords.some(k => descLower.includes(k))
      const txType = isCredit && !isDebit ? "credit" : "debit"

      currentTx = {
        date: `${year}-${String(monthNum).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`,
        description: desc,
        amount,
        type: txType,
        raw_line: trimmed,
      }
    } else if (currentTx) {
      // Continuation line — append to description
      let extra = trimmed
        .replace(/\s*-?[\d,]+\.\d{2}\s*/g, "")
        .replace(/S\d{15,}/g, "")
        .replace(/P\d{15,}/g, "")
        .replace(/Card \d{4}$/g, "")
        .trim()

      if (extra && !/^\d+$/.test(extra)) {
        currentTx.description += " " + extra
      }
      // If current tx has no amount, check continuation for one
      if (currentTx.amount === 0) {
        const contAmounts = trimmed.match(/[\d,]+\.\d{2}/g)
        if (contAmounts) {
          currentTx.amount = parseFloat(contAmounts[0].replace(/,/g, ""))
        }
      }
    }
  }
  if (currentTx) transactions.push(currentTx)

  // Clean up
  const cleaned = transactions
    .filter(tx => tx.amount > 0)
    .map(tx => ({
      ...tx,
      description: tx.description.replace(/\s+/g, " ").trim(),
    }))

  // Get month name for response
  const monthNum = parseInt(statementMonth.split("-")[1] || "1")
  const monthNameList = ["January","February","March","April","May","June","July","August","September","October","November","December"]

  return {
    transactions: cleaned,
    statementMonth: monthNameList[monthNum - 1] || "Unknown",
    statementYear: String(year),
  }
}

// ========================================
// Inline CSV parser (no papaparse dependency)
// ========================================
function parseCSVText(csvText: string) {
  const lines = csvText.split("\n").filter(l => l.trim())
  const transactions: any[] = []

  for (const line of lines) {
    if (/Transaction History|^Date|Check Number|Totals|Monthly service|Account transaction/i.test(line)) continue

    const parts = line.split(/\t|,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map(p => p.trim().replace(/^"|"$/g, ""))
    if (parts.length < 2) continue

    const dateStr = parts[0]
    if (!/\d{1,2}\/\d{1,2}/.test(dateStr)) continue

    const description = parts[1] || ""
    const deposits = parts[2] ? parseFloat(parts[2].replace(/,/g, "")) : 0
    const withdrawals = parts[3] ? parseFloat(parts[3].replace(/,/g, "")) : 0

    if (deposits === 0 && withdrawals === 0 && isNaN(deposits) && isNaN(withdrawals)) continue

    const isIncome = deposits > 0
    const amount = isIncome ? deposits : withdrawals

    const [month, day] = dateStr.split("/")
    const date = `2025-${(month || "01").padStart(2, "0")}-${(day || "01").padStart(2, "0")}`

    if (amount > 0) {
      transactions.push({
        date,
        description: description.substring(0, 200),
        amount: Math.abs(amount),
        type: isIncome ? "credit" : "debit",
        raw_line: line,
      })
    }
  }

  return { transactions, statementMonth: "Multiple", statementYear: "2025" }
}


export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File
    const accountType = formData.get("accountType") as string
    const accountName = formData.get("accountName") as string

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    console.log("[parse] Processing:", file.name, "Type:", file.type, "Size:", file.size)

    let parsedResult: { transactions: any[]; statementMonth: string; statementYear: string }

    // === PDF PARSING ===
    if (file.name.endsWith(".pdf") || file.type === "application/pdf") {
      const arrayBuffer = await file.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)

      let pdfText = ""
      try {
        // pdf-parse has a known issue with test files on serverless
        // We use dynamic import and handle errors gracefully
        const pdfParse = (await import("pdf-parse")).default
        const pdfData = await pdfParse(buffer, {
          // Disable test file loading
          max: 0,
        })
        pdfText = pdfData.text
      } catch (pdfError: any) {
        console.error("[parse] pdf-parse error:", pdfError.message)
        // Fallback: try with explicit options
        try {
          const pdf = require("pdf-parse/lib/pdf-parse")
          const data = await pdf(buffer)
          pdfText = data.text
        } catch (fallbackError: any) {
          console.error("[parse] pdf-parse fallback also failed:", fallbackError.message)
          return NextResponse.json(
            { error: "Failed to read PDF. Try converting to CSV from your Wells Fargo online banking." },
            { status: 500 }
          )
        }
      }

      console.log("[parse] PDF text extracted, length:", pdfText.length)

      if (pdfText.length < 100) {
        return NextResponse.json(
          { error: "PDF appears to be scanned/image-only. Please download a digital PDF from Wells Fargo online banking." },
          { status: 400 }
        )
      }

      parsedResult = parseWFText(pdfText)
      console.log(`[parse] WF PDF: ${parsedResult.transactions.length} transactions for ${parsedResult.statementMonth} ${parsedResult.statementYear}`)
    }
    // === CSV PARSING ===
    else if (file.name.endsWith(".csv") || file.type === "text/csv") {
      const csvText = await file.text()
      parsedResult = parseCSVText(csvText)
      console.log(`[parse] CSV: ${parsedResult.transactions.length} transactions`)
    } else {
      return NextResponse.json({ error: "Unsupported file type. Use PDF or CSV." }, { status: 400 })
    }

    if (parsedResult.transactions.length === 0) {
      return NextResponse.json(
        { error: "No transactions found in file. Make sure this is a Wells Fargo statement." },
        { status: 400 }
      )
    }

    // === CATEGORIZE with rule engine ===
    const categorized = categorizeByRules(parsedResult.transactions)

    // Convert to the format the existing UI expects
    const transactions = categorized.map((tx) => {
      const catInfo = tx.category_id ? CATEGORY_MAP[tx.category_id] : null
      const categoryName = catInfo?.name || "Uncategorized Expense"
      const isIncome = tx.type === "credit"

      let merchantName = tx.description
        .replace(/Purchase authorized on \d{2}\/\d{2}\s*/i, "")
        .replace(/Recurring Payment authorized on \d{2}\/\d{2}\s*/i, "")
        .replace(/Recurring Payment -?\s*/i, "")
        .replace(/Purchase with Cash Back \$?\s*authorized on \d{2}\/\d{2}\s*/i, "")
        .split(/\s{2,}/)[0]
        .substring(0, 50)
        .trim()

      return {
        date: tx.date,
        description: tx.description,
        amount: Math.abs(tx.amount),
        category: categoryName,
        isIncome,
        merchantName,
        pending: false,
      }
    })

    const catCount = transactions.filter((t: any) => t.category !== "Uncategorized Expense").length
    console.log(`[parse] Done: ${transactions.length} total, ${catCount} categorized, ${transactions.length - catCount} uncategorized`)

    return NextResponse.json({
      transactions,
      month: parsedResult.statementMonth,
      year: parsedResult.statementYear,
      success: true,
    })

  } catch (error: any) {
    console.error("[parse] Unhandled error:", error.message, error.stack)
    return NextResponse.json(
      { error: `Failed to parse: ${error.message}` },
      { status: 500 }
    )
  }
}
