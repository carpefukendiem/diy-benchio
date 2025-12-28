import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File
    const accountName = formData.get("accountName") as string
    const accountType = formData.get("accountType") as string
    const month = formData.get("month") as string
    const year = formData.get("year") as string

    if (!file || !accountName || !accountType) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    console.log("[v0] Processing statement upload:", {
      fileName: file.name,
      accountName,
      accountType,
      fileSize: file.size,
      fileType: file.type,
    })

    const parseFormData = new FormData()
    parseFormData.append("file", file)
    parseFormData.append("accountType", accountType)
    parseFormData.append("accountName", accountName)
    if (month) parseFormData.append("month", month)
    if (year) parseFormData.append("year", year)

    const parseResponse = await fetch(new URL("/api/statements/parse", request.url).toString(), {
      method: "POST",
      body: parseFormData,
    })

    if (!parseResponse.ok) {
      const errorData = await parseResponse.json()
      console.error("[v0] Parse API error:", errorData)
      throw new Error(errorData.error || "Failed to parse statement file")
    }

    const { transactions: parsedTransactions } = await parseResponse.json()

    const transactions = parsedTransactions.map((t: any, index: number) => ({
      ...t,
      id: `${accountName}-${Date.now()}-${index}`,
      account: accountName,
    }))

    console.log(`[v0] Successfully parsed ${transactions.length} transactions from ${file.name}`)

    return NextResponse.json({
      success: true,
      transactions,
      message: `Successfully processed ${transactions.length} transactions`,
    })
  } catch (error: any) {
    console.error("[v0] Error uploading statement:", error)
    return NextResponse.json(
      {
        error: error.message || "Failed to process statement file",
        success: false,
      },
      { status: 500 },
    )
  }
}
