import { type NextRequest, NextResponse } from "next/server"
import { Buffer } from "buffer"
import { categorizeByRules } from "@/lib/categorization/rules-engine"

// CRITICAL: Allow large file uploads (bank PDFs can be 5MB+)
export const config = {
  api: {
    bodyParser: false,
  },
}

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
// Extract text from PDF buffer
// ========================================
async function extractPDFText(buffer: Buffer): Promise<string> {
  // pdf-parse has a known issue: on import, it tries to load a test PDF
  // which crashes on Vercel. We handle this with multiple fallback strategies.
  try {
    // Strategy 1: Dynamic import (works on Vercel when serverExternalPackages includes pdf-parse)
    const pdfParse = (await import("pdf-parse")).default
    const data = await pdfParse(buffer, {
      // Disable the test file that crashes Vercel
      max: 0, // no page limit
    })
    if (data && data.text && data.text.length > 50) {
      return data.text
    }
  } catch (e1: any) {
    console.log("[pdf] Dynamic import failed:", e1.message)
    try {
      // Strategy 2: require (works in some Node.js environments)
      const pdfParse = require("pdf-parse")
      const data = await pdfParse(buffer)
      if (data && data.text && data.text.length > 50) {
        return data.text
      }
    } catch (e2: any) {
      console.log("[pdf] Require failed:", e2.message)
    }
  }

  // Strategy 3: Manual extraction for simple text PDFs
  // Many bank PDFs have text directly in the buffer
  try {
    const textContent = buffer.toString("utf-8")
    // Look for common bank statement patterns in raw text
    if (textContent.includes("wells fargo") || textContent.includes("Wells Fargo") ||
        textContent.includes("chase") || textContent.includes("barclays")) {
      // Extract readable text between stream/endstream markers
      const streams = textContent.match(/stream\r?\n([\s\S]*?)endstream/g)
      if (streams) {
        const text = streams.map(s => {
          const content = s.replace(/^stream\r?\n/, "").replace(/endstream$/, "")
          // Filter to only printable ASCII
          return content.replace(/[^\x20-\x7E\n\r]/g, " ").replace(/\s+/g, " ").trim()
        }).filter(s => s.length > 20).join("\n")
        if (text.length > 100) return text
      }
    }
  } catch (e3: any) {
    console.log("[pdf] Manual extraction failed:", e3.message)
  }

  throw new Error(
    "Could not extract text from this PDF. This usually means pdf-parse failed to initialize. " +
    "Try these alternatives:\n" +
    "1. Download your statement as CSV instead of PDF from your bank's website\n" +
    "2. Try a different browser to download the PDF\n" +
    "3. Make sure the PDF is a digital statement (not a scanned image)"
  )
}

// ========================================
// Detect statement type from PDF text
// ========================================
function detectStatementType(text: string): "wellsfargo" | "chase" | "barclays" | "unknown" {
  const t = text.toLowerCase()
  if (t.includes("wells fargo") || (t.includes("transaction history") && t.includes("purchase authorized"))) return "wellsfargo"
  if (t.includes("chase freedom") || t.includes("chase.com/cardhelp") || t.includes("cardmember service")) return "chase"
  if (t.includes("barclays") || t.includes("barclaysus.com") || t.includes("barclays view")) return "barclays"
  // Fallback heuristics
  if (t.includes("account activity") && t.includes("merchant name or transaction")) return "chase"
  if (t.includes("purchase activity for") && t.includes("points")) return "barclays"
  return "unknown"
}

