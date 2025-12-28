import { NextResponse } from "next/server"
import { generateText } from "ai"
import { Buffer } from "buffer"

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File
    const accountType = formData.get("accountType") as string
    const accountName = formData.get("accountName") as string

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    console.log("[v0] Parsing statement file:", file.name, "Type:", file.type, "Size:", file.size)

    let fileContent = ""
    let pdfBase64 = ""

    if (file.name.endsWith(".csv") || file.type === "text/csv") {
      fileContent = await file.text()
      console.log("[v0] CSV content preview:", fileContent.substring(0, 500))

      // Try direct parsing first for Wells Fargo format
      try {
        const lines = fileContent.split("\n").filter((line) => line.trim())
        const transactions = []

        for (const line of lines) {
          // Skip header lines and summary lines
          if (
            line.includes("Transaction History") ||
            line.includes("Date") ||
            line.includes("Check Number") ||
            line.includes("Totals") ||
            line.includes("Monthly service fee") ||
            line.includes("Account transaction fees") ||
            line.trim().length === 0
          ) {
            continue
          }

          // Parse Wells Fargo CSV format: Date | Description | Deposits | Withdrawals | Balance
          const parts = line.split("\t").map((p) => p.trim().replace(/"/g, ""))

          if (parts.length >= 2) {
            const dateStr = parts[0]
            const description = parts[1]
            const deposits = parts[2] ? Number.parseFloat(parts[2].replace(/,/g, "")) : 0
            const withdrawals = parts[3] ? Number.parseFloat(parts[3].replace(/,/g, "")) : 0

            // Skip if no amount
            if (deposits === 0 && withdrawals === 0) continue

            const isIncome = deposits > 0
            const amount = isIncome ? deposits : withdrawals

            // Parse date (M/D format from CSV)
            let date = ""
            if (dateStr.includes("/")) {
              const [month, day] = dateStr.split("/")
              // Assume 2025 for now - can be improved
              date = `2025-${month.padStart(2, "0")}-${day.padStart(2, "0")}`
            }

            // Categorize based on description
            let category = "Uncategorized Expense"
            let merchantName = description

            if (description.includes("Stripe Transfer")) {
              category = "Sales Revenue"
              merchantName = "Stripe"
            } else if (description.includes("Highlevel") || description.includes("Gohighlevel")) {
              category = "Software & Web Hosting Expense"
              merchantName = "GoHighLevel"
            } else if (description.includes("Google")) {
              category = "Software & Web Hosting Expense"
              merchantName = "Google Workspace"
            } else if (description.includes("Mailgun")) {
              category = "Software & Web Hosting Expense"
              merchantName = "Mailgun"
            } else if (description.includes("Godaddy")) {
              category = "Software & Web Hosting Expense"
              merchantName = "GoDaddy"
            } else if (description.includes("Loom")) {
              category = "Software & Web Hosting Expense"
              merchantName = "Loom"
            } else if (description.includes("Bench Accounting")) {
              category = "Professional Service Expense"
              merchantName = "Bench Accounting"
            } else if (description.includes("Verizon") || description.includes("Vz Wireless")) {
              category = "Phone & Internet Expense"
              merchantName = "Verizon"
            } else if (description.includes("Cox Comm")) {
              category = "Phone & Internet Expense"
              merchantName = "Cox Communications"
            } else if (
              description.includes("Fuel") ||
              description.includes("Holister Fuel") ||
              description.includes("Fairview Fuel")
            ) {
              category = "Gas & Auto Expense"
              merchantName = description.includes("Holister") ? "Holister Fuel" : "Fairview Fuel"
            } else if (description.includes("Insurance") || description.includes("United Fin Cas")) {
              category = "Insurance Expense - Business"
              merchantName = "Business Insurance"
            } else if (
              description.includes("Chipotle") ||
              description.includes("IN-N-Out") ||
              description.includes("Starbucks") ||
              description.includes("Pressed Juicery") ||
              description.includes("Cajun Kitchen") ||
              description.includes("Dart Coffee") ||
              description.includes("Mony's") ||
              description.includes("Finney's")
            ) {
              category = "Business Meals Expense"
              // Extract merchant name from description
              if (description.includes("Chipotle")) merchantName = "Chipotle"
              else if (description.includes("IN-N-Out")) merchantName = "In-N-Out Burger"
              else if (description.includes("Starbucks")) merchantName = "Starbucks"
              else if (description.includes("Pressed Juicery")) merchantName = "Pressed Juicery"
              else if (description.includes("Cajun Kitchen")) merchantName = "Cajun Kitchen"
              else if (description.includes("Dart Coffee")) merchantName = "Dart Coffee"
              else if (description.includes("Mony's")) merchantName = "Mony's"
              else if (description.includes("Finney's")) merchantName = "Finney's"
            } else if (
              description.includes("Transfer to Ruiz") ||
              description.includes("Zelle to Ruiz") ||
              description.includes("Owner Draw")
            ) {
              category = "Member Drawing - Ruben Ruiz"
              merchantName = "Owner Draw"
            } else if (description.includes("Transfer From Ruiz") || description.includes("Zelle From")) {
              category = "Member Contribution - Ruben Ruiz"
              merchantName = "Owner Contribution"
            } else if (
              description.includes("Monthly Service Fee") ||
              description.includes("Overdraft Fee") ||
              description.includes("ATM")
            ) {
              category = "Bank & ATM Fee Expense"
              merchantName = "Wells Fargo Fees"
            } else if (description.includes("Marborg")) {
              category = "Utilities Expense"
              merchantName = "Marborg Disposal"
            } else if (description.includes("Home Depot") || description.includes("Chase Credit")) {
              category = "Member Drawing - Ruben Ruiz"
              merchantName = "Personal Payment"
            } else if (isIncome) {
              category = "Other Income"
            }

            if (date && amount > 0) {
              transactions.push({
                date,
                description: description.substring(0, 200), // Limit description length
                amount: Math.abs(amount),
                category,
                isIncome,
                merchantName: merchantName.substring(0, 100),
              })
            }
          }
        }

        if (transactions.length > 0) {
          console.log("[v0] Successfully parsed", transactions.length, "transactions using direct CSV parsing")
          console.log("[v0] Sample transactions:", JSON.stringify(transactions.slice(0, 3), null, 2))
          return NextResponse.json({
            transactions,
            success: true,
          })
        }
      } catch (parseError) {
        console.log("[v0] Direct CSV parsing failed, falling back to AI:", parseError)
      }

      const { text } = await generateText({
        model: "openai/gpt-4o",
        prompt: `You are parsing a Wells Fargo ${accountType} statement for ${accountName}.

Parse this CSV and extract ALL transactions. Each line has: Date | Description | Deposits/Credits | Withdrawals/Debits | Balance

Categorize transactions:
- Stripe transfers = "Sales Revenue" (income: true)
- Software (GoHighLevel, Google, Mailgun, GoDaddy, Loom) = "Software & Web Hosting Expense"
- Food/restaurants = "Business Meals Expense"
- Gas stations = "Gas & Auto Expense"
- Verizon/Cox = "Phone & Internet Expense"
- Insurance = "Insurance Expense - Business"
- Owner draws/Zelle to Ruiz = "Member Drawing - Ruben Ruiz"
- Owner contributions/Zelle from = "Member Contribution - Ruben Ruiz"
- Bank fees = "Bank & ATM Fee Expense"

Return ONLY a JSON array:
[{"date":"YYYY-MM-DD","description":"...","amount":123.45,"category":"...","isIncome":true/false,"merchantName":"..."}]

CSV:
${fileContent}`,
      })

      const jsonMatch = text.match(/\[[\s\S]*\]/)
      if (!jsonMatch) {
        throw new Error("No JSON array found in AI response")
      }

      const transactions = JSON.parse(jsonMatch[0])
      console.log("[v0] Successfully parsed", transactions.length, "transactions using AI")

      return NextResponse.json({
        transactions,
        success: true,
      })
    }

    if (file.name.endsWith(".pdf") || file.type === "application/pdf") {
      const arrayBuffer = await file.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      pdfBase64 = buffer.toString("base64")

      console.log("[v0] PDF file size:", buffer.length, "bytes")

      const { text } = await generateText({
        model: "openai/gpt-4o",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Parse this Wells Fargo ${accountType} statement. Extract ALL transactions with date, description, amount, and categorize them. Return as JSON array: [{"date":"YYYY-MM-DD","description":"...","amount":123.45,"category":"...","isIncome":true/false,"merchantName":"..."}]`,
              },
              {
                type: "image",
                image: `data:application/pdf;base64,${pdfBase64}`,
              },
            ],
          },
        ],
      })

      const jsonMatch = text.match(/\[[\s\S]*\]/)
      if (!jsonMatch) {
        throw new Error("No JSON array found in PDF parse response")
      }

      const transactions = JSON.parse(jsonMatch[0])
      console.log("[v0] Successfully parsed", transactions.length, "transactions from PDF")

      return NextResponse.json({
        transactions,
        success: true,
      })
    }

    return NextResponse.json({ error: "Unsupported file type" }, { status: 400 })
  } catch (error: any) {
    console.error("[v0] Error parsing statement:", error)
    return NextResponse.json({ error: error.message || "Failed to parse statement" }, { status: 500 })
  }
}
