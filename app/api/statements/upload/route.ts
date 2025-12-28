import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File
    const accountName = formData.get("accountName") as string
    const accountType = formData.get("accountType") as string
    const month = formData.get("month") as string
    const year = formData.get("year") as string

    if (!file || !accountName || !month || !year) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    console.log("[v0] Processing statement upload:", {
      fileName: file.name,
      accountName,
      accountType,
      month,
      year,
      fileSize: file.size,
      fileType: file.type,
    })

    // Parse the file content
    const fileContent = await file.text()
    const transactions = await parseStatementFile(file.name, fileContent, accountName)

    console.log(`[v0] Parsed ${transactions.length} transactions from ${file.name}`)

    return NextResponse.json({
      success: true,
      transactions,
      message: `Successfully processed ${transactions.length} transactions`,
    })
  } catch (error) {
    console.error("[v0] Error uploading statement:", error)
    return NextResponse.json({ error: "Failed to process statement file" }, { status: 500 })
  }
}

async function parseStatementFile(fileName: string, content: string, accountName: string) {
  const transactions: any[] = []

  // Detect file type
  const isCSV = fileName.toLowerCase().endsWith(".csv")

  if (isCSV) {
    // Parse CSV
    const lines = content.split("\n").filter((line) => line.trim())

    // Skip header row
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i]
      const columns = line.split(",").map((col) => col.replace(/^"|"$/g, "").trim())

      if (columns.length >= 3) {
        // Assuming format: Date, Description, Amount
        const date = columns[0]
        const description = columns[1]
        const amount = Number.parseFloat(columns[2]?.replace(/[^0-9.-]/g, "") || "0")

        if (date && description && !isNaN(amount)) {
          transactions.push({
            id: `${accountName}-${date}-${Math.random()}`,
            date,
            description,
            amount: Math.abs(amount),
            category: "Uncategorized",
            account: accountName,
            isIncome: amount > 0,
            pending: false,
          })
        }
      }
    }
  } else {
    // For PDF files, return empty array for now
    // In production, you'd use a PDF parsing library like pdf-parse
    console.log("[v0] PDF parsing not yet implemented, returning empty transactions")
  }

  return transactions
}
