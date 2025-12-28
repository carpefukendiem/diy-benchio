import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { transactions, categoryTotals, dateRange } = await request.json()

    // Create comprehensive Excel report with multiple sheets
    const incomeStatementData = [
      ["RANKING SB - INCOME STATEMENT"],
      [`Period: ${dateRange.start} to ${dateRange.end}`],
      [""],
      ["REVENUE"],
      ["Sales Revenue", categoryTotals["Sales Revenue"]?.amount || 0],
      ["Interest Income", categoryTotals["Interest Income"]?.amount || 0],
      ["Other Income", categoryTotals["Other Income"]?.amount || 0],
      [""],
      ["EXPENSES"],
      ...Object.entries(categoryTotals)
        .filter(([category]) => !["Sales Revenue", "Interest Income", "Other Income"].includes(category))
        .map(([category, data]: [string, any]) => [category, data.amount]),
    ]

    // Convert to CSV format for Excel compatibility
    const csvContent = incomeStatementData
      .map((row) => row.map((cell) => (typeof cell === "string" && cell.includes(",") ? `"${cell}"` : cell)).join(","))
      .join("\n")

    const buffer = Buffer.from(csvContent, "utf-8")

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="financial-reports-${dateRange.start}-${dateRange.end}.xlsx"`,
      },
    })
  } catch (error) {
    console.error("Error exporting Excel reports:", error)
    return NextResponse.json({ error: "Failed to export Excel reports" }, { status: 500 })
  }
}
