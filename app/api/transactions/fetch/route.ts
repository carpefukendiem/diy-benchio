import { NextResponse } from "next/server"

export async function GET() {
  try {
    // Return empty array initially - transactions will be populated when accounts are connected
    return NextResponse.json({
      transactions: [],
    })
  } catch (error) {
    console.error("Error fetching transactions:", error)
    return NextResponse.json({ error: "Failed to fetch transactions" }, { status: 500 })
  }
}
