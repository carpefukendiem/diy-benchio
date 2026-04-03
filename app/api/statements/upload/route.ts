import { type NextRequest, NextResponse } from "next/server"
import { categorizeByRules, CATEGORY_ID_TO_NAME } from "@/lib/categorization/rules-engine"
import pdfParse from "pdf-parse"
import { KEYWORD_MAPPING_RULES } from "@/lib/categorization/keyword-mapping"

// Route segment config for Next.js App Router (large PDFs + pdf-parse)
export const maxDuration = 60
export const runtime = "nodejs"

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
  "00000000-0000-0000-0004-000000000009": { name: "Crypto / Investments", isPersonal: true, isTransfer: true },
  "00000000-0000-0000-0004-000000000010": { name: "Personal - Investments", isPersonal: true, isTransfer: true },
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
// Parse Wells Fargo bank statement PDF text
//
// pdf-parse format (verified against real statements):
// Header:  "January 31, 2025         Page 1 of 6"
// Txn line example (multi-line, amounts in separate columns):
//   "1/2   Stripe Transfer St-J1A4W0L7G7I9 Ruben Ruiz  301.75          \n"  (credit)
//   "1/2   Recurring Payment authorized on 01/01 Google *Gsuite_Ran\nCC@Google.Com CA ...  \n   7.20       \n"  (debit)
//
// Lines starting with M/D are transaction dates.
// Amount columns: credits appear before debits, then ending balance.
// We reassemble multi-line transactions (description wraps) then parse amounts.
// ========================================
function parseWFPDFText(text: string) {
  const creditKW = [
    "stripe transfer",
    "zelle from",
    "online transfer from",
    "upwork escrow",
    "from upwork",
    "upwork",
    "upwork ca",
    "money transfer from",
    "money transfer authorized",
    "purchase return",
    "refund",
    "overdraft protection from",
    "instant pmt from",
    "deposit",
    "payment received",
  ]
  const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"]

  // Year from header: "January 31, 2025" or "December 31, 2025"
  const yearMatch = text.match(/(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+(\d{4})/)
  const year = yearMatch ? parseInt(yearMatch[1]) : new Date().getFullYear()

  const txns: any[] = []

  // Split text into lines; group into transaction blocks.
  // A transaction starts with "M/D   " (date pattern at start of line).
  // Subsequent lines with no date but containing description/amounts belong to same txn.
  const lines = text.split("\n")

  interface WFTxn { date: string; descParts: string[]; amounts: number[] }
  let current: WFTxn | null = null

  const flushCurrent = () => {
    if (!current) return
    const desc = current.descParts
      .join(" ")
      .replace(/Purchase authorized on \d{2}\/\d{2}\s*/gi, "")
      .replace(/Recurring Payment authorized on \d{2}\/\d{2}\s*/gi, "")
      .replace(/Recurring Payment -?\s*/gi, "")
      .replace(/Purchase with Cash Back \$?\d*\.?\d* authorized on \d{2}\/\d{2}\s*/gi, "")
      .replace(/\s+/g, " ").trim()

    if (desc.length < 2) return
    if (/^(Date|Check|Number|Description|Deposits|Withdrawals|Credits|Debits|Ending daily|Beginning balance|Ending balance|Totals|Monthly service fee|Other fees|Transaction history)/i.test(desc)) return

    // Amounts: first non-zero is credit or debit. WF format: credit then debit then balance.
    // We use keyword heuristic to determine credit vs debit.
    const dl = desc.toLowerCase()
    const isCr = creditKW.some(k => dl.includes(k))
    const amount = current.amounts.find(a => a > 0) || 0
    if (amount <= 0 || amount > 999999) return

    let finalAmount = amount
    let finalDesc = desc
    // WF overdraft fee shows the protected transaction amount, not the $35 fee
    if (dl.includes("overdraft fee for a transaction")) {
      finalAmount = 35.00
      finalDesc = "Overdraft Fee"
    }

    txns.push({
      date: current.date,
      description: finalDesc.substring(0, 200),
      amount: finalAmount,
      type: isCr ? "credit" : "debit",
      raw_line: current.descParts[0]?.substring(0, 200) || "",
    })
  }

  for (const rawLine of lines) {
    const line = rawLine.trimEnd()
    // New transaction: line starts with M/D date pattern
    // Wells Fargo exports are inconsistent: separator after date can be tabs, many spaces,
    // or OCR-expanded whitespace. Accept any whitespace width.
    const dateM = line.match(/^(\d{1,2})\s*\/\s*(\d{1,2})\s+(.*)/)
    if (dateM) {
      flushCurrent()
      const mo = dateM[1].padStart(2, "0")
      const da = dateM[2].padStart(2, "0")
      const rest = dateM[3].trim()
      // Extract amounts from this line
      const amtMatches = rest.match(/[\d,]+\.\d{2}/g) || []
      const amounts = amtMatches.map(a => parseFloat(a.replace(/,/g, ""))).filter(a => a > 0)
      // Description: everything before the first amount
      const firstAmt = amtMatches[0]
      const descPart =
        firstAmt !== undefined ? rest.substring(0, rest.indexOf(firstAmt)).trim() : rest.trim()
      current = { date: `${year}-${mo}-${da}`, descParts: descPart ? [descPart] : [], amounts }
    } else if (current) {
      // Continuation line
      const trimmed = line.trim()
      if (!trimmed) continue
      const amtMatches = trimmed.match(/^[\d,]+\.\d{2}(\s+[\d,]+\.\d{2})*$/)
      if (amtMatches) {
        // Pure amount line
        const nums = trimmed.match(/[\d,]+\.\d{2}/g) || []
        nums.forEach(n => { const v = parseFloat(n.replace(/,/g, "")); if (v > 0) current!.amounts.push(v) })
      } else {
        // Description continuation — strip trailing amounts first
        const cleaned = trimmed.replace(/\s+[\d,]+\.\d{2}(\s+[\d,]+\.\d{2})*\s*$/, "").trim()
        if (cleaned.length > 1 && cleaned.length < 200) current.descParts.push(cleaned)
        // Still grab any amounts on this line
        const lineAmts = trimmed.match(/[\d,]+\.\d{2}/g) || []
        lineAmts.forEach(n => { const v = parseFloat(n.replace(/,/g, "")); if (v > 0 && !current!.amounts.includes(v)) current!.amounts.push(v) })
      }
    }
  }
  flushCurrent()

  // Determine statement month from most common transaction month
  const monthCounts: Record<string, number> = {}
  txns.forEach(t => { const m = t.date.substring(5, 7); monthCounts[m] = (monthCounts[m] || 0) + 1 })
  const topMonth = Object.entries(monthCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "01"

  console.log(`[wf-pdf] Parsed ${txns.length} transactions, top month: ${topMonth}, year: ${year}`)
  return { transactions: txns, statementMonth: monthNames[parseInt(topMonth) - 1] || "Unknown", statementYear: String(year) }
}

// ========================================
// Parse Chase credit card PDF text
//
// pdf-parse format (verified against real statements):
// Transactions section starts with "Transaction\nMerchant  Name or Transaction Description$ Amount\n"
// Each transaction line: "MM/DD     DESCRIPTION<amount>" (no space before amount)
// Payment line: "01/03     Payment Thank You - Web-250.00" (negative = credit)
// Purchase line: "12/14     STAPLES       00108894 GOLETA CA31.53"
// Fee line: "02/12     LATE FEE40.00"
// Interest: "02/14     PURCHASE INTEREST CHARGE144.21"
// Summary rows: "TOTAL FEES FOR THIS PERIOD$40.00", "TOTAL INTEREST..."
// ========================================
function parseChasePDFText(text: string) {
  const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"]

  let year = new Date().getFullYear() - 1
  // Chase 2025 statements show due dates in
  // 2025/2026 but transactions are in 2025.
  // Derive from Payment Due Date:
  const chaseDueDateMatch = text.match(
    /Payment Due Date[:\s]*(\d{2})\/(\d{2})\/(\d{2,4})/
  )
  if (chaseDueDateMatch) {
    let dueYr = parseInt(chaseDueDateMatch[3])
    if (dueYr < 100) dueYr += 2000
    const dueMo = parseInt(chaseDueDateMatch[1])
    // Due date is ~3 weeks after statement closes
    // Feb due date = January statement = dueYr
    // Jan due date = December statement = dueYr - 1
    // All other months: statement year = dueYr
    year = dueMo === 1 ? dueYr - 1 : dueYr
  }
  let stmtMonth = "Unknown"

  const txns: any[] = []

  // Chase format varies by export version; don't hard-fail if this exact header is missing.
  const txnSectionIdx = text.indexOf("Merchant  Name or Transaction Description")
  const txnText = txnSectionIdx >= 0 ? text.substring(txnSectionIdx) : text
  const lines = txnText.split("\n")

  // Each transaction line is usually "MM/DD  DESCRIPTION  AMOUNT" (amount may or may not be spaced).
  // Negative amounts = credits (payments), positive = debits (charges)
  const TXN_LINE_RE = /^(\d{1,2})\/(\d{1,2})\s+(.+?)\s*(-?[\d,]+\.\d{2})$/

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue
    // Skip summary rows
    if (/^(TOTAL |Year-to-date|Total fees|Total interest|Your\s+is|Purchases|Cash Advances|Balance Transfers|\(v\)|\(d\))/i.test(trimmed)) continue

    const m = trimmed.match(TXN_LINE_RE)
    if (!m) continue

    const mo = parseInt(m[1]), da = parseInt(m[2])
    if (mo < 1 || mo > 12 || da < 1 || da > 31) continue

    let desc = m[3].replace(/\s{2,}/g, " ").trim()
    const rawAmt = parseFloat(m[4].replace(/,/g, ""))
    const amount = Math.abs(rawAmt)
    const isCredit = rawAmt < 0  // negative = payment/credit

    if (amount <= 0 || amount > 999999) continue
    if (desc.length < 2) continue

    // Skip interest/fee summary rows embedded in transactions
    if (/^(Interest Charge|INTEREST CHARGE|Fees Charged|TOTAL FEES|TOTAL INTEREST)/i.test(desc)) continue

    // Determine year: if we're in Jan-Feb and see Dec transactions, they're prior year
    // Use the statement's most recent month to anchor the year
    txns.push({
      date: `${year}-${String(mo).padStart(2, "0")}-${String(da).padStart(2, "0")}`,
      description: desc.substring(0, 200),
      amount,
      type: isCredit ? "credit" : "debit",
      raw_line: trimmed.substring(0, 200),
    })
  }

  // Determine statement month from most common transaction month
  const monthCounts: Record<string, number> = {}
  txns.forEach(t => { const mo = t.date.substring(5, 7); monthCounts[mo] = (monthCounts[mo] || 0) + 1 })
  const topMonth = Object.entries(monthCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "01"
  stmtMonth = monthNames[parseInt(topMonth) - 1] || "Unknown"

  // Fix year for transactions in the minority month that cross year boundary
  // e.g. statement mostly in Jan 2025 but has Dec 2024 transactions
  if (txns.length > 0) {
    const monthNums = txns.map(t => parseInt(t.date.substring(5, 7)))
    const maxMonth = Math.max(...monthNums)
    const minMonth = Math.min(...monthNums)
    // If we span Dec->Jan boundary, Dec txns should be prior year
    if (maxMonth === 12 && minMonth === 1) {
      txns.forEach(t => {
        if (parseInt(t.date.substring(5, 7)) === 12) {
          t.date = `${year - 1}-${t.date.substring(5)}`
        }
      })
    }
  }

  console.log(`[chase-pdf] Parsed ${txns.length} transactions, month=${stmtMonth}, year=${year}`)
  return { transactions: txns, statementMonth: stmtMonth, statementYear: String(year) }
}

// ========================================
// Parse Barclays credit card PDF text
//
// Exact format produced by pdf-parse (server-side, verified against real statements):
//
// Header:    "Statement Balance as of 05/08/25:  (account ending 2163)\n$4,059.94"
//            Payment Due Date is on the NEXT LINE after "Payment Due Date:\n"
//
// Transaction lines (NO spaces between date columns — pdf-parse joins them):
// Payment:   "Apr 14Apr 14Payment Received WELLS FARGO BN/A-$242.77"
// Purchase:  "Apr 19Apr 20SQ *PANINO GOLETA Goleta CA99$32.95"
//            "Apr 20Apr 21Prime Video Channels amzn.com/bill WA6$5.99"
// Fee:       "Aug 05Aug 05LATE PAYMENT FEE$40.00"
// Interest:  "Aug 08Aug 08INTEREST CHARGE-PB PURCHASE$55.34"
//            "Aug 08Aug 08Interest Charge On Purchases$9.94"
//
// Key observations:
// - Transaction date + posting date are concatenated: "Apr 14Apr 14"
// - N/A for payments, no separator: "...WELLS FARGO BN/A-$242.77"
// - Points immediately before $: "...Goleta CA99$32.95"
// - Fees have no points column: "...LATE PAYMENT FEE$40.00"
// ========================================
function parseBarclaysPDFText(text: string) {
  const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"]
  const barclaysMonths: Record<string, string> = {
    Jan:"01",Feb:"02",Mar:"03",Apr:"04",May:"05",Jun:"06",Jul:"07",Aug:"08",Sep:"09",Oct:"10",Nov:"11",Dec:"12",
  }

  // ---- Extract statement closing date for year + month label ----
  // pdf-parse format: "Statement Balance as of 05/08/25:  (account ending..."
  // This is the most reliable date — always present, always the closing date.
  // Avoid "Payment Due Date" which can be next year (e.g. 01/05/26 for December stmt).
  const balanceMatch = text.match(/Statement Balance as of\s+(\d{1,2})\/(\d{1,2})\/(\d{2,4})/)
  let year = new Date().getFullYear()
  let stmtMonth = "Unknown"

  if (balanceMatch) {
    year = parseInt(balanceMatch[3]); if (year < 100) year += 2000
    stmtMonth = monthNames[parseInt(balanceMatch[1]) - 1] || "Unknown"
  }

  // ---- Parse transaction lines ----
  // pdf-parse joins date columns without spaces: "Apr 14Apr 14Description..."
  // Pattern: Mon DD repeated twice, then description + amount
  // We match each line against three patterns (payment, purchase, fee/interest)

  const txns: any[] = []

  // Parsing per-line is more resilient to PDF extraction spacing variations.
  const lines = text.split("\n")
  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) continue
    if (/^(total|no transaction|no payment|no fees|to see activity|purchase activity|2\d{3} year|this year|interest charge calc|type of balance|standard purchase|prior standard|balance transfer|cash advance|visit barclays|page \d|transaction date)/i.test(line)) continue

    // Transaction date + posting date are often concatenated: "Apr 14Apr 14..."
    const head = line.match(/^([A-Za-z]{3})\s*(\d{1,2})([A-Za-z]{3})\s*\d{1,2}(.+)$/)
    if (!head) continue

    const txMonAbbrRaw = head[1]
    const txMonAbbr = txMonAbbrRaw.charAt(0).toUpperCase() + txMonAbbrRaw.slice(1, 3).toLowerCase()
    const txDay = String(parseInt(head[2])).padStart(2, "0")
    const txMon = barclaysMonths[txMonAbbr] || "01"
    const tail = (head[4] || "").trim()
    if (!tail || tail.length < 3) continue

    const date = `${year}-${txMon}-${txDay}`

    // Barclays sometimes extracts "N/A" artifacts into the tail for fee lines.
    // If it looks like a late payment fee / interest charge, we must treat it as a debit (expense),
    // never as a credit.
    const tailLower = tail.toLowerCase()
    if (/late payment fee|late payment|late fee|interest charge/i.test(tailLower)) {
      const feeMatch = tail.match(/^(.*?)\$([\d,]+\.\d{2})$/)
      if (feeMatch) {
        const desc = (feeMatch[1] || tail).replace(/N\/A/i, "").replace(/\s+/g, " ").trim()
        const amount = parseFloat(feeMatch[2].replace(/,/g, ""))
        if (amount > 0 && desc.length > 1) {
          txns.push({
            date,
            description: desc.substring(0, 200),
            amount,
            type: "debit",
            raw_line: line.substring(0, 200),
          })
        }
        continue
      }
      // If we can't parse the fee amount, fall through to other heuristics.
    }

    // Payment / credit lines
    const payment = tail.match(/^(.*?)(?:N\/A)?-?\$([\d,]+\.\d{2})$/i)
    if (payment && /payment|thank you|received|n\/a/i.test(tail)) {
      const amount = parseFloat(payment[2].replace(/,/g, ""))
      const desc = (payment[1] || tail).replace(/N\/A/i, "").replace(/-?\$[\d,]+\.\d{2}\s*$/i, "").trim()
      if (amount > 0) {
        txns.push({ date, description: desc.substring(0, 200), amount, type: "credit", raw_line: line.substring(0, 200) })
      }
      continue
    }

    // Purchase with points suffix before amount, e.g. "...CA99$32.95"
    const purchase = tail.match(/^(.*?)(\d{1,4})\$([\d,]+\.\d{2})$/)
    if (purchase) {
      const amount = parseFloat(purchase[3].replace(/,/g, ""))
      const desc = (purchase[1] || "").trim()
      if (amount > 0 && desc.length > 1) {
        txns.push({ date, description: desc.substring(0, 200), amount, type: "debit", raw_line: line.substring(0, 200) })
      }
      continue
    }

    // Generic amount-at-end line
    const generic = tail.match(/^(.*?)\$([\d,]+\.\d{2})$/)
    if (generic) {
      const amount = parseFloat(generic[2].replace(/,/g, ""))
      const desc = (generic[1] || "").trim()
      if (amount > 0 && desc.length > 1) {
        txns.push({ date, description: desc.substring(0, 200), amount, type: "debit", raw_line: line.substring(0, 200) })
      }
    }
  }

  console.log(`[barclays-pdf] Parsed ${txns.length} transactions, year=${year}, month=${stmtMonth}`)
  return { transactions: txns, statementMonth: stmtMonth, statementYear: String(year) }
}