// ========================================
// Parse Chase credit card statement text
// ========================================
function parseChaseText(text: string) {
  const lines = text.split("\n")

  // Extract statement date for year
  const stmtDateMatch = text.match(/Statement Date:\s*(\d{1,2})\/(\d{1,2})\/(\d{2,4})/)
  const openCloseMatch = text.match(/Opening\/Closing Date\s+(\d{1,2})\/(\d{1,2})\/(\d{2,4})\s*-\s*(\d{1,2})\/(\d{1,2})\/(\d{2,4})/)
  
  let year = 2025
  let stmtMonth = "Unknown"
  const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"]
  
  if (stmtDateMatch) {
    year = parseInt(stmtDateMatch[3])
    if (year < 100) year += 2000
    const mn = parseInt(stmtDateMatch[1])
    stmtMonth = monthNames[mn - 1] || "Unknown"
  } else if (openCloseMatch) {
    year = parseInt(openCloseMatch[6])
    if (year < 100) year += 2000
    const mn = parseInt(openCloseMatch[4])
    stmtMonth = monthNames[mn - 1] || "Unknown"
  }

  const txns: any[] = []
  let inPurchases = false
  let inFees = false
  let inInterest = false

  // Chase format from pdf-parse: "10/15     WINGSTOP 2592 GOLETA CA 10.86"
  // May have variable whitespace. Amount is always at end of line.
  const txRe = /^(\d{1,2})\/(\d{1,2})\s+(.+?)\s+([\d,]+\.\d{2})\s*$/

  for (const line of lines) {
    const t = line.trim()
    
    // Section detection — Chase uses these exact headers
    if (t === "PURCHASES" || t === "PURCHASE") { inPurchases = true; inFees = false; inInterest = false; continue }
    if (t === "FEES CHARGED") { inPurchases = false; inFees = true; inInterest = false; continue }
    if (t === "INTEREST CHARGED") { inPurchases = false; inFees = false; inInterest = true; continue }
    // Also catch variations
    if (/^PURCHASE\s*$/i.test(t) && !/INTEREST/i.test(t)) { inPurchases = true; inFees = false; inInterest = false; continue }
    if (/^FEES CHARGED\s*$/i.test(t)) { inPurchases = false; inFees = true; inInterest = false; continue }
    if (/^INTEREST CHARGED\s*$/i.test(t) && !/INTEREST CHARGES$/i.test(t)) { inPurchases = false; inFees = false; inInterest = true; continue }
    // Stop sections
    if (/^INTEREST CHARGES$/i.test(t)) { continue } // This is the summary header, not the section
    if (/^TOTAL /i.test(t) || /^Year-to-date/i.test(t)) { continue }
    if (/^ACCOUNT ACTIVITY/i.test(t) || /YOUR ACCOUNT MESSAGES/i.test(t)) { continue }

    const m = t.match(txRe)
    if (m && (inPurchases || inFees || inInterest)) {
      const mn = parseInt(m[1]), dy = parseInt(m[2])
      const desc = m[3].trim()
      const amount = parseFloat(m[4].replace(/,/g, ""))
      
      if (amount <= 0) continue
      // Skip totals lines
      if (/^TOTAL/i.test(desc)) continue

      let txType = "debit"
      // Payments/credits are negative in Chase statements
      if (desc.toLowerCase().includes("payment") && !desc.toLowerCase().includes("late")) txType = "credit"

      txns.push({
        date: `${year}-${String(mn).padStart(2, "0")}-${String(dy).padStart(2, "0")}`,
        description: desc,
        amount,
        type: txType,
        raw_line: t,
        source: inFees ? "fee" : inInterest ? "interest" : "purchase",
      })
    }
  }

  return {
    transactions: txns.filter(tx => tx.amount > 0),
    statementMonth: stmtMonth,
    statementYear: String(year),
  }
}

