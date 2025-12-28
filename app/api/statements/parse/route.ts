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
    } else if (file.name.endsWith(".pdf") || file.type === "application/pdf") {
      const arrayBuffer = await file.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      pdfBase64 = buffer.toString("base64")

      console.log("[v0] PDF file size:", buffer.length, "bytes, converted to base64")
    } else {
      return NextResponse.json({ error: "Unsupported file type. Please upload CSV or PDF" }, { status: 400 })
    }

    const systemPrompt = `You are parsing a Wells Fargo ${accountType} statement for ${accountName}.

CRITICAL INSTRUCTIONS FOR WELLS FARGO STATEMENTS:
1. Look for the "Transaction history" or "Account activity" section
2. Each transaction has: Date, Description/Merchant, Withdrawals/Debits, Deposits/Credits
3. Parse the transaction table and extract EVERY transaction
4. For checking accounts categorize as follows:
   - Stripe transfers = "Sales Revenue" (income: true)
   - Recurring software (GoHighLevel, Google, Mailgun, etc.) = "Software & Web Hosting Expense" (income: false)
   - Restaurant/food = "Business Meals Expense" (income: false)
   - Gas stations = "Gas & Auto Expense" (income: false)
   - Verizon/Cox/phone = "Phone & Internet Expense" (income: false)
   - Insurance = "Insurance Expense - Business" (income: false)
   - Owner transfers/draws = "Member Drawing - Ruben Ruiz" (income: false)
   - ATM fees, monthly fees = "Bank & ATM Fee Expense" (income: false)

5. Convert dates to YYYY-MM-DD format (if date is 01/15/2025, convert to 2025-01-15)
6. Remove $ signs and commas from amounts - just return the number
7. All amounts should be positive numbers (no negative signs)
8. Clean merchant names (remove extra numbers, store locations)

Return ONLY a valid JSON array with this exact structure:
[
  {
    "date": "YYYY-MM-DD",
    "description": "Transaction description",
    "amount": 123.45,
    "category": "Category name",
    "isIncome": true or false,
    "merchantName": "Clean merchant name"
  }
]

Do not include any explanation, only the JSON array.`

    if (pdfBase64) {
      const { text } = await generateText({
        model: "openai/gpt-4o",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: systemPrompt },
              {
                type: "image",
                image: `data:application/pdf;base64,${pdfBase64}`,
              },
            ],
          },
        ],
      })

      console.log("[v0] Raw AI response:", text.substring(0, 500))

      // Parse the JSON response
      const jsonMatch = text.match(/\[[\s\S]*\]/)
      if (!jsonMatch) {
        throw new Error("No JSON array found in response")
      }

      const transactions = JSON.parse(jsonMatch[0])
      console.log("[v0] Successfully parsed", transactions.length, "transactions from PDF")
      console.log("[v0] Sample transactions:", JSON.stringify(transactions.slice(0, 3), null, 2))

      return NextResponse.json({
        transactions,
        success: true,
      })
    } else {
      const { text } = await generateText({
        model: "openai/gpt-4o",
        prompt: `${systemPrompt}

CSV Content:
${fileContent}`,
      })

      console.log("[v0] Raw AI response:", text.substring(0, 500))

      // Parse the JSON response
      const jsonMatch = text.match(/\[[\s\S]*\]/)
      if (!jsonMatch) {
        throw new Error("No JSON array found in response")
      }

      const transactions = JSON.parse(jsonMatch[0])
      console.log("[v0] Successfully parsed", transactions.length, "transactions from CSV")

      return NextResponse.json({
        transactions,
        success: true,
      })
    }
  } catch (error: any) {
    console.error("[v0] Error parsing statement:", error)
    return NextResponse.json({ error: error.message || "Failed to parse statement" }, { status: 500 })
  }
}
