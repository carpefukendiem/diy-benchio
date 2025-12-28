import { type NextRequest, NextResponse } from "next/server"
import { Configuration, PlaidApi, PlaidEnvironments } from "plaid"

export async function POST(request: NextRequest) {
  try {
    const { access_token, start_date, end_date } = await request.json()

    if (!access_token) {
      return NextResponse.json({ error: "Access token is required" }, { status: 400 })
    }

    const clientId = process.env.PLAID_CLIENT_ID
    const secret = process.env.PLAID_SECRET

    if (!clientId || !secret) {
      return NextResponse.json(
        {
          error: "Plaid not configured",
          details: "PLAID_CLIENT_ID and PLAID_SECRET environment variables are required",
        },
        { status: 500 },
      )
    }

    const configuration = new Configuration({
      basePath: PlaidEnvironments.sandbox,
      baseOptions: {
        headers: {
          "PLAID-CLIENT-ID": clientId,
          "PLAID-SECRET": secret,
        },
      },
    })

    const client = new PlaidApi(configuration)

    const response = await client.transactionsGet({
      access_token,
      start_date: start_date || "2025-01-01",
      end_date: end_date || new Date().toISOString().split("T")[0],
    })

    console.log("[v0] Retrieved", response.data.transactions.length, "transactions")

    return NextResponse.json({
      transactions: response.data.transactions,
      accounts: response.data.accounts,
      total_transactions: response.data.total_transactions,
    })
  } catch (error) {
    console.error("[v0] Error fetching transactions:", error)
    return NextResponse.json(
      {
        error: "Failed to fetch transactions",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
