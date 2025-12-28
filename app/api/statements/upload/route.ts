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

    const parseFormData = new FormData()
    parseFormData.append("file", file)
    parseFormData.append("accountType", accountType)
    parseFormData.append("accountName", accountName)

    const parseResponse = await fetch(new URL("/api/statements/parse", request.url).toString(), {
      method: "POST",
      body: parseFormData,
    })

    if (!parseResponse.ok) {
      throw new Error("Failed to parse statement file")
    }

    const { transactions: parsedTransactions } = await parseResponse.json()

    // Add IDs and account info to transactions
    const transactions = parsedTransactions.map((t: any, index: number) => ({
      ...t,
      id: `${accountName}-${year}-${month}-${index}`,
      account: accountName,
    }))

    console.log(`[v0] AI parsed ${transactions.length} transactions from ${file.name}`)

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