// ========================================
// Parse PDF text extracted on the frontend via pdfjs-dist
// Auto-detects bank type and routes to the right parser
// ========================================
function parsePDFText(text: string) {
  const stmtType = detectStatementType(text)
  console.log(`[pdf] Auto-detected statement type: ${stmtType}, text length: ${text.length}`)

  const safeEmpty = { transactions: [] as any[], statementMonth: "Unknown", statementYear: String(new Date().getFullYear()) }

  let parsed = safeEmpty
  try {
    if (stmtType === "chase") {
      parsed = parseChasePDFText(text)
    } else if (stmtType === "barclays") {
      parsed = parseBarclaysPDFText(text)
    } else {
      // Default: Wells Fargo
      parsed = parseWFPDFText(text)
    }
  } catch (e: any) {
    console.error("[pdf] Primary parser crashed:", e?.message || e)
    parsed = safeEmpty
  }

  if (!parsed || !Array.isArray(parsed.transactions)) {
    console.warn("[pdf] Primary parser returned invalid shape; using safe empty result")
    parsed = safeEmpty
  }

  // If primary parser found nothing, try all parsers as fallback
  if (parsed.transactions.length === 0) {
    console.log("[pdf] Primary parser found 0 txns, trying all parsers as fallback")
    const runSafe = (fn: (x: string) => any, label: string) => {
      try {
        const out = fn(text)
        if (!out || !Array.isArray(out.transactions)) return safeEmpty
        return out
      } catch (e: any) {
        console.error(`[pdf] Fallback parser ${label} crashed:`, e?.message || e)
        return safeEmpty
      }
    }

    const wf = runSafe(parseWFPDFText, "wellsfargo")
    const chase = runSafe(parseChasePDFText, "chase")
    const barclays = runSafe(parseBarclaysPDFText, "barclays")

    const best = [wf, chase, barclays].sort((a, b) => b.transactions.length - a.transactions.length)[0] || safeEmpty
    if (best.transactions.length > 0) {
      console.log(`[pdf] Fallback found ${best.transactions.length} txns`)
      parsed = best
    }
  }

  return parsed
}

