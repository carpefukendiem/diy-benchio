import { type NextRequest, NextResponse } from "next/server"
import { categorizeByRules } from "@/lib/categorization/rules-engine"

// Route segment config for Next.js App Router
export const maxDuration = 30

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
// Detect statement type from extracted PDF text
// ========================================
function detectStatementType(text: string): "wellsfargo" | "chase" | "barclays" | "unknown" {
  const t = text.toLowerCase()
  if (t.includes("wells fargo") || (t.includes("transaction history") && t.includes("purchase authorized"))) return "wellsfargo"
  if (t.includes("chase freedom") || t.includes("chase.com") || t.includes("cardmember service") || t.includes("account activity")) return "chase"
  if (t.includes("barclays") || t.includes("barclaysus.com") || t.includes("barclays view")) return "barclays"
  return "unknown"
}

// ========================================
// Parse Wells Fargo PDF text (extracted by pdfjs-dist on frontend)
// ========================================
function parseWFPDFText(text: string) {
  const creditKW = ["stripe transfer","zelle from","online transfer from","upwork escrow","purchase return","refund","overdraft protection from","instant pmt from","deposit"]
  const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"]

  // Extract year from text
  const yearMatch = text.match(/(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+(\d{4})/)
  const year = yearMatch ? parseInt(yearMatch[1]) : 2025

  // pdfjs-dist joins text with spaces, so we look for date patterns M/D or M/DD
  const txns: any[] = []

  // Split on date patterns to find transactions
  // Pattern: M/D or M/DD followed by description and amount
  const segments = text.split(/(?=\b(\d{1,2})\/(\d{1,2})\b)/)

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]
    const m = seg.match(/^(\d{1,2})\/(\d{1,2})\s+(.+)/)
    if (!m) continue

    const mo = m[1].padStart(2, "0")
    const da = m[2].padStart(2, "0")
    const rest = m[3]

    // Extract amounts (dollar figures with decimals)
    const amtMatches = rest.match(/[\d,]+\.\d{2}/g)
    if (!amtMatches || amtMatches.length === 0) continue

    const amount = parseFloat(amtMatches[0].replace(/,/g, ""))
    if (amount <= 0 || amount > 999999) continue

    // Get description: everything before the first amount
    const firstAmtIdx = rest.indexOf(amtMatches[0])
    let desc = rest.substring(0, firstAmtIdx).trim()

    // Clean up description
    desc = desc.replace(/Purchase authorized on \d{2}\/\d{2}\s*/i, "")
      .replace(/Recurring Payment authorized on \d{2}\/\d{2}\s*/i, "")
      .replace(/Recurring Payment -?\s*/i, "")
      .replace(/\s+/g, " ").trim()

    if (desc.length < 2 || /^(Date|Ending daily|Beginning balance|Ending balance|Totals|Monthly service)/i.test(desc)) continue

    const dl = desc.toLowerCase()
    const isCr = creditKW.some(k => dl.includes(k))

    txns.push({
      date: `${year}-${mo}-${da}`,
      description: desc.substring(0, 200),
      amount,
      type: isCr ? "credit" : "debit",
      raw_line: seg.substring(0, 200),
    })
  }

  // Determine statement month
  const monthCounts: Record<string, number> = {}
  txns.forEach(t => { const m = t.date.substring(5, 7); monthCounts[m] = (monthCounts[m] || 0) + 1 })
  const topMonth = Object.entries(monthCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "01"

  console.log(`[wf-pdf] Parsed ${txns.length} transactions, top month: ${topMonth}`)
  return { transactions: txns, statementMonth: monthNames[parseInt(topMonth) - 1] || "Unknown", statementYear: String(year) }
}

// ========================================
// Parse Chase credit card PDF text
// ========================================
function parseChasePDFText(text: string) {
  const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"]
  const yearMatch = text.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})\s*-\s*(\d{1,2})\/(\d{1,2})\/(\d{2,4})/)

  let year = 2025
  let stmtMonth = "Unknown"
  if (yearMatch) {
    year = parseInt(yearMatch[6])
    if (year < 100) year += 2000
    stmtMonth = monthNames[parseInt(yearMatch[4]) - 1] || "Unknown"
  }

  const txns: any[] = []
  // Chase format from pdfjs: "10/15 MERCHANT NAME 10.86"
  const segments = text.split(/(?=\b(\d{1,2})\/(\d{1,2})\b)/)

  for (const seg of segments) {
    const m = seg.match(/^(\d{1,2})\/(\d{1,2})\s+(.+?)(\s+)([\d,]+\.\d{2})/)
    if (!m) continue

    const mo = parseInt(m[1]), da = parseInt(m[2])
    if (mo < 1 || mo > 12 || da < 1 || da > 31) continue

    const desc = m[3].trim()
    const amount = parseFloat(m[5].replace(/,/g, ""))
    if (amount <= 0 || amount > 999999) continue
    if (/^(TOTAL|Year-to-date|Previous|New Balance|Payment Due|Account Number)/i.test(desc)) continue

    const isPayment = /payment/i.test(desc) && !/late/i.test(desc)

    txns.push({
      date: `${year}-${String(mo).padStart(2, "0")}-${String(da).padStart(2, "0")}`,
      description: desc.substring(0, 200),
      amount,
      type: isPayment ? "credit" : "debit",
      raw_line: seg.substring(0, 200),
    })
  }

  console.log(`[chase-pdf] Parsed ${txns.length} transactions`)
  return { transactions: txns, statementMonth: stmtMonth, statementYear: String(year) }
}

