import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { transactions } = await request.json()

    // In production, you would use a library like ExcelJS to create actual Excel files
    // For now, we'll create a CSV that Excel can open

    const headers = ["Date", "Description", "Merchant", "Amount", "Category", "Account", "Type", "Transaction ID"]

    const csvContent = [
      headers.join(","),
      ...transactions.map((t: any) =>
        [
          t.date,
          `"${t.description}"`,
          `"${t.merchantName || ""}"`,
          t.amount,
          `"${t.category}"`,
          `"${t.account}"`,
          t.isIncome ? "Income" : "Expense",
          t.id,
        ].join(","),
      ),
    ].join("\n")

    const buffer = Buffer.from(csvContent, "utf-8")

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="transactions-${new Date().toISOString().split("T")[0]}.xlsx"`,
      },
    })
  } catch (error) {
    console.error("Error exporting to Excel:", error)
    return NextResponse.json({ error: "Failed to export to Excel" }, { status: 500 })
  }
}