// ========================================
// Wells Fargo Business Checking — online CSV export (no header row)
// Columns: "MM/DD/YYYY","signed_amount","*","",description
// Positive amount = credit; negative = debit.
// ========================================
function stripUtf8Bom(text: string): string {
  if (text.charCodeAt(0) === 0xfeff) return text.slice(1)
  return text
}

function splitCsvFields(line: string): string[] {
  const fields: string[] = []
  let cur = ""
  let i = 0
  let inQuotes = false
  while (i < line.length) {
    const c = line[i]
    if (inQuotes) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"'
        i += 2
        continue
      }
      if (c === '"') {
        inQuotes = false
        i++
        continue
      }
      cur += c
      i++
      continue
    }
    if (c === '"') {
      inQuotes = true
      i++
      continue
    }
    if (c === ",") {
      fields.push(cur.trim())
      cur = ""
      i++
      continue
    }
    cur += c
    i++
  }
  fields.push(cur.trim())
  return fields.map((f) => f.replace(/^"|"$/g, ""))
}

// Allow 2- or 4-digit year (some exports use MM/DD/YY)
const WF_BIZ_CSV_DATE = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/

function normalizeWfBizYear(y: string): string {
  if (y.length === 4) return y
  const n = parseInt(y, 10)
  if (!Number.isFinite(n)) return y
  return n >= 70 ? `19${y}` : `20${y.padStart(2, "0")}`
}