// ========================================
// Parse Barclays credit card statement text
// ========================================
function parseBarclaysText(text: string) {
  const lines = text.split("\n")

  // Extract statement period
  const periodMatch = text.match(/Statement Period\s+(\d{1,2})\/(\d{1,2})\/(\d{2,4})\s*-\s*(\d{1,2})\/(\d{1,2})\/(\d{2,4})/)
  let year = 2025
  let stmtMonth = "Unknown"
  const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"]

  if (periodMatch) {
    year = parseInt(periodMatch[6])
    if (year < 100) year += 2000
    const mn = parseInt(periodMatch[4])
    stmtMonth = monthNames[mn - 1] || "Unknown"
  }

  const txns: any[] = []
  let inPayments = false
  let inPurchases = false
  let inFees = false
  let inInterest = false

  // Barclays months
  const barclaysMonths: Record<string, string> = {
    Jan:"01",Feb:"02",Mar:"03",Apr:"04",May:"05",Jun:"06",
    Jul:"07",Aug:"08",Sep:"09",Oct:"10",Nov:"11",Dec:"12",
  }

  // Barclays format: Mon DD Mon DD DESCRIPTION POINTS $AMOUNT
  // e.g.: Dec 16 Dec 17 SQ *SWEET CREAMS SANTA BARBARA CA 42 $14.00
  const purchaseRe = /^(\w{3})\s+(\d{1,2})\s+(\w{3})\s+(\d{1,2})\s+(.+?)\s+(\d+)\s+\$?([\d,]+\.\d{2})\s*$/
  // Payment format: Mon DD Mon DD Payment Received WELLS FARGO B N/A -$175.00
  const paymentRe = /^(\w{3})\s+(\d{1,2})\s+(\w{3})\s+(\d{1,2})\s+(.+?)\s+N\/A\s+-?\$?([\d,]+\.\d{2})\s*$/
  // Fee/interest format: Mon DD Mon DD DESCRIPTION $AMOUNT
  const feeRe = /^(\w{3})\s+(\d{1,2})\s+(\w{3})\s+(\d{1,2})\s+(.+?)\s+\$?([\d,]+\.\d{2})\s*$/

  for (const line of lines) {
    const t = line.trim()

    // Section detection
    if (/^Payments$/i.test(t)) { inPayments = true; inPurchases = false; inFees = false; inInterest = false; continue }
    if (/^Purchase Activity/i.test(t)) { inPayments = false; inPurchases = true; inFees = false; inInterest = false; continue }
    if (/^Fees Charged$/i.test(t)) { inPayments = false; inPurchases = false; inFees = true; inInterest = false; continue }
    if (/^Interest Charged$/i.test(t)) { inPayments = false; inPurchases = false; inFees = false; inInterest = true; continue }
    if (/^Total /i.test(t) || /^No fees charged/i.test(t) || /^No Transaction Activity/i.test(t)) continue
    if (/Transaction Date/i.test(t) || /Posting Date/i.test(t)) continue

    // Try purchase pattern (has Points column)
    if (inPurchases) {
      const pm = t.match(purchaseRe)
      if (pm) {
        const txMon = barclaysMonths[pm[1]] || "01"
        const txDay = pm[2]
        const desc = pm[5].trim()
        const amount = parseFloat(pm[7].replace(/,/g, ""))
        if (amount > 0) {
          txns.push({
            date: `${year}-${txMon}-${String(parseInt(txDay)).padStart(2, "0")}`,
            description: desc, amount, type: "debit", raw_line: t, source: "purchase",
          })
        }
        continue
      }
    }

    // Try payment pattern
    if (inPayments) {
      const paym = t.match(paymentRe)
      if (paym) {
        const txMon = barclaysMonths[paym[1]] || "01"
        const txDay = paym[2]
        const desc = paym[5].trim()
        const amount = parseFloat(paym[6].replace(/,/g, ""))
        if (amount > 0) {
          txns.push({
            date: `${year}-${txMon}-${String(parseInt(txDay)).padStart(2, "0")}`,
            description: desc, amount, type: "credit", raw_line: t, source: "payment",
          })
        }
        continue
      }
    }

    // Try fee/interest pattern
    if (inFees || inInterest) {
      const fm = t.match(feeRe)
      if (fm) {
        const txMon = barclaysMonths[fm[1]] || "01"
        const txDay = fm[2]
        const desc = fm[5].trim()
        const amount = parseFloat(fm[6].replace(/,/g, ""))
        if (amount > 0 && !/^Total/i.test(desc)) {
          txns.push({
            date: `${year}-${txMon}-${String(parseInt(txDay)).padStart(2, "0")}`,
            description: desc, amount, type: "debit", raw_line: t,
            source: inFees ? "fee" : "interest",
          })
        }
      }
    }
  }

  return {
    transactions: txns.filter(tx => tx.amount > 0),
    statementMonth: stmtMonth,
    statementYear: String(year),
  }
}

