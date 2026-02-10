import { NextResponse } from "next/server"
import { Buffer } from "buffer"
import { parseWellsFargoStatement } from "@/lib/parsers/wellsfargo-pdf"
import { parseCSVStatement } from "@/lib/parsers/csv-parser"
import { categorizeByRules } from "@/lib/categorization/rules-engine"

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

    let parsedTransactions: any[] = []
    let statementMonth = ""
    let statementYear = ""

    // === PDF PARSING ===
    if (file.name.endsWith(".pdf") || file.type === "application/pdf") {
      const arrayBuffer = await file.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)

      const pdfParse = (await import("pdf-parse")).default
      const pdfData = await pdfParse(buffer)

      console.log("[parse] PDF text length:", pdfData.text.length)

      const result = parseWellsFargoStatement(pdfData.text)
      parsedTransactions = result.transactions

      if (result.statementMonth) {
        const parts = result.statementMonth.split("-")
        statementYear = parts[0] || "2025"
        const monthNum = parseInt(parts[1] || "1")
        const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"]
        statementMonth = monthNames[monthNum - 1] || "Unknown"
      }

      console.log(`[parse] WF PDF: ${parsedTransactions.length} transactions for ${statementMonth} ${statementYear}`)
    }
    // === CSV PARSING ===
    else if (file.name.endsWith(".csv") || file.type === "text/csv") {
      const csvText = await file.text()
      const result = parseCSVStatement(csvText)
      parsedTransactions = result.transactions
      statementMonth = "Multiple"
      statementYear = "2025"

      console.log(`[parse] CSV: ${parsedTransactions.length} transactions`)
    } else {
      return NextResponse.json({ error: "Unsupported file type. Use PDF or CSV." }, { status: 400 })
    }

    // === CATEGORIZE with rule engine ===
    const categorized = categorizeByRules(parsedTransactions)

    // Category ID -> human-readable name map
    const categoryMap: Record<string, { name: string; isPersonal: boolean; isTransfer: boolean }> = {
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

    // Convert to the format the existing UI expects
    const transactions = categorized.map((tx) => {
      const catInfo = tx.category_id ? categoryMap[tx.category_id] : null
      const categoryName = catInfo?.name || "Uncategorized Expense"
      const isIncome = tx.type === "credit"

      // Extract a clean merchant name from description
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
      month: statementMonth,
      year: statementYear,
      success: true,
    })

  } catch (error: any) {
    console.error("[parse] Error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to parse statement" },
      { status: 500 }
    )
  }
}