function rowLooksLikeWellsFargoBusinessCsv(parts: string[]): boolean {
  if (parts.length < 5) return false
  const d = parts[0].trim()
  if (!WF_BIZ_CSV_DATE.test(d)) return false
  const n = parseFloat(parts[1].replace(/,/g, ""))
  return Number.isFinite(n)
}

function parseWellsFargoBusinessCSV(csvText: string) {
  csvText = stripUtf8Bom(csvText)
  const rawLines = csvText.split(/\r?\n/)
  const txns: any[] = []

  for (const rawLine of rawLines) {
    const line = rawLine.trim()
    if (!line) continue
    const parts = splitCsvFields(line)
    if (!rowLooksLikeWellsFargoBusinessCsv(parts)) continue

    const dm = parts[0].trim().match(WF_BIZ_CSV_DATE)
    if (!dm) continue
    const mo = dm[1].padStart(2, "0")
    const da = dm[2].padStart(2, "0")
    const yr = normalizeWfBizYear(dm[3])

    const signed = parseFloat(parts[1].replace(/,/g, ""))
    if (!Number.isFinite(signed) || signed === 0) continue

    const description = (parts[4] ?? "").trim() || parts.slice(4).join(",").trim()
    if (!description) continue

    const amount = Math.abs(signed)
    const type = signed > 0 ? "credit" : "debit"

    txns.push({
      date: `${yr}-${mo}-${da}`,
      description: description.substring(0, 200),
      amount,
      type,
      raw_line: line.length > 500 ? line.substring(0, 500) : line,
    })
  }

  const monthCounts: Record<string, number> = {}
  txns.forEach((t) => {
    const m = t.date.substring(5, 7)
    monthCounts[m] = (monthCounts[m] || 0) + 1
  })
  const topMonth = Object.entries(monthCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "01"
  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ]

  console.log(`[csv-wf-business] Parsed ${txns.length} transactions, top month: ${topMonth}`)

  return {
    transactions: txns,
    statementMonth: monthNames[parseInt(topMonth, 10) - 1] || "Unknown",
    statementYear: txns[0]?.date?.substring(0, 4) || "2025",
  }
}