// ========================================
// Parse Barclays credit card PDF text
// ========================================
function parseBarclaysPDFText(text: string) {
  const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"]
  const barclaysMonths: Record<string, string> = {
    Jan:"01",Feb:"02",Mar:"03",Apr:"04",May:"05",Jun:"06",Jul:"07",Aug:"08",Sep:"09",Oct:"10",Nov:"11",Dec:"12",
  }

  const periodMatch = text.match(/Statement Period\s+(\d{1,2})\/(\d{1,2})\/(\d{2,4})\s*-\s*(\d{1,2})\/(\d{1,2})\/(\d{2,4})/)
  let year = 2025
  let stmtMonth = "Unknown"
  if (periodMatch) {
    year = parseInt(periodMatch[6])
    if (year < 100) year += 2000
    stmtMonth = monthNames[parseInt(periodMatch[4]) - 1] || "Unknown"
  }

  const txns: any[] = []
  // Barclays format from pdfjs: "Dec 16 Dec 17 SQ *SWEET CREAMS SANTA BARBARA CA 42 $14.00"
  const purchaseRe = /(\w{3})\s+(\d{1,2})\s+(\w{3})\s+(\d{1,2})\s+(.+?)\s+(\d+)\s+\$?([\d,]+\.\d{2})/g
  const paymentRe = /(\w{3})\s+(\d{1,2})\s+(\w{3})\s+(\d{1,2})\s+(.+?)\s+N\/A\s+-?\$?([\d,]+\.\d{2})/g

  // Payments
  let pm
  while ((pm = paymentRe.exec(text)) !== null) {
    const txMon = barclaysMonths[pm[1]] || "01"
    const txDay = pm[2]
    const desc = pm[5].trim()
    const amount = parseFloat(pm[6].replace(/,/g, ""))
    if (amount > 0 && desc.length > 2) {
      txns.push({
        date: `${year}-${txMon}-${String(parseInt(txDay)).padStart(2, "0")}`,
        description: desc.substring(0, 200), amount, type: "credit", raw_line: pm[0],
      })
    }
  }

  // Purchases
  let pr
  while ((pr = purchaseRe.exec(text)) !== null) {
    const txMon = barclaysMonths[pr[1]] || "01"
    const txDay = pr[2]
    const desc = pr[5].trim()
    const amount = parseFloat(pr[7].replace(/,/g, ""))
    if (amount > 0 && desc.length > 2 && !/^Total/i.test(desc)) {
      // Skip if already added as a payment
      const isDupe = txns.some(t => t.date === `${year}-${txMon}-${String(parseInt(txDay)).padStart(2, "0")}` && t.amount === amount)
      if (!isDupe) {
        txns.push({
          date: `${year}-${txMon}-${String(parseInt(txDay)).padStart(2, "0")}`,
          description: desc.substring(0, 200), amount, type: "debit", raw_line: pr[0],
        })
      }
    }
  }

  console.log(`[barclays-pdf] Parsed ${txns.length} transactions`)
  return { transactions: txns, statementMonth: stmtMonth, statementYear: String(year) }
}

// ========================================
// Parse PDF text extracted on the frontend via pdfjs-dist
// Auto-detects bank type and routes to the right parser
// ========================================
function parsePDFText(text: string) {
  const stmtType = detectStatementType(text)
  console.log(`[pdf] Auto-detected statement type: ${stmtType}, text length: ${text.length}`)

  let parsed
  if (stmtType === "chase") {
    parsed = parseChasePDFText(text)
  } else if (stmtType === "barclays") {
    parsed = parseBarclaysPDFText(text)
  } else {
    // Default: Wells Fargo
    parsed = parseWFPDFText(text)
  }

  // If primary parser found nothing, try all parsers as fallback
  if (parsed.transactions.length === 0) {
    console.log("[pdf] Primary parser found 0 txns, trying all parsers as fallback")
    const wf = parseWFPDFText(text)
    const chase = parseChasePDFText(text)
    const barclays = parseBarclaysPDFText(text)

    const best = [wf, chase, barclays].sort((a, b) => b.transactions.length - a.transactions.length)[0]
    if (best.transactions.length > 0) {
      console.log(`[pdf] Fallback found ${best.transactions.length} txns`)
      parsed = best
    }
  }

  return parsed
}

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

    // === PDF (text already extracted on frontend via pdfjs-dist) ===
    if (isPDF) {
      console.log("[upload] Parsing PDF text (extracted on frontend), length:", fileContent.length)
      parsed = parsePDFText(fileContent)
      console.log(`[upload] PDF parsed: ${parsed.transactions.length} txns for ${parsed.statementMonth} ${parsed.statementYear}`)
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