// ========================================
// Parse Wells Fargo statement text into transactions
// ========================================
function parseWFText(text: string) {
  const lines = text.split("\n")

  // Extract year
  const yearMatch = text.match(/(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+(\d{4})/)
  const year = yearMatch ? parseInt(yearMatch[1]) : 2025

  // Extract statement month
  const MN: Record<string, string> = {
    January:"01",February:"02",March:"03",April:"04",May:"05",June:"06",
    July:"07",August:"08",September:"09",October:"10",November:"11",December:"12",
  }
  const monthMatch = text.match(/(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}/)
  const stmtMonth = monthMatch ? `${year}-${MN[monthMatch[1]] || "01"}` : `${year}-01`

  const creditKW = ["stripe transfer","zelle from","online transfer from","upwork escrow","purchase return","refund","overdraft protection from","instant pmt from"]
  const debitKW = ["purchase authorized","recurring payment","online transfer to","atm withdrawal","zelle to","overdraft fee","monthly service fee","chase credit crd","so cal edison","vz wireless","recurring transfer to","save as you go","united fin cas"]

  const txns: any[] = []
  let inSection = false
  let cur: any = null
  const txRe = /^(\d{1,2})\/(\d{1,2})\s+(.+)/

  for (const line of lines) {
    const t = line.trim()
    if (/transaction history/i.test(t) || /account activity/i.test(t) || /checking.*statement/i.test(t)) { inSection = true; continue }
    if (/^Totals|Monthly service fee summary|Account transaction fees/i.test(t)) {
      if (cur) { txns.push(cur); cur = null }
      inSection = false; continue
    }
    if (!inSection || t.length < 3) continue
    if (/^Date\b.*(?:Number|Description)/i.test(t)) continue
    if (/Ending daily.*balance/i.test(t)) continue

    const m = t.match(txRe)
    if (m) {
      if (cur) txns.push(cur)
      const mn = parseInt(m[1]), dy = parseInt(m[2]), rest = m[3]
      const amts = rest.match(/[\d,]+\.\d{2}/g) || []
      const desc = rest.replace(/\s+[\d,]+\.\d{2}/g,"").replace(/\s*-[\d,]+\.\d{2}/g,"").trim()
      const amount = amts.length ? parseFloat(amts[0].replace(/,/g,"")) : 0
      const dl = desc.toLowerCase()
      const isCr = creditKW.some(k => dl.includes(k))
      const isDr = debitKW.some(k => dl.includes(k))
      cur = {
        date: `${year}-${String(mn).padStart(2,"0")}-${String(dy).padStart(2,"0")}`,
        description: desc, amount, type: isCr && !isDr ? "credit" : "debit", raw_line: t,
      }
    } else if (cur) {
      let extra = t.replace(/\s*-?[\d,]+\.\d{2}\s*/g,"").replace(/S\d{15,}/g,"").replace(/P\d{15,}/g,"").replace(/Card \d{4}$/,"").trim()
      if (extra && !/^\d+$/.test(extra)) cur.description += " " + extra
      if (cur.amount === 0) { const a = t.match(/[\d,]+\.\d{2}/); if (a) cur.amount = parseFloat(a[0].replace(/,/g,"")) }
    }
  }
  if (cur) txns.push(cur)

  // FALLBACK: If section-based parsing found nothing, try parsing entire document
  if (txns.length === 0) {
    console.log("[wf] Section-based parsing found 0 txns, trying full-document fallback")
    let fallbackCur: any = null
    for (const line of lines) {
      const t = line.trim()
      if (t.length < 5) continue
      const m = t.match(txRe)
      if (m) {
        if (fallbackCur) txns.push(fallbackCur)
        const mn = parseInt(m[1]), dy = parseInt(m[2]), rest = m[3]
        const amts = rest.match(/[\d,]+\.\d{2}/g) || []
        const desc = rest.replace(/\s+[\d,]+\.\d{2}/g,"").replace(/\s*-[\d,]+\.\d{2}/g,"").trim()
        const amount = amts.length ? parseFloat(amts[0].replace(/,/g,"")) : 0
        const dl = desc.toLowerCase()
        const isCr = creditKW.some(k => dl.includes(k))
        if (amount > 0 && desc.length > 2 && !/^Date\b/i.test(desc) && !/^Ending/i.test(desc)) {
          fallbackCur = {
            date: `${year}-${String(mn).padStart(2,"0")}-${String(dy).padStart(2,"0")}`,
            description: desc, amount, type: isCr ? "credit" : "debit", raw_line: t,
          }
        } else { fallbackCur = null }
      } else if (fallbackCur) {
        let extra = t.replace(/\s*-?[\d,]+\.\d{2}\s*/g,"").replace(/[SP]\d{15,}/g,"").replace(/Card \d{4}$/,"").trim()
        if (extra && !/^\d+$/.test(extra) && extra.length < 100) fallbackCur.description += " " + extra
      }
    }
    if (fallbackCur) txns.push(fallbackCur)
    console.log(`[wf] Fallback found ${txns.length} transactions`)
  }

  const monthNum = parseInt(stmtMonth.split("-")[1] || "1")
  const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"]

  return {
    transactions: txns.filter(tx => tx.amount > 0).map(tx => ({ ...tx, description: tx.description.replace(/\s+/g," ").trim() })),
    statementMonth: monthNames[monthNum - 1] || "Unknown",
    statementYear: String(year),
  }
}

// ========================================
// Parse CSV text into transactions
// ========================================
function parseCSVText(csvText: string) {
  const lines = csvText.split("\n").filter(l => l.trim())
  const txns: any[] = []
  for (const line of lines) {
    if (/Transaction History|^Date|Check Number|Totals|Monthly service/i.test(line)) continue
    const parts = line.split(/\t|,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map(p => p.trim().replace(/^"|"$/g,""))
    if (parts.length < 2 || !/\d{1,2}\/\d{1,2}/.test(parts[0])) continue
    const deposits = parseFloat((parts[2]||"0").replace(/,/g,"")) || 0
    const withdrawals = parseFloat((parts[3]||"0").replace(/,/g,"")) || 0
    if (deposits === 0 && withdrawals === 0) continue
    const isIncome = deposits > 0
    const [mo, da] = parts[0].split("/")
    txns.push({
      date: `2025-${(mo||"01").padStart(2,"0")}-${(da||"01").padStart(2,"0")}`,
      description: (parts[1]||"").substring(0,200),
      amount: Math.abs(isIncome ? deposits : withdrawals),
      type: isIncome ? "credit" : "debit",
      raw_line: line,
    })
  }
  return { transactions: txns, statementMonth: "Multiple", statementYear: "2025" }
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
    const formData = await request.formData()
    const file = formData.get("file") as File
    const accountName = formData.get("accountName") as string
    const accountType = formData.get("accountType") as string

    if (!file || !accountName || !accountType) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    console.log("[upload] Processing:", file.name, "Size:", file.size, "Account:", accountName)

    let parsed: { transactions: any[]; statementMonth: string; statementYear: string }

    // === PDF ===
    if (file.name.toLowerCase().endsWith(".pdf") || file.type === "application/pdf") {
      const arrayBuffer = await file.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)

      console.log("[upload] Extracting text from PDF, buffer size:", buffer.length)

      let pdfText: string
      try {
        pdfText = await extractPDFText(buffer)
      } catch (e: any) {
        console.error("[upload] PDF extraction failed:", e.message)
        return NextResponse.json({ error: e.message, success: false }, { status: 500 })
      }

      console.log("[upload] PDF text length:", pdfText.length)

      if (pdfText.length < 100) {
        return NextResponse.json({
          error: "PDF appears empty or scanned. Download a digital PDF from your bank's online banking.",
          success: false,
        }, { status: 400 })
      }

      // Auto-detect statement type first
      const stmtType = detectStatementType(pdfText)
      console.log(`[upload] Auto-detected: ${stmtType}`)

      if (stmtType === "chase") {
        parsed = parseChaseText(pdfText)
        console.log(`[upload] Chase: ${parsed.transactions.length} txns for ${parsed.statementMonth} ${parsed.statementYear}`)
      } else if (stmtType === "barclays") {
        parsed = parseBarclaysText(pdfText)
        console.log(`[upload] Barclays: ${parsed.transactions.length} txns for ${parsed.statementMonth} ${parsed.statementYear}`)
      } else {
        // Default to Wells Fargo
        parsed = parseWFText(pdfText)
        console.log(`[upload] WF: ${parsed.transactions.length} txns for ${parsed.statementMonth} ${parsed.statementYear}`)

        // If Wells Fargo found nothing, try Chase and Barclays as fallback
        if (parsed.transactions.length === 0) {
          const chaseParsed = parseChaseText(pdfText)
          const barclaysParsed = parseBarclaysText(pdfText)
          if (chaseParsed.transactions.length > barclaysParsed.transactions.length) {
            parsed = chaseParsed
            console.log(`[upload] Fallback Chase: ${parsed.transactions.length} txns`)
          } else if (barclaysParsed.transactions.length > 0) {
            parsed = barclaysParsed
            console.log(`[upload] Fallback Barclays: ${parsed.transactions.length} txns`)
          }
        }
      }
    }
    // === CSV ===
    else if (file.name.toLowerCase().endsWith(".csv") || file.type === "text/csv") {
      const csvText = await file.text()
      parsed = parseCSVText(csvText)
      console.log(`[upload] CSV parsed: ${parsed.transactions.length} txns`)
    }
    // === UNSUPPORTED ===
    else {
      return NextResponse.json({ error: "Unsupported file type. Use PDF or CSV." }, { status: 400 })
    }

    if (parsed.transactions.length === 0) {
      return NextResponse.json({
        error: `No transactions found in ${file.name}. Supports Wells Fargo, Chase Freedom, and Barclays View statements.`,
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
      message: `Processed ${transactions.length} transactions from ${file.name}`,
    })

  } catch (error: any) {
    console.error("[upload] Unhandled error:", error.message, error.stack)
    return NextResponse.json({ error: error.message || "Upload failed", success: false }, { status: 500 })
  }
}