// ========================================
// Parse CSV text into transactions
// Handles 3 formats:
//   1. Wells Fargo text export (no headers, multiline, amount on its own line)
//   2. Standard CSV with headers (Date, Description, Amount OR Date, Desc, Credit, Debit)
//   3. Chase CSV (Transaction Date, Post Date, Description, Category, Type, Amount)
// ========================================
function parseCSVText(csvText: string) {
  csvText = stripUtf8Bom(csvText)
  const rawLines = csvText.split(/\r?\n/)

  // ------- Detect format -------
  const firstNonEmpty = rawLines.find(l => l.trim().length > 0) || ""

  // Wells Fargo Business Checking CSV: quoted fields, col0 = date, col1 = signed amount, no header.
  // Must run before WF text-export heuristic — that pattern expects a bare "M/D " start, not a leading quote.
  if (firstNonEmpty.includes(",")) {
    try {
      const probe = splitCsvFields(firstNonEmpty.trim())
      if (rowLooksLikeWellsFargoBusinessCsv(probe)) {
        console.log("[csv] Detected Wells Fargo Business Checking CSV (quoted export)")
        return parseWellsFargoBusinessCSV(csvText)
      }
    } catch {
      /* ignore probe errors */
    }
  }

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

  // Credit keywords (these are deposits / income) — align with WF / Upwork settlement strings
  const creditKW = [
    "stripe transfer",
    "online transfer from",
    "upwork escrow",
    "upwork escrow in edi",
    "edi pymnts",
    "from upwork",
    "upwork",
    "upwork ca",
    "payment escrow i edi",
    "payment escrow inc",
    "payment escrow",
    "money transfer authorized",
    "deposit",
    "credit memo",
    "interest payment",
  ]

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
function toUIFormat(categorized: any[] | undefined | null) {
  const list = Array.isArray(categorized) ? categorized : []
  return list.map(tx => {
    const categoryName = tx.category_id
      ? CAT[tx.category_id]?.name ?? CATEGORY_ID_TO_NAME[tx.category_id]?.name ?? "Uncategorized Expense"
      : "Uncategorized Expense"
    let merchantName = tx.description
      .replace(/Purchase authorized on \d{2}\/\d{2}\s*/i,"")
      .replace(/Recurring Payment authorized on \d{2}\/\d{2}\s*/i,"")
      .replace(/Recurring Payment -?\s*/i,"")
      .replace(/Purchase with Cash Back \$?\s*authorized on \d{2}\/\d{2}\s*/i,"")
      .split(/\s{2,}/)[0].substring(0,50).trim()
    // Credit/debit from parser (WF Business CSV uses amount sign → type). Any 0001-* category
    // counts as income in the UI so Freelance/Stripe stay revenue even if type was mis-detected.
    const isIncome =
      tx.type === "credit" || (tx.category_id?.startsWith("00000000-0000-0000-0001-") ?? false)
    return {
      date: tx.date,
      description: tx.description,
      amount: Math.abs(tx.amount),
      category: categoryName,
      isIncome,
      merchantName,
      pending: false,
      is_personal: Boolean(tx.is_personal),
      is_transfer: Boolean(tx.is_transfer),
      confidence: typeof tx.confidence === "number" ? tx.confidence : undefined,
      categorized_by: tx.categorized_by ?? undefined,
      notes: tx.notes ?? undefined,
    }
  })
}

// ========================================
// Core parse + categorize (shared by JSON and multipart uploads)
// ========================================
async function processStatementBuffer(params: {
  fileName: string
  isPDF: boolean
  accountName: string
  accountType: string
  buffer: Buffer
}) {
  const { fileName, isPDF, accountName, accountType } = params
  const buffer = params.buffer

  console.log("[upload] Processing:", fileName, "isPDF:", isPDF, "bytes:", buffer.length, "Account:", accountName, "type:", accountType)

  let parsed: { transactions: any[]; statementMonth: string; statementYear: string }

  if (isPDF) {
    console.log("[upload] Extracting PDF text server-side with pdf-parse")
    const pdfData = await pdfParse(buffer)
    const extractedText = pdfData.text
    console.log("[upload] pdf-parse extracted text length:", extractedText.length, "pages:", pdfData.numpages)
    if (extractedText.length < 20) {
      return {
        ok: false as const,
        status: 400,
        error: `Could not read text from ${fileName}. Try downloading the statement again as a digital PDF (not a scan/photo).`,
      }
    }
    parsed = parsePDFText(extractedText)
    console.log(
      `[upload] PDF parsed: ${parsed.transactions?.length ?? 0} txns for ${parsed.statementMonth} ${parsed.statementYear}`
    )
  } else {
    const csvText = stripUtf8Bom(buffer.toString("utf-8"))
    if (accountType === "wf_business_csv") {
      parsed = parseWellsFargoBusinessCSV(csvText)
      console.log(`[upload] WF Business CSV parsed: ${parsed.transactions?.length ?? 0} txns`)
    } else {
      parsed = parseCSVText(csvText)
      console.log(`[upload] CSV parsed: ${parsed.transactions?.length ?? 0} txns`)
    }
  }

  if (!parsed || !Array.isArray(parsed.transactions)) {
    return {
      ok: false as const,
      status: 500,
      error: "Parser returned undefined",
    }
  }

  if (parsed.transactions.length === 0) {
    return {
      ok: false as const,
      status: 400,
      error: `No transactions found in ${fileName}. Supports Wells Fargo, Chase, and Barclays statements.`,
    }
  }

  let safeCategorized: any[]
  try {
    const result = categorizeByRules(parsed.transactions, KEYWORD_MAPPING_RULES)
    safeCategorized = Array.isArray(result) ? result : parsed.transactions
  } catch (e) {
    console.error("[upload] categorizeByRules failed:", e)
    safeCategorized = parsed.transactions
  }

  const transactions = toUIFormat(safeCategorized).map((t, i) => ({
    ...t,
    id: `${accountName}-${Date.now()}-${i}`,
    account: accountName,
  }))

  const catCount = transactions.filter(t => t.category !== "Uncategorized Expense").length
  console.log(`[upload] Done: ${transactions.length} txns, ${catCount} categorized`)

  return {
    ok: true as const,
    transactions,
    month: parsed.statementMonth,
    year: parsed.statementYear,
    message: `Processed ${transactions.length} transactions from ${fileName}`,
  }
}

type ProcessOkResult = Extract<Awaited<ReturnType<typeof processStatementBuffer>>, { ok: true }>

function uploadSuccessResponse(result: ProcessOkResult) {
  console.log(
    "[upload] Returning:",
    result.transactions?.length,
    "transactions",
    "month:",
    result.month,
    "year:",
    result.year
  )
  if (!result.transactions || !Array.isArray(result.transactions)) {
    return NextResponse.json(
      { error: "Parser returned no transaction array", success: false },
      { status: 500 }
    )
  }
  return NextResponse.json({
    success: true,
    transactions: result.transactions,
    month: result.month,
    year: result.year,
    message: result.message,
  })
}

// ========================================
// MAIN UPLOAD HANDLER (multipart preferred — avoids huge base64 JSON bodies)
// ========================================
export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") || ""

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData()
      const file = formData.get("file")
      if (!(file instanceof Blob)) {
        return NextResponse.json({ error: "Missing file in form data", success: false }, { status: 400 })
      }

      const fileName = String(formData.get("fileName") || (file as File).name || "statement")
      const accountName = String(formData.get("accountName") || "")
      const accountType = String(formData.get("accountType") || "")
      const isPDFFlag = String(formData.get("isPDF") || "")
      const isPDF =
        isPDFFlag === "true" ||
        fileName.toLowerCase().endsWith(".pdf") ||
        (file as File).type === "application/pdf"

      if (!accountName || !accountType) {
        return NextResponse.json({ error: "Missing account name or account type", success: false }, { status: 400 })
      }

      const arrayBuffer = await file.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)

      let result: Awaited<ReturnType<typeof processStatementBuffer>>
      try {
        result = await processStatementBuffer({
          fileName,
          isPDF,
          accountName,
          accountType,
          buffer,
        })
      } catch (innerError: any) {
        console.error(
          "[upload] processStatementBuffer crashed:",
          innerError?.message,
          innerError?.stack?.substring(0, 500)
        )
        return NextResponse.json(
          {
            error: innerError?.message || "Processing failed",
            success: false,
            debug: innerError?.stack?.substring(0, 200),
          },
          { status: 500 }
        )
      }

      if (!result.ok) {
        return NextResponse.json({ error: result.error, success: false }, { status: result.status })
      }

      return uploadSuccessResponse(result)
    }

    // Legacy: JSON + base64 (kept for compatibility; avoid for large PDFs)
    const body = await request.json()
    const { fileName, fileContent, isPDF, accountName, accountType } = body

    if (!fileName || !fileContent || !accountName || !accountType) {
      return NextResponse.json({ error: "Missing required fields", success: false }, { status: 400 })
    }

    const buffer = isPDF ? Buffer.from(fileContent, "base64") : Buffer.from(String(fileContent), "utf-8")

    let result: Awaited<ReturnType<typeof processStatementBuffer>>
    try {
      result = await processStatementBuffer({
        fileName,
        isPDF: Boolean(isPDF),
        accountName,
        accountType,
        buffer,
      })
    } catch (innerError: any) {
      console.error(
        "[upload] processStatementBuffer crashed:",
        innerError?.message,
        innerError?.stack?.substring(0, 500)
      )
      return NextResponse.json(
        {
          error: innerError?.message || "Processing failed",
          success: false,
          debug: innerError?.stack?.substring(0, 200),
        },
        { status: 500 }
      )
    }

    if (!result.ok) {
      return NextResponse.json({ error: result.error, success: false }, { status: result.status })
    }

    return uploadSuccessResponse(result)
  } catch (error: any) {
    console.error("[upload] Unhandled error:", error.message, error.stack)
    return NextResponse.json({ error: error.message || "Upload failed", success: false }, { status: 500 })
  }
}
